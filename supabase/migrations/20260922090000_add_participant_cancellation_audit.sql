-- Participant cancellation is a reversible soft status change. Related rows
-- remain immutable so billing, delivery, travel, room, pickup, attendance, and
-- idempotency history remain available for audit.

ALTER TABLE public.participants
  ADD COLUMN cancelled_at timestamptz,
  ADD COLUMN cancelled_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  ADD COLUMN cancellation_reason text;

ALTER TABLE public.participants
  ADD CONSTRAINT participants_cancellation_metadata_consistent
  CHECK (
    (
      registration_status = 'CANCELLED'::public.registration_status
      AND cancelled_at IS NOT NULL
      AND cancelled_by IS NOT NULL
      AND char_length(btrim(coalesce(cancellation_reason, ''))) BETWEEN 1 AND 500
    )
    OR (
      registration_status = 'REGISTERED'::public.registration_status
      AND cancelled_at IS NULL
      AND cancelled_by IS NULL
      AND cancellation_reason IS NULL
    )
  ) NOT VALID;

CREATE INDEX participants_cancelled_at_idx
ON public.participants (cancelled_at DESC)
WHERE registration_status = 'CANCELLED'::public.registration_status;

CREATE TABLE public.participant_registration_status_changes (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  participant_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE RESTRICT,
  previous_status public.registration_status NOT NULL,
  new_status public.registration_status NOT NULL,
  cancellation_reason text,
  changed_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  changed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT participant_registration_status_changes_status_changed
    CHECK (previous_status <> new_status),
  CONSTRAINT participant_registration_status_changes_reason_valid
    CHECK (
      new_status <> 'CANCELLED'::public.registration_status
      OR char_length(btrim(coalesce(cancellation_reason, ''))) BETWEEN 1 AND 500
    )
);

CREATE INDEX participant_registration_status_changes_participant_changed_at_idx
ON public.participant_registration_status_changes (participant_id, changed_at DESC);

ALTER TABLE public.participant_registration_status_changes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.participant_registration_status_changes
FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.participant_registration_status_changes TO service_role;

CREATE OR REPLACE FUNCTION public.set_participant_registration_status(
  p_registration_id text,
  p_target_status public.registration_status,
  p_changed_by uuid,
  p_cancellation_reason text DEFAULT NULL
)
RETURNS TABLE (result_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_participant public.participants%ROWTYPE;
  v_reason text := NULLIF(btrim(coalesce(p_cancellation_reason, '')), '');
  v_actor_is_admin boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS profile
    WHERE profile.id = p_changed_by
      AND profile.is_active = true
      AND profile.role IN (
        'ADMIN'::public.user_role,
        'SUPER_ADMIN'::public.user_role
      )
  )
  INTO v_actor_is_admin;

  IF NOT v_actor_is_admin THEN
    RETURN QUERY SELECT 'UNAUTHORIZED_ACTOR'::text;
    RETURN;
  END IF;

  IF p_registration_id IS NULL OR btrim(p_registration_id) !~ '^AKKAI26-[0-9]{6}$'
     OR p_target_status IS NULL THEN
    RETURN QUERY SELECT 'INVALID_INPUT'::text;
    RETURN;
  END IF;

  IF p_target_status = 'CANCELLED'::public.registration_status
     AND (v_reason IS NULL OR char_length(v_reason) > 500) THEN
    RETURN QUERY SELECT 'INVALID_REASON'::text;
    RETURN;
  END IF;

  SELECT participant.*
  INTO v_participant
  FROM public.participants AS participant
  WHERE participant.registration_id = btrim(p_registration_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'NOT_FOUND'::text;
    RETURN;
  END IF;

  IF v_participant.registration_status = p_target_status THEN
    RETURN QUERY SELECT CASE
      WHEN p_target_status = 'CANCELLED'::public.registration_status
        THEN 'ALREADY_CANCELLED'::text
      ELSE 'ALREADY_REGISTERED'::text
    END;
    RETURN;
  END IF;

  IF p_target_status = 'CANCELLED'::public.registration_status THEN
    UPDATE public.participants
    SET registration_status = 'CANCELLED'::public.registration_status,
        cancelled_at = now(),
        cancelled_by = p_changed_by,
        cancellation_reason = v_reason
    WHERE id = v_participant.id;
  ELSE
    UPDATE public.participants
    SET registration_status = 'REGISTERED'::public.registration_status,
        cancelled_at = NULL,
        cancelled_by = NULL,
        cancellation_reason = NULL
    WHERE id = v_participant.id;
  END IF;

  INSERT INTO public.participant_registration_status_changes (
    participant_id,
    previous_status,
    new_status,
    cancellation_reason,
    changed_by
  )
  VALUES (
    v_participant.id,
    v_participant.registration_status,
    p_target_status,
    v_reason,
    p_changed_by
  );

  RETURN QUERY SELECT 'UPDATED'::text;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_participant_registration_status(text, public.registration_status, uuid, text)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_participant_registration_status(text, public.registration_status, uuid, text)
TO service_role;
