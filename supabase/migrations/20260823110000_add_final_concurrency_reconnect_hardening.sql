-- Final H-2 concurrency and reconnect hardening.
-- The event sequence is a deterministic display-order token, not a commit-order
-- claim. Sequence gaps are acceptable if a transaction rolls back.

ALTER TABLE public.scan_events
  ADD COLUMN event_sequence bigint;

CREATE SEQUENCE public.scan_events_event_sequence_seq;

ALTER SEQUENCE public.scan_events_event_sequence_seq
  OWNED BY public.scan_events.event_sequence;

WITH ordered_events AS (
  SELECT
    id,
    row_number() OVER (ORDER BY scanned_at ASC, id ASC) AS event_sequence
  FROM public.scan_events
)
UPDATE public.scan_events AS scan_event
SET event_sequence = ordered_events.event_sequence
FROM ordered_events
WHERE scan_event.id = ordered_events.id;

SELECT setval(
  'public.scan_events_event_sequence_seq',
  COALESCE((SELECT max(event_sequence) FROM public.scan_events), 0) + 1,
  false
);

ALTER TABLE public.scan_events
  ALTER COLUMN event_sequence SET DEFAULT nextval(
    'public.scan_events_event_sequence_seq'
  ),
  ALTER COLUMN event_sequence SET NOT NULL;

ALTER TABLE public.scan_events
  ADD CONSTRAINT scan_events_event_sequence_unique UNIQUE (event_sequence);

REVOKE ALL ON SEQUENCE public.scan_events_event_sequence_seq
FROM PUBLIC;

REVOKE ALL ON SEQUENCE public.scan_events_event_sequence_seq
FROM anon;

REVOKE ALL ON SEQUENCE public.scan_events_event_sequence_seq
FROM authenticated;

GRANT USAGE ON SEQUENCE public.scan_events_event_sequence_seq
TO service_role;

-- Pair in the same profile -> station -> session order used by scanner
-- processing. The sequential locks preserve the existing boolean result and
-- all existing pairing checks while making the lock order explicit.
CREATE OR REPLACE FUNCTION public.pair_scanner_station(
  p_station_id uuid,
  p_operator_profile_id uuid,
  p_expected_pairing_code_hash text
)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_station public.scanner_stations%ROWTYPE;
  v_session public.sessions%ROWTYPE;
BEGIN
  SELECT profile.*
  INTO v_profile
  FROM public.profiles AS profile
  WHERE profile.id = p_operator_profile_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_profile.is_active IS DISTINCT FROM true
     OR v_profile.role NOT IN (
       'ADMIN'::public.user_role,
       'OPERATOR'::public.user_role
     ) THEN
    RETURN false;
  END IF;

  SELECT station.*
  INTO v_station
  FROM public.scanner_stations AS station
  WHERE station.id = p_station_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_station.status <> 'WAITING_PAIRING'::public.station_status
     OR v_station.paired_operator_id IS NOT NULL
     OR v_station.closed_at IS NOT NULL
     OR v_station.pairing_expires_at <= now()
     OR v_station.pairing_code_hash IS DISTINCT FROM p_expected_pairing_code_hash THEN
    RETURN false;
  END IF;

  SELECT session.*
  INTO v_session
  FROM public.sessions AS session
  WHERE session.id = v_station.session_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_session.status <> 'OPEN'::public.session_status THEN
    RETURN false;
  END IF;

  UPDATE public.scanner_stations AS station
  SET status = 'PAIRED'::public.station_status,
      paired_operator_id = p_operator_profile_id,
      paired_at = now(),
      last_activity_at = now()
  WHERE station.id = v_station.id;

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.pair_scanner_station(uuid, uuid, text)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.pair_scanner_station(uuid, uuid, text)
TO service_role;

