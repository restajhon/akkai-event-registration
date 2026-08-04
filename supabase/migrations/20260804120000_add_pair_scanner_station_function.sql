-- Atomically pair a scanner station to an authenticated operator profile.
-- The application server must verify the raw pairing code with scrypt before
-- calling this function and pass the hash currently read from the station row.

CREATE OR REPLACE FUNCTION public.pair_scanner_station(
  p_station_id uuid,
  p_operator_profile_id uuid,
  p_expected_pairing_code_hash text
)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  WITH eligible_station AS (
    SELECT station.id
    FROM public.scanner_stations AS station
    INNER JOIN public.sessions AS session
      ON session.id = station.session_id
    INNER JOIN public.profiles AS profile
      ON profile.id = p_operator_profile_id
    WHERE station.id = p_station_id
      AND station.status = 'WAITING_PAIRING'::public.station_status
      AND station.paired_operator_id IS NULL
      AND station.pairing_expires_at > now()
      AND station.pairing_code_hash = p_expected_pairing_code_hash
      AND session.status = 'OPEN'::public.session_status
      AND profile.is_active = true
      AND profile.role IN (
        'ADMIN'::public.user_role,
        'OPERATOR'::public.user_role
      )
    FOR UPDATE OF station, session, profile
  )
  UPDATE public.scanner_stations AS station
  SET status = 'PAIRED'::public.station_status,
      paired_operator_id = p_operator_profile_id,
      paired_at = now(),
      last_activity_at = now()
  FROM eligible_station
  WHERE station.id = eligible_station.id;

  RETURN FOUND;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.pair_scanner_station(uuid, uuid, text)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.pair_scanner_station(uuid, uuid, text)
TO service_role;
