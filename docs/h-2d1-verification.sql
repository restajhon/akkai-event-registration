-- Read-only H-2D1 post-migration verification queries.

-- A. Inspect the current broadcast function definition. Confirm it contains
-- station display and dashboard topics, and no session-only emission.
SELECT pg_get_functiondef(
  'public.broadcast_scan_event_to_live_display()'::regprocedure
) AS broadcast_function_definition;

-- B. Confirm the AFTER INSERT trigger still invokes the broadcast function.
SELECT
  namespace.nspname AS table_schema,
  relation.relname AS table_name,
  trigger.tgname AS trigger_name,
  pg_get_triggerdef(trigger.oid) AS trigger_definition
FROM pg_trigger AS trigger
JOIN pg_class AS relation
  ON relation.oid = trigger.tgrelid
JOIN pg_namespace AS namespace
  ON namespace.oid = relation.relnamespace
WHERE namespace.nspname = 'public'
  AND relation.relname = 'scan_events'
  AND trigger.tgname = 'scan_events_broadcast_to_live_display'
  AND NOT trigger.tgisinternal;

-- C. Inspect the current Realtime topic policy and authorization expression.
SELECT policyname, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'realtime'
  AND tablename = 'messages'
  AND policyname = 'live_display_broadcast_select';

-- D. Confirm the deployed function text includes both new topic families.
WITH function_source AS (
  SELECT pg_get_functiondef(
    'public.broadcast_scan_event_to_live_display()'::regprocedure
  ) AS definition
)
SELECT
  definition LIKE '%akkai:display:station:%' AS emits_station_display_topic,
  definition LIKE '%akkai:dashboard:%' AS emits_dashboard_topic,
  definition NOT LIKE '%''akkai:display:'' || NEW.session_id::text%' AS no_session_only_topic
FROM function_source;
