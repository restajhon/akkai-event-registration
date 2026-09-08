-- Registration certificates stay in a private bucket and billing is created
-- atomically with the participant reservation.

ALTER TABLE public.participants
  ADD COLUMN position text;

ALTER TABLE public.participants
  ADD CONSTRAINT participants_position_valid CHECK (
    position IS NULL
    OR (position = btrim(position) AND char_length(position) BETWEEN 1 AND 100)
  );

ALTER TABLE public.participants
  DROP CONSTRAINT IF EXISTS participants_participation_scope_valid,
  DROP CONSTRAINT IF EXISTS participants_actuarial_consultant_status_valid;

ALTER TABLE public.participants
  ADD CONSTRAINT participants_participation_scope_valid CHECK (
    participation_scope IS NULL
    OR participation_scope IN (
      'Seluruh acara',
      'Rapat Anggota',
      'Rapat Anggota AKKAI 2026',
      'Seminar Profesi Konsultan Aktuaria',
      'Seminar Profesi Konsultan Akruaria'
    )
  ),
  ADD CONSTRAINT participants_actuarial_consultant_status_valid CHECK (
    actuarial_consultant_status IS NULL
    OR actuarial_consultant_status IN (
      'Peserta Baru',
      'Penerima Grandfathering',
      'Penerima Grandfathering CIAC'
    )
  );

CREATE TABLE public.registration_certificate_upload_intents (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  email text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  file_name text NOT NULL,
  file_mime text NOT NULL,
  file_size bigint NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '2 hours'),
  consumed_at timestamptz,
  CONSTRAINT registration_certificate_intent_email_valid CHECK (
    email = btrim(email)
    AND email = lower(email)
    AND char_length(email) BETWEEN 3 AND 254
  ),
  CONSTRAINT registration_certificate_intent_path_valid CHECK (
    storage_path ~ '^certificates/[0-9a-f-]{36}\.(pdf|jpg|jpeg|png)$'
  ),
  CONSTRAINT registration_certificate_intent_file_name_valid CHECK (
    char_length(file_name) BETWEEN 1 AND 255
  ),
  CONSTRAINT registration_certificate_intent_mime_valid CHECK (
    file_mime IN ('application/pdf', 'image/jpeg', 'image/png')
  ),
  CONSTRAINT registration_certificate_intent_size_valid CHECK (
    file_size BETWEEN 1 AND 2097152
  ),
  CONSTRAINT registration_certificate_intent_status_valid CHECK (
    status IN ('PENDING', 'CONSUMED')
  ),
  CONSTRAINT registration_certificate_intent_consumed_at_valid CHECK (
    (status = 'PENDING' AND consumed_at IS NULL)
    OR (status = 'CONSUMED' AND consumed_at IS NOT NULL)
  )
);

CREATE INDEX registration_certificate_intents_expiry_idx
ON public.registration_certificate_upload_intents (expires_at)
WHERE status = 'PENDING';

CREATE TABLE public.registration_documents (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  participant_id uuid NOT NULL UNIQUE REFERENCES public.participants(id) ON DELETE RESTRICT,
  document_type text NOT NULL DEFAULT 'CIAC_EMPLOYMENT_CERTIFICATE',
  storage_path text NOT NULL UNIQUE,
  file_name text NOT NULL,
  file_mime text NOT NULL,
  file_size bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT registration_document_type_valid CHECK (document_type = 'CIAC_EMPLOYMENT_CERTIFICATE'),
  CONSTRAINT registration_document_path_valid CHECK (
    storage_path ~ '^certificates/[0-9a-f-]{36}\.(pdf|jpg|jpeg|png)$'
  ),
  CONSTRAINT registration_document_mime_valid CHECK (
    file_mime IN ('application/pdf', 'image/jpeg', 'image/png')
  ),
  CONSTRAINT registration_document_size_valid CHECK (file_size BETWEEN 1 AND 2097152),
  CONSTRAINT registration_document_file_name_valid CHECK (char_length(file_name) BETWEEN 1 AND 255)
);

