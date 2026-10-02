-- Qualify V5 idempotency lookup columns so RETURNS TABLE participant_id
-- cannot be confused with columns from the referenced tables.

CREATE OR REPLACE FUNCTION public.create_participant_with_registration_reservation_v5(
  p_full_name text,
  p_email text,
  p_phone_number text,
  p_kka_name text,
  p_position text,
  p_polo_size text,
  p_polo_model text,
  p_package_type text,
  p_participation_scope text,
  p_actuarial_consultant_status text,
  p_attends_pai_congress boolean,
  p_privacy_consent_at timestamptz,
  p_certificate_upload_intent_id uuid,
  p_idempotency_key text
)
RETURNS TABLE (
  result_code text,
  participant_id uuid,
  registration_id text,
  full_name text,
  email text,
  qr_token text,
  email_log_id uuid,
  email_generation bigint,
  billing_id uuid,
  billing_number text,
  billing_amount bigint,
  billing_created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing_participant_id uuid;
  v_participant public.participants%ROWTYPE;
  v_billing public.registration_billings%ROWTYPE;
  v_email_log_id uuid;
  v_result record;
  v_is_new_key boolean;
BEGIN
  IF p_idempotency_key IS NULL
     OR char_length(btrim(p_idempotency_key)) NOT BETWEEN 16 AND 200 THEN
    RETURN QUERY SELECT 'INVALID_INPUT'::text, NULL::uuid, NULL::text, NULL::text,
      NULL::text, NULL::text, NULL::uuid, NULL::bigint, NULL::uuid, NULL::text,
      NULL::bigint, NULL::timestamptz;
    RETURN;
  END IF;

  INSERT INTO public.registration_submission_idempotency_keys (idempotency_key)
  VALUES (btrim(p_idempotency_key))
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING true INTO v_is_new_key;

  IF NOT COALESCE(v_is_new_key, false) THEN
    SELECT submission_key.participant_id INTO v_existing_participant_id
    FROM public.registration_submission_idempotency_keys AS submission_key
    WHERE submission_key.idempotency_key = btrim(p_idempotency_key)
    FOR UPDATE;

    IF v_existing_participant_id IS NULL THEN
      RETURN QUERY SELECT 'IN_PROGRESS'::text, NULL::uuid, NULL::text, NULL::text,
        NULL::text, NULL::text, NULL::uuid, NULL::bigint, NULL::uuid, NULL::text,
        NULL::bigint, NULL::timestamptz;
      RETURN;
    END IF;

    SELECT participant.* INTO v_participant
    FROM public.participants AS participant
    WHERE participant.id = v_existing_participant_id;

    SELECT billing.* INTO v_billing
    FROM public.registration_billings AS billing
    WHERE billing.participant_id = v_existing_participant_id;

    SELECT email_log.id INTO v_email_log_id
    FROM public.email_logs AS email_log
    WHERE email_log.participant_id = v_existing_participant_id
      AND email_log.email_type = 'REGISTRATION'::public.email_type
    ORDER BY email_log.created_at ASC
    LIMIT 1;

    IF NOT FOUND OR v_billing.id IS NULL THEN
      RETURN QUERY SELECT 'IN_PROGRESS'::text, NULL::uuid, NULL::text, NULL::text,
        NULL::text, NULL::text, NULL::uuid, NULL::bigint, NULL::uuid, NULL::text,
        NULL::bigint, NULL::timestamptz;
      RETURN;
    END IF;

    RETURN QUERY SELECT 'ALREADY_CREATED'::text, v_participant.id,
      v_participant.registration_id, v_participant.full_name, v_participant.email,
      v_participant.qr_token, v_email_log_id, v_participant.email_generation,
      v_billing.id, v_billing.billing_number, v_billing.amount, v_billing.created_at;
    RETURN;
  END IF;

  SELECT * INTO v_result
  FROM public.create_participant_with_registration_reservation_v4(
    p_full_name, p_email, p_phone_number, p_kka_name, p_position, p_polo_size,
    p_polo_model, p_package_type, p_participation_scope,
    p_actuarial_consultant_status, p_attends_pai_congress, p_privacy_consent_at,
    p_certificate_upload_intent_id
  );

  IF v_result.result_code <> 'CREATED' THEN
    DELETE FROM public.registration_submission_idempotency_keys AS submission_key
    WHERE submission_key.idempotency_key = btrim(p_idempotency_key)
      AND submission_key.participant_id IS NULL;
    RETURN QUERY SELECT v_result.result_code::text, NULL::uuid, NULL::text,
      NULL::text, NULL::text, NULL::text, NULL::uuid, NULL::bigint, NULL::uuid,
      NULL::text, NULL::bigint, NULL::timestamptz;
    RETURN;
  END IF;

  UPDATE public.registration_submission_idempotency_keys AS submission_key
  SET participant_id = v_result.participant_id
  WHERE submission_key.idempotency_key = btrim(p_idempotency_key);

  RETURN QUERY SELECT v_result.result_code::text, v_result.participant_id::uuid,
    v_result.registration_id::text, v_result.full_name::text, v_result.email::text,
    v_result.qr_token::text, v_result.email_log_id::uuid,
    v_result.email_generation::bigint, v_result.billing_id::uuid,
    v_result.billing_number::text, v_result.billing_amount::bigint,
    v_result.billing_created_at::timestamptz;
END;
$$;
