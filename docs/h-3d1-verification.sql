-- Read-only H-3D1 additive schema and RPC verification.
-- Do not use this file for database writes.

-- A. Participant columns and nullability.
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'participants' AND column_name IN (
      'institution',
      'member_number',
      'kka_name',
      'polo_size',
      'polo_model'
    ))
    OR table_name IN (
      'participant_travel',
      'participant_room_assignments',
      'participant_pickup_assignments'
    )
  )
ORDER BY table_name, ordinal_position;

-- B. New participant constraints.
SELECT
  conrelid::regclass AS table_name,
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE connamespace = 'public'::regnamespace
  AND conname IN (
    'participants_kka_name_valid',
    'participants_polo_size_valid',
    'participants_polo_model_valid',
    'participant_travel_dates_valid',
    'participant_travel_outbound_mode_valid',
    'participant_travel_return_mode_valid',
    'participant_room_dates_valid',
    'participant_pickup_status_valid',
    'participant_pickup_scheduled_fields_valid'
  )
ORDER BY table_name, constraint_name;

-- C. New tables, primary keys, and foreign keys.
SELECT
  conrelid::regclass AS table_name,
  conname AS constraint_name,
  contype,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE connamespace = 'public'::regnamespace
  AND conrelid IN (
    'public.participant_travel'::regclass,
    'public.participant_room_assignments'::regclass,
    'public.participant_pickup_assignments'::regclass
  )
ORDER BY table_name, constraint_name;

-- D. RLS must be enabled for all new tables.
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS row_level_security,
  c.relforcerowsecurity AS force_row_level_security
FROM pg_class AS c
JOIN pg_namespace AS namespace ON namespace.oid = c.relnamespace
WHERE namespace.nspname = 'public'
  AND c.relname IN (
    'participant_travel',
    'participant_room_assignments',
    'participant_pickup_assignments'
  )
ORDER BY table_name;

-- E. There should be no direct policies for anon/authenticated on new tables.
SELECT schemaname, tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'participant_travel',
    'participant_room_assignments',
    'participant_pickup_assignments'
  )
ORDER BY tablename, policyname;

-- F. Expected operational indexes.
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'participants_kka_name_idx',
    'participants_polo_size_idx',
    'participants_polo_model_idx',
    'participants_category_idx',
    'participant_travel_outbound_date_idx',
    'participant_travel_return_date_idx',
    'participant_travel_outbound_mode_idx',
    'participant_travel_return_mode_idx',
    'participant_travel_extend_stay_idx',
    'participant_room_assignments_room_number_idx',
    'participant_room_assignments_room_type_idx',
    'participant_pickup_assignments_status_idx',
    'participant_pickup_assignments_pickup_at_idx'
  )
ORDER BY tablename, indexname;

-- G. New and legacy registration RPCs must both exist.
SELECT
  routine_name,
  specific_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'create_participant_with_registration_reservation',
    'create_participant_with_registration_reservation_v2',
    'upsert_participant_travel',
    'upsert_participant_room_assignment',
    'upsert_participant_pickup_assignment'
  )
ORDER BY routine_name, specific_name;

-- H. New functions must be SECURITY DEFINER with an explicit search_path and
-- executable only by service_role. Expected anon/authenticated/public values
-- are false.
WITH audited_functions AS (
  SELECT p.oid, p.proacl, p.proowner, p.oid::regprocedure AS function_name,
         p.prosecdef, p.proconfig
  FROM pg_proc AS p
  JOIN pg_namespace AS namespace ON namespace.oid = p.pronamespace
  WHERE namespace.nspname = 'public'
    AND p.oid IN (
      'public.create_participant_with_registration_reservation_v2(text,text,text,text,text,text,text,text,timestamptz)'::regprocedure,
      'public.upsert_participant_travel(text,text,date,time,text,text,text,text,date,time,text,text,text,boolean)'::regprocedure,
      'public.upsert_participant_room_assignment(text,text,text,date,date,text,uuid)'::regprocedure,
      'public.upsert_participant_pickup_assignment(text,text,timestamptz,text,text,text,text,uuid)'::regprocedure
    )
)
SELECT
  function_name,
  prosecdef AS security_definer,
  proconfig AS function_configuration,
  has_function_privilege('service_role', oid, 'EXECUTE') AS service_role_execute,
  has_function_privilege('anon', oid, 'EXECUTE') AS anon_execute,
  has_function_privilege('authenticated', oid, 'EXECUTE') AS authenticated_execute,
  COALESCE(
    (
      SELECT bool_or(acl.grantee = 0 AND acl.privilege_type = 'EXECUTE')
      FROM aclexplode(COALESCE(audited.proacl, acldefault('f', audited.proowner))) AS acl
    ),
    false
  ) AS public_execute
FROM audited_functions AS audited
ORDER BY function_name;

-- I. Expected zero rows: orphan operational records.
SELECT travel.participant_id
FROM public.participant_travel AS travel
LEFT JOIN public.participants AS participant
  ON participant.id = travel.participant_id
WHERE participant.id IS NULL;

SELECT rooms.participant_id
FROM public.participant_room_assignments AS rooms
LEFT JOIN public.participants AS participant
  ON participant.id = rooms.participant_id
WHERE participant.id IS NULL;

SELECT pickups.participant_id
FROM public.participant_pickup_assignments AS pickups
LEFT JOIN public.participants AS participant
  ON participant.id = pickups.participant_id
WHERE participant.id IS NULL;

-- J. The primary key makes duplicate travel rows impossible. Expected zero rows.
SELECT participant_id, count(*) AS travel_row_count
FROM public.participant_travel
GROUP BY participant_id
HAVING count(*) > 1;

-- K. Informational legacy completeness review. These values must not be
-- backfilled with fabricated data by H-3D1.
SELECT
  count(*) AS participant_count,
  count(*) FILTER (WHERE institution IS NOT NULL) AS historical_institution_count,
  count(*) FILTER (WHERE kka_name IS NULL) AS kka_name_missing_count,
  count(*) FILTER (WHERE polo_size IS NULL) AS polo_size_missing_count,
  count(*) FILTER (WHERE polo_model IS NULL) AS polo_model_missing_count
FROM public.participants;

-- L. No travel/room/pickup data is expected to be created by this migration.
-- This query reports current counts without modifying data.
SELECT
  (SELECT count(*) FROM public.participant_travel) AS travel_count,
  (SELECT count(*) FROM public.participant_room_assignments) AS room_assignment_count,
  (SELECT count(*) FROM public.participant_pickup_assignments) AS pickup_assignment_count;
