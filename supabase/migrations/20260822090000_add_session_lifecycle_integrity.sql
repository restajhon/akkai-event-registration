-- Enforce consistent session lifecycle timestamps while preserving the
-- never-opened CLOSED state.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.sessions
    WHERE (status = 'OPEN'::public.session_status AND closed_at IS NOT NULL)
       OR (
         status = 'CLOSED'::public.session_status
         AND (
           (opened_at IS NULL AND closed_at IS NOT NULL)
           OR (opened_at IS NOT NULL AND closed_at IS NULL)
         )
       )
       OR (
         opened_at IS NOT NULL
         AND closed_at IS NOT NULL
         AND closed_at < opened_at
       )
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Migration aborted: ambiguous or contradictory session lifecycle timestamps exist.';
  END IF;
END
$$;

-- Legacy OPEN rows did not record opened_at. updated_at is the best available
-- server-side approximation for those rows; never-opened CLOSED rows remain
-- unchanged.
UPDATE public.sessions
SET opened_at = COALESCE(opened_at, updated_at, now()),
    closed_at = NULL
WHERE status = 'OPEN'::public.session_status
  AND opened_at IS NULL;

CREATE OR REPLACE FUNCTION public.sync_session_lifecycle_timestamps()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'OPEN'::public.session_status THEN
      NEW.opened_at := now();
      NEW.closed_at := NULL;
    END IF;

    RETURN NEW;
  END IF;

  IF OLD.status = 'CLOSED'::public.session_status
     AND NEW.status = 'OPEN'::public.session_status THEN
    NEW.opened_at := now();
    NEW.closed_at := NULL;
  ELSIF OLD.status = 'OPEN'::public.session_status
        AND NEW.status = 'CLOSED'::public.session_status THEN
    NEW.opened_at := OLD.opened_at;
    NEW.closed_at := now();
  ELSIF OLD.status = NEW.status THEN
    NEW.opened_at := OLD.opened_at;
    NEW.closed_at := OLD.closed_at;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sessions_sync_lifecycle_timestamps
ON public.sessions;

CREATE TRIGGER sessions_sync_lifecycle_timestamps
BEFORE INSERT OR UPDATE ON public.sessions
FOR EACH ROW
EXECUTE FUNCTION public.sync_session_lifecycle_timestamps();

ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_lifecycle_timestamps_valid CHECK (
    (
      status = 'CLOSED'::public.session_status
      AND opened_at IS NULL
      AND closed_at IS NULL
    )
    OR (
      status = 'OPEN'::public.session_status
      AND opened_at IS NOT NULL
      AND closed_at IS NULL
    )
    OR (
      status = 'CLOSED'::public.session_status
      AND opened_at IS NOT NULL
      AND closed_at IS NOT NULL
      AND closed_at >= opened_at
    )
  );