CREATE TYPE public.billing_email_status AS ENUM ('PENDING', 'SENT', 'FAILED');

CREATE SEQUENCE public.billing_number_seq
  AS bigint START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 999999 NO CYCLE;

CREATE OR REPLACE FUNCTION public.set_billing_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.billing_number := 'INV-AKKAI26-' || lpad(nextval('public.billing_number_seq')::text, 6, '0');
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_billing_number() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_billing_number() TO service_role;

CREATE TABLE public.registration_billings (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  participant_id uuid NOT NULL UNIQUE REFERENCES public.participants(id) ON DELETE RESTRICT,
  registration_id text NOT NULL UNIQUE REFERENCES public.participants(registration_id) ON DELETE RESTRICT,
  billing_number text NOT NULL UNIQUE,
  full_name text NOT NULL,
  kka_name text NOT NULL,
  package_type text NOT NULL,
  participation_scope text NOT NULL,
  amount bigint NOT NULL,
  currency text NOT NULL DEFAULT 'IDR',
  payment_status text NOT NULL DEFAULT 'UNPAID',
  paid_at timestamptz,
  paid_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  billing_email_status public.billing_email_status NOT NULL DEFAULT 'PENDING',
  billing_email_provider_message_id text,
  billing_email_error text,
  billing_email_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT registration_billing_number_format CHECK (billing_number ~ '^INV-AKKAI26-[0-9]{6}$'),
  CONSTRAINT registration_billing_package_valid CHECK (package_type IN ('Twin Share', 'Single')),
  CONSTRAINT registration_billing_scope_valid CHECK (
    participation_scope IN ('Seluruh acara', 'Rapat Anggota AKKAI 2026', 'Seminar Profesi Konsultan Aktuaria')
  ),
  CONSTRAINT registration_billing_amount_valid CHECK (amount IN (6000000, 7000000)),
  CONSTRAINT registration_billing_currency_valid CHECK (currency = 'IDR'),
  CONSTRAINT registration_billing_payment_status_valid CHECK (payment_status IN ('UNPAID', 'PAID')),
  CONSTRAINT registration_billing_paid_fields_valid CHECK (
    (payment_status = 'UNPAID' AND paid_at IS NULL AND paid_by IS NULL)
    OR (payment_status = 'PAID' AND paid_at IS NOT NULL AND paid_by IS NOT NULL)
  )
);

CREATE OR REPLACE TRIGGER registration_billings_set_number
BEFORE INSERT ON public.registration_billings
FOR EACH ROW
EXECUTE FUNCTION public.set_billing_number();

CREATE OR REPLACE TRIGGER registration_billings_set_updated_at
BEFORE UPDATE ON public.registration_billings
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.registration_billing_email_logs (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  billing_id uuid NOT NULL REFERENCES public.registration_billings(id) ON DELETE RESTRICT,
  recipient_email text NOT NULL,
  status public.billing_email_status NOT NULL DEFAULT 'PENDING',
  provider_message_id text,
  error_message text,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  CONSTRAINT registration_billing_email_recipient_valid CHECK (
    recipient_email = lower(btrim(recipient_email))
    AND char_length(recipient_email) BETWEEN 3 AND 254
  )
);

CREATE UNIQUE INDEX registration_billing_email_one_per_billing
ON public.registration_billing_email_logs (billing_id);

