-- Read-only H-2C post-migration verification queries.

-- A. CLOSED stations retaining paired ownership. Expected: 0 rows.
SELECT id, station_name, session_id, paired_operator_id, paired_at, closed_at
FROM public.scanner_stations
WHERE status = 'CLOSED'::public.station_status
  AND (paired_operator_id IS NOT NULL OR paired_at IS NOT NULL)
ORDER BY closed_at, id;

-- B. Station lifecycle contradictions. Expected: 0 rows.
SELECT id, station_name, status, paired_operator_id, paired_at, closed_at
FROM public.scanner_stations
WHERE (
    status = 'CLOSED'::public.station_status
    AND (
      closed_at IS NULL
      OR paired_operator_id IS NOT NULL
      OR paired_at IS NOT NULL
    )
  )
  OR (
    status = 'WAITING_PAIRING'::public.station_status
    AND (
      paired_operator_id IS NOT NULL
      OR paired_at IS NOT NULL
      OR closed_at IS NOT NULL
    )
  )
  OR (
    status IN (
      'PAIRED'::public.station_status,
      'ACTIVE'::public.station_status
    )
    AND (
      paired_operator_id IS NULL
      OR paired_at IS NULL
      OR closed_at IS NOT NULL
    )
  )
  OR (
    status <> 'CLOSED'::public.station_status
    AND closed_at IS NOT NULL
  )
ORDER BY id;

-- C. Paired stations owned by inactive operators. Expected: 0 rows for the
-- current audited data; this is informational for future profile changes.
SELECT station.id, station.station_name, station.paired_operator_id,
       profile.full_name, profile.is_active
FROM public.scanner_stations AS station
JOIN public.profiles AS profile
  ON profile.id = station.paired_operator_id
WHERE station.paired_operator_id IS NOT NULL
  AND profile.is_active IS DISTINCT FROM true
ORDER BY station.id;

-- D. Informational status distribution.
SELECT status, count(*) AS station_count
FROM public.scanner_stations
GROUP BY status
ORDER BY status;

-- E. Informational only: stations attached to CLOSED sessions are allowed.
SELECT station.id, station.station_name, station.status,
       station.session_id, session.code AS session_code, session.closed_at
FROM public.scanner_stations AS station
JOIN public.sessions AS session
  ON session.id = station.session_id
WHERE session.status = 'CLOSED'::public.session_status
ORDER BY station.id;

-- Function privilege audit. Expected: service_role_execute = true and all
-- other columns = false for both functions. PUBLIC is ACL grantee 0.
SELECT
  p.oid::regprocedure AS function_name,
  has_function_privilege('service_role', p.oid, 'EXECUTE')
    AS service_role_execute,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE')
    AS authenticated_execute,
  COALESCE(
    (
      SELECT bool_or(acl.grantee = 0 AND acl.privilege_type = 'EXECUTE')
      FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) AS acl
    ),
    false
  ) AS public_execute
FROM pg_proc AS p
JOIN pg_namespace AS namespace
  ON namespace.oid = p.pronamespace
WHERE namespace.nspname = 'public'
  AND p.oid IN (
    'public.close_scanner_station(uuid)'::regprocedure,
    'public.reset_scanner_station_pairing(uuid,public.station_status,text,text,text,timestamp with time zone)'::regprocedure
  )
ORDER BY function_name;
