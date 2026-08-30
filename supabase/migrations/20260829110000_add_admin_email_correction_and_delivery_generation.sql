-- Track which participant email generation each delivery attempt belongs to.
ALTER TABLE public.participants
  ADD COLUMN email_generation bigint NOT NULL DEFAULT 0;

ALTER TABLE public.participants
  ADD CONSTRAINT participants_email_generation_nonnegative
  CHECK (email_generation >= 0);

ALTER TABLE public.email_logs
  ADD COLUMN email_generation bigint NOT NULL DEFAULT 0;

ALTER TABLE public.email_logs
  ADD CONSTRAINT email_logs_email_generation_nonnegative
  CHECK (email_generation >= 0);

CREATE INDEX email_logs_participant_generation_status_created_at_idx
ON public.email_logs (
  participant_id,
  email_generation,
  status,
  created_at DESC
);

-- Email corrections are immutable operational history.
CREATE TABLE public.participant_email_changes (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  participant_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE RESTRICT,
  old_email text NOT NULL,
  new_email text NOT NULL,
  changed_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  changed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT participant_email_changes_old_email_not_blank
    CHECK (btrim(old_email) <> ''),
  CONSTRAINT participant_email_changes_new_email_not_blank
    CHECK (btrim(new_email) <> ''),
  CONSTRAINT participant_email_changes_email_changed
    CHECK (old_email <> new_email)
);

CREATE INDEX participant_email_changes_participant_changed_at_idx
ON public.participant_email_changes (participant_id, changed_at DESC);

ALTER TABLE public.participant_email_changes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.participant_email_changes
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT ON TABLE public.participant_email_changes TO service_role;

-- Correct the current participant email without rewriting delivery history.
CREATE OR REPLACE FUNCTION public.correct_participant_email(
  p_participant_id uuid,
  p_new_email text,
  p_changed_by uuid,
  p_expected_email_generation bigint,
  p_allow_stale_pending boolean DEFAULT false
)
RETURNS TABLE (
  result_code text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_participant public.participants%ROWTYPE;
  v_actor_is_admin boolean;
  v_new_email text;
  v_has_recent_pending boolean;
  v_has_stale_pending boolean;
  v_constraint_name text;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = p_changed_by
      AND is_active = true
      AND role = 'ADMIN'::public.user_role
  )
  INTO v_actor_is_admin;

  IF NOT v_actor_is_admin THEN
    RETURN QUERY SELECT 'UNAUTHORIZED_ACTOR'::text;
    RETURN;
  END IF;

  SELECT *
  INTO v_participant
  FROM public.participants
  WHERE id = p_participant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'NOT_FOUND'::text;
    RETURN;
  END IF;

  IF p_expected_email_generation IS NULL
     OR p_expected_email_generation <> v_participant.email_generation THEN
    RETURN QUERY SELECT 'STALE_FORM'::text;
    RETURN;
  END IF;

  v_new_email := lower(btrim(COALESCE(p_new_email, '')));

  IF v_new_email = ''
     OR v_new_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RETURN QUERY SELECT 'INVALID_INPUT'::text;
    RETURN;
  END IF;

  IF v_new_email = v_participant.email THEN
    RETURN QUERY SELECT 'NO_CHANGE'::text;
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.email_logs
    WHERE participant_id = v_participant.id
      AND email_generation = v_participant.email_generation
      AND email_type IN (
        'REGISTRATION'::public.email_type,
        'RESEND'::public.email_type
      )
      AND status = 'PENDING'::public.email_status
      AND created_at >= now() - interval '15 minutes'
  )
  INTO v_has_recent_pending;

  IF v_has_recent_pending THEN
    RETURN QUERY SELECT 'EMAIL_SEND_PENDING'::text;
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.email_logs
    WHERE participant_id = v_participant.id
      AND email_generation = v_participant.email_generation
      AND email_type IN (
        'REGISTRATION'::public.email_type,
        'RESEND'::public.email_type
      )
      AND status = 'PENDING'::public.email_status
      AND created_at < now() - interval '15 minutes'
  )
  INTO v_has_stale_pending;

  IF v_has_stale_pending AND NOT COALESCE(p_allow_stale_pending, false) THEN
    RETURN QUERY SELECT 'STALE_PENDING_REQUIRES_CONFIRMATION'::text;
    RETURN;
  END IF;

  BEGIN
    UPDATE public.participants
    SET email = v_new_email,
        email_generation = email_generation + 1,
        email_status = 'PENDING'::public.email_status,
        last_email_sent_at = NULL
    WHERE id = v_participant.id;

    INSERT INTO public.participant_email_changes (
      participant_id,
      old_email,
      new_email,
      changed_by
    )
    VALUES (
      v_participant.id,
      v_participant.email,
      v_new_email,
      p_changed_by
    );
  EXCEPTION
    WHEN unique_violation THEN
      GET STACKED DIAGNOSTICS v_constraint_name = CONSTRAINT_NAME;

      IF v_constraint_name = 'participants_email_lower_unique' THEN
        RETURN QUERY SELECT 'DUPLICATE_EMAIL'::text;
        RETURN;
      END IF;

      RAISE;
  END;

  RETURN QUERY SELECT 'UPDATED'::text;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.correct_participant_email(uuid, text, uuid, bigint, boolean)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.correct_participant_email(uuid, text, uuid, bigint, boolean)
