-- Add OPERATIONAL to cancellation access. Restoration remains exclusive to
-- SUPER_ADMIN; this follows the previously applied participant status RPC
-- migration without modifying it.

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
  v_actor_role public.user_role;
  v_actor_is_active boolean;
BEGIN
  SELECT profile.role, profile.is_active
  INTO v_actor_role, v_actor_is_active
  FROM public.profiles AS profile
  WHERE profile.id = p_changed_by;

  IF NOT FOUND OR v_actor_is_active IS DISTINCT FROM true THEN
    RETURN QUERY SELECT 'UNAUTHORIZED_ACTOR'::text;
    RETURN;
  END IF;

  IF p_registration_id IS NULL OR btrim(p_registration_id) !~ '^AKKAI26-[0-9]{6}$'
     OR p_target_status IS NULL THEN
    RETURN QUERY SELECT 'INVALID_INPUT'::text;
    RETURN;
  END IF;

  IF p_target_status = 'CANCELLED'::public.registration_status
     AND v_actor_role NOT IN (
       'ADMIN'::public.user_role,
       'SUPER_ADMIN'::public.user_role,
       'OPERATIONAL'::public.user_role
     ) THEN
    RETURN QUERY SELECT 'UNAUTHORIZED_ACTOR'::text;
    RETURN;
  END IF;

  IF p_target_status = 'REGISTERED'::public.registration_status
     AND v_actor_role <> 'SUPER_ADMIN'::public.user_role THEN
    RETURN QUERY SELECT 'UNAUTHORIZED_ACTOR'::text;
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
