-- Read-only H-3A1 email reliability verification queries.

-- A. Inspect the atomic resend reservation RPC. Confirm participant locking,
-- exact generation-aware idempotency lookup, current-generation rolling
-- 60-second duplicate suppression, rolling quota, and PENDING insertion.
SELECT pg_get_functiondef(
  'public.reserve_participant_email_resend(uuid,text,uuid,text)'::regprocedure
) AS reservation_function_definition;

-- B. Function privileges. Expected service_role_execute = true and all other
-- columns = false. PUBLIC is checked through ACL grantee OID 0.
WITH audited_function AS (
  SELECT p.oid, p.proacl, p.proowner, p.oid::regprocedure AS function_name
  FROM pg_proc AS p
  JOIN pg_namespace AS namespace ON namespace.oid = p.pronamespace
  WHERE namespace.nspname = 'public'
    AND p.oid = 'public.reserve_participant_email_resend(uuid,text,uuid,text)'::regprocedure
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
FROM audited_function AS audited;

-- C. Idempotency-key duplicates. Expected: 0 rows.
SELECT idempotency_key, count(*) AS log_count
FROM public.email_logs
WHERE idempotency_key IS NOT NULL
GROUP BY idempotency_key
HAVING count(*) > 1
ORDER BY idempotency_key;

-- D. Informational resend history grouped by participant and status. All
-- statuses count toward the five-attempt rolling quota by design.
SELECT participant_id, status, count(*) AS resend_count
FROM public.email_logs
WHERE email_type = 'RESEND'::public.email_type
GROUP BY participant_id, status
ORDER BY participant_id, status;

-- E. Informational historical duplicate-window review. This identifies RESEND
-- rows for the same participant created less than 60 seconds apart, including
-- pre-fix data. Historical rows are not corruption and are not modified.
WITH resend_history AS (
  SELECT
    id,
    participant_id,
    created_at,
    status,
    idempotency_key,
    lag(id) OVER (
      PARTITION BY participant_id
      ORDER BY created_at, id
    ) AS previous_email_log_id,
    lag(created_at) OVER (
      PARTITION BY participant_id
      ORDER BY created_at, id
    ) AS previous_created_at
  FROM public.email_logs
  WHERE email_type = 'RESEND'::public.email_type
)
SELECT
  participant_id,
  previous_email_log_id,
  previous_created_at,
  id AS email_log_id,
  created_at,
  created_at - previous_created_at AS separation,
  status,
  idempotency_key
FROM resend_history
WHERE previous_created_at IS NOT NULL
  AND created_at - previous_created_at < interval '60 seconds'
ORDER BY participant_id, created_at, id;

-- F. Stale PENDING attempts. The application uses 15 minutes as the
-- conservative stale threshold. These records remain PENDING and are not
-- silently relabeled: they represent UNKNOWN/provider state requiring review.

WITH stale_pending AS (
  SELECT
    CASE
      WHEN created_at >= now() - interval '1 hour'
        THEN '15-60 minutes'
      WHEN created_at >= now() - interval '24 hours'
        THEN '1-24 hours'
      ELSE 'over 24 hours'
    END AS age_bucket
  FROM public.email_logs
  WHERE email_type IN (
    'REGISTRATION'::public.email_type,
    'RESEND'::public.email_type
  )
    AND status = 'PENDING'::public.email_status
    AND created_at < now() - interval '15 minutes'
)
SELECT
  age_bucket,
  count(*) AS stale_pending_count
FROM stale_pending
GROUP BY age_bucket
ORDER BY CASE age_bucket
  WHEN '15-60 minutes' THEN 1
  WHEN '1-24 hours' THEN 2
  ELSE 3
END;

-- G. Participant/email-log foreign-key integrity. Expected: 0 rows. A
-- recipient mismatch with the current participant email is allowed for older
-- email generations and is not checked here as corruption.
SELECT log.id, log.participant_id, log.email_type, log.status,
       log.recipient_email
FROM public.email_logs AS log
LEFT JOIN public.participants AS participant ON participant.id = log.participant_id
WHERE participant.id IS NULL;
