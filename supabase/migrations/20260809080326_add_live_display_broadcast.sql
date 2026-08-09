-- Broadcast eligible scan events to authenticated Live Display clients.

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
  v_topic text;
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

  SELECT
    ss.station_name
  INTO STRICT
    v_station_name
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

  v_topic := 'akkai:display:' || NEW.session_id::text;

  BEGIN
    PERFORM realtime.send(
      v_payload,
      'participant-check-in',
      v_topic,
      true
    );
  EXCEPTION
    WHEN OTHERS THEN
      NULL;
  END;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.broadcast_scan_event_to_live_display()
FROM PUBLIC;

REVOKE ALL ON FUNCTION public.broadcast_scan_event_to_live_display()
FROM anon;

REVOKE ALL ON FUNCTION public.broadcast_scan_event_to_live_display()
FROM authenticated;

CREATE OR REPLACE TRIGGER scan_events_broadcast_to_live_display
AFTER INSERT ON public.scan_events
FOR EACH ROW
EXECUTE FUNCTION public.broadcast_scan_event_to_live_display();

CREATE POLICY live_display_broadcast_select
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.messages.extension = 'broadcast'
  AND realtime.topic() LIKE 'akkai:display:%'
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