TO service_role;

-- Reserve the initial registration email atomically with participant creation.
CREATE OR REPLACE FUNCTION public.create_participant_with_registration_reservation(
  p_full_name text,
  p_email text,
  p_phone_number text,
  p_institution text,
  p_participant_category text,
  p_member_number text,
  p_privacy_consent_at timestamptz
)
RETURNS TABLE (
  result_code text,
  participant_id uuid,
  registration_id text,
  full_name text,
  email text,
  qr_token text,
  email_log_id uuid,
  email_generation bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_participant public.participants%ROWTYPE;
  v_email_log_id uuid;
  v_email text;
  v_member_number text;
  v_constraint_name text;
BEGIN
  v_email := lower(btrim(COALESCE(p_email, '')));
  v_member_number := CASE
    WHEN p_member_number IS NULL THEN NULL
    ELSE upper(btrim(p_member_number))
  END;

  IF btrim(COALESCE(p_full_name, '')) !~ '^.{3,100}$'
     OR v_email = ''
     OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     OR btrim(COALESCE(p_phone_number, '')) = ''
     OR btrim(COALESCE(p_institution, '')) !~ '^.{2,150}$'
     OR p_privacy_consent_at IS NULL THEN
    RETURN QUERY SELECT 'INVALID_INPUT'::text, NULL::uuid, NULL::text,
      NULL::text, NULL::text, NULL::text, NULL::uuid, NULL::bigint;
    RETURN;
  END IF;

  IF p_participant_category IS NULL OR p_participant_category NOT IN (
    'Anggota AKKAI',
    'Pengurus AKKAI',
    'Narasumber',
    'Tamu Undangan',
    'Panitia',
    'Lainnya'
  ) THEN
    RETURN QUERY SELECT 'INVALID_INPUT'::text, NULL::uuid, NULL::text,
      NULL::text, NULL::text, NULL::text, NULL::uuid, NULL::bigint;
    RETURN;
  END IF;

  IF p_participant_category IN ('Anggota AKKAI', 'Pengurus AKKAI')
     AND (v_member_number IS NULL OR char_length(v_member_number) NOT BETWEEN 3 AND 50) THEN
    RETURN QUERY SELECT 'INVALID_INPUT'::text, NULL::uuid, NULL::text,
      NULL::text, NULL::text, NULL::text, NULL::uuid, NULL::bigint;
    RETURN;
  END IF;

  IF p_participant_category NOT IN ('Anggota AKKAI', 'Pengurus AKKAI') THEN
    v_member_number := NULL;
  END IF;

  BEGIN
    INSERT INTO public.participants (
      full_name,
      email,
      phone_number,
      institution,
      participant_category,
      member_number,
      privacy_consent_at,
      email_generation,
      email_status
    )
    VALUES (
      btrim(p_full_name),
      v_email,
      btrim(p_phone_number),
      btrim(p_institution),
      p_participant_category,
      v_member_number,
      p_privacy_consent_at,
      0,
      'PENDING'::public.email_status
    )
    RETURNING * INTO v_participant;

    INSERT INTO public.email_logs (
      participant_id,
      email_type,
      recipient_email,
      provider_message_id,
      status,
      error_message,
      sent_by,
      sent_at,
      idempotency_key,
      email_generation
    )
    VALUES (
      v_participant.id,
      'REGISTRATION'::public.email_type,
      v_participant.email,
      NULL,
      'PENDING'::public.email_status,
      NULL,
      NULL,
      NULL,
      'registration:' || v_participant.id,
      v_participant.email_generation
    )
    RETURNING id INTO v_email_log_id;
  EXCEPTION
    WHEN unique_violation THEN
      GET STACKED DIAGNOSTICS v_constraint_name = CONSTRAINT_NAME;

      IF v_constraint_name = 'participants_email_lower_unique' THEN
        RETURN QUERY SELECT 'DUPLICATE_EMAIL'::text, NULL::uuid, NULL::text,
          NULL::text, NULL::text, NULL::text, NULL::uuid, NULL::bigint;
        RETURN;
      END IF;

      IF v_constraint_name = 'participants_member_number_upper_unique' THEN
        RETURN QUERY SELECT 'DUPLICATE_MEMBER_NUMBER'::text, NULL::uuid, NULL::text,
          NULL::text, NULL::text, NULL::text, NULL::uuid, NULL::bigint;
        RETURN;
      END IF;

      RAISE;
  END;

  RETURN QUERY SELECT
    'CREATED'::text,
    v_participant.id,
    v_participant.registration_id,
    v_participant.full_name,
    v_participant.email,
    v_participant.qr_token,
    v_email_log_id,
    v_participant.email_generation;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_participant_with_registration_reservation(text, text, text, text, text, text, timestamptz)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_participant_with_registration_reservation(text, text, text, text, text, text, timestamptz)
TO service_role;

-- Finalize a provider attempt and update participant aggregate state only for
-- the generation represented by that attempt.
CREATE OR REPLACE FUNCTION public.finalize_participant_email_attempt(
  p_participant_id uuid,
  p_email_log_id uuid,
  p_email_generation bigint,
  p_final_status public.email_status,
  p_provider_message_id text DEFAULT NULL,
  p_error_category text DEFAULT NULL,
  p_sent_at timestamptz DEFAULT NULL
)
RETURNS TABLE (
  result_code text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_participant public.participants%ROWTYPE;
  v_email_log public.email_logs%ROWTYPE;
  v_sent_at timestamptz;
BEGIN
  IF p_final_status IS NULL OR p_final_status NOT IN (
    'SENT'::public.email_status,
    'FAILED'::public.email_status
  ) THEN
    RETURN QUERY SELECT 'INVALID_STATE'::text;
    RETURN;
  END IF;

  IF p_final_status = 'SENT'::public.email_status
     AND (
       p_provider_message_id IS NULL
       OR btrim(p_provider_message_id) = ''
     ) THEN
    RETURN QUERY SELECT 'INVALID_STATE'::text;
    RETURN;
  END IF;

  SELECT *
  INTO v_participant
  FROM public.participants
  WHERE id = p_participant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'NOT_FOUND'::text;
    RETURN;
  END IF;

  SELECT *
  INTO v_email_log
  FROM public.email_logs
  WHERE id = p_email_log_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'NOT_FOUND'::text;
    RETURN;
  END IF;

  IF v_email_log.participant_id <> v_participant.id THEN
    RETURN QUERY SELECT 'INVALID_STATE'::text;
    RETURN;
  END IF;

  IF p_email_generation IS NULL
     OR v_email_log.email_generation <> p_email_generation THEN
    RETURN QUERY SELECT 'INVALID_STATE'::text;
    RETURN;
  END IF;

  IF v_email_log.status IN (
    'SENT'::public.email_status,
    'FAILED'::public.email_status
  ) THEN
    RETURN QUERY SELECT 'ALREADY_FINALIZED'::text;
    RETURN;
  END IF;

  IF v_email_log.status <> 'PENDING'::public.email_status THEN
    RETURN QUERY SELECT 'INVALID_STATE'::text;
    RETURN;
  END IF;

  v_sent_at := COALESCE(p_sent_at, now());

  UPDATE public.email_logs
  SET status = p_final_status,
      provider_message_id = CASE
        WHEN p_final_status = 'SENT'::public.email_status
          THEN p_provider_message_id
        ELSE NULL
      END,
      error_message = CASE
        WHEN p_final_status = 'FAILED'::public.email_status
          THEN COALESCE(NULLIF(btrim(p_error_category), ''), 'DELIVERY_FAILED')
        ELSE NULL
      END,
      sent_at = CASE
        WHEN p_final_status = 'SENT'::public.email_status THEN v_sent_at
        ELSE NULL
      END
  WHERE id = v_email_log.id;

  IF v_email_log.email_generation <> v_participant.email_generation THEN
    RETURN QUERY SELECT 'STALE_GENERATION'::text;
    RETURN;
  END IF;

  UPDATE public.participants
  SET email_status = p_final_status,
      last_email_sent_at = CASE
        WHEN p_final_status = 'SENT'::public.email_status THEN v_sent_at
        ELSE last_email_sent_at
      END
  WHERE id = v_participant.id;

  RETURN QUERY SELECT 'CURRENT_GENERATION'::text;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.finalize_participant_email_attempt(uuid, uuid, bigint, public.email_status, text, text, timestamptz)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.finalize_participant_email_attempt(uuid, uuid, bigint, public.email_status, text, text, timestamptz)
TO service_role;

-- Keep resend reservation atomic and stamp the participant's current
-- generation. The participant lock remains the concurrency boundary.
CREATE OR REPLACE FUNCTION public.reserve_participant_email_resend(
  p_participant_id uuid,
  p_recipient_email text,
  p_sent_by uuid,
  p_idempotency_key text
)
RETURNS TABLE (
  result_code text,
  email_log_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_participant public.participants%ROWTYPE;
  v_existing_email_log_id uuid;
  v_recent_email_log_id uuid;
  v_resend_count bigint;
BEGIN
  SELECT *
  INTO v_participant
  FROM public.participants
  WHERE id = p_participant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'NOT_FOUND'::text, NULL::uuid;
    RETURN;
  END IF;

  IF v_participant.registration_status = 'CANCELLED'::public.registration_status THEN
    RETURN QUERY SELECT 'CANCELLED'::text, NULL::uuid;
    RETURN;
  END IF;

  IF p_idempotency_key IS NULL OR btrim(p_idempotency_key) = ''
     OR p_recipient_email IS NULL OR btrim(p_recipient_email) = '' THEN
    RETURN QUERY SELECT 'INVALID_INPUT'::text, NULL::uuid;
    RETURN;
  END IF;

  IF p_recipient_email <> v_participant.email THEN
    RETURN QUERY SELECT 'RECIPIENT_MISMATCH'::text, NULL::uuid;
    RETURN;
  END IF;

  SELECT id
  INTO v_existing_email_log_id
  FROM public.email_logs
  WHERE idempotency_key = p_idempotency_key;

  IF FOUND THEN
    RETURN QUERY SELECT 'ALREADY_RESERVED'::text, v_existing_email_log_id;
    RETURN;
  END IF;

  SELECT id
  INTO v_recent_email_log_id
  FROM public.email_logs
  WHERE participant_id = p_participant_id
    AND email_generation = v_participant.email_generation
    AND email_type = 'RESEND'::public.email_type
    AND created_at >= now() - interval '60 seconds'
    AND status IN (
      'PENDING'::public.email_status,
      'SENT'::public.email_status
    )
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT 'RECENTLY_RESERVED'::text, v_recent_email_log_id;
    RETURN;
  END IF;

  SELECT count(*)
  INTO v_resend_count
  FROM public.email_logs
  WHERE participant_id = p_participant_id
    AND email_type = 'RESEND'::public.email_type
    AND created_at >= now() - interval '24 hours';

  IF v_resend_count >= 5 THEN
    RETURN QUERY SELECT 'LIMIT_REACHED'::text, NULL::uuid;
    RETURN;
  END IF;

  INSERT INTO public.email_logs (
    participant_id,
    email_type,
    recipient_email,
    provider_message_id,
    status,
    error_message,
    sent_by,
    sent_at,
    idempotency_key,
    email_generation
  )
  VALUES (
    p_participant_id,
    'RESEND'::public.email_type,
    p_recipient_email,
    NULL,
    'PENDING'::public.email_status,
    NULL,
    p_sent_by,
    NULL,
    p_idempotency_key,
    v_participant.email_generation
  )
  ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
  RETURNING id INTO v_existing_email_log_id;

  IF NOT FOUND THEN
    SELECT id
    INTO v_existing_email_log_id
    FROM public.email_logs
    WHERE idempotency_key = p_idempotency_key;

    RETURN QUERY SELECT 'ALREADY_RESERVED'::text, v_existing_email_log_id;
    RETURN;
  END IF;

  RETURN QUERY SELECT 'RESERVED'::text, v_existing_email_log_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reserve_participant_email_resend(uuid, text, uuid, text)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.reserve_participant_email_resend(uuid, text, uuid, text)
TO service_role;
