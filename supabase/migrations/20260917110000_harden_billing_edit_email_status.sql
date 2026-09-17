-- Keep billing delivery state honest when an admin edits participant or
-- billing fields. Sending remains an explicit operation, never a trigger side effect.

CREATE OR REPLACE FUNCTION public.reset_billing_email_after_participant_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.email IS DISTINCT FROM NEW.email THEN
    UPDATE public.registration_billings
    SET billing_email_status = 'PENDING'::public.billing_email_status,
        billing_email_provider_message_id = NULL,
        billing_email_error = NULL,
        billing_email_sent_at = NULL
    WHERE participant_id = NEW.id;

    UPDATE public.registration_billing_email_logs AS billing_log
    SET recipient_email = NEW.email,
        status = 'PENDING'::public.billing_email_status,
        provider_message_id = NULL,
        error_message = NULL,
        sent_at = NULL
    WHERE billing_id IN (
      SELECT billing.id
      FROM public.registration_billings AS billing
      WHERE billing.participant_id = NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER participants_reset_billing_email_after_change
BEFORE UPDATE ON public.participants
FOR EACH ROW
EXECUTE FUNCTION public.reset_billing_email_after_participant_change();

CREATE OR REPLACE FUNCTION public.reset_billing_email_after_billing_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.full_name IS DISTINCT FROM NEW.full_name
     OR OLD.kka_name IS DISTINCT FROM NEW.kka_name
     OR OLD.package_type IS DISTINCT FROM NEW.package_type
     OR OLD.participation_scope IS DISTINCT FROM NEW.participation_scope
     OR OLD.amount IS DISTINCT FROM NEW.amount THEN
    NEW.billing_email_status = 'PENDING'::public.billing_email_status;
    NEW.billing_email_provider_message_id = NULL;
    NEW.billing_email_error = NULL;
    NEW.billing_email_sent_at = NULL;

    UPDATE public.registration_billing_email_logs
    SET status = 'PENDING'::public.billing_email_status,
        provider_message_id = NULL,
        error_message = NULL,
        sent_at = NULL
    WHERE billing_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER registration_billings_reset_email_after_change
BEFORE UPDATE ON public.registration_billings
FOR EACH ROW
EXECUTE FUNCTION public.reset_billing_email_after_billing_change();

REVOKE ALL ON FUNCTION public.reset_billing_email_after_participant_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reset_billing_email_after_billing_change() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_billing_email_after_participant_change() TO service_role;
GRANT EXECUTE ON FUNCTION public.reset_billing_email_after_billing_change() TO service_role;
