-- H-3D3 durable participant travel verification limiter.
-- The private table has no direct API access; only the service-role RPC can use it.

CREATE SCHEMA IF NOT EXISTS private;

REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE TABLE private.participant_travel_rate_limits (
  key_hash text PRIMARY KEY,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  attempt_count integer NOT NULL DEFAULT 0,
  CONSTRAINT participant_travel_rate_limit_key_valid CHECK (
    key_hash ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT participant_travel_rate_limit_count_valid CHECK (
    attempt_count >= 0
  )
);

CREATE INDEX participant_travel_rate_limits_window_idx
ON private.participant_travel_rate_limits (window_started_at);

ALTER TABLE private.participant_travel_rate_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE private.participant_travel_rate_limits
FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.consume_participant_travel_rate_limit(
  p_key_hashes text[]
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_key text;
  v_now timestamptz := clock_timestamp();
  v_attempt_count integer;
  v_allowed boolean := true;
BEGIN
  IF p_key_hashes IS NULL
     OR cardinality(p_key_hashes) = 0
     OR EXISTS (
       SELECT 1
       FROM unnest(p_key_hashes) AS supplied_key(key_hash)
       WHERE supplied_key.key_hash !~ '^[0-9a-f]{64}$'
     ) THEN
    RETURN false;
  END IF;

  DELETE FROM private.participant_travel_rate_limits
  WHERE window_started_at < v_now - interval '1 day';

  FOR v_key IN
    SELECT DISTINCT supplied_key.key_hash
    FROM unnest(p_key_hashes) AS supplied_key(key_hash)
    ORDER BY supplied_key.key_hash
  LOOP
    INSERT INTO private.participant_travel_rate_limits AS rate_limit (
      key_hash,
      window_started_at,
      attempt_count
    )
    VALUES (v_key, v_now, 1)
    ON CONFLICT (key_hash) DO UPDATE
    SET window_started_at = CASE
          WHEN rate_limit.window_started_at
            <= v_now - interval '15 minutes'
          THEN v_now
          ELSE rate_limit.window_started_at
        END,
        attempt_count = CASE
          WHEN rate_limit.window_started_at
            <= v_now - interval '15 minutes'
          THEN 1
          ELSE LEAST(rate_limit.attempt_count + 1, 2147483647)
        END;

    SELECT attempt_count
    INTO v_attempt_count
    FROM private.participant_travel_rate_limits
    WHERE key_hash = v_key;

    IF v_attempt_count > 12 THEN
      v_allowed := false;
    END IF;
  END LOOP;

  RETURN v_allowed;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.consume_participant_travel_rate_limit(text[])
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.consume_participant_travel_rate_limit(text[])
TO service_role;
