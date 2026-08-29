-- Suppress different resend requests for the same participant within a rolling
-- 60-second window while retaining exact idempotency-key behavior.
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
    idempotency_key
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
    p_idempotency_key
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
