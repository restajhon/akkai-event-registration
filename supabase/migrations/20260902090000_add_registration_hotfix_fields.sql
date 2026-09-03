-- Registration deadline hotfix fields.
-- New answers are nullable at table level so existing participants remain valid.

ALTER TABLE public.participants
  ALTER COLUMN participant_category DROP NOT NULL;

ALTER TABLE public.participants
  DROP CONSTRAINT participants_category_valid;

ALTER TABLE public.participants
  DROP CONSTRAINT participants_polo_size_valid;

ALTER TABLE public.participants
  ADD COLUMN package_type text,
  ADD COLUMN participation_scope text,
  ADD COLUMN actuarial_consultant_status text,
  ADD COLUMN attends_pai_congress boolean,
  ADD CONSTRAINT participants_category_valid CHECK (
    participant_category IS NULL
    OR char_length(btrim(participant_category)) BETWEEN 1 AND 100
  ),
  ADD CONSTRAINT participants_polo_size_valid CHECK (
    polo_size IS NULL
    OR polo_size IN ('S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'XXXXL')
  ),
  ADD CONSTRAINT participants_package_type_valid CHECK (
    package_type IS NULL
    OR package_type IN ('Twin Share', 'Single')
  ),
  ADD CONSTRAINT participants_participation_scope_valid CHECK (
    participation_scope IS NULL
    OR participation_scope IN (
      'Seluruh acara',
      'Rapat Anggota',
      'Seminar Profesi Konsultan Akruaria'
    )
  ),
  ADD CONSTRAINT participants_actuarial_consultant_status_valid CHECK (
    actuarial_consultant_status IS NULL
    OR actuarial_consultant_status IN ('Peserta Baru', 'Penerima Grandfathering')
  );

CREATE INDEX participants_package_type_idx
ON public.participants (package_type);

CREATE INDEX participants_participation_scope_idx
ON public.participants (participation_scope);

CREATE INDEX participants_actuarial_consultant_status_idx
ON public.participants (actuarial_consultant_status);

-- Revised public registration contract. The H-3D2 RPCs remain available for
-- already-deployed application instances during migration/deployment overlap.
CREATE OR REPLACE FUNCTION public.create_participant_with_registration_reservation_v3(
  p_full_name text,
  p_email text,
  p_phone_number text,
  p_kka_name text,
  p_polo_size text,
  p_polo_model text,
  p_package_type text,
  p_participation_scope text,
  p_actuarial_consultant_status text,
  p_attends_pai_congress boolean,
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
  v_full_name text;
  v_email text;
  v_phone_number text;
  v_kka_name text;
  v_polo_size text;
  v_polo_model text;
  v_package_type text;
  v_participation_scope text;
  v_actuarial_consultant_status text;
  v_constraint_name text;
BEGIN
  v_full_name := btrim(COALESCE(p_full_name, ''));
  v_email := lower(btrim(COALESCE(p_email, '')));
  v_phone_number := btrim(COALESCE(p_phone_number, ''));
  v_kka_name := btrim(COALESCE(p_kka_name, ''));
  v_polo_size := btrim(COALESCE(p_polo_size, ''));
  v_polo_model := btrim(COALESCE(p_polo_model, ''));
  v_package_type := btrim(COALESCE(p_package_type, ''));
  v_participation_scope := btrim(COALESCE(p_participation_scope, ''));
  v_actuarial_consultant_status := btrim(COALESCE(p_actuarial_consultant_status, ''));

  IF v_full_name !~ '^.{3,100}$'
     OR v_email = ''
     OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     OR v_phone_number = ''
     OR v_kka_name !~ '^.{1,150}$'
     OR v_polo_size NOT IN ('S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'XXXXL')
     OR v_polo_model NOT IN ('Lengan Panjang', 'Lengan Pendek')
     OR v_package_type NOT IN ('Twin Share', 'Single')
     OR v_participation_scope NOT IN (
       'Seluruh acara',
       'Rapat Anggota',
       'Seminar Profesi Konsultan Akruaria'
     )
     OR v_actuarial_consultant_status NOT IN (
       'Peserta Baru',
       'Penerima Grandfathering'
     )
     OR p_attends_pai_congress IS NULL
     OR p_privacy_consent_at IS NULL THEN
    RETURN QUERY SELECT 'INVALID_INPUT'::text, NULL::uuid, NULL::text,
      NULL::text, NULL::text, NULL::text, NULL::uuid, NULL::bigint;
    RETURN;
  END IF;

  BEGIN
    INSERT INTO public.participants (
      full_name,
      email,
      phone_number,
      participant_category,
      member_number,
      kka_name,
      polo_size,
      polo_model,
      package_type,
      participation_scope,
      actuarial_consultant_status,
      attends_pai_congress,
      privacy_consent_at,
      email_generation,
      email_status
    )
    VALUES (
      v_full_name,
      v_email,
      v_phone_number,
      NULL,
      NULL,
      v_kka_name,
      v_polo_size,
      v_polo_model,
      v_package_type,
      v_participation_scope,
      v_actuarial_consultant_status,
      p_attends_pai_congress,
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

REVOKE EXECUTE ON FUNCTION public.create_participant_with_registration_reservation_v3(
  text, text, text, text, text, text, text, text, text, boolean, timestamptz
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_participant_with_registration_reservation_v3(
  text, text, text, text, text, text, text, text, text, boolean, timestamptz
) TO service_role;
