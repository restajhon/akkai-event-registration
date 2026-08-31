-- H-3D1 service-role-only RPC foundation.
-- Existing registration, scan, manual check-in, realtime, email, and QR
-- contracts are intentionally preserved.

CREATE OR REPLACE FUNCTION public.create_participant_with_registration_reservation_v2(
  p_full_name text,
  p_email text,
  p_phone_number text,
  p_kka_name text,
  p_participant_category text,
  p_member_number text,
  p_polo_size text,
  p_polo_model text,
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
  v_participant_category text;
  v_member_number text;
  v_polo_size text;
  v_polo_model text;
  v_constraint_name text;
BEGIN
  v_full_name := btrim(COALESCE(p_full_name, ''));
  v_email := lower(btrim(COALESCE(p_email, '')));
  v_phone_number := btrim(COALESCE(p_phone_number, ''));
  v_kka_name := btrim(COALESCE(p_kka_name, ''));
  v_participant_category := btrim(COALESCE(p_participant_category, ''));
  v_member_number := CASE
    WHEN p_member_number IS NULL OR btrim(p_member_number) = '' THEN NULL
    ELSE upper(btrim(p_member_number))
  END;
  v_polo_size := btrim(COALESCE(p_polo_size, ''));
  v_polo_model := btrim(COALESCE(p_polo_model, ''));

  IF v_full_name !~ '^.{3,100}$'
     OR v_email = ''
     OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     OR v_phone_number = ''
     OR v_kka_name !~ '^.{1,150}$'
     OR v_participant_category !~ '^.{1,100}$'
     OR v_polo_size NOT IN ('S', 'M', 'L', 'XL', 'XXL', 'XXXL')
     OR v_polo_model NOT IN ('Lengan Panjang', 'Lengan Pendek')
     OR p_privacy_consent_at IS NULL
     OR (
       v_member_number IS NOT NULL
       AND char_length(v_member_number) NOT BETWEEN 3 AND 50
     ) THEN
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
      privacy_consent_at,
      email_generation,
      email_status
    )
    VALUES (
      v_full_name,
      v_email,
      v_phone_number,
      v_participant_category,
      v_member_number,
      v_kka_name,
      v_polo_size,
      v_polo_model,
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

REVOKE EXECUTE ON FUNCTION public.create_participant_with_registration_reservation_v2(text, text, text, text, text, text, text, text, timestamptz)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_participant_with_registration_reservation_v2(text, text, text, text, text, text, text, text, timestamptz)
TO service_role;

CREATE OR REPLACE FUNCTION public.upsert_participant_travel(
  p_registration_id text,
  p_registered_email text,
  p_outbound_date date,
  p_outbound_time time,
  p_outbound_transport_mode text,
  p_outbound_transport_number text,
  p_outbound_origin text,
  p_outbound_destination text,
  p_return_date date,
  p_return_time time,
  p_return_transport_mode text,
  p_return_transport_number text,
  p_return_destination text,
  p_extend_stay boolean
)
RETURNS TABLE (result_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_registration_id text;
  v_email text;
  v_outbound_mode text;
  v_outbound_number text;
  v_outbound_origin text;
  v_outbound_destination text;
  v_return_mode text;
  v_return_number text;
  v_return_destination text;
  v_participant_id uuid;
BEGIN
  v_registration_id := upper(btrim(COALESCE(p_registration_id, '')));
  v_email := lower(btrim(COALESCE(p_registered_email, '')));
  v_outbound_mode := btrim(COALESCE(p_outbound_transport_mode, ''));
  v_outbound_number := NULLIF(btrim(COALESCE(p_outbound_transport_number, '')), '');
  v_outbound_origin := btrim(COALESCE(p_outbound_origin, ''));
  v_outbound_destination := btrim(COALESCE(p_outbound_destination, ''));
  v_return_mode := btrim(COALESCE(p_return_transport_mode, ''));
  v_return_number := NULLIF(btrim(COALESCE(p_return_transport_number, '')), '');
  v_return_destination := btrim(COALESCE(p_return_destination, ''));

  IF v_registration_id !~ '^AKKAI26-[0-9]{6}$'
     OR v_email = ''
     OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     OR p_outbound_date IS NULL
     OR p_outbound_time IS NULL
     OR v_outbound_mode !~ '^.{1,50}$'
     OR v_outbound_origin !~ '^.{1,150}$'
     OR v_outbound_destination !~ '^.{1,150}$'
     OR p_return_date IS NULL
     OR p_return_time IS NULL
     OR v_return_mode !~ '^.{1,50}$'
     OR v_return_destination !~ '^.{1,150}$'
     OR p_return_date < p_outbound_date
     OR (
       v_outbound_number IS NOT NULL
       AND char_length(v_outbound_number) NOT BETWEEN 1 AND 100
     )
     OR (
       v_return_number IS NOT NULL
       AND char_length(v_return_number) NOT BETWEEN 1 AND 100
     )
     OR p_extend_stay IS NULL THEN
    RETURN QUERY SELECT 'INVALID_INPUT'::text;
    RETURN;
  END IF;

  SELECT participant.id
  INTO v_participant_id
  FROM public.participants AS participant
  WHERE participant.registration_id = v_registration_id
    AND participant.email = v_email
    AND participant.registration_status = 'REGISTERED'::public.registration_status
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'INVALID_IDENTITY'::text;
    RETURN;
  END IF;

  INSERT INTO public.participant_travel (
    participant_id,
    outbound_date,
    outbound_time,
    outbound_transport_mode,
    outbound_transport_number,
    outbound_origin,
    outbound_destination,
    return_date,
    return_time,
    return_transport_mode,
    return_transport_number,
    return_destination,
    extend_stay
  )
  VALUES (
    v_participant_id,
    p_outbound_date,
    p_outbound_time,
    v_outbound_mode,
    v_outbound_number,
    v_outbound_origin,
    v_outbound_destination,
    p_return_date,
    p_return_time,
    v_return_mode,
    v_return_number,
    v_return_destination,
    p_extend_stay
  )
  ON CONFLICT (participant_id) DO UPDATE
  SET outbound_date = EXCLUDED.outbound_date,
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
      extend_stay = EXCLUDED.extend_stay,
      updated_at = now();

  RETURN QUERY SELECT 'SAVED'::text;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.upsert_participant_travel(text, text, date, time, text, text, text, text, date, time, text, text, text, boolean)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.upsert_participant_travel(text, text, date, time, text, text, text, text, date, time, text, text, text, boolean)
TO service_role;

CREATE OR REPLACE FUNCTION public.upsert_participant_room_assignment(
  p_registration_id text,
  p_room_number text,
  p_room_type text,
  p_check_in_date date,
  p_check_out_date date,
  p_notes text,
  p_updated_by uuid
)
RETURNS TABLE (result_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_registration_id text;
  v_room_number text;
  v_room_type text;
  v_notes text;
  v_participant public.participants%ROWTYPE;
  v_actor public.profiles%ROWTYPE;
BEGIN
  v_registration_id := upper(btrim(COALESCE(p_registration_id, '')));
  v_room_number := NULLIF(btrim(COALESCE(p_room_number, '')), '');
  v_room_type := NULLIF(btrim(COALESCE(p_room_type, '')), '');
  v_notes := NULLIF(btrim(COALESCE(p_notes, '')), '');

  SELECT profile.*
  INTO v_actor
  FROM public.profiles AS profile
  WHERE profile.id = p_updated_by
  FOR UPDATE;

  IF NOT FOUND OR v_actor.is_active IS DISTINCT FROM true
     OR v_actor.role <> 'ADMIN'::public.user_role THEN
    RETURN QUERY SELECT 'UNAUTHORIZED'::text;
    RETURN;
  END IF;

  SELECT participant.*
  INTO v_participant
  FROM public.participants AS participant
  WHERE participant.registration_id = v_registration_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'NOT_FOUND'::text;
    RETURN;
  END IF;

  IF v_participant.registration_status <> 'REGISTERED'::public.registration_status THEN
    RETURN QUERY SELECT 'PARTICIPANT_NOT_ACTIVE'::text;
    RETURN;
  END IF;

  IF (
    v_room_number IS NOT NULL
    AND char_length(v_room_number) NOT BETWEEN 1 AND 50
  ) OR (
    v_room_type IS NOT NULL
    AND char_length(v_room_type) NOT BETWEEN 1 AND 100
  ) OR (
    v_notes IS NOT NULL
    AND char_length(v_notes) NOT BETWEEN 1 AND 500
  ) OR (
    p_check_in_date IS NOT NULL
    AND p_check_out_date IS NOT NULL
    AND p_check_out_date < p_check_in_date
  ) THEN
    RETURN QUERY SELECT 'INVALID_INPUT'::text;
    RETURN;
  END IF;

  INSERT INTO public.participant_room_assignments (
    participant_id,
    room_number,
    room_type,
    check_in_date,
    check_out_date,
    notes,
    updated_by
  )
  VALUES (
    v_participant.id,
    v_room_number,
    v_room_type,
    p_check_in_date,
    p_check_out_date,
    v_notes,
    v_actor.id
  )
  ON CONFLICT (participant_id) DO UPDATE
  SET room_number = EXCLUDED.room_number,
      room_type = EXCLUDED.room_type,
      check_in_date = EXCLUDED.check_in_date,
      check_out_date = EXCLUDED.check_out_date,
      notes = EXCLUDED.notes,
      updated_by = EXCLUDED.updated_by,
      updated_at = now();

  RETURN QUERY SELECT 'SAVED'::text;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.upsert_participant_room_assignment(text, text, text, date, date, text, uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.upsert_participant_room_assignment(text, text, text, date, date, text, uuid)
TO service_role;

CREATE OR REPLACE FUNCTION public.upsert_participant_pickup_assignment(
  p_registration_id text,
  p_status text,
  p_pickup_at timestamptz,
  p_pickup_point text,
  p_vehicle_label text,
  p_pic_driver text,
  p_notes text,
  p_updated_by uuid
)
RETURNS TABLE (result_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_registration_id text;
  v_status text;
  v_pickup_point text;
  v_vehicle_label text;
  v_pic_driver text;
  v_notes text;
  v_participant public.participants%ROWTYPE;
  v_actor public.profiles%ROWTYPE;
BEGIN
  v_registration_id := upper(btrim(COALESCE(p_registration_id, '')));
  v_status := upper(btrim(COALESCE(p_status, '')));
  v_pickup_point := NULLIF(btrim(COALESCE(p_pickup_point, '')), '');
  v_vehicle_label := NULLIF(btrim(COALESCE(p_vehicle_label, '')), '');
  v_pic_driver := NULLIF(btrim(COALESCE(p_pic_driver, '')), '');
  v_notes := NULLIF(btrim(COALESCE(p_notes, '')), '');

  SELECT profile.*
  INTO v_actor
  FROM public.profiles AS profile
  WHERE profile.id = p_updated_by
  FOR UPDATE;

  IF NOT FOUND OR v_actor.is_active IS DISTINCT FROM true
     OR v_actor.role <> 'ADMIN'::public.user_role THEN
    RETURN QUERY SELECT 'UNAUTHORIZED'::text;
    RETURN;
  END IF;

  SELECT participant.*
  INTO v_participant
  FROM public.participants AS participant
  WHERE participant.registration_id = v_registration_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'NOT_FOUND'::text;
    RETURN;
  END IF;

  IF v_participant.registration_status <> 'REGISTERED'::public.registration_status THEN
    RETURN QUERY SELECT 'PARTICIPANT_NOT_ACTIVE'::text;
    RETURN;
  END IF;

  IF v_status NOT IN ('SCHEDULED', 'COMPLETED', 'CANCELLED')
     OR (
       v_status IN ('SCHEDULED', 'COMPLETED')
       AND (p_pickup_at IS NULL OR v_pickup_point IS NULL)
     ) OR (
       v_pickup_point IS NOT NULL
       AND char_length(v_pickup_point) NOT BETWEEN 1 AND 150
     ) OR (
       v_vehicle_label IS NOT NULL
       AND char_length(v_vehicle_label) NOT BETWEEN 1 AND 100
     ) OR (
       v_pic_driver IS NOT NULL
       AND char_length(v_pic_driver) NOT BETWEEN 1 AND 150
     ) OR (
       v_notes IS NOT NULL
       AND char_length(v_notes) NOT BETWEEN 1 AND 500
     ) THEN
    RETURN QUERY SELECT 'INVALID_INPUT'::text;
    RETURN;
  END IF;

  INSERT INTO public.participant_pickup_assignments (
    participant_id,
    status,
    pickup_at,
    pickup_point,
    vehicle_label,
    pic_driver,
    notes,
    updated_by
  )
  VALUES (
    v_participant.id,
    v_status,
    p_pickup_at,
    v_pickup_point,
    v_vehicle_label,
    v_pic_driver,
    v_notes,
    v_actor.id
  )
  ON CONFLICT (participant_id) DO UPDATE
  SET status = EXCLUDED.status,
      pickup_at = EXCLUDED.pickup_at,
      pickup_point = EXCLUDED.pickup_point,
      vehicle_label = EXCLUDED.vehicle_label,
      pic_driver = EXCLUDED.pic_driver,
      notes = EXCLUDED.notes,
      updated_by = EXCLUDED.updated_by,
      updated_at = now();

  RETURN QUERY SELECT 'SAVED'::text;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.upsert_participant_pickup_assignment(text, text, timestamptz, text, text, text, text, uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.upsert_participant_pickup_assignment(text, text, timestamptz, text, text, text, text, uuid)
TO service_role;
