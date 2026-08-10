-- Atomically process a manual participant check-in for an owned scanner station.
-- The registration ID is resolved inside the transaction and the manual method
-- is fixed by the function rather than supplied by the caller.

CREATE OR REPLACE FUNCTION public.process_manual_check_in(
  p_registration_id text,
  p_station_id uuid,
  p_operator_profile_id uuid
)
RETURNS TABLE (
  status_code text,
  result_status public.scan_result_status,
  registration_id text,
  full_name text,
  institution text,
  participant_category text,
  session_code text,
  session_name text,
  checked_at timestamptz,
  is_duplicate boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_operator public.profiles%ROWTYPE;
  v_station public.scanner_stations%ROWTYPE;
  v_session public.sessions%ROWTYPE;
  v_participant public.participants%ROWTYPE;
  v_attendance public.attendance%ROWTYPE;
  v_has_arrival boolean;
BEGIN
  status_code := NULL;
  result_status := NULL;
  registration_id := NULL;
  full_name := NULL;
  institution := NULL;
  participant_category := NULL;
  session_code := NULL;
  session_name := NULL;
  checked_at := NULL;
  is_duplicate := false;

  -- Keep the first lock in the same order as process_qr_scan.
  SELECT profile.*
  INTO v_operator
  FROM public.profiles AS profile
  WHERE profile.id = p_operator_profile_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_operator.is_active IS DISTINCT FROM true
     OR v_operator.role NOT IN (
       'ADMIN'::public.user_role,
       'OPERATOR'::public.user_role
     ) THEN
    status_code := 'unauthorized-operator';
    result_status := 'ERROR'::public.scan_result_status;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Lock the station before deriving and locking its session.
  SELECT station.*
  INTO v_station
  FROM public.scanner_stations AS station
  WHERE station.id = p_station_id
  FOR UPDATE;

  IF NOT FOUND THEN
    status_code := 'invalid-station';
    result_status := 'STATION_INACTIVE'::public.scan_result_status;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT session.*
  INTO v_session
  FROM public.sessions AS session
  WHERE session.id = v_station.session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    status_code := 'invalid-station';
    result_status := 'STATION_INACTIVE'::public.scan_result_status;
    RETURN NEXT;
    RETURN;
  END IF;

  session_code := v_session.code;
  session_name := v_session.name;

  IF v_station.status = 'CLOSED'::public.station_status
     OR v_station.closed_at IS NOT NULL THEN
    status_code := 'invalid-station';
    result_status := 'STATION_INACTIVE'::public.scan_result_status;

    INSERT INTO public.scan_events (
      station_id,
      participant_id,
      session_id,
      attendance_id,
      result_status,
      result_message,
      operator_id,
      metadata
    )
    VALUES (
      v_station.id,
      NULL,
      v_session.id,
      NULL,
      result_status,
      'Station sudah ditutup.',
      v_operator.id,
      '{"operation": "manual-check-in"}'::jsonb
    );

    RETURN NEXT;
    RETURN;
  END IF;

  IF v_station.status NOT IN (
       'PAIRED'::public.station_status,
       'ACTIVE'::public.station_status
     ) THEN
    status_code := 'station-not-paired';
    result_status := 'STATION_INACTIVE'::public.scan_result_status;

    INSERT INTO public.scan_events (
      station_id,
      participant_id,
      session_id,
      attendance_id,
      result_status,
      result_message,
      operator_id,
      metadata
    )
    VALUES (
      v_station.id,
      NULL,
      v_session.id,
      NULL,
      result_status,
      'Station belum siap melakukan check-in manual.',
      v_operator.id,
      '{"operation": "manual-check-in"}'::jsonb
    );

    RETURN NEXT;
    RETURN;
  END IF;

  IF v_station.paired_operator_id IS NULL THEN
    status_code := 'station-not-paired';
    result_status := 'STATION_INACTIVE'::public.scan_result_status;

    INSERT INTO public.scan_events (
      station_id,
      participant_id,
      session_id,
      attendance_id,
      result_status,
      result_message,
      operator_id,
      metadata
    )
    VALUES (
      v_station.id,
      NULL,
      v_session.id,
      NULL,
      result_status,
      'Station belum terikat ke operator.',
      v_operator.id,
      '{"operation": "manual-check-in"}'::jsonb
    );

    RETURN NEXT;
    RETURN;
  END IF;

  IF v_station.paired_operator_id <> p_operator_profile_id THEN
    status_code := 'station-owned-by-other-operator';
    result_status := 'STATION_INACTIVE'::public.scan_result_status;

    INSERT INTO public.scan_events (
      station_id,
      participant_id,
      session_id,
      attendance_id,
      result_status,
      result_message,
      operator_id,
      metadata
    )
    VALUES (
      v_station.id,
      NULL,
      v_session.id,
      NULL,
      result_status,
      'Station terikat ke operator lain.',
      v_operator.id,
      '{"operation": "manual-check-in"}'::jsonb
    );

    RETURN NEXT;
    RETURN;
  END IF;

  -- Match QR activity semantics for a valid owned station.
  UPDATE public.scanner_stations
  SET last_activity_at = now()
  WHERE id = v_station.id;

  IF v_session.status = 'CLOSED'::public.session_status THEN
    status_code := 'closed-session';
    result_status := 'SESSION_CLOSED'::public.scan_result_status;

    INSERT INTO public.scan_events (
      station_id,
      participant_id,
      session_id,
      attendance_id,
      result_status,
      result_message,
      operator_id,
      metadata
    )
    VALUES (
      v_station.id,
      NULL,
      v_session.id,
      NULL,
      result_status,
      'Sesi check-in manual belum dibuka atau telah ditutup.',
      v_operator.id,
      '{"operation": "manual-check-in"}'::jsonb
    );

    RETURN NEXT;
    RETURN;
  END IF;

  p_registration_id := btrim(p_registration_id);

  IF p_registration_id IS NULL OR p_registration_id = '' THEN
    status_code := 'invalid-request';
    result_status := 'ERROR'::public.scan_result_status;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Resolve and lock the participant only after operator, station, and session.
  SELECT participant.*
  INTO v_participant
  FROM public.participants AS participant
  WHERE participant.registration_id = p_registration_id
  FOR UPDATE;

  IF NOT FOUND THEN
    status_code := 'participant-not-found';
    result_status := 'ERROR'::public.scan_result_status;

    INSERT INTO public.scan_events (
      station_id,
      participant_id,
      session_id,
      attendance_id,
      result_status,
      result_message,
      operator_id,
      metadata
    )
    VALUES (
      v_station.id,
      NULL,
      v_session.id,
      NULL,
      result_status,
      'Peserta tidak ditemukan.',
      v_operator.id,
      '{"operation": "manual-check-in"}'::jsonb
    );

    RETURN NEXT;
    RETURN;
  END IF;

  registration_id := v_participant.registration_id;
  full_name := v_participant.full_name;
  institution := v_participant.institution;
  participant_category := v_participant.participant_category;

  IF v_participant.registration_status <> 'REGISTERED'::public.registration_status THEN
    status_code := 'cancelled-participant';
    result_status := 'CANCELLED_PARTICIPANT'::public.scan_result_status;

    INSERT INTO public.scan_events (
      station_id,
      participant_id,
      session_id,
      attendance_id,
      result_status,
      result_message,
      operator_id,
      metadata
    )
    VALUES (
      v_station.id,
      v_participant.id,
      v_session.id,
      NULL,
      result_status,
      'Pendaftaran peserta telah dibatalkan.',
      v_operator.id,
      '{"operation": "manual-check-in"}'::jsonb
    );

    RETURN NEXT;
    RETURN;
  END IF;

  INSERT INTO public.attendance (
    participant_id,
    session_id,
    check_in_method,
    operator_id,
    station_id,
    notes
  )
  VALUES (
    v_participant.id,
    v_session.id,
    'MANUAL'::public.check_in_method,
    v_operator.id,
    v_station.id,
    NULL
  )
  ON CONFLICT (participant_id, session_id) DO NOTHING
  RETURNING *
  INTO v_attendance;

  IF NOT FOUND THEN
    SELECT attendance.*
    INTO v_attendance
    FROM public.attendance AS attendance
    WHERE attendance.participant_id = v_participant.id
      AND attendance.session_id = v_session.id
    FOR SHARE;

    IF NOT FOUND THEN
      RAISE EXCEPTION
        'Attendance conflict did not resolve to an existing row.'
        USING ERRCODE = 'P0001';
    END IF;

    status_code := 'already-checked-in';
    result_status := 'ALREADY_CHECKED_IN'::public.scan_result_status;
    checked_at := v_attendance.check_in_time;
    is_duplicate := true;

    INSERT INTO public.scan_events (
      station_id,
      participant_id,
      session_id,
      attendance_id,
      result_status,
      result_message,
      operator_id,
      metadata
    )
    VALUES (
      v_station.id,
      v_participant.id,
      v_session.id,
      v_attendance.id,
      result_status,
      'Peserta sudah check-in pada sesi ini melalui proses manual.',
      v_operator.id,
      '{"operation": "manual-check-in"}'::jsonb
    );

    RETURN NEXT;
    RETURN;
  END IF;

  checked_at := v_attendance.check_in_time;

  IF v_session.code = 'SEMINAR' THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.attendance AS arrival_attendance
      INNER JOIN public.sessions AS arrival_session
        ON arrival_session.id = arrival_attendance.session_id
      WHERE arrival_attendance.participant_id = v_participant.id
        AND arrival_session.code = 'ARRIVAL'
    )
    INTO v_has_arrival;
  ELSE
    v_has_arrival := true;
  END IF;

  IF v_has_arrival THEN
    status_code := 'success';
    result_status := 'SUCCESS'::public.scan_result_status;

    INSERT INTO public.scan_events (
      station_id,
      participant_id,
      session_id,
      attendance_id,
      result_status,
      result_message,
      operator_id,
      metadata
    )
    VALUES (
      v_station.id,
      v_participant.id,
      v_session.id,
      v_attendance.id,
      result_status,
      'Check-in manual berhasil.',
      v_operator.id,
      '{"operation": "manual-check-in"}'::jsonb
    );
  ELSE
    status_code := 'success-with-warning';
    result_status := 'SUCCESS_WITH_WARNING'::public.scan_result_status;

    INSERT INTO public.scan_events (
      station_id,
      participant_id,
      session_id,
      attendance_id,
      result_status,
      result_message,
      operator_id,
      metadata
    )
    VALUES (
      v_station.id,
      v_participant.id,
      v_session.id,
      v_attendance.id,
      result_status,
      'Check-in manual seminar berhasil; peserta belum tercatat pada sesi ARRIVAL.',
      v_operator.id,
      '{"operation": "manual-check-in"}'::jsonb
    );
  END IF;

  RETURN NEXT;
  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.process_manual_check_in(text, uuid, uuid)
FROM PUBLIC;

REVOKE ALL ON FUNCTION public.process_manual_check_in(text, uuid, uuid)
FROM anon;

REVOKE ALL ON FUNCTION public.process_manual_check_in(text, uuid, uuid)
FROM authenticated;

GRANT EXECUTE ON FUNCTION public.process_manual_check_in(text, uuid, uuid)
TO service_role;
