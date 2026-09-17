-- Collective registration groups keep every participant, billing, QR, and
-- delivery record independent while giving admins a readable grouping key.

CREATE TABLE public.registration_batches (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  batch_code text NOT NULL UNIQUE DEFAULT (
    'BATCH-' || upper(substr(replace(extensions.gen_random_uuid()::text, '-', ''), 1, 10))
  ),
  mode text NOT NULL DEFAULT 'COLLECTIVE',
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT registration_batches_code_valid CHECK (
    batch_code ~ '^BATCH-[A-Z0-9]{10}$'
  ),
  CONSTRAINT registration_batches_mode_valid CHECK (
    mode IN ('COLLECTIVE')
  ),
  CONSTRAINT registration_batches_idempotency_key_valid CHECK (
    char_length(btrim(idempotency_key)) BETWEEN 16 AND 200
  )
);

ALTER TABLE public.participants
  ADD COLUMN batch_id uuid REFERENCES public.registration_batches(id) ON DELETE SET NULL;

CREATE INDEX participants_batch_id_idx
  ON public.participants (batch_id, created_at DESC);

ALTER TABLE public.registration_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.registration_batches
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.registration_batches TO service_role;

-- V6 adds batch metadata and optional participant travel/member data around
-- the existing V5 reservation. Each RPC call remains one participant unit.
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
      ON CONFLICT (participant_id) DO NOTHING;
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

CREATE OR REPLACE FUNCTION public.update_participant_data(
  p_participant_id uuid,
  p_actor_id uuid,
  p_full_name text,
  p_phone_number text,
  p_member_number text,
  p_institution text,
  p_position text,
  p_kka_name text,
  p_package_type text,
  p_participation_scope text,
  p_polo_size text,
  p_polo_model text,
  p_actuarial_consultant_status text,
  p_attends_pai_congress boolean,
  p_travel jsonb DEFAULT NULL
)
RETURNS TABLE (result_code text, billing_amount bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_participant public.participants%ROWTYPE;
  v_member_number text := NULLIF(upper(btrim(coalesce(p_member_number, ''))), '');
  v_institution text := NULLIF(btrim(coalesce(p_institution, '')), '');
  v_amount bigint;
BEGIN
  IF NOT public.has_permission(p_actor_id, 'participants.manage') THEN
    RETURN QUERY SELECT 'UNAUTHORIZED'::text, NULL::bigint;
    RETURN;
  END IF;

  SELECT * INTO v_participant
  FROM public.participants
  WHERE id = p_participant_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'NOT_FOUND'::text, NULL::bigint;
    RETURN;
  END IF;

  IF btrim(coalesce(p_full_name, '')) !~ '^.{3,100}$'
     OR btrim(coalesce(p_phone_number, '')) = ''
     OR btrim(coalesce(p_kka_name, '')) = ''
     OR btrim(coalesce(p_package_type, '')) NOT IN ('Twin Share', 'Single')
     OR btrim(coalesce(p_participation_scope, '')) NOT IN (
       'Seluruh acara', 'Rapat Anggota AKKAI 2026', 'Seminar Profesi Konsultan Aktuaria'
     )
     OR btrim(coalesce(p_polo_size, '')) NOT IN ('S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'XXXXL')
     OR btrim(coalesce(p_polo_model, '')) NOT IN ('Lengan Panjang', 'Lengan Pendek')
     OR btrim(coalesce(p_actuarial_consultant_status, '')) NOT IN ('Peserta Baru', 'Penerima Grandfathering CIAC')
     OR p_attends_pai_congress IS NULL THEN
    RETURN QUERY SELECT 'INVALID_INPUT'::text, NULL::bigint;
    RETURN;
  END IF;

  IF v_member_number IS NOT NULL AND char_length(v_member_number) NOT BETWEEN 3 AND 50 THEN
    RETURN QUERY SELECT 'INVALID_INPUT'::text, NULL::bigint;
    RETURN;
  END IF;
  IF v_institution IS NOT NULL AND char_length(v_institution) NOT BETWEEN 2 AND 150 THEN
    RETURN QUERY SELECT 'INVALID_INPUT'::text, NULL::bigint;
    RETURN;
  END IF;

  v_amount := CASE btrim(p_package_type) WHEN 'Twin Share' THEN 6000000 ELSE 7000000 END;

  UPDATE public.participants
  SET full_name = btrim(p_full_name),
      phone_number = btrim(p_phone_number),
      member_number = v_member_number,
      institution = v_institution,
      position = NULLIF(btrim(coalesce(p_position, '')), ''),
      kka_name = NULLIF(btrim(coalesce(p_kka_name, '')), ''),
      package_type = btrim(p_package_type),
      participation_scope = btrim(p_participation_scope),
      polo_size = btrim(p_polo_size),
      polo_model = btrim(p_polo_model),
      actuarial_consultant_status = btrim(p_actuarial_consultant_status),
      attends_pai_congress = p_attends_pai_congress
  WHERE id = p_participant_id;

  UPDATE public.registration_billings
  SET full_name = btrim(p_full_name),
      kka_name = NULLIF(btrim(coalesce(p_kka_name, '')), ''),
      package_type = btrim(p_package_type),
      participation_scope = btrim(p_participation_scope),
      amount = v_amount
  WHERE participant_id = p_participant_id;

  IF p_travel IS NULL THEN
    DELETE FROM public.participant_travel WHERE participant_id = p_participant_id;
  ELSE
    INSERT INTO public.participant_travel (
      participant_id, outbound_date, outbound_time, outbound_transport_mode,
      outbound_transport_number, outbound_origin, outbound_destination,
      return_date, return_time, return_transport_mode, return_transport_number,
      return_destination, extend_stay
    ) VALUES (
      p_participant_id,
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
    ON CONFLICT (participant_id) DO UPDATE SET
      outbound_date = EXCLUDED.outbound_date,
      outbound_time = EXCLUDED.outbound_time,
      outbound_transport_mode = EXCLUDED.outbound_transport_mode,
      outbound_transport_number = EXCLUDED.outbound_transport_number,
      outbound_origin = EXCLUDED.outbound_origin,
      outbound_destination = EXCLUDED.outbound_destination,
      return_date = EXCLUDED.return_date,
      return_time = EXCLUDED.return_time,
      return_transport_mode = EXCLUDED.return_transport_mode,
      return_transport_number = EXCLUDED.return_transport_number,
      return_destination = EXCLUDED.return_destination,
      extend_stay = EXCLUDED.extend_stay;
  END IF;

  RETURN QUERY SELECT 'UPDATED'::text, v_amount;
EXCEPTION
  WHEN unique_violation THEN
    RETURN QUERY SELECT 'DUPLICATE_MEMBER_NUMBER'::text, NULL::bigint;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_participant_data(
  uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, boolean, jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_participant_data(
  uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, boolean, jsonb
) TO service_role;