-- Create a station only while its session row is locked and OPEN. The server
-- action remains responsible for ADMIN authorization and secret generation.
CREATE OR REPLACE FUNCTION public.create_scanner_station(
  p_station_name text,
  p_session_id uuid,
  p_pairing_code_hash text,
  p_pairing_token_hash text,
  p_pairing_expires_at timestamptz,
  p_created_by uuid
)
RETURNS TABLE (
  status_code text,
  station_id uuid
)
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_session public.sessions%ROWTYPE;
BEGIN
  status_code := NULL;
  station_id := NULL;

  SELECT session.*
  INTO v_session
  FROM public.sessions AS session
  WHERE session.id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    status_code := 'SESSION_NOT_FOUND';
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_session.status <> 'OPEN'::public.session_status THEN
    status_code := 'SESSION_CLOSED';
    RETURN NEXT;
    RETURN;
  END IF;

  INSERT INTO public.scanner_stations (
    station_name,
    session_id,
    status,
    pairing_code_hash,
    pairing_token_hash,
    pairing_expires_at,
    paired_operator_id,
    paired_at,
    last_activity_at,
    created_by,
    closed_at
  )
  VALUES (
    p_station_name,
    v_session.id,
    'WAITING_PAIRING'::public.station_status,
    p_pairing_code_hash,
    p_pairing_token_hash,
    p_pairing_expires_at,
    NULL,
    NULL,
    NULL,
    p_created_by,
    NULL
  )
  RETURNING id INTO station_id;

  status_code := 'CREATED';
  RETURN NEXT;
  RETURN;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_scanner_station(text, uuid, text, text, timestamptz, uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_scanner_station(text, uuid, text, text, timestamptz, uuid)
TO service_role;

-- Add the database ordering token to the existing display-safe payload. Topic
-- routing remains the H-2D1 station/dashboard design.
CREATE OR REPLACE FUNCTION public.broadcast_scan_event_to_live_display()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_registration_id text;
  v_full_name text;
  v_institution text;
  v_participant_category text;
  v_session_code text;
  v_session_name text;
  v_station_name text;
  v_status text;
  v_payload jsonb;
BEGIN
  IF NEW.result_status NOT IN (
    'SUCCESS'::public.scan_result_status,
    'SUCCESS_WITH_WARNING'::public.scan_result_status,
    'ALREADY_CHECKED_IN'::public.scan_result_status
  ) THEN
    RETURN NEW;
  END IF;

  IF NEW.participant_id IS NULL THEN
    RAISE EXCEPTION 'Eligible scan event has no participant';
  END IF;

  SELECT
    p.registration_id,
    p.full_name,
    p.institution,
    p.participant_category
  INTO STRICT
    v_registration_id,
    v_full_name,
    v_institution,
    v_participant_category
  FROM public.participants AS p
  WHERE p.id = NEW.participant_id;

  SELECT
    s.code,
    s.name
  INTO STRICT
    v_session_code,
    v_session_name
  FROM public.sessions AS s
  WHERE s.id = NEW.session_id;

  SELECT ss.station_name
  INTO STRICT v_station_name
  FROM public.scanner_stations AS ss
  WHERE ss.id = NEW.station_id;

  v_status := CASE NEW.result_status
    WHEN 'SUCCESS'::public.scan_result_status THEN 'success'
    WHEN 'SUCCESS_WITH_WARNING'::public.scan_result_status THEN 'success-with-warning'
    WHEN 'ALREADY_CHECKED_IN'::public.scan_result_status THEN 'already-checked-in'
    ELSE NULL
  END;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Unsupported Live Display scan status';
  END IF;

  v_payload := jsonb_build_object(
    'status', v_status,
    'participant', jsonb_build_object(
      'registrationId', v_registration_id,
      'fullName', v_full_name,
      'institution', v_institution,
      'participantCategory', v_participant_category
    ),
    'session', jsonb_build_object(
      'code', v_session_code,
      'name', v_session_name
    ),
    'station', jsonb_build_object(
      'name', v_station_name
    ),
    'eventAt', NEW.scanned_at,
    'eventSequence', NEW.event_sequence::text
  );

  BEGIN
    PERFORM realtime.send(
      v_payload,
      'participant-check-in',
      'akkai:display:station:' || NEW.station_id::text,
      true
    );
  EXCEPTION
    WHEN OTHERS THEN
      NULL;
  END;

  IF NEW.result_status IN (
    'SUCCESS'::public.scan_result_status,
    'SUCCESS_WITH_WARNING'::public.scan_result_status
  ) THEN
    BEGIN
      PERFORM realtime.send(
        v_payload,
        'participant-check-in',
        'akkai:dashboard:' || NEW.session_id::text,
        true
      );
    EXCEPTION
      WHEN OTHERS THEN
        NULL;
    END;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.broadcast_scan_event_to_live_display()
FROM PUBLIC;

REVOKE ALL ON FUNCTION public.broadcast_scan_event_to_live_display()
FROM anon;

REVOKE ALL ON FUNCTION public.broadcast_scan_event_to_live_display()
FROM authenticated;
