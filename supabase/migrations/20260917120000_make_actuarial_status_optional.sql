-- Status CIAC is optional for both public registration flows.
-- Blank input is normalized to NULL before validation and persistence.

CREATE OR REPLACE FUNCTION public.create_participant_with_registration_reservation_v4(
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
  p_certificate_upload_intent_id uuid
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
  v_participant public.participants%ROWTYPE;
  v_certificate public.registration_certificate_upload_intents%ROWTYPE;
  v_email_log_id uuid;
  v_billing public.registration_billings%ROWTYPE;
  v_billing_email_log_id uuid;
  v_full_name text := btrim(coalesce(p_full_name, ''));
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_phone_number text := btrim(coalesce(p_phone_number, ''));
  v_kka_name text := btrim(coalesce(p_kka_name, ''));
  v_position text := btrim(coalesce(p_position, ''));
  v_polo_size text := btrim(coalesce(p_polo_size, ''));
  v_polo_model text := btrim(coalesce(p_polo_model, ''));
  v_package_type text := btrim(coalesce(p_package_type, ''));
  v_participation_scope text := btrim(coalesce(p_participation_scope, ''));
  v_actuarial_status text := NULLIF(btrim(coalesce(p_actuarial_consultant_status, '')), '');
  v_amount bigint;
  v_constraint_name text;
BEGIN
  IF v_full_name !~ '^.{3,100}$'
     OR v_email = ''
     OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     OR v_phone_number = ''
     OR v_kka_name !~ '^.{1,150}$'
     OR v_position !~ '^.{1,100}$'
     OR v_polo_size NOT IN ('S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'XXXXL')
     OR v_polo_model NOT IN ('Lengan Panjang', 'Lengan Pendek')
     OR v_package_type NOT IN ('Twin Share', 'Single')
     OR v_participation_scope NOT IN ('Seluruh acara', 'Rapat Anggota AKKAI 2026', 'Seminar Profesi Konsultan Aktuaria')
     OR (v_actuarial_status IS NOT NULL AND v_actuarial_status NOT IN ('Peserta Baru', 'Penerima Grandfathering CIAC'))
     OR p_attends_pai_congress IS NULL
     OR p_privacy_consent_at IS NULL THEN
    RETURN QUERY SELECT 'INVALID_INPUT'::text, NULL::uuid, NULL::text, NULL::text, NULL::text,
      NULL::text, NULL::uuid, NULL::bigint, NULL::uuid, NULL::text, NULL::bigint, NULL::timestamptz;
    RETURN;
  END IF;

  IF v_actuarial_status = 'Peserta Baru' THEN
    IF p_certificate_upload_intent_id IS NULL THEN
      RETURN QUERY SELECT 'INVALID_INPUT'::text, NULL::uuid, NULL::text, NULL::text, NULL::text,
        NULL::text, NULL::uuid, NULL::bigint, NULL::uuid, NULL::text, NULL::bigint, NULL::timestamptz;
      RETURN;
    END IF;

    SELECT certificate_intent.* INTO v_certificate
    FROM public.registration_certificate_upload_intents AS certificate_intent
    WHERE certificate_intent.id = p_certificate_upload_intent_id
      AND certificate_intent.status = 'PENDING'
      AND certificate_intent.email = v_email
      AND certificate_intent.expires_at > now()
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN QUERY SELECT 'INVALID_INPUT'::text, NULL::uuid, NULL::text, NULL::text, NULL::text,
        NULL::text, NULL::uuid, NULL::bigint, NULL::uuid, NULL::text, NULL::bigint, NULL::timestamptz;
      RETURN;
    END IF;
  ELSIF p_certificate_upload_intent_id IS NOT NULL THEN
    RETURN QUERY SELECT 'INVALID_INPUT'::text, NULL::uuid, NULL::text, NULL::text, NULL::text,
      NULL::text, NULL::uuid, NULL::bigint, NULL::uuid, NULL::text, NULL::bigint, NULL::timestamptz;
    RETURN;
  END IF;

  v_amount := CASE v_package_type WHEN 'Twin Share' THEN 6000000 ELSE 7000000 END;

  BEGIN
    INSERT INTO public.participants (
      full_name, email, phone_number, participant_category, member_number,
      kka_name, position, polo_size, polo_model, package_type, participation_scope,
      actuarial_consultant_status, attends_pai_congress, privacy_consent_at,
      email_generation, email_status
    ) VALUES (
      v_full_name, v_email, v_phone_number, NULL, NULL, v_kka_name, v_position,
      v_polo_size, v_polo_model, v_package_type, v_participation_scope,
      v_actuarial_status, p_attends_pai_congress, p_privacy_consent_at, 0, 'PENDING'
    ) RETURNING * INTO v_participant;

    IF p_certificate_upload_intent_id IS NOT NULL THEN
      INSERT INTO public.registration_documents (
        participant_id, storage_path, file_name, file_mime, file_size
      ) VALUES (
        v_participant.id, v_certificate.storage_path, v_certificate.file_name,
        v_certificate.file_mime, v_certificate.file_size
      );

      UPDATE public.registration_certificate_upload_intents AS certificate_intent
      SET status = 'CONSUMED', consumed_at = now()
      WHERE certificate_intent.id = v_certificate.id;
    END IF;

    INSERT INTO public.email_logs (
      participant_id, email_type, recipient_email, status, idempotency_key, email_generation
    ) VALUES (
      v_participant.id, 'REGISTRATION', v_participant.email, 'PENDING',
      'registration:' || v_participant.id, v_participant.email_generation
    ) RETURNING id INTO v_email_log_id;

    INSERT INTO public.registration_billings (
      participant_id, registration_id, full_name, kka_name, package_type,
      participation_scope, amount
    ) VALUES (
      v_participant.id, v_participant.registration_id, v_participant.full_name,
      v_participant.kka_name, v_participant.package_type, v_participant.participation_scope,
      v_amount
    ) RETURNING * INTO v_billing;

    INSERT INTO public.registration_billing_email_logs (
      billing_id, recipient_email, idempotency_key
    ) VALUES (
      v_billing.id, v_participant.email, 'billing:' || v_billing.id
    ) RETURNING id INTO v_billing_email_log_id;
  EXCEPTION
    WHEN unique_violation THEN
      GET STACKED DIAGNOSTICS v_constraint_name = CONSTRAINT_NAME;
      IF v_constraint_name = 'participants_email_lower_unique' THEN
        RETURN QUERY SELECT 'DUPLICATE_EMAIL'::text, NULL::uuid, NULL::text, NULL::text, NULL::text,
          NULL::text, NULL::uuid, NULL::bigint, NULL::uuid, NULL::text, NULL::bigint, NULL::timestamptz;
        RETURN;
      END IF;
      RAISE;
  END;

  RETURN QUERY SELECT 'CREATED'::text, v_participant.id, v_participant.registration_id,
    v_participant.full_name, v_participant.email, v_participant.qr_token, v_email_log_id,
    v_participant.email_generation, v_billing.id, v_billing.billing_number, v_billing.amount,
    v_billing.created_at;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_participant_with_registration_reservation_v4(
  text, text, text, text, text, text, text, text, text, text, boolean, timestamptz, uuid
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_participant_with_registration_reservation_v4(
  text, text, text, text, text, text, text, text, text, text, boolean, timestamptz, uuid
) TO service_role;
