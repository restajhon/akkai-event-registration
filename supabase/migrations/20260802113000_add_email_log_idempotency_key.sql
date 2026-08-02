-- Add database-level idempotency support for registration email delivery.
-- Application code will populate this field with registration:{participant_id}.

ALTER TABLE public.email_logs
  ADD COLUMN idempotency_key text;

CREATE UNIQUE INDEX email_logs_idempotency_key_unique
ON public.email_logs (idempotency_key)
WHERE idempotency_key IS NOT NULL;
