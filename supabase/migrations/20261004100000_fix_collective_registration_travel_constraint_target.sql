-- participant_id is the participant_travel primary key. Naming its verified
-- constraint avoids ambiguity with the v6 RETURNS TABLE output parameter.
CREATE OR REPLACE FUNCTION public.create_participant_with_registration_reservation_v6(
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
  p_idempotency_key text,
  p_batch_id uuid,
  p_member_number text DEFAULT NULL,
  p_institution text DEFAULT NULL,
  p_travel jsonb DEFAULT NULL
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
  v_result record;
  v_participant public.participants%ROWTYPE;
  v_member_number text := NULLIF(upper(btrim(coalesce(p_member_number, ''))), '');
  v_institution text := NULLIF(btrim(coalesce(p_institution, '')), '');
BEGIN
  IF p_batch_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.registration_batches WHERE id = p_batch_id
  ) THEN
    RETURN QUERY SELECT 'INVALID_INPUT'::text, NULL::uuid, NULL::text, NULL::text,
      NULL::text, NULL::text, NULL::uuid, NULL::bigint, NULL::uuid, NULL::text,
      NULL::bigint, NULL::timestamptz;
    RETURN;
  END IF;

  IF v_member_number IS NOT NULL AND char_length(v_member_number) NOT BETWEEN 3 AND 50 THEN
    RETURN QUERY SELECT 'INVALID_INPUT'::text, NULL::uuid, NULL::text, NULL::text,
      NULL::text, NULL::text, NULL::uuid, NULL::bigint, NULL::uuid, NULL::text,
      NULL::bigint, NULL::timestamptz;
    RETURN;
  END IF;

  IF v_institution IS NOT NULL AND char_length(v_institution) NOT BETWEEN 2 AND 150 THEN
    RETURN QUERY SELECT 'INVALID_INPUT'::text, NULL::uuid, NULL::text, NULL::text,
      NULL::text, NULL::text, NULL::uuid, NULL::bigint, NULL::uuid, NULL::text,
      NULL::bigint, NULL::timestamptz;
    RETURN;
  END IF;

  IF p_travel IS NOT NULL AND (
    jsonb_typeof(p_travel) <> 'object'
    OR coalesce(p_travel->>'outbound_date', '') = ''
    OR coalesce(p_travel->>'outbound_time', '') = ''
    OR coalesce(p_travel->>'outbound_transport_mode', '') = ''
    OR coalesce(p_travel->>'outbound_origin', '') = ''
    OR coalesce(p_travel->>'outbound_destination', '') = ''
    OR coalesce(p_travel->>'return_date', '') = ''
    OR coalesce(p_travel->>'return_time', '') = ''
    OR coalesce(p_travel->>'return_transport_mode', '') = ''
    OR coalesce(p_travel->>'return_destination', '') = ''
  ) THEN
    RETURN QUERY SELECT 'INVALID_INPUT'::text, NULL::uuid, NULL::text, NULL::text,
      NULL::text, NULL::text, NULL::uuid, NULL::bigint, NULL::uuid, NULL::text,
      NULL::bigint, NULL::timestamptz;
    RETURN;
  END IF;

  BEGIN
    SELECT * INTO v_result
    FROM public.create_participant_with_registration_reservation_v5(
      p_full_name, p_email, p_phone_number, p_kka_name, p_position, p_polo_size,
      p_polo_model, p_package_type, p_participation_scope,
      p_actuarial_consultant_status, p_attends_pai_congress, p_privacy_consent_at,
      p_certificate_upload_intent_id, p_idempotency_key
    );

    IF v_result.result_code NOT IN ('CREATED', 'ALREADY_CREATED') THEN
      RETURN QUERY SELECT v_result.result_code::text, NULL::uuid, NULL::text,
        NULL::text, NULL::text, NULL::text, NULL::uuid, NULL::bigint, NULL::uuid,
        NULL::text, NULL::bigint, NULL::timestamptz;
      RETURN;
    END IF;

    SELECT * INTO v_participant
    FROM public.participants
    WHERE id = v_result.participant_id
    FOR UPDATE;

    IF v_participant.batch_id IS NOT NULL AND v_participant.batch_id <> p_batch_id THEN
      RETURN QUERY SELECT 'BATCH_MISMATCH'::text, NULL::uuid, NULL::text, NULL::text,
        NULL::text, NULL::text, NULL::uuid, NULL::bigint, NULL::uuid, NULL::text,
        NULL::bigint, NULL::timestamptz;
      RETURN;
    END IF;

    UPDATE public.participants
    SET batch_id = p_batch_id,
        member_number = v_member_number,
        institution = v_institution
    WHERE id = v_participant.id;

    IF p_travel IS NOT NULL THEN
      INSERT INTO public.participant_travel (
        participant_id, outbound_date, outbound_time, outbound_transport_mode,
        outbound_transport_number, outbound_origin, outbound_destination,
        return_date, return_time, return_transport_mode, return_transport_number,
        return_destination, extend_stay
      ) VALUES (
        v_participant.id,
        (p_travel->>'outbound_date')::date,
        (p_travel->>'outbound_time')::time,
        btrim(p_travel->>'outbound_transport_mode'),
        NULLIF(btrim(p_travel->>'outbound_transport_number'), ''),
        btrim(p_travel->>'outbound_origin'),
        btrim(p_travel->>'outbound_destination'),
        (p_travel->>'return_date')::date,
        (p_travel->>'return_time')::time,
        btrim(p_travel->>'return_transport_mode'),
        NULLIF(btrim(p_travel->>'return_transport_number'), ''),
        btrim(p_travel->>'return_destination'),
        coalesce((p_travel->>'extend_stay')::boolean, false)
      )
      ON CONFLICT ON CONSTRAINT participant_travel_pkey DO NOTHING;
    END IF;
  EXCEPTION
    WHEN unique_violation THEN
      RETURN QUERY SELECT 'DUPLICATE_MEMBER_NUMBER'::text, NULL::uuid, NULL::text,
        NULL::text, NULL::text, NULL::text, NULL::uuid, NULL::bigint, NULL::uuid,
        NULL::text, NULL::bigint, NULL::timestamptz;
      RETURN;
  END;

  RETURN QUERY SELECT v_result.result_code::text, v_result.participant_id::uuid,
    v_result.registration_id::text, v_result.full_name::text, v_result.email::text,
    v_result.qr_token::text, v_result.email_log_id::uuid,
    v_result.email_generation::bigint, v_result.billing_id::uuid,
    v_result.billing_number::text, v_result.billing_amount::bigint,
    v_result.billing_created_at::timestamptz;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_participant_with_registration_reservation_v6(
  text, text, text, text, text, text, text, text, text, text, boolean, timestamptz,
  uuid, text, uuid, text, text, jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_participant_with_registration_reservation_v6(
  text, text, text, text, text, text, text, text, text, text, boolean, timestamptz,
  uuid, text, uuid, text, text, jsonb
) TO service_role;