ALTER TABLE public.registration_certificate_upload_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_billings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_billing_email_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.registration_certificate_upload_intents,
  public.registration_documents,
  public.registration_billings,
  public.registration_billing_email_logs
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.registration_certificate_upload_intents TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.registration_documents TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.registration_billings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.registration_billing_email_logs TO service_role;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'registration-certificates',
  'registration-certificates',
  false,
  2097152,
  ARRAY['application/pdf', 'image/jpeg', 'image/png']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 2097152,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE OR REPLACE FUNCTION public.create_participant_with_registration_reservation_v4(
  p_full_name text,
  p_email text,
  p_phone_number text,
  p_kka_name text,
  p_position text,
  p_polo_size text,
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
  v_package_type text := btrim(coalesce(p_package_type, ''));
  v_participation_scope text := btrim(coalesce(p_participation_scope, ''));
  v_actuarial_status text := btrim(coalesce(p_actuarial_consultant_status, ''));
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
     OR v_package_type NOT IN ('Twin Share', 'Single')
     OR v_participation_scope NOT IN ('Seluruh acara', 'Rapat Anggota AKKAI 2026', 'Seminar Profesi Konsultan Aktuaria')
     OR v_actuarial_status NOT IN ('Peserta Baru', 'Penerima Grandfathering CIAC')
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

    SELECT * INTO v_certificate
    FROM public.registration_certificate_upload_intents
    WHERE id = p_certificate_upload_intent_id
      AND status = 'PENDING'
      AND email = v_email
      AND expires_at > now()
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
      v_polo_size, NULL, v_package_type, v_participation_scope,
      v_actuarial_status, p_attends_pai_congress, p_privacy_consent_at, 0, 'PENDING'
    ) RETURNING * INTO v_participant;

    IF p_certificate_upload_intent_id IS NOT NULL THEN
      INSERT INTO public.registration_documents (
        participant_id, storage_path, file_name, file_mime, file_size
      ) VALUES (
        v_participant.id, v_certificate.storage_path, v_certificate.file_name,
        v_certificate.file_mime, v_certificate.file_size
      );

      UPDATE public.registration_certificate_upload_intents
      SET status = 'CONSUMED', consumed_at = now()
      WHERE id = v_certificate.id;
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
  text, text, text, text, text, text, text, text, text, boolean, timestamptz, uuid
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_participant_with_registration_reservation_v4(
  text, text, text, text, text, text, text, text, text, boolean, timestamptz, uuid
) TO service_role;

CREATE OR REPLACE FUNCTION public.finalize_registration_billing_email(
  p_billing_id uuid,
  p_final_status public.billing_email_status,
  p_provider_message_id text,
  p_error_message text,
  p_sent_at timestamptz
)
RETURNS TABLE (result_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.registration_billings
  SET billing_email_status = p_final_status,
      billing_email_provider_message_id = p_provider_message_id,
      billing_email_error = p_error_message,
      billing_email_sent_at = p_sent_at
  WHERE id = p_billing_id;

  UPDATE public.registration_billing_email_logs
  SET status = p_final_status,
      provider_message_id = p_provider_message_id,
      error_message = p_error_message,
      sent_at = p_sent_at
  WHERE billing_id = p_billing_id AND status = 'PENDING';

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'NOT_FOUND'::text;
    RETURN;
  END IF;

  RETURN QUERY SELECT 'UPDATED'::text;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.finalize_registration_billing_email(uuid, public.billing_email_status, text, text, timestamptz)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_registration_billing_email(uuid, public.billing_email_status, text, text, timestamptz)
TO service_role;

CREATE OR REPLACE FUNCTION public.set_registration_billing_payment_status(
  p_billing_id uuid,
  p_payment_status text,
  p_paid_by uuid
)
RETURNS TABLE (result_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_payment_status NOT IN ('UNPAID', 'PAID') THEN
    RETURN QUERY SELECT 'INVALID_STATUS'::text;
    RETURN;
  END IF;

  UPDATE public.registration_billings
  SET payment_status = p_payment_status,
      paid_at = CASE WHEN p_payment_status = 'PAID' THEN now() ELSE NULL END,
      paid_by = CASE WHEN p_payment_status = 'PAID' THEN p_paid_by ELSE NULL END
  WHERE id = p_billing_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'NOT_FOUND'::text;
    RETURN;
  END IF;

  RETURN QUERY SELECT 'UPDATED'::text;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_registration_billing_payment_status(uuid, text, uuid)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_registration_billing_payment_status(uuid, text, uuid)
TO service_role;
