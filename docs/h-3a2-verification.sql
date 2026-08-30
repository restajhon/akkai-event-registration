-- Read-only H-3A2 email correction, generation, and search-privacy verification.

-- A. Generation columns, defaults, and nonnegative checks.
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'participants' AND column_name = 'email_generation')
    OR (table_name = 'email_logs' AND column_name = 'email_generation')
  )
ORDER BY table_name;

SELECT
  conrelid::regclass AS table_name,
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE connamespace = 'public'::regnamespace
  AND conname IN (
    'participants_email_generation_nonnegative',
    'email_logs_email_generation_nonnegative'
  )
ORDER BY conrelid::regclass, conname;

-- B. Email correction audit table and RLS. RLS should be true; no direct
-- anon/authenticated policy should expose the audit table.
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS row_level_security,
  c.relforcerowsecurity AS force_row_level_security
FROM pg_class AS c
JOIN pg_namespace AS namespace ON namespace.oid = c.relnamespace
WHERE namespace.nspname = 'public'
  AND c.relname = 'participant_email_changes';

SELECT schemaname, tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'participant_email_changes';

-- C. Inspect the correction RPC. Confirm actor validation, participant locking,
-- stale-PENDING override handling, generation increment, and audit insertion.
SELECT pg_get_functiondef(
  'public.correct_participant_email(uuid,text,uuid,bigint,boolean)'::regprocedure
) AS correction_function_definition;

-- D. Inspect the atomic registration reservation RPC and finalization RPC.
SELECT pg_get_functiondef(
  'public.create_participant_with_registration_reservation(text,text,text,text,text,text,timestamptz)'::regprocedure
) AS registration_reservation_function_definition;

SELECT pg_get_functiondef(
  'public.finalize_participant_email_attempt(uuid,uuid,bigint,public.email_status,text,text,timestamptz)'::regprocedure
) AS finalization_function_definition;

-- E. Function privileges. Each listed function should be executable by
-- service_role only. PUBLIC is checked through ACL grantee OID 0.
WITH audited_functions AS (
  SELECT p.oid, p.proacl, p.proowner, p.oid::regprocedure AS function_name
  FROM pg_proc AS p
  JOIN pg_namespace AS namespace ON namespace.oid = p.pronamespace
  WHERE namespace.nspname = 'public'
    AND p.oid IN (
      'public.correct_participant_email(uuid,text,uuid,bigint,boolean)'::regprocedure,
      'public.create_participant_with_registration_reservation(text,text,text,text,text,text,timestamptz)'::regprocedure,
      'public.finalize_participant_email_attempt(uuid,uuid,bigint,public.email_status,text,text,timestamptz)'::regprocedure,
      'public.reserve_participant_email_resend(uuid,text,uuid,text)'::regprocedure
    )
)
SELECT
  function_name,
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

-- F. Confirm SECURITY DEFINER and controlled search_path for the RPCs.
SELECT
  p.oid::regprocedure AS function_name,
  p.prosecdef AS security_definer,
  p.proconfig AS function_configuration
FROM pg_proc AS p
JOIN pg_namespace AS namespace ON namespace.oid = p.pronamespace
WHERE namespace.nspname = 'public'
  AND p.oid IN (
    'public.correct_participant_email(uuid,text,uuid,bigint,boolean)'::regprocedure,
    'public.create_participant_with_registration_reservation(text,text,text,text,text,text,timestamptz)'::regprocedure,
    'public.finalize_participant_email_attempt(uuid,uuid,bigint,public.email_status,text,text,timestamptz)'::regprocedure,
    'public.reserve_participant_email_resend(uuid,text,uuid,text)'::regprocedure
  )
ORDER BY function_name;

-- G. Orphan email logs and audit rows. Expected: 0 rows.
SELECT log.id, log.participant_id
FROM public.email_logs AS log
LEFT JOIN public.participants AS participant ON participant.id = log.participant_id
WHERE participant.id IS NULL;

SELECT change.id, change.participant_id, change.changed_by
FROM public.participant_email_changes AS change
LEFT JOIN public.participants AS participant ON participant.id = change.participant_id
LEFT JOIN public.profiles AS profile ON profile.id = change.changed_by
WHERE participant.id IS NULL
   OR profile.id IS NULL;

-- H. Current-generation recipient integrity. Expected: 0 rows. Historical
-- older-generation recipient differences are valid snapshots.
SELECT
  log.id,
  log.participant_id,
  log.email_generation,
  log.recipient_email,
  participant.email AS current_email
FROM public.email_logs AS log
JOIN public.participants AS participant ON participant.id = log.participant_id
WHERE log.email_generation = participant.email_generation
  AND log.recipient_email <> participant.email;

-- I. Informational historical recipient mismatches and generation mismatches.
-- These are expected after a legitimate correction and are not corruption.
SELECT
  log.id,
  log.participant_id,
  log.email_generation AS log_email_generation,
  participant.email_generation AS current_email_generation,
  log.recipient_email AS historical_recipient_email,
  participant.email AS current_email,
  log.status,
  log.created_at
FROM public.email_logs AS log
JOIN public.participants AS participant ON participant.id = log.participant_id
WHERE log.email_generation <> participant.email_generation
   OR log.recipient_email <> participant.email
ORDER BY log.participant_id, log.created_at DESC;

-- J. SENT logs must contain provider acceptance metadata. Expected: 0 rows.
SELECT id, participant_id, status, provider_message_id, sent_at
FROM public.email_logs
WHERE status = 'SENT'::public.email_status
  AND (
    provider_message_id IS NULL
    OR btrim(provider_message_id) = ''
    OR sent_at IS NULL
  );

-- K. Informational current-generation PENDING attempts. Recent rows are
-- correction-blocking; stale rows require p_allow_stale_pending = true.
SELECT
  log.participant_id,
  log.email_generation,
  log.email_type,
  log.status,
  log.created_at,
  CASE
    WHEN log.created_at >= now() - interval '15 minutes' THEN 'RECENT'
    ELSE 'STALE'
  END AS pending_age_class
FROM public.email_logs AS log
JOIN public.participants AS participant
  ON participant.id = log.participant_id
 AND participant.email_generation = log.email_generation
WHERE log.status = 'PENDING'::public.email_status
ORDER BY log.created_at DESC;

-- L. Resend idempotency keys must carry the generation marker. Informational
-- rows only; existing non-resend and pre-generation keys are not modified.
SELECT id, participant_id, email_generation, idempotency_key
FROM public.email_logs
WHERE email_type = 'RESEND'::public.email_type
  AND (
    idempotency_key IS NULL
    OR idempotency_key NOT LIKE 'resend:%:g%:%'
  )
ORDER BY created_at DESC;

-- M. Historical email logs are not mutated by this verification script. This
-- query only reports the audit history of email corrections.
SELECT participant_id, old_email, new_email, changed_by, changed_at
FROM public.participant_email_changes
ORDER BY changed_at DESC;
