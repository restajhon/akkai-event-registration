-- Enforce attendance and scan-event relationships without changing existing
-- operational rows or RPC behavior.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.attendance
    WHERE check_in_method = 'QR'::public.check_in_method
      AND station_id IS NULL
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Migration aborted: QR attendance without a station exists.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.attendance AS attendance
    WHERE attendance.station_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.scanner_stations AS station
        WHERE station.id = attendance.station_id
          AND station.session_id = attendance.session_id
      )
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'foreign_key_violation',
      MESSAGE = 'Migration aborted: attendance station/session mismatch exists.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.scan_events AS scan_event
    WHERE (
        scan_event.result_status IN (
          'SUCCESS'::public.scan_result_status,
          'SUCCESS_WITH_WARNING'::public.scan_result_status,
          'ALREADY_CHECKED_IN'::public.scan_result_status
        )
        AND (
          scan_event.participant_id IS NULL
          OR scan_event.attendance_id IS NULL
        )
      )
      OR (
        scan_event.result_status = 'INVALID_QR'::public.scan_result_status
        AND (
          scan_event.participant_id IS NOT NULL
          OR scan_event.attendance_id IS NOT NULL
        )
      )
      OR (
        scan_event.result_status = 'CANCELLED_PARTICIPANT'::public.scan_result_status
        AND (
          scan_event.participant_id IS NULL
          OR scan_event.attendance_id IS NOT NULL
        )
      )
      OR (
        scan_event.result_status IN (
          'SESSION_CLOSED'::public.scan_result_status,
          'STATION_INACTIVE'::public.scan_result_status
        )
        AND (
          scan_event.participant_id IS NOT NULL
          OR scan_event.attendance_id IS NOT NULL
        )
      )
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Migration aborted: scan-event result status/nullability mismatch exists.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.scan_events AS scan_event
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.scanner_stations AS station
      WHERE station.id = scan_event.station_id
        AND station.session_id = scan_event.session_id
    )
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'foreign_key_violation',
      MESSAGE = 'Migration aborted: scan-event station/session mismatch exists.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.scan_events AS scan_event
    WHERE scan_event.attendance_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.attendance AS attendance
        WHERE attendance.id = scan_event.attendance_id
          AND attendance.session_id = scan_event.session_id
          AND (
            scan_event.participant_id IS NULL
            OR attendance.participant_id = scan_event.participant_id
          )
      )
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'foreign_key_violation',
      MESSAGE = 'Migration aborted: scan-event attendance relationship mismatch exists.';
  END IF;
END
$$;

ALTER TABLE public.scanner_stations
  ADD CONSTRAINT scanner_stations_id_session_unique
  UNIQUE (id, session_id);

ALTER TABLE public.attendance
  ADD CONSTRAINT attendance_id_session_unique
  UNIQUE (id, session_id);

ALTER TABLE public.attendance
  ADD CONSTRAINT attendance_id_participant_session_unique
  UNIQUE (id, participant_id, session_id);

ALTER TABLE public.attendance
  ADD CONSTRAINT attendance_qr_requires_station
  CHECK (
    check_in_method <> 'QR'::public.check_in_method
    OR station_id IS NOT NULL
  );

ALTER TABLE public.attendance
  ADD CONSTRAINT attendance_station_session_fkey
  FOREIGN KEY (station_id, session_id)
  REFERENCES public.scanner_stations (id, session_id)
  MATCH SIMPLE
  ON DELETE RESTRICT;

ALTER TABLE public.scan_events
  ADD CONSTRAINT scan_events_result_status_semantics
  CHECK (
    (
      result_status IN (
        'SUCCESS'::public.scan_result_status,
        'SUCCESS_WITH_WARNING'::public.scan_result_status,
        'ALREADY_CHECKED_IN'::public.scan_result_status
      )
      AND participant_id IS NOT NULL
      AND attendance_id IS NOT NULL
    )
    OR (
      result_status = 'INVALID_QR'::public.scan_result_status
      AND participant_id IS NULL
      AND attendance_id IS NULL
    )
    OR (
      result_status = 'CANCELLED_PARTICIPANT'::public.scan_result_status
      AND participant_id IS NOT NULL
      AND attendance_id IS NULL
    )
    OR (
      result_status IN (
        'SESSION_CLOSED'::public.scan_result_status,
        'STATION_INACTIVE'::public.scan_result_status
      )
      AND participant_id IS NULL
      AND attendance_id IS NULL
    )
    OR result_status = 'ERROR'::public.scan_result_status
  );

ALTER TABLE public.scan_events
  ADD CONSTRAINT scan_events_station_session_fkey
  FOREIGN KEY (station_id, session_id)
  REFERENCES public.scanner_stations (id, session_id)
  MATCH SIMPLE
  ON DELETE RESTRICT;

ALTER TABLE public.scan_events
  ADD CONSTRAINT scan_events_attendance_participant_session_fkey
  FOREIGN KEY (attendance_id, participant_id, session_id)
  REFERENCES public.attendance (id, participant_id, session_id)
  MATCH SIMPLE
  ON DELETE RESTRICT;

ALTER TABLE public.scan_events
  ADD CONSTRAINT scan_events_attendance_session_fkey
  FOREIGN KEY (attendance_id, session_id)
  REFERENCES public.attendance (id, session_id)
  MATCH SIMPLE
  ON DELETE RESTRICT;
