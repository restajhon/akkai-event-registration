-- Route Live Display broadcasts by station while keeping Dashboard broadcasts
-- session-wide. Attendance and scan-event writes remain the source of truth.

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
    'eventAt', NEW.scanned_at
  );

  -- Duplicate feedback is useful to the station display, even though it does
  -- not change the session attendance count.
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

  -- Dashboard refreshes only for attendance-changing outcomes.
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

DROP POLICY IF EXISTS live_display_broadcast_select
ON realtime.messages;

CREATE POLICY live_display_broadcast_select
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.messages.extension = 'broadcast'
  AND (
    realtime.topic() LIKE 'akkai:dashboard:%'
    OR realtime.topic() LIKE 'akkai:display:station:%'
  )
  AND EXISTS (
    SELECT 1
    FROM public.profiles AS p
    WHERE p.id = (SELECT auth.uid())
      AND p.is_active = true
      AND p.role IN (
        'ADMIN'::public.user_role,
        'OPERATOR'::public.user_role
      )
  )
);
