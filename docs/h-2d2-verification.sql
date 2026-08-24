-- Read-only H-2D2 post-migration verification queries.

-- A. Inspect the final pairing function. Confirm the sequential profile,
-- station, and session SELECT ... FOR UPDATE statements.
SELECT pg_get_functiondef(
  'public.pair_scanner_station(uuid,uuid,text)'::regprocedure
) AS pair_function_definition;

-- B. Inspect the transactional station-create function.
SELECT pg_get_functiondef(
  'public.create_scanner_station(text,uuid,text,text,timestamp with time zone,uuid)'::regprocedure
) AS create_function_definition;

-- C. Inspect the final broadcast function and eventSequence payload field.
SELECT pg_get_functiondef(
  'public.broadcast_scan_event_to_live_display()'::regprocedure
) AS broadcast_function_definition;

-- D. Function privileges. Expected service_role_execute = true and all other
-- columns = false. PUBLIC is checked through ACL grantee OID 0.
WITH audited_functions AS (
  SELECT
    p.oid,
    p.proacl,
    p.proowner,
    p.oid::regprocedure AS function_name
  FROM pg_proc AS p
  JOIN pg_namespace AS namespace
    ON namespace.oid = p.pronamespace
  WHERE namespace.nspname = 'public'
    AND p.oid IN (
      'public.pair_scanner_station(uuid,uuid,text)'::regprocedure,
      'public.create_scanner_station(text,uuid,text,text,timestamp with time zone,uuid)'::regprocedure
    )
  )
SELECT
  function_name,
  has_function_privilege('service_role', oid, 'EXECUTE')
    AS service_role_execute,
  has_function_privilege('anon', oid, 'EXECUTE') AS anon_execute,
  has_function_privilege('authenticated', oid, 'EXECUTE')
    AS authenticated_execute,
  COALESCE(
    (
      SELECT bool_or(acl.grantee = 0 AND acl.privilege_type = 'EXECUTE')
      FROM aclexplode(COALESCE(
        audited.proacl,
        acldefault('f', audited.proowner)
      )) AS acl
    ),
    false
  ) AS public_execute
FROM audited_functions AS audited
ORDER BY function_name;

-- E. Event-sequence column metadata.
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'scan_events'
  AND column_name = 'event_sequence';

-- F. Sequence privileges. Expected service_role_usage = true and all other
-- role columns = false. PUBLIC is checked through ACL grantee OID 0.
WITH sequence_acl AS (
  SELECT
    sequence_class.relacl,
    sequence_class.relowner
  FROM pg_class AS sequence_class
  JOIN pg_namespace AS namespace
    ON namespace.oid = sequence_class.relnamespace
  WHERE namespace.nspname = 'public'
    AND sequence_class.relname = 'scan_events_event_sequence_seq'
    AND sequence_class.relkind = 'S'
)
SELECT
  has_sequence_privilege(
    'service_role',
    'public.scan_events_event_sequence_seq',
    'USAGE'
  ) AS service_role_usage,
  has_sequence_privilege(
    'anon',
    'public.scan_events_event_sequence_seq',
    'USAGE'
  ) AS anon_usage,
  has_sequence_privilege(
    'authenticated',
    'public.scan_events_event_sequence_seq',
    'USAGE'
  ) AS authenticated_usage,
  COALESCE(
    (
      SELECT bool_or(acl.grantee = 0 AND acl.privilege_type = 'USAGE')
      FROM sequence_acl
      CROSS JOIN LATERAL aclexplode(COALESCE(
        sequence_acl.relacl,
        acldefault('S', sequence_acl.relowner)
      )) AS acl
    ),
    false
  ) AS public_usage;

-- G. Event-sequence NULL count. Expected: 0.
SELECT count(*) AS null_event_sequence_count
FROM public.scan_events
WHERE event_sequence IS NULL;

-- H. Duplicate event-sequence values. Expected: 0 rows.
SELECT event_sequence, count(*) AS sequence_count
FROM public.scan_events
GROUP BY event_sequence
HAVING count(*) > 1
ORDER BY event_sequence;

-- I. Informational event-sequence range.
SELECT
  min(event_sequence) AS minimum_event_sequence,
  max(event_sequence) AS maximum_event_sequence,
  count(*) AS scan_event_count
FROM public.scan_events;

-- J. Station lifecycle contradictions. Expected: 0 rows.
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

-- K. Station/session relationship integrity. Expected: 0 rows.
SELECT station.id, station.station_name, station.session_id
FROM public.scanner_stations AS station
WHERE NOT EXISTS (
  SELECT 1
  FROM public.sessions AS session
  WHERE session.id = station.session_id
)
ORDER BY station.id;

-- L. Confirm the H-2D1 Realtime policy still permits only the two current
-- topic families and preserves active ADMIN/OPERATOR authorization.
SELECT policyname, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'realtime'
  AND tablename = 'messages'
  AND policyname = 'live_display_broadcast_select';
