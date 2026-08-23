-- Enforce scanner-station lifecycle invariants and make close/reset
-- transactional. Existing pairing hashes remain valid credentials only while
-- the station state permits pairing.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.scanner_stations
    WHERE status = 'CLOSED'::public.station_status
      AND closed_at IS NULL
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Migration aborted: CLOSED scanner stations without closed_at exist.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.scanner_stations
    WHERE status = 'WAITING_PAIRING'::public.station_status
      AND (paired_operator_id IS NOT NULL OR paired_at IS NOT NULL)
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Migration aborted: WAITING_PAIRING scanner stations retain paired ownership.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.scanner_stations
    WHERE status IN (
        'PAIRED'::public.station_status,
        'ACTIVE'::public.station_status
      )
      AND (paired_operator_id IS NULL OR paired_at IS NULL)
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Migration aborted: PAIRED or ACTIVE scanner stations lack paired ownership.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.scanner_stations
    WHERE status <> 'CLOSED'::public.station_status
      AND closed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Migration aborted: non-CLOSED scanner stations have closed_at populated.';
  END IF;
END
$$;

-- CLOSED rows are historical station instances. Clear only their stale
-- ownership; preserve station/session history, pairing hashes, and close time.
UPDATE public.scanner_stations
SET paired_operator_id = NULL,
    paired_at = NULL
WHERE status = 'CLOSED'::public.station_status
  AND (paired_operator_id IS NOT NULL OR paired_at IS NOT NULL);

ALTER TABLE public.scanner_stations
  ADD CONSTRAINT scanner_stations_closed_state_valid CHECK (
    status <> 'CLOSED'::public.station_status
    OR (
      closed_at IS NOT NULL
      AND paired_operator_id IS NULL
      AND paired_at IS NULL
    )
  ),
  ADD CONSTRAINT scanner_stations_waiting_pairing_state_valid CHECK (
    status <> 'WAITING_PAIRING'::public.station_status
    OR (
      paired_operator_id IS NULL
      AND paired_at IS NULL
      AND closed_at IS NULL
    )
  ),
  ADD CONSTRAINT scanner_stations_paired_active_state_valid CHECK (
    status NOT IN (
      'PAIRED'::public.station_status,
      'ACTIVE'::public.station_status
    )
    OR (
      paired_operator_id IS NOT NULL
      AND paired_at IS NOT NULL
      AND closed_at IS NULL
    )
  ),
  ADD CONSTRAINT scanner_stations_non_closed_at_null CHECK (
    status = 'CLOSED'::public.station_status
    OR closed_at IS NULL
  );

-- Close one station without changing its session or historical attendance and
-- scan-event rows. The row lock makes concurrent close/reset/pair operations
-- serialize on the station.
CREATE OR REPLACE FUNCTION public.close_scanner_station(
  p_station_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_station public.scanner_stations%ROWTYPE;
BEGIN
  SELECT station.*
  INTO v_station
  FROM public.scanner_stations AS station
  WHERE station.id = p_station_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0002',
      MESSAGE = 'Station tidak ditemukan.';
  END IF;

  IF v_station.status = 'CLOSED'::public.station_status THEN
    -- Keep an already-recorded historical close time unchanged while restoring
    -- canonical ownership if legacy data or an older writer left it populated.
    UPDATE public.scanner_stations
    SET paired_operator_id = NULL,
        paired_at = NULL
    WHERE id = v_station.id;

    RETURN true;
  END IF;

  UPDATE public.scanner_stations
  SET status = 'CLOSED'::public.station_status,
      paired_operator_id = NULL,
      paired_at = NULL,
      closed_at = now()
  WHERE id = v_station.id;

  RETURN true;
END;
$$;

-- Reset pairing credentials only if the server's observed code hash is still
-- current. A successful reset replaces that hash, while pair/close change the
-- station status, preventing stale reset requests from overwriting newer state.
-- Lock order is station -> session, matching the station/session operational
-- RPCs and avoiding a reset-specific inversion.
CREATE OR REPLACE FUNCTION public.reset_scanner_station_pairing(
  p_station_id uuid,
  p_expected_status public.station_status,
  p_expected_pairing_code_hash text,
  p_pairing_code_hash text,
  p_pairing_token_hash text,
  p_pairing_expires_at timestamptz
)
RETURNS text
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_station public.scanner_stations%ROWTYPE;
  v_session public.sessions%ROWTYPE;
BEGIN
  SELECT station.*
  INTO v_station
  FROM public.scanner_stations AS station
  WHERE station.id = p_station_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0002',
      MESSAGE = 'Station tidak ditemukan.';
  END IF;

  IF v_station.status = 'CLOSED'::public.station_status THEN
    RETURN 'STATION_CLOSED';
  END IF;

  IF v_station.status IS DISTINCT FROM p_expected_status
     OR v_station.pairing_code_hash IS DISTINCT FROM p_expected_pairing_code_hash THEN
    RETURN 'STALE_STATE';
  END IF;

  SELECT session.*
  INTO v_session
  FROM public.sessions AS session
  WHERE session.id = v_station.session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'foreign_key_violation',
      MESSAGE = 'Session station tidak ditemukan.';
  END IF;

  IF v_session.status <> 'OPEN'::public.session_status THEN
    RETURN 'SESSION_CLOSED';
  END IF;

  UPDATE public.scanner_stations
  SET status = 'WAITING_PAIRING'::public.station_status,
      pairing_code_hash = p_pairing_code_hash,
      pairing_token_hash = p_pairing_token_hash,
      pairing_expires_at = p_pairing_expires_at,
      paired_operator_id = NULL,
      paired_at = NULL,
      last_activity_at = NULL,
      closed_at = NULL
  WHERE id = v_station.id;

  RETURN 'RESET';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.close_scanner_station(uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.close_scanner_station(uuid)
TO service_role;

REVOKE EXECUTE ON FUNCTION public.reset_scanner_station_pairing(uuid, public.station_status, text, text, text, timestamptz)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.reset_scanner_station_pairing(uuid, public.station_status, text, text, text, timestamptz)
TO service_role;
