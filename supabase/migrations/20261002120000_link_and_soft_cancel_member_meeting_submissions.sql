-- Legacy submissions have no safe participant identity. Leave their registration_id
-- NULL and require an explicit, verified Registration ID before linking them.
ALTER TABLE public.member_meeting_submissions
  ADD COLUMN registration_id text REFERENCES public.participants(registration_id) ON DELETE RESTRICT,
  ADD COLUMN cancelled_at timestamptz,
  ADD COLUMN cancelled_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT;

CREATE INDEX member_meeting_submissions_active_registration_idx
  ON public.member_meeting_submissions (registration_id, created_at DESC)
  WHERE registration_id IS NOT NULL AND cancelled_at IS NULL;

GRANT UPDATE ON TABLE public.member_meeting_submissions TO service_role;

CREATE OR REPLACE FUNCTION public.validate_member_meeting_submission_registration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_participant public.participants%ROWTYPE;
BEGIN
  IF NEW.registration_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT participant.*
  INTO v_participant
  FROM public.participants AS participant
  WHERE participant.registration_id = btrim(NEW.registration_id)
  FOR UPDATE;

  IF NOT FOUND OR v_participant.email <> NEW.email THEN
    RAISE EXCEPTION 'Member meeting submission participant could not be verified.'
      USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.member_meeting_participants AS membership
    WHERE membership.participant_id = v_participant.id
      AND membership.meeting_code = 'RAPAT_ANGGOTA_AKKAI_2026'
  ) THEN
    RAISE EXCEPTION 'Participant is not active in this member meeting.'
      USING ERRCODE = '23514';
  END IF;

  NEW.registration_id := v_participant.registration_id;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_member_meeting_submission_registration()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER member_meeting_submissions_validate_registration
BEFORE INSERT OR UPDATE OF registration_id ON public.member_meeting_submissions
FOR EACH ROW
EXECUTE FUNCTION public.validate_member_meeting_submission_registration();

-- Explicit manual linking is reserved for reviewed legacy rows. No name/email
-- backfill is attempted, because shared email addresses are permitted.
CREATE OR REPLACE FUNCTION public.link_member_meeting_submission(
  p_submission_id uuid,
  p_registration_id text,
  p_changed_by uuid
)
RETURNS TABLE (result_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_participant public.participants%ROWTYPE;
  v_submission public.member_meeting_submissions%ROWTYPE;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles AS profile
    WHERE profile.id = p_changed_by
      AND profile.is_active = true
      AND profile.role = 'SUPER_ADMIN'::public.user_role
  ) THEN
    RETURN QUERY SELECT 'UNAUTHORIZED'::text;
    RETURN;
  END IF;

  IF p_submission_id IS NULL OR p_registration_id IS NULL
     OR btrim(p_registration_id) !~ '^AKKAI26-[0-9]{6}$' THEN
    RETURN QUERY SELECT 'INVALID_INPUT'::text;
    RETURN;
  END IF;

  SELECT participant.* INTO v_participant
  FROM public.participants AS participant
  WHERE participant.registration_id = btrim(p_registration_id)
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'PARTICIPANT_NOT_FOUND'::text;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.member_meeting_participants AS membership
    WHERE membership.participant_id = v_participant.id
      AND membership.meeting_code = 'RAPAT_ANGGOTA_AKKAI_2026'
  ) THEN
    RETURN QUERY SELECT 'NOT_IN_MEETING'::text;
    RETURN;
  END IF;

  SELECT submission.* INTO v_submission
  FROM public.member_meeting_submissions AS submission
  WHERE submission.id = p_submission_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'SUBMISSION_NOT_FOUND'::text;
    RETURN;
  END IF;

  IF v_submission.cancelled_at IS NOT NULL THEN
    RETURN QUERY SELECT 'SUBMISSION_CANCELLED'::text;
    RETURN;
  END IF;
  IF v_submission.registration_id IS NOT NULL THEN
    RETURN QUERY SELECT 'ALREADY_LINKED'::text;
    RETURN;
  END IF;
  IF v_submission.email <> v_participant.email THEN
    RETURN QUERY SELECT 'EMAIL_MISMATCH'::text;
    RETURN;
  END IF;

  UPDATE public.member_meeting_submissions AS submission
  SET registration_id = v_participant.registration_id
  WHERE submission.id = p_submission_id
    AND submission.registration_id IS NULL
    AND submission.cancelled_at IS NULL;

  RETURN QUERY SELECT 'LINKED'::text;
END;
$$;

REVOKE ALL ON FUNCTION public.link_member_meeting_submission(uuid, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.link_member_meeting_submission(uuid, text, uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.cancel_member_meeting_participant(
  p_registration_id text,
  p_changed_by uuid
)
RETURNS TABLE (result_code text, cancelled_submission_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_participant public.participants%ROWTYPE;
  v_removed_participant_id uuid;
  v_cancelled_submission_count integer := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles AS profile
    WHERE profile.id = p_changed_by
      AND profile.is_active = true
      AND profile.role = 'SUPER_ADMIN'::public.user_role
  ) THEN
    RETURN QUERY SELECT 'UNAUTHORIZED'::text, 0;
    RETURN;
  END IF;

  IF p_registration_id IS NULL OR btrim(p_registration_id) !~ '^AKKAI26-[0-9]{6}$' THEN
    RETURN QUERY SELECT 'INVALID_INPUT'::text, 0;
    RETURN;
  END IF;

  SELECT participant.* INTO v_participant
  FROM public.participants AS participant
  WHERE participant.registration_id = btrim(p_registration_id)
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'PARTICIPANT_NOT_FOUND'::text, 0;
    RETURN;
  END IF;

  DELETE FROM public.member_meeting_participants AS membership
  WHERE membership.participant_id = v_participant.id
    AND membership.meeting_code = 'RAPAT_ANGGOTA_AKKAI_2026'
  RETURNING membership.participant_id INTO v_removed_participant_id;

  IF v_removed_participant_id IS NULL THEN
    RETURN QUERY SELECT 'NOT_IN_MEETING'::text, 0;
    RETURN;
  END IF;

  UPDATE public.member_meeting_submissions AS submission
  SET cancelled_at = now(),
      cancelled_by = p_changed_by
  WHERE submission.registration_id = v_participant.registration_id
    AND submission.cancelled_at IS NULL;
  GET DIAGNOSTICS v_cancelled_submission_count = ROW_COUNT;

  RETURN QUERY SELECT 'CANCELLED'::text, v_cancelled_submission_count;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_member_meeting_participant(text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_member_meeting_participant(text, uuid)
  TO service_role;
