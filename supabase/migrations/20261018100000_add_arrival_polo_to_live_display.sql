-- Carry the participant's saved polo selection through Arrival Live Display
-- broadcasts. Non-Arrival session payloads retain their existing shape.

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
  v_polo_model text;
  v_polo_size text;
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
    p.participant_category,
    p.polo_model,
    p.polo_size
  INTO STRICT
    v_registration_id,
    v_full_name,
    v_institution,
    v_participant_category,
    v_polo_model,
    v_polo_size
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
    ) || CASE
      WHEN v_session_code = 'ARRIVAL' THEN jsonb_strip_nulls(jsonb_build_object(
        'poloModel', NULLIF(btrim(v_polo_model), ''),
        'poloSize', NULLIF(btrim(v_polo_size), '')
      ))
      ELSE '{}'::jsonb
    END,
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
