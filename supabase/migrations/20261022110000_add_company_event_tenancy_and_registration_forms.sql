-- Multi-company and multi-event foundation for AKKAI registration.
-- Existing participant IDs and operational records are retained and assigned
-- to one AKKAI company/event. No participant data is rewritten or deleted.

CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT companies_slug_valid CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  CONSTRAINT companies_name_valid CHECK (char_length(btrim(name)) BETWEEN 2 AND 150)
);

CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  slug text NOT NULL,
  event_code text NOT NULL,
  name text NOT NULL,
  starts_on date,
  ends_on date,
  registration_open boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT events_company_slug_unique UNIQUE (company_id, slug),
  CONSTRAINT events_public_slug_unique UNIQUE (slug),
  CONSTRAINT events_company_code_unique UNIQUE (company_id, event_code),
  CONSTRAINT events_id_company_unique UNIQUE (id, company_id),
  CONSTRAINT events_slug_valid CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  CONSTRAINT events_code_valid CHECK (event_code ~ '^[A-Z0-9]{2,16}$'),
  CONSTRAINT events_name_valid CHECK (char_length(btrim(name)) BETWEEN 2 AND 200),
  CONSTRAINT events_date_range_valid CHECK (ends_on IS NULL OR starts_on IS NULL OR ends_on >= starts_on)
);

INSERT INTO public.companies (slug, name)
VALUES ('akkai', 'Asosiasi Konsultan Aktuaria Indonesia')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.events (company_id, slug, event_code, name, starts_on, ends_on, registration_open)
SELECT company.id, 'akkai-2026', 'AKKAI26',
       'Seminar Profesi Konsultan Aktuaria Indonesia, Sertifikasi CIAC dan Rapat Anggota AKKAI 2026',
       DATE '2026-10-19', DATE '2026-10-21', true
FROM public.companies AS company
WHERE company.slug = 'akkai'
ON CONFLICT (company_id, slug) DO NOTHING;

CREATE TABLE public.company_memberships (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  role text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_memberships_profile_company_unique UNIQUE (profile_id, company_id),
  CONSTRAINT company_memberships_role_valid CHECK (
    role IN ('ADMIN', 'OPERATOR', 'REGISTRATION', 'OPERATIONAL', 'SCANNER')
  )
);

-- Existing active non-global users retain their existing role within AKKAI.
INSERT INTO public.company_memberships (company_id, profile_id, role)
SELECT company.id, profile.id, profile.role::text
FROM public.companies AS company
CROSS JOIN public.profiles AS profile
WHERE company.slug = 'akkai'
  AND profile.is_active = true
  AND profile.role::text <> 'SUPER_ADMIN'
ON CONFLICT (profile_id, company_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.current_registration_event_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_event_setting text := NULLIF(current_setting('app.registration_event_id', true), '');
  v_event_id uuid;
BEGIN
  IF v_event_setting IS NOT NULL THEN
    RETURN v_event_setting::uuid;
  END IF;

  SELECT event.id INTO v_event_id
  FROM public.events AS event
  WHERE event.slug = 'akkai-2026'
    AND event.company_id = (SELECT company.id FROM public.companies AS company WHERE company.slug = 'akkai');
  RETURN v_event_id;
END;
$$;

REVOKE ALL ON FUNCTION public.current_registration_event_id() FROM PUBLIC, anon, authenticated, service_role;

ALTER TABLE public.sessions ADD COLUMN event_id uuid;
ALTER TABLE public.participants ADD COLUMN event_id uuid;
ALTER TABLE public.scanner_stations ADD COLUMN event_id uuid;
ALTER TABLE public.attendance ADD COLUMN event_id uuid;
ALTER TABLE public.scan_events ADD COLUMN event_id uuid;
ALTER TABLE public.email_logs ADD COLUMN event_id uuid;
ALTER TABLE public.participant_travel ADD COLUMN event_id uuid;
ALTER TABLE public.participant_room_assignments ADD COLUMN event_id uuid;
ALTER TABLE public.participant_pickup_assignments ADD COLUMN event_id uuid;
ALTER TABLE public.registration_batches ADD COLUMN event_id uuid;
ALTER TABLE public.member_meeting_participants ADD COLUMN event_id uuid;
ALTER TABLE public.participant_email_changes ADD COLUMN event_id uuid;
ALTER TABLE public.member_meeting_upload_intents ADD COLUMN event_id uuid;
ALTER TABLE public.registration_submission_idempotency_keys ADD COLUMN event_id uuid;
ALTER TABLE public.participant_registration_status_changes ADD COLUMN event_id uuid;
ALTER TABLE public.registration_certificate_upload_intents ADD COLUMN event_id uuid;
ALTER TABLE public.registration_documents ADD COLUMN event_id uuid;
ALTER TABLE public.registration_billings ADD COLUMN event_id uuid;
ALTER TABLE public.registration_billing_email_logs ADD COLUMN event_id uuid;
ALTER TABLE public.member_meeting_submissions ADD COLUMN event_id uuid;

UPDATE public.sessions SET event_id = public.current_registration_event_id();
UPDATE public.participants SET event_id = public.current_registration_event_id();
UPDATE public.registration_batches SET event_id = public.current_registration_event_id();
UPDATE public.registration_certificate_upload_intents SET event_id = public.current_registration_event_id();
UPDATE public.member_meeting_upload_intents SET event_id = public.current_registration_event_id();

UPDATE public.scanner_stations AS station
SET event_id = session.event_id
FROM public.sessions AS session
WHERE session.id = station.session_id;

UPDATE public.attendance AS attendance
SET event_id = participant.event_id
FROM public.participants AS participant
WHERE participant.id = attendance.participant_id;

UPDATE public.scan_events AS scan_event
SET event_id = session.event_id
FROM public.sessions AS session
WHERE session.id = scan_event.session_id;

UPDATE public.email_logs AS email_log
SET event_id = participant.event_id
FROM public.participants AS participant
WHERE participant.id = email_log.participant_id;

UPDATE public.participant_travel AS travel
SET event_id = participant.event_id
FROM public.participants AS participant
WHERE participant.id = travel.participant_id;

UPDATE public.participant_room_assignments AS assignment
SET event_id = participant.event_id
FROM public.participants AS participant
WHERE participant.id = assignment.participant_id;

UPDATE public.participant_pickup_assignments AS assignment
SET event_id = participant.event_id
FROM public.participants AS participant
WHERE participant.id = assignment.participant_id;

UPDATE public.member_meeting_participants AS meeting_participant
SET event_id = participant.event_id
FROM public.participants AS participant
WHERE participant.id = meeting_participant.participant_id;

UPDATE public.participant_email_changes AS email_change
SET event_id = participant.event_id
FROM public.participants AS participant
WHERE participant.id = email_change.participant_id;

UPDATE public.registration_submission_idempotency_keys AS idempotency
SET event_id = participant.event_id
FROM public.participants AS participant
WHERE participant.id = idempotency.participant_id;

UPDATE public.participant_registration_status_changes AS status_change
SET event_id = participant.event_id
FROM public.participants AS participant
WHERE participant.id = status_change.participant_id;

UPDATE public.registration_documents AS document
SET event_id = participant.event_id
FROM public.participants AS participant
WHERE participant.id = document.participant_id;

UPDATE public.registration_billings AS billing
SET event_id = participant.event_id
FROM public.participants AS participant
WHERE participant.id = billing.participant_id;

UPDATE public.registration_billing_email_logs AS billing_log
SET event_id = billing.event_id
FROM public.registration_billings AS billing
WHERE billing.id = billing_log.billing_id;

UPDATE public.member_meeting_submissions AS submission
SET event_id = participant.event_id
FROM public.participants AS participant
WHERE participant.registration_id = submission.registration_id;

UPDATE public.member_meeting_submissions
SET event_id = public.current_registration_event_id()
WHERE event_id IS NULL;

ALTER TABLE public.sessions ALTER COLUMN event_id SET DEFAULT public.current_registration_event_id();
ALTER TABLE public.participants ALTER COLUMN event_id SET DEFAULT public.current_registration_event_id();
ALTER TABLE public.registration_batches ALTER COLUMN event_id SET DEFAULT public.current_registration_event_id();
ALTER TABLE public.registration_certificate_upload_intents ALTER COLUMN event_id SET DEFAULT public.current_registration_event_id();
ALTER TABLE public.member_meeting_upload_intents ALTER COLUMN event_id SET DEFAULT public.current_registration_event_id();

ALTER TABLE public.sessions ALTER COLUMN event_id SET NOT NULL;
ALTER TABLE public.participants ALTER COLUMN event_id SET NOT NULL;
ALTER TABLE public.scanner_stations ALTER COLUMN event_id SET NOT NULL;
ALTER TABLE public.attendance ALTER COLUMN event_id SET NOT NULL;
ALTER TABLE public.scan_events ALTER COLUMN event_id SET NOT NULL;
ALTER TABLE public.email_logs ALTER COLUMN event_id SET NOT NULL;
ALTER TABLE public.participant_travel ALTER COLUMN event_id SET NOT NULL;
ALTER TABLE public.participant_room_assignments ALTER COLUMN event_id SET NOT NULL;
ALTER TABLE public.participant_pickup_assignments ALTER COLUMN event_id SET NOT NULL;
ALTER TABLE public.registration_batches ALTER COLUMN event_id SET NOT NULL;
ALTER TABLE public.member_meeting_participants ALTER COLUMN event_id SET NOT NULL;
ALTER TABLE public.participant_email_changes ALTER COLUMN event_id SET NOT NULL;
ALTER TABLE public.member_meeting_upload_intents ALTER COLUMN event_id SET NOT NULL;
ALTER TABLE public.registration_submission_idempotency_keys ALTER COLUMN event_id SET NOT NULL;
ALTER TABLE public.participant_registration_status_changes ALTER COLUMN event_id SET NOT NULL;
ALTER TABLE public.registration_certificate_upload_intents ALTER COLUMN event_id SET NOT NULL;
ALTER TABLE public.registration_documents ALTER COLUMN event_id SET NOT NULL;
ALTER TABLE public.registration_billings ALTER COLUMN event_id SET NOT NULL;
ALTER TABLE public.registration_billing_email_logs ALTER COLUMN event_id SET NOT NULL;
ALTER TABLE public.member_meeting_submissions ALTER COLUMN event_id SET NOT NULL;

DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'sessions', 'participants', 'scanner_stations', 'attendance', 'scan_events',
    'email_logs', 'participant_travel', 'participant_room_assignments',
    'participant_pickup_assignments', 'registration_batches',
    'member_meeting_participants', 'participant_email_changes',
    'member_meeting_upload_intents', 'registration_submission_idempotency_keys',
    'participant_registration_status_changes', 'registration_certificate_upload_intents',
    'registration_documents', 'registration_billings', 'registration_billing_email_logs',
    'member_meeting_submissions'
  ] LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE RESTRICT',
      v_table, v_table || '_event_id_fkey'
    );
    EXECUTE format('CREATE INDEX %I ON public.%I (event_id)', v_table || '_event_id_idx', v_table);
  END LOOP;
END;
$$;

ALTER TABLE public.participants ADD CONSTRAINT participants_id_event_unique UNIQUE (id, event_id);
ALTER TABLE public.participants ADD CONSTRAINT participants_registration_event_unique UNIQUE (registration_id, event_id);
ALTER TABLE public.sessions ADD CONSTRAINT sessions_id_event_unique UNIQUE (id, event_id);
ALTER TABLE public.registration_batches ADD CONSTRAINT registration_batches_id_event_unique UNIQUE (id, event_id);
ALTER TABLE public.registration_billings ADD CONSTRAINT registration_billings_id_event_unique UNIQUE (id, event_id);
ALTER TABLE public.scanner_stations ADD CONSTRAINT scanner_stations_id_event_unique UNIQUE (id, event_id);

ALTER TABLE public.sessions DROP CONSTRAINT IF EXISTS sessions_code_key;
ALTER TABLE public.sessions ADD CONSTRAINT sessions_event_code_unique UNIQUE (event_id, code);
ALTER TABLE public.participants DROP CONSTRAINT IF EXISTS participants_registration_id_format;
ALTER TABLE public.participants ADD CONSTRAINT participants_registration_id_format
  CHECK (registration_id ~ '^[A-Z0-9]{2,16}-[0-9]{6}$');
ALTER TABLE public.registration_billings DROP CONSTRAINT IF EXISTS registration_billing_number_format;
ALTER TABLE public.registration_billings ADD CONSTRAINT registration_billing_number_format
  CHECK (billing_number ~ '^INV-[A-Z0-9]{2,16}-[0-9]{6}$');

ALTER TABLE public.participants
  ADD CONSTRAINT participants_batch_event_fkey
  FOREIGN KEY (batch_id, event_id)
  REFERENCES public.registration_batches(id, event_id) ON DELETE SET NULL (batch_id);
ALTER TABLE public.scanner_stations
  ADD CONSTRAINT scanner_stations_session_event_fkey
  FOREIGN KEY (session_id, event_id) REFERENCES public.sessions(id, event_id) ON DELETE RESTRICT;
ALTER TABLE public.attendance
  ADD CONSTRAINT attendance_participant_event_fkey
  FOREIGN KEY (participant_id, event_id) REFERENCES public.participants(id, event_id) ON DELETE RESTRICT,
  ADD CONSTRAINT attendance_session_event_fkey
  FOREIGN KEY (session_id, event_id) REFERENCES public.sessions(id, event_id) ON DELETE RESTRICT;
ALTER TABLE public.scan_events
  ADD CONSTRAINT scan_events_session_event_fkey
  FOREIGN KEY (session_id, event_id) REFERENCES public.sessions(id, event_id) ON DELETE RESTRICT,
  ADD CONSTRAINT scan_events_station_event_fkey
  FOREIGN KEY (station_id, event_id) REFERENCES public.scanner_stations(id, event_id) ON DELETE RESTRICT,
  ADD CONSTRAINT scan_events_participant_event_fkey
  FOREIGN KEY (participant_id, event_id) REFERENCES public.participants(id, event_id) ON DELETE RESTRICT;
ALTER TABLE public.email_logs
  ADD CONSTRAINT email_logs_participant_event_fkey
  FOREIGN KEY (participant_id, event_id) REFERENCES public.participants(id, event_id) ON DELETE RESTRICT;
ALTER TABLE public.participant_travel
  ADD CONSTRAINT participant_travel_participant_event_fkey
  FOREIGN KEY (participant_id, event_id) REFERENCES public.participants(id, event_id) ON DELETE RESTRICT;
ALTER TABLE public.participant_room_assignments
  ADD CONSTRAINT participant_room_participant_event_fkey
  FOREIGN KEY (participant_id, event_id) REFERENCES public.participants(id, event_id) ON DELETE RESTRICT;
ALTER TABLE public.participant_pickup_assignments
  ADD CONSTRAINT participant_pickup_participant_event_fkey
  FOREIGN KEY (participant_id, event_id) REFERENCES public.participants(id, event_id) ON DELETE RESTRICT;
ALTER TABLE public.registration_documents
  ADD CONSTRAINT registration_documents_participant_event_fkey
  FOREIGN KEY (participant_id, event_id) REFERENCES public.participants(id, event_id) ON DELETE RESTRICT;
ALTER TABLE public.registration_billings
  ADD CONSTRAINT registration_billings_participant_event_fkey
  FOREIGN KEY (participant_id, event_id) REFERENCES public.participants(id, event_id) ON DELETE RESTRICT,
  ADD CONSTRAINT registration_billings_registration_event_fkey
  FOREIGN KEY (registration_id, event_id) REFERENCES public.participants(registration_id, event_id) ON DELETE RESTRICT;
ALTER TABLE public.registration_billing_email_logs
  ADD CONSTRAINT registration_billing_email_logs_billing_event_fkey
  FOREIGN KEY (billing_id, event_id) REFERENCES public.registration_billings(id, event_id) ON DELETE RESTRICT;
ALTER TABLE public.registration_submission_idempotency_keys
  ADD CONSTRAINT registration_idempotency_participant_event_fkey
  FOREIGN KEY (participant_id, event_id) REFERENCES public.participants(id, event_id) ON DELETE RESTRICT;
ALTER TABLE public.participant_email_changes
  ADD CONSTRAINT participant_email_changes_participant_event_fkey
  FOREIGN KEY (participant_id, event_id) REFERENCES public.participants(id, event_id) ON DELETE RESTRICT;
ALTER TABLE public.participant_registration_status_changes
  ADD CONSTRAINT participant_status_changes_participant_event_fkey
  FOREIGN KEY (participant_id, event_id) REFERENCES public.participants(id, event_id) ON DELETE RESTRICT;
ALTER TABLE public.member_meeting_participants
  ADD CONSTRAINT member_meeting_participants_participant_event_fkey
  FOREIGN KEY (participant_id, event_id) REFERENCES public.participants(id, event_id) ON DELETE RESTRICT;
ALTER TABLE public.member_meeting_submissions
  ADD CONSTRAINT member_meeting_submissions_registration_event_fkey
  FOREIGN KEY (registration_id, event_id) REFERENCES public.participants(registration_id, event_id) ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION public.set_event_scoped_registration_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_code text;
  v_number bigint;
BEGIN
  IF NEW.registration_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT event.event_code INTO v_code
  FROM public.events AS event
  WHERE event.id = NEW.event_id;
  IF v_code IS NULL THEN
    RAISE EXCEPTION 'Registration event is unavailable.' USING ERRCODE = '23503';
  END IF;

  BEGIN
    v_number := nextval('public.registration_id_seq');
  EXCEPTION WHEN SQLSTATE '2200H' THEN
    RAISE EXCEPTION USING ERRCODE = '2200H', MESSAGE = 'Registration ID sequence limit reached.';
  END;
  NEW.registration_id := v_code || '-' || lpad(v_number::text, 6, '0');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_event_scoped_billing_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_code text;
BEGIN
  IF NEW.billing_number IS NOT NULL THEN
    RETURN NEW;
  END IF;
  SELECT event.event_code INTO v_code
  FROM public.events AS event
  WHERE event.id = NEW.event_id;
  IF v_code IS NULL THEN
    RAISE EXCEPTION 'Billing event is unavailable.' USING ERRCODE = '23503';
  END IF;
  NEW.billing_number := 'INV-' || v_code || '-' || lpad(nextval('public.billing_number_seq')::text, 6, '0');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_and_validate_event_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_expected_event_id uuid;
BEGIN
  CASE TG_TABLE_NAME
    WHEN 'participants', 'sessions', 'registration_batches',
         'registration_certificate_upload_intents', 'member_meeting_upload_intents' THEN
      v_expected_event_id := COALESCE(NEW.event_id, public.current_registration_event_id());
    WHEN 'scanner_stations' THEN
      SELECT session.event_id INTO v_expected_event_id FROM public.sessions AS session WHERE session.id = NEW.session_id;
    WHEN 'attendance' THEN
      SELECT participant.event_id INTO v_expected_event_id FROM public.participants AS participant WHERE participant.id = NEW.participant_id;
      IF NOT EXISTS (SELECT 1 FROM public.sessions AS session WHERE session.id = NEW.session_id AND session.event_id = v_expected_event_id) THEN
        RAISE EXCEPTION 'Attendance participant and session must belong to the same event.' USING ERRCODE = '23514';
      END IF;
    WHEN 'scan_events' THEN
      SELECT session.event_id INTO v_expected_event_id FROM public.sessions AS session WHERE session.id = NEW.session_id;
      IF NOT EXISTS (SELECT 1 FROM public.scanner_stations AS station WHERE station.id = NEW.station_id AND station.event_id = v_expected_event_id) THEN
        RAISE EXCEPTION 'Scan station and session must belong to the same event.' USING ERRCODE = '23514';
      END IF;
      IF NEW.participant_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.participants AS participant WHERE participant.id = NEW.participant_id AND participant.event_id = v_expected_event_id
      ) THEN
        RAISE EXCEPTION 'Scan participant and session must belong to the same event.' USING ERRCODE = '23514';
      END IF;
    WHEN 'email_logs', 'participant_travel', 'participant_room_assignments',
         'participant_pickup_assignments', 'member_meeting_participants',
         'participant_email_changes', 'registration_submission_idempotency_keys',
         'participant_registration_status_changes', 'registration_documents' THEN
      IF NEW.participant_id IS NOT NULL THEN
        SELECT participant.event_id INTO v_expected_event_id FROM public.participants AS participant WHERE participant.id = NEW.participant_id;
      ELSE
        v_expected_event_id := COALESCE(NEW.event_id, public.current_registration_event_id());
      END IF;
    WHEN 'registration_billings' THEN
      SELECT participant.event_id INTO v_expected_event_id FROM public.participants AS participant WHERE participant.id = NEW.participant_id;
    WHEN 'registration_billing_email_logs' THEN
      SELECT billing.event_id INTO v_expected_event_id FROM public.registration_billings AS billing WHERE billing.id = NEW.billing_id;
    WHEN 'member_meeting_submissions' THEN
      IF NEW.registration_id IS NOT NULL THEN
        SELECT participant.event_id INTO v_expected_event_id FROM public.participants AS participant WHERE participant.registration_id = NEW.registration_id;
      ELSE
        v_expected_event_id := COALESCE(NEW.event_id, public.current_registration_event_id());
      END IF;
    ELSE
      v_expected_event_id := NEW.event_id;
  END CASE;

  IF v_expected_event_id IS NULL THEN
    RAISE EXCEPTION 'Event ownership could not be resolved.' USING ERRCODE = '23503';
  END IF;
  IF NEW.event_id IS NOT NULL AND NEW.event_id <> v_expected_event_id THEN
    RAISE EXCEPTION 'Row event does not match its parent event.' USING ERRCODE = '23514';
  END IF;
  NEW.event_id := v_expected_event_id;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'sessions', 'participants', 'scanner_stations', 'attendance', 'scan_events',
    'email_logs', 'participant_travel', 'participant_room_assignments',
    'participant_pickup_assignments', 'registration_batches',
    'member_meeting_participants', 'participant_email_changes',
    'member_meeting_upload_intents', 'registration_submission_idempotency_keys',
    'participant_registration_status_changes', 'registration_certificate_upload_intents',
    'registration_documents', 'registration_billings', 'registration_billing_email_logs',
    'member_meeting_submissions'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT OR UPDATE OF event_id ON public.%I FOR EACH ROW EXECUTE FUNCTION public.assign_and_validate_event_id()',
      v_table || '_assign_event_id', v_table
    );
  END LOOP;
END;
$$;

DROP TRIGGER IF EXISTS participants_set_registration_id ON public.participants;
CREATE TRIGGER participants_set_registration_id
BEFORE INSERT ON public.participants
FOR EACH ROW EXECUTE FUNCTION public.set_event_scoped_registration_id();
DROP TRIGGER IF EXISTS registration_billings_set_number ON public.registration_billings;
CREATE TRIGGER registration_billings_set_number
BEFORE INSERT ON public.registration_billings
FOR EACH ROW EXECUTE FUNCTION public.set_event_scoped_billing_number();

CREATE TABLE public.registration_forms (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  event_id uuid NOT NULL UNIQUE REFERENCES public.events(id) ON DELETE RESTRICT,
  draft_config jsonb NOT NULL,
  published_version_id uuid,
  draft_updated_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT registration_forms_draft_config_object CHECK (jsonb_typeof(draft_config) = 'object')
);

CREATE TABLE public.registration_form_versions (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.registration_forms(id) ON DELETE RESTRICT,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE RESTRICT,
  version_number integer NOT NULL,
  config jsonb NOT NULL,
  published_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  published_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT registration_form_versions_number_valid CHECK (version_number > 0),
  CONSTRAINT registration_form_versions_config_object CHECK (jsonb_typeof(config) = 'object'),
  CONSTRAINT registration_form_versions_form_number_unique UNIQUE (form_id, version_number),
  CONSTRAINT registration_form_versions_id_event_unique UNIQUE (id, event_id),
  CONSTRAINT registration_form_versions_form_event_unique UNIQUE (id, form_id, event_id)
);

ALTER TABLE public.registration_forms
  ADD CONSTRAINT registration_forms_published_version_event_fkey
  FOREIGN KEY (published_version_id, event_id)
  REFERENCES public.registration_form_versions(id, event_id) ON DELETE RESTRICT;

CREATE TABLE public.registration_form_submissions (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE RESTRICT,
  form_version_id uuid NOT NULL,
  participant_id uuid,
  idempotency_key text NOT NULL,
  answers jsonb NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT registration_form_submissions_answers_object CHECK (jsonb_typeof(answers) = 'object'),
  CONSTRAINT registration_form_submissions_idempotency_unique UNIQUE (event_id, idempotency_key),
  CONSTRAINT registration_form_submissions_form_version_event_fkey
    FOREIGN KEY (form_version_id, event_id) REFERENCES public.registration_form_versions(id, event_id) ON DELETE RESTRICT,
  CONSTRAINT registration_form_submissions_participant_event_fkey
    FOREIGN KEY (participant_id, event_id) REFERENCES public.participants(id, event_id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX registration_form_submissions_participant_unique
  ON public.registration_form_submissions (participant_id)
  WHERE participant_id IS NOT NULL;
CREATE INDEX registration_form_submissions_event_submitted_idx
  ON public.registration_form_submissions (event_id, submitted_at DESC);

CREATE OR REPLACE FUNCTION public.reject_registration_form_submission_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Registration form submissions are immutable.' USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER registration_form_submissions_immutable
BEFORE UPDATE OR DELETE ON public.registration_form_submissions
FOR EACH ROW EXECUTE FUNCTION public.reject_registration_form_submission_mutation();

CREATE OR REPLACE FUNCTION public.reject_published_form_version_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Published registration form versions are immutable.' USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER registration_form_versions_immutable
BEFORE UPDATE OR DELETE ON public.registration_form_versions
FOR EACH ROW EXECUTE FUNCTION public.reject_published_form_version_mutation();

CREATE OR REPLACE FUNCTION public.has_event_permission(
  p_profile_id uuid,
  p_event_id uuid,
  p_permission text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT (auth.role() = 'service_role' OR p_profile_id = auth.uid()) AND (EXISTS (
    SELECT 1 FROM public.profiles AS profile
    WHERE profile.id = p_profile_id
      AND profile.is_active = true
      AND profile.role::text = 'SUPER_ADMIN'
  ) OR EXISTS (
    SELECT 1
    FROM public.company_memberships AS membership
    JOIN public.events AS event ON event.company_id = membership.company_id
    WHERE membership.profile_id = p_profile_id
      AND membership.is_active = true
      AND event.id = p_event_id
      AND CASE membership.role
        WHEN 'ADMIN' THEN p_permission IN (
          'dashboard.view', 'participants.view', 'participants.manage', 'participants.email',
          'participants.export', 'participants.cancel', 'rooms.view', 'rooms.manage',
          'rooms.export', 'pickup.view', 'pickup.manage', 'pickup.export',
          'attendance.view', 'attendance.export', 'sessions.view', 'sessions.manage',
          'scanner.pair', 'scanner.checkin', 'display.view', 'display.manage',
          'member_meetings.view', 'member_meetings.manage', 'forms.view', 'forms.manage'
        )
        WHEN 'OPERATIONAL' THEN p_permission IN (
          'dashboard.view', 'participants.view', 'participants.manage', 'participants.email',
          'participants.export', 'participants.cancel', 'rooms.view', 'rooms.manage',
          'rooms.export', 'pickup.view', 'pickup.manage', 'pickup.export',
          'attendance.view', 'attendance.export', 'member_meetings.view', 'forms.view'
        )
        WHEN 'REGISTRATION' THEN p_permission IN (
          'dashboard.view', 'participants.view', 'participants.manage', 'participants.email',
          'participants.export', 'attendance.view', 'forms.view'
        )
        WHEN 'OPERATOR' THEN p_permission IN ('scanner.pair', 'scanner.checkin', 'display.view')
        WHEN 'SCANNER' THEN p_permission IN ('scanner.pair', 'scanner.checkin', 'display.view')
        ELSE false
      END
  ));
$$;

REVOKE ALL ON FUNCTION public.has_event_permission(uuid, uuid, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.has_event_permission(uuid, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_participant_registration_status(
  p_registration_id text,
  p_target_status public.registration_status,
  p_changed_by uuid,
  p_cancellation_reason text DEFAULT NULL
)
RETURNS TABLE (result_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_participant public.participants%ROWTYPE;
  v_reason text := NULLIF(btrim(coalesce(p_cancellation_reason, '')), '');
  v_permission text;
BEGIN
  IF p_registration_id IS NULL
     OR btrim(p_registration_id) !~ '^[A-Z0-9]{2,16}-[0-9]{6}$'
     OR p_target_status IS NULL THEN
    RETURN QUERY SELECT 'INVALID_INPUT'::text;
    RETURN;
  END IF;

  IF p_target_status = 'CANCELLED'::public.registration_status THEN
    v_permission := 'participants.cancel';
    IF v_reason IS NULL OR char_length(v_reason) > 500 THEN
      RETURN QUERY SELECT 'INVALID_REASON'::text;
      RETURN;
    END IF;
  ELSE
    v_permission := 'participants.restore';
  END IF;

  SELECT participant.* INTO v_participant
  FROM public.participants AS participant
  WHERE participant.registration_id = btrim(p_registration_id)
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'NOT_FOUND'::text;
    RETURN;
  END IF;

  IF NOT public.has_event_permission(p_changed_by, v_participant.event_id, v_permission) THEN
    RETURN QUERY SELECT 'UNAUTHORIZED_ACTOR'::text;
    RETURN;
  END IF;
  IF v_participant.registration_status = p_target_status THEN
    RETURN QUERY SELECT CASE
      WHEN p_target_status = 'CANCELLED'::public.registration_status
        THEN 'ALREADY_CANCELLED'::text
      ELSE 'ALREADY_REGISTERED'::text
    END;
    RETURN;
  END IF;

  IF p_target_status = 'CANCELLED'::public.registration_status THEN
    UPDATE public.participants
    SET registration_status = 'CANCELLED'::public.registration_status,
        cancelled_at = now(),
        cancelled_by = p_changed_by,
        cancellation_reason = v_reason
    WHERE id = v_participant.id;
  ELSE
    UPDATE public.participants
    SET registration_status = 'REGISTERED'::public.registration_status,
        cancelled_at = NULL,
        cancelled_by = NULL,
        cancellation_reason = NULL
    WHERE id = v_participant.id;
  END IF;

  INSERT INTO public.participant_registration_status_changes (
    participant_id, previous_status, new_status, cancellation_reason, changed_by
  ) VALUES (
    v_participant.id,
    v_participant.registration_status,
    p_target_status,
    v_reason,
    p_changed_by
  );
  RETURN QUERY SELECT 'UPDATED'::text;
END;
$$;

DO $$
DECLARE
  v_definition text;
BEGIN
  SELECT pg_get_functiondef(proc.oid) INTO v_definition
  FROM pg_proc AS proc
  JOIN pg_namespace AS namespace ON namespace.oid = proc.pronamespace
  WHERE namespace.nspname = 'public'
    AND proc.proname = 'upsert_participant_travel';
  v_definition := replace(
    v_definition,
    'v_registration_id !~ ''^AKKAI26-[0-9]{6}$''',
    'v_registration_id !~ ''^[A-Z0-9]{2,16}-[0-9]{6}$'''
  );
  EXECUTE v_definition;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_registration_form_answers(
  p_form_version_id uuid,
  p_answers jsonb
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_fields jsonb;
  v_field jsonb;
  v_key text;
  v_type text;
  v_value jsonb;
  v_option text;
BEGIN
  IF p_answers IS NULL OR jsonb_typeof(p_answers) <> 'object' THEN
    RETURN false;
  END IF;
  SELECT version.config->'fields' INTO v_fields
  FROM public.registration_form_versions AS version
  WHERE version.id = p_form_version_id;
  IF v_fields IS NULL OR jsonb_typeof(v_fields) <> 'array' THEN
    RETURN false;
  END IF;

  FOR v_key IN SELECT jsonb_object_keys(p_answers) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_fields) AS field
      WHERE field->>'key' = v_key AND coalesce((field->>'system')::boolean, false) = false
    ) THEN
      RETURN false;
    END IF;
  END LOOP;

  FOR v_field IN SELECT value FROM jsonb_array_elements(v_fields) LOOP
    v_key := v_field->>'key';
    v_type := v_field->>'type';
    v_value := p_answers->v_key;
    IF coalesce((v_field->>'required')::boolean, false)
       AND (v_value IS NULL OR v_value = 'null'::jsonb OR v_value = '""'::jsonb OR v_value = 'false'::jsonb) THEN
      RETURN false;
    END IF;
    IF v_value IS NULL OR v_value = 'null'::jsonb THEN
      CONTINUE;
    END IF;
    IF v_type IN ('text', 'email', 'tel', 'textarea', 'date', 'select', 'radio') THEN
      IF jsonb_typeof(v_value) <> 'string' THEN RETURN false; END IF;
      IF v_type IN ('select', 'radio') AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(coalesce(v_field->'options', '[]'::jsonb)) AS option_value
        WHERE option_value = v_value #>> '{}'
      ) THEN RETURN false; END IF;
      IF v_type = 'email' AND (v_value #>> '{}') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RETURN false; END IF;
      IF v_type = 'date' AND (v_value #>> '{}') !~ '^\d{4}-\d{2}-\d{2}$' THEN RETURN false; END IF;
    ELSIF v_type = 'number' THEN
      IF jsonb_typeof(v_value) <> 'number' THEN RETURN false; END IF;
    ELSIF v_type = 'checkbox' THEN
      IF jsonb_typeof(v_value) <> 'boolean' THEN RETURN false; END IF;
    ELSE
      -- Unknown field types (including arbitrary markup/code and file uploads)
      -- are rejected by the database contract as well as the server schema.
      RETURN false;
    END IF;
  END LOOP;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_registration_form_answers(uuid, jsonb) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_valid_registration_form_config(p_config jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN jsonb_typeof(p_config) <> 'object'
      OR p_config->>'schemaVersion' <> '1'
      OR jsonb_typeof(p_config->'title') <> 'string'
      OR char_length(btrim(p_config->>'title')) NOT BETWEEN 1 AND 200
      OR (p_config->>'title') ~ '[<>]'
      OR lower(p_config->>'title') ~ 'javascript[[:space:]]*:'
      OR jsonb_typeof(p_config->'instructions') <> 'string'
      OR char_length(p_config->>'instructions') > 2000
      OR (p_config->>'instructions') ~ '[<>]'
      OR lower(p_config->>'instructions') ~ 'javascript[[:space:]]*:'
      OR jsonb_typeof(p_config->'sections') <> 'array'
      OR jsonb_array_length(p_config->'sections') NOT BETWEEN 1 AND 30
      OR jsonb_typeof(p_config->'fields') <> 'array'
      OR jsonb_array_length(p_config->'fields') > 100
    THEN false
    WHEN EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_config->'sections') AS section
      WHERE jsonb_typeof(section->'id') <> 'string'
        OR (section->>'id') !~ '^[a-z][a-z0-9_-]{0,39}$'
        OR jsonb_typeof(section->'title') <> 'string'
        OR char_length(btrim(section->>'title')) NOT BETWEEN 1 AND 120
        OR (section->>'title') ~ '[<>]'
        OR lower(section->>'title') ~ 'javascript[[:space:]]*:'
        OR jsonb_typeof(section->'position') <> 'number'
        OR (section->>'position')::numeric < 0
        OR (section->>'position')::numeric > 1000
        OR (section ? 'description' AND (
          jsonb_typeof(section->'description') <> 'string'
          OR char_length(section->>'description') > 500
          OR (section->>'description') ~ '[<>]'
          OR lower(section->>'description') ~ 'javascript[[:space:]]*:'
        ))
    ) THEN false
    WHEN EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_config->'fields') AS field
      WHERE jsonb_typeof(field->'id') <> 'string'
        OR (field->>'id') !~ '^[a-z][a-z0-9_-]{0,59}$'
        OR jsonb_typeof(field->'key') <> 'string'
        OR (field->>'key') !~ '^[a-z][a-z0-9_]{0,59}$'
        OR jsonb_typeof(field->'type') <> 'string'
        OR field->>'type' NOT IN ('text', 'email', 'tel', 'number', 'textarea', 'date', 'select', 'radio', 'checkbox', 'file')
        OR jsonb_typeof(field->'label') <> 'string'
        OR char_length(btrim(field->>'label')) NOT BETWEEN 1 AND 160
        OR (field->>'label') ~ '[<>]'
        OR lower(field->>'label') ~ 'javascript[[:space:]]*:'
        OR jsonb_typeof(field->'required') <> 'boolean'
        OR jsonb_typeof(field->'sectionId') <> 'string'
        OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_config->'sections') AS section WHERE section->>'id' = field->>'sectionId')
        OR jsonb_typeof(field->'position') <> 'number'
        OR (field->>'position')::numeric < 0
        OR (field->>'position')::numeric > 1000
        OR (field ? 'placeholder' AND (
          jsonb_typeof(field->'placeholder') <> 'string'
          OR char_length(field->>'placeholder') > 200
          OR (field->>'placeholder') ~ '[<>]'
          OR lower(field->>'placeholder') ~ 'javascript[[:space:]]*:'
        ))
        OR (field->>'type' IN ('select', 'radio') AND (jsonb_typeof(field->'options') <> 'array' OR jsonb_array_length(field->'options') < 1 OR jsonb_array_length(field->'options') > 30))
        OR (field ? 'options' AND jsonb_typeof(field->'options') = 'array' AND EXISTS (
          SELECT 1 FROM jsonb_array_elements(field->'options') AS option_value
          WHERE jsonb_typeof(option_value) <> 'string'
             OR (option_value #>> '{}') ~ '[<>]'
             OR lower(option_value #>> '{}') ~ 'javascript[[:space:]]*:'
        ))
        OR (field->>'type' = 'file' AND (field->>'key' <> 'certificate_file' OR field->>'system' <> 'true'))
        OR (coalesce(field->>'system', 'false') <> 'true' AND field->>'type' = 'file')
        OR EXISTS (
          SELECT 1 FROM jsonb_each(field) AS property(key, value)
          WHERE property.key NOT IN ('id', 'key', 'type', 'label', 'placeholder', 'required', 'options', 'sectionId', 'position', 'system')
        )
    ) THEN false
    WHEN (SELECT count(*) FROM jsonb_array_elements(p_config->'fields') AS field WHERE field->>'system' = 'true') < 13 THEN false
    WHEN EXISTS (
      SELECT required.key
      FROM (VALUES
        ('full_name', 'text', true), ('email', 'email', true), ('phone_number', 'tel', true),
        ('kka_name', 'text', true), ('position', 'text', true), ('polo_size', 'select', true),
        ('polo_model', 'select', true), ('package_type', 'select', true), ('participation_scope', 'select', true),
        ('actuarial_consultant_status', 'select', false), ('attends_pai_congress', 'select', true),
        ('privacy_consent', 'checkbox', true), ('certificate_file', 'file', false)
      ) AS required(key, field_type, is_required)
      WHERE NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_config->'fields') AS field
        WHERE field->>'key' = required.key
          AND field->>'id' = required.key
          AND field->>'type' = required.field_type
          AND field->>'system' = 'true'
          AND (field->>'required')::boolean = required.is_required
      )
    ) THEN false
    WHEN (SELECT count(*) FROM jsonb_array_elements(p_config->'fields') AS field) <>
         (SELECT count(DISTINCT field->>'key') FROM jsonb_array_elements(p_config->'fields') AS field) THEN false
    WHEN (SELECT count(*) FROM jsonb_array_elements(p_config->'fields') AS field) <>
         (SELECT count(DISTINCT field->>'id') FROM jsonb_array_elements(p_config->'fields') AS field) THEN false
    WHEN (SELECT count(*) FROM jsonb_array_elements(p_config->'sections') AS section) <>
         (SELECT count(DISTINCT section->>'id') FROM jsonb_array_elements(p_config->'sections') AS section) THEN false
    ELSE true
  END;
$$;

REVOKE ALL ON FUNCTION public.is_valid_registration_form_config(jsonb) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.save_registration_form_draft(
  p_event_id uuid,
  p_config jsonb,
  p_updated_by uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_form_id uuid;
BEGIN
  IF NOT public.has_event_permission(p_updated_by, p_event_id, 'forms.manage') THEN
    RAISE EXCEPTION 'Form management permission is required.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_valid_registration_form_config(p_config) THEN
    RAISE EXCEPTION 'Registration form configuration is invalid.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.registration_forms (event_id, draft_config, draft_updated_by)
  VALUES (p_event_id, p_config, p_updated_by)
  ON CONFLICT (event_id) DO UPDATE
    SET draft_config = EXCLUDED.draft_config,
        draft_updated_by = EXCLUDED.draft_updated_by,
        updated_at = now()
  RETURNING id INTO v_form_id;
  RETURN v_form_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.publish_registration_form_draft(
  p_event_id uuid,
  p_published_by uuid
)
RETURNS TABLE (version_id uuid, version_number integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_form public.registration_forms%ROWTYPE;
  v_next_version integer;
  v_version_id uuid;
BEGIN
  IF NOT public.has_event_permission(p_published_by, p_event_id, 'forms.manage') THEN
    RAISE EXCEPTION 'Form management permission is required.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_form
  FROM public.registration_forms AS form
  WHERE form.event_id = p_event_id
  FOR UPDATE;
  IF NOT FOUND OR NOT public.is_valid_registration_form_config(v_form.draft_config) THEN
    RAISE EXCEPTION 'Registration form draft is unavailable or invalid.' USING ERRCODE = '22023';
  END IF;

  SELECT coalesce(max(form_version.version_number), 0) + 1 INTO v_next_version
  FROM public.registration_form_versions AS form_version
  WHERE form_version.form_id = v_form.id;

  INSERT INTO public.registration_form_versions (form_id, event_id, version_number, config, published_by)
  VALUES (v_form.id, p_event_id, v_next_version, v_form.draft_config, p_published_by)
  RETURNING id INTO v_version_id;

  UPDATE public.registration_forms
  SET published_version_id = v_version_id, updated_at = now()
  WHERE id = v_form.id;

  RETURN QUERY SELECT v_version_id, v_next_version;
END;
$$;

REVOKE ALL ON FUNCTION public.save_registration_form_draft(uuid, jsonb, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.publish_registration_form_draft(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_registration_form_draft(uuid, jsonb, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.publish_registration_form_draft(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.submit_public_registration_form(
  p_event_id uuid,
  p_form_version_id uuid,
  p_idempotency_key text,
  p_answers jsonb
)
RETURNS TABLE (result_code text, submission_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_published_version_id uuid;
  v_submission_id uuid;
BEGIN
  SELECT form.published_version_id INTO v_published_version_id
  FROM public.registration_forms AS form
  JOIN public.events AS event ON event.id = form.event_id
  WHERE form.event_id = p_event_id
    AND event.registration_open = true;
  IF v_published_version_id IS DISTINCT FROM p_form_version_id
     OR p_idempotency_key IS NULL
     OR char_length(btrim(p_idempotency_key)) NOT BETWEEN 16 AND 200
     OR NOT public.validate_registration_form_answers(p_form_version_id, p_answers) THEN
    RETURN QUERY SELECT 'INVALID_INPUT'::text, NULL::uuid;
    RETURN;
  END IF;

  INSERT INTO public.registration_form_submissions (event_id, form_version_id, idempotency_key, answers)
  VALUES (p_event_id, p_form_version_id, btrim(p_idempotency_key), p_answers)
  ON CONFLICT (event_id, idempotency_key) DO NOTHING
  RETURNING id INTO v_submission_id;
  IF v_submission_id IS NULL THEN
    SELECT submission.id INTO v_submission_id
    FROM public.registration_form_submissions AS submission
    WHERE submission.event_id = p_event_id AND submission.idempotency_key = btrim(p_idempotency_key);
    RETURN QUERY SELECT 'ALREADY_SUBMITTED'::text, v_submission_id;
    RETURN;
  END IF;
  RETURN QUERY SELECT 'SUBMITTED'::text, v_submission_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_public_registration_form(uuid, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_public_registration_form(uuid, uuid, text, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.create_participant_with_registration_reservation_v7(
  p_full_name text,
  p_email text,
  p_phone_number text,
  p_kka_name text,
  p_position text,
  p_polo_size text,
  p_polo_model text,
  p_package_type text,
  p_participation_scope text,
  p_actuarial_consultant_status text,
  p_attends_pai_congress boolean,
  p_privacy_consent_at timestamptz,
  p_certificate_upload_intent_id uuid,
  p_idempotency_key text,
  p_event_id uuid,
  p_form_version_id uuid,
  p_answers jsonb
)
RETURNS TABLE (
  result_code text,
  participant_id uuid,
  registration_id text,
  full_name text,
  email text,
  qr_token text,
  email_log_id uuid,
  email_generation bigint,
  billing_id uuid,
  billing_number text,
  billing_amount bigint,
  billing_created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result record;
  v_form_is_published boolean;
  v_upload_event_id uuid;
  v_existing_event_id uuid;
  v_existing_form_version_id uuid;
BEGIN
  SELECT form.published_version_id = p_form_version_id
  INTO v_form_is_published
  FROM public.registration_forms AS form
  JOIN public.events AS event ON event.id = form.event_id
  WHERE form.event_id = p_event_id AND event.registration_open = true;
  IF NOT coalesce(v_form_is_published, false)
     OR NOT public.validate_registration_form_answers(p_form_version_id, p_answers) THEN
    RETURN QUERY SELECT 'INVALID_INPUT'::text, NULL::uuid, NULL::text, NULL::text,
      NULL::text, NULL::text, NULL::uuid, NULL::bigint, NULL::uuid, NULL::text,
      NULL::bigint, NULL::timestamptz;
    RETURN;
  END IF;
  IF p_certificate_upload_intent_id IS NOT NULL THEN
    SELECT intent.event_id INTO v_upload_event_id
    FROM public.registration_certificate_upload_intents AS intent
    WHERE intent.id = p_certificate_upload_intent_id;
    IF v_upload_event_id IS DISTINCT FROM p_event_id THEN
      RETURN QUERY SELECT 'INVALID_INPUT'::text, NULL::uuid, NULL::text, NULL::text,
        NULL::text, NULL::text, NULL::uuid, NULL::bigint, NULL::uuid, NULL::text,
        NULL::bigint, NULL::timestamptz;
      RETURN;
    END IF;
  END IF;

  PERFORM set_config('app.registration_event_id', p_event_id::text, true);
  SELECT * INTO v_result
  FROM public.create_participant_with_registration_reservation_v5(
    p_full_name, p_email, p_phone_number, p_kka_name, p_position, p_polo_size,
    p_polo_model, p_package_type, p_participation_scope,
    p_actuarial_consultant_status, p_attends_pai_congress, p_privacy_consent_at,
    p_certificate_upload_intent_id, p_idempotency_key
  );
  IF v_result.result_code NOT IN ('CREATED', 'ALREADY_CREATED') THEN
    RETURN QUERY SELECT v_result.result_code::text, NULL::uuid, NULL::text, NULL::text,
      NULL::text, NULL::text, NULL::uuid, NULL::bigint, NULL::uuid, NULL::text,
      NULL::bigint, NULL::timestamptz;
    RETURN;
  END IF;

  SELECT participant.event_id INTO v_existing_event_id
  FROM public.participants AS participant
  WHERE participant.id = v_result.participant_id;
  SELECT submission.form_version_id INTO v_existing_form_version_id
  FROM public.registration_form_submissions AS submission
  WHERE submission.event_id = p_event_id AND submission.idempotency_key = btrim(p_idempotency_key);
  IF v_existing_event_id IS DISTINCT FROM p_event_id
     OR (v_result.result_code = 'ALREADY_CREATED' AND v_existing_form_version_id IS DISTINCT FROM p_form_version_id) THEN
    RETURN QUERY SELECT 'IDEMPOTENCY_CONFLICT'::text, NULL::uuid, NULL::text, NULL::text,
      NULL::text, NULL::text, NULL::uuid, NULL::bigint, NULL::uuid, NULL::text,
      NULL::bigint, NULL::timestamptz;
    RETURN;
  END IF;

  INSERT INTO public.registration_form_submissions (
    event_id, form_version_id, participant_id, idempotency_key, answers
  ) VALUES (
    p_event_id, p_form_version_id, v_result.participant_id, btrim(p_idempotency_key), p_answers
  ) ON CONFLICT (event_id, idempotency_key) DO NOTHING;

  RETURN QUERY SELECT v_result.result_code::text, v_result.participant_id::uuid,
    v_result.registration_id::text, v_result.full_name::text, v_result.email::text,
    v_result.qr_token::text, v_result.email_log_id::uuid,
    v_result.email_generation::bigint, v_result.billing_id::uuid,
    v_result.billing_number::text, v_result.billing_amount::bigint,
    v_result.billing_created_at::timestamptz;
END;
$$;

REVOKE ALL ON FUNCTION public.create_participant_with_registration_reservation_v7(
  text, text, text, text, text, text, text, text, text, text, boolean, timestamptz,
  uuid, text, uuid, uuid, jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_participant_with_registration_reservation_v7(
  text, text, text, text, text, text, text, text, text, text, boolean, timestamptz,
  uuid, text, uuid, uuid, jsonb
) TO service_role;

CREATE OR REPLACE FUNCTION public.create_participant_with_registration_reservation_v8(
  p_full_name text,
  p_email text,
  p_phone_number text,
  p_kka_name text,
  p_position text,
  p_polo_size text,
  p_polo_model text,
  p_package_type text,
  p_participation_scope text,
  p_actuarial_consultant_status text,
  p_attends_pai_congress boolean,
  p_privacy_consent_at timestamptz,
  p_certificate_upload_intent_id uuid,
  p_idempotency_key text,
  p_batch_id uuid,
  p_member_number text,
  p_institution text,
  p_travel jsonb,
  p_event_id uuid,
  p_form_version_id uuid,
  p_answers jsonb
)
RETURNS TABLE (
  result_code text,
  participant_id uuid,
  registration_id text,
  full_name text,
  email text,
  qr_token text,
  email_log_id uuid,
  email_generation bigint,
  billing_id uuid,
  billing_number text,
  billing_amount bigint,
  billing_created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result record;
  v_form_is_published boolean;
  v_batch_event_id uuid;
BEGIN
  SELECT form.published_version_id = p_form_version_id
  INTO v_form_is_published
  FROM public.registration_forms AS form
  JOIN public.events AS event ON event.id = form.event_id
  WHERE form.event_id = p_event_id AND event.registration_open = true;
  SELECT batch.event_id INTO v_batch_event_id
  FROM public.registration_batches AS batch WHERE batch.id = p_batch_id;
  IF NOT coalesce(v_form_is_published, false)
     OR v_batch_event_id IS DISTINCT FROM p_event_id
     OR NOT public.validate_registration_form_answers(p_form_version_id, p_answers) THEN
    RETURN QUERY SELECT 'INVALID_INPUT'::text, NULL::uuid, NULL::text, NULL::text,
      NULL::text, NULL::text, NULL::uuid, NULL::bigint, NULL::uuid, NULL::text,
      NULL::bigint, NULL::timestamptz;
    RETURN;
  END IF;

  PERFORM set_config('app.registration_event_id', p_event_id::text, true);
  SELECT * INTO v_result
  FROM public.create_participant_with_registration_reservation_v6(
    p_full_name, p_email, p_phone_number, p_kka_name, p_position, p_polo_size,
    p_polo_model, p_package_type, p_participation_scope,
    p_actuarial_consultant_status, p_attends_pai_congress, p_privacy_consent_at,
    p_certificate_upload_intent_id, p_idempotency_key, p_batch_id,
    p_member_number, p_institution, p_travel
  );
  IF v_result.result_code NOT IN ('CREATED', 'ALREADY_CREATED') THEN
    RETURN QUERY SELECT v_result.result_code::text, NULL::uuid, NULL::text, NULL::text,
      NULL::text, NULL::text, NULL::uuid, NULL::bigint, NULL::uuid, NULL::text,
      NULL::bigint, NULL::timestamptz;
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.participants AS participant
    WHERE participant.id = v_result.participant_id
      AND participant.event_id = p_event_id
      AND participant.batch_id = p_batch_id
  ) THEN
    RETURN QUERY SELECT 'IDEMPOTENCY_CONFLICT'::text, NULL::uuid, NULL::text, NULL::text,
      NULL::text, NULL::text, NULL::uuid, NULL::bigint, NULL::uuid, NULL::text,
      NULL::bigint, NULL::timestamptz;
    RETURN;
  END IF;
  INSERT INTO public.registration_form_submissions (
    event_id, form_version_id, participant_id, idempotency_key, answers
  ) VALUES (
    p_event_id, p_form_version_id, v_result.participant_id, btrim(p_idempotency_key), p_answers
  ) ON CONFLICT (event_id, idempotency_key) DO NOTHING;

  RETURN QUERY SELECT v_result.result_code::text, v_result.participant_id::uuid,
    v_result.registration_id::text, v_result.full_name::text, v_result.email::text,
    v_result.qr_token::text, v_result.email_log_id::uuid,
    v_result.email_generation::bigint, v_result.billing_id::uuid,
    v_result.billing_number::text, v_result.billing_amount::bigint,
    v_result.billing_created_at::timestamptz;
END;
$$;

REVOKE ALL ON FUNCTION public.create_participant_with_registration_reservation_v8(
  text, text, text, text, text, text, text, text, text, text, boolean, timestamptz,
  uuid, text, uuid, text, text, jsonb, uuid, uuid, jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_participant_with_registration_reservation_v8(
  text, text, text, text, text, text, text, text, text, text, boolean, timestamptz,
  uuid, text, uuid, text, text, jsonb, uuid, uuid, jsonb
) TO service_role;

-- V5/V6 remain callable internally by the definer-owned V7/V8 wrappers only;
-- app callers must use the event-bound reservation RPCs.
REVOKE ALL ON FUNCTION public.create_participant_with_registration_reservation_v5(
  text, text, text, text, text, text, text, text, text, text, boolean, timestamptz, uuid, text
) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.create_participant_with_registration_reservation_v6(
  text, text, text, text, text, text, text, text, text, text, boolean, timestamptz,
  uuid, text, uuid, text, text, jsonb
) FROM PUBLIC, anon, authenticated, service_role;

-- Create the v1 AKKAI form snapshot without touching existing participant IDs.
INSERT INTO public.registration_forms (event_id, draft_config)
SELECT event.id,
  '{
    "schemaVersion":1,
    "title":"Formulir Registrasi Seminar Profesi Konsultan Aktuaria Indonesia, Sertifikasi CIAC dan Rapat Anggota AKKAI 2026",
    "instructions":"Lengkapi data berikut dengan benar untuk menyimpan pendaftaran Anda.",
    "sections":[
      {"id":"identitas","title":"Data Diri & Kontak","description":"Identitas peserta","position":1},
      {"id":"akomodasi","title":"Paket yang Diambil","description":"Akomodasi kegiatan","position":2},
      {"id":"polo","title":"Pilihan Poloshirt","description":"Pilihan Peserta","position":3},
      {"id":"profesi","title":"Informasi Profesi & Kehadiran","description":"Status kepesertaan","position":4},
      {"id":"persetujuan","title":"Persetujuan & Kebijakan Data","description":"Konfirmasi akhir","position":5}
    ],
    "fields":[
      {"id":"full_name","key":"full_name","type":"text","label":"Nama","placeholder":"Masukkan nama lengkap sesuai identitas","required":true,"sectionId":"identitas","position":1,"system":true},
      {"id":"kka_name","key":"kka_name","type":"text","label":"KKA","placeholder":"Masukkan nama KKA","required":true,"sectionId":"identitas","position":2,"system":true},
      {"id":"position","key":"position","type":"text","label":"Jabatan","placeholder":"Masukkan jabatan","required":true,"sectionId":"identitas","position":3,"system":true},
      {"id":"phone_number","key":"phone_number","type":"tel","label":"No. HP","placeholder":"Contoh: 081234567890","required":true,"sectionId":"identitas","position":4,"system":true},
      {"id":"email","key":"email","type":"email","label":"Alamat Email","placeholder":"nama@email.com","required":true,"sectionId":"identitas","position":5,"system":true},
      {"id":"package_type","key":"package_type","type":"select","label":"Paket yang diambil","required":true,"options":["Twin Share","Single"],"sectionId":"akomodasi","position":1,"system":true},
      {"id":"polo_size","key":"polo_size","type":"select","label":"Ukuran Poloshirt","required":true,"options":["S","M","L","XL","XXL","XXXL","XXXXL"],"sectionId":"polo","position":1,"system":true},
      {"id":"polo_model","key":"polo_model","type":"select","label":"Model Poloshirt","required":true,"options":["Lengan Panjang","Lengan Pendek"],"sectionId":"polo","position":2,"system":true},
      {"id":"participation_scope","key":"participation_scope","type":"select","label":"Mengikuti","required":true,"options":["Seluruh acara","Rapat Anggota AKKAI 2026","Seminar Profesi Konsultan Aktuaria"],"sectionId":"profesi","position":1,"system":true},
      {"id":"actuarial_consultant_status","key":"actuarial_consultant_status","type":"select","label":"Status CIAC","required":false,"options":["Peserta Baru","Penerima Grandfathering CIAC"],"sectionId":"profesi","position":2,"system":true},
      {"id":"attends_pai_congress","key":"attends_pai_congress","type":"select","label":"Hadir pada Kongres Persatuan Aktuaris Indonesia (PAI)","required":true,"options":["true","false"],"sectionId":"profesi","position":3,"system":true},
      {"id":"privacy_consent","key":"privacy_consent","type":"checkbox","label":"Saya menyetujui penggunaan data untuk keperluan registrasi, komunikasi, dan administrasi AKKAI 2026.","required":true,"sectionId":"persetujuan","position":1,"system":true},
      {"id":"certificate_file","key":"certificate_file","type":"file","label":"Surat Keterangan Kerja CIAC","required":false,"sectionId":"profesi","position":4,"system":true}
    ]
  }'::jsonb
FROM public.events AS event
JOIN public.companies AS company ON company.id = event.company_id
WHERE company.slug = 'akkai' AND event.slug = 'akkai-2026'
ON CONFLICT (event_id) DO NOTHING;

INSERT INTO public.registration_form_versions (form_id, event_id, version_number, config, published_at)
SELECT form.id, form.event_id, 1, form.draft_config, now()
FROM public.registration_forms AS form
JOIN public.events AS event ON event.id = form.event_id
JOIN public.companies AS company ON company.id = event.company_id
WHERE company.slug = 'akkai' AND event.slug = 'akkai-2026'
  AND form.published_version_id IS NULL
ON CONFLICT (form_id, version_number) DO NOTHING;

UPDATE public.registration_forms AS form
SET published_version_id = version.id
FROM public.registration_form_versions AS version
WHERE version.form_id = form.id
  AND version.version_number = 1
  AND form.published_version_id IS NULL;

-- Freeze the exact pre-CMS participant cohort and source values before writing
-- historical submissions. Later corrective migrations use this ledger to
-- classify and recover only these rows; created_at is never used as a cohort
-- cutoff. This is a migration-only snapshot, not an original form payload.
CREATE TABLE public.registration_legacy_participant_backfill (
  participant_id uuid PRIMARY KEY,
  event_id uuid NOT NULL,
  source_created_at timestamptz NOT NULL,
  full_name text,
  email text,
  phone_number text,
  kka_name text,
  position text,
  polo_size text,
  polo_model text,
  package_type text,
  participation_scope text,
  actuarial_consultant_status text,
  attends_pai_congress boolean,
  privacy_consent_at timestamptz,
  CONSTRAINT registration_legacy_participant_backfill_participant_event_fkey
    FOREIGN KEY (participant_id, event_id)
    REFERENCES public.participants(id, event_id) ON DELETE RESTRICT
);

COMMENT ON TABLE public.registration_legacy_participant_backfill IS
  'One-time frozen cohort and participant-column source snapshot captured by the CMS migration for historical reconciliation; not an original form payload.';

REVOKE ALL ON TABLE public.registration_legacy_participant_backfill
  FROM PUBLIC, anon, authenticated, service_role;

INSERT INTO public.registration_legacy_participant_backfill (
  participant_id, event_id, source_created_at, full_name, email, phone_number,
  kka_name, position, polo_size, polo_model, package_type, participation_scope,
  actuarial_consultant_status, attends_pai_congress, privacy_consent_at
)
SELECT participant.id, participant.event_id, participant.created_at,
       participant.full_name, participant.email, participant.phone_number,
       participant.kka_name, participant.position, participant.polo_size,
       participant.polo_model, participant.package_type,
       participant.participation_scope, participant.actuarial_consultant_status,
       participant.attends_pai_congress, participant.privacy_consent_at
FROM public.participants AS participant
JOIN public.events AS event ON event.id = participant.event_id
JOIN public.companies AS company ON company.id = event.company_id
WHERE company.slug = 'akkai' AND event.slug = 'akkai-2026';

-- There is no original answers payload for participants predating the CMS.
-- This initial snapshot is therefore built from the frozen participant values
-- above, with nullable values omitted and consent included only when its
-- persisted timestamp exists. A deterministic key marks these rows as legacy.
INSERT INTO public.registration_form_submissions (
  event_id, form_version_id, participant_id, idempotency_key, answers, submitted_at
)
SELECT legacy.event_id,
       form.published_version_id,
       legacy.participant_id,
       'legacy:' || legacy.participant_id::text,
       jsonb_strip_nulls(jsonb_build_object(
         'full_name', legacy.full_name,
         'email', legacy.email,
         'phone_number', legacy.phone_number,
         'kka_name', legacy.kka_name,
         'position', legacy.position,
         'polo_size', legacy.polo_size,
         'polo_model', legacy.polo_model,
         'package_type', legacy.package_type,
         'participation_scope', legacy.participation_scope,
         'actuarial_consultant_status', legacy.actuarial_consultant_status,
         'attends_pai_congress', CASE
           WHEN legacy.attends_pai_congress IS NULL THEN NULL::jsonb
           ELSE to_jsonb(legacy.attends_pai_congress::text)
         END,
         'privacy_consent', CASE
           WHEN legacy.privacy_consent_at IS NOT NULL THEN to_jsonb(true)
           ELSE NULL::jsonb
         END
       )),
       legacy.source_created_at
FROM public.registration_legacy_participant_backfill AS legacy
JOIN public.registration_forms AS form ON form.event_id = legacy.event_id
ON CONFLICT (event_id, idempotency_key) DO NOTHING;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.registration_legacy_participant_backfill AS legacy
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.registration_form_submissions AS submission
      WHERE submission.participant_id = legacy.participant_id
        AND submission.event_id = legacy.event_id
        AND submission.idempotency_key = 'legacy:' || legacy.participant_id::text
    )
  ) THEN
    RAISE EXCEPTION 'The initial CMS migration did not create a marked submission for every captured historical participant.';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.has_company_membership(p_profile_id uuid, p_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT (auth.role() = 'service_role' OR p_profile_id = auth.uid()) AND (EXISTS (
    SELECT 1 FROM public.profiles AS profile
    WHERE profile.id = p_profile_id AND profile.is_active = true AND profile.role::text = 'SUPER_ADMIN'
  ) OR EXISTS (
    SELECT 1 FROM public.company_memberships AS membership
    WHERE membership.profile_id = p_profile_id AND membership.company_id = p_company_id AND membership.is_active = true
  ));
$$;

REVOKE ALL ON FUNCTION public.has_company_membership(uuid, uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.has_company_membership(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.event_has_published_registration_form(p_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.registration_forms AS form
    WHERE form.event_id = p_event_id AND form.published_version_id IS NOT NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.is_current_published_registration_form_version(
  p_event_id uuid,
  p_version_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.registration_forms AS form
    WHERE form.event_id = p_event_id AND form.published_version_id = p_version_id
  );
$$;

REVOKE ALL ON FUNCTION public.event_has_published_registration_form(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_current_published_registration_form_version(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.event_has_published_registration_form(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_current_published_registration_form_version(uuid, uuid) TO anon, authenticated;

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_form_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_form_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY companies_membership_select ON public.companies
  FOR SELECT TO authenticated USING (public.has_company_membership((SELECT auth.uid()), id));
CREATE POLICY events_membership_select ON public.events
  FOR SELECT TO authenticated USING (public.has_company_membership((SELECT auth.uid()), company_id));
CREATE POLICY events_public_registration_select ON public.events
  FOR SELECT TO anon, authenticated USING (
    registration_open = true
    AND public.event_has_published_registration_form(id)
  );
CREATE POLICY company_memberships_self_select ON public.company_memberships
  FOR SELECT TO authenticated USING (
    profile_id = (SELECT auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles AS profile WHERE profile.id = (SELECT auth.uid()) AND profile.role::text = 'SUPER_ADMIN' AND profile.is_active = true)
  );
CREATE POLICY registration_forms_member_select ON public.registration_forms
  FOR SELECT TO authenticated USING (public.has_event_permission((SELECT auth.uid()), event_id, 'forms.manage'));
CREATE POLICY registration_form_versions_public_published_select ON public.registration_form_versions
  FOR SELECT TO anon, authenticated USING (
    published_at IS NOT NULL
    AND public.is_current_published_registration_form_version(event_id, id)
  );
CREATE POLICY registration_form_versions_member_select ON public.registration_form_versions
  FOR SELECT TO authenticated USING (
    public.has_event_permission((SELECT auth.uid()), event_id, 'forms.manage')
    OR public.has_event_permission((SELECT auth.uid()), event_id, 'participants.view')
  );
CREATE POLICY registration_form_submissions_member_select ON public.registration_form_submissions
  FOR SELECT TO authenticated USING (public.has_event_permission((SELECT auth.uid()), event_id, 'participants.view'));

DO $$
DECLARE
  v_table text;
  v_permission text;
  v_tables text[] := ARRAY[
    'sessions', 'participants', 'scanner_stations', 'attendance', 'scan_events',
    'email_logs', 'participant_travel', 'participant_room_assignments',
    'participant_pickup_assignments', 'registration_batches',
    'member_meeting_participants', 'participant_email_changes',
    'member_meeting_upload_intents', 'registration_submission_idempotency_keys',
    'participant_registration_status_changes', 'registration_certificate_upload_intents',
    'registration_documents', 'registration_billings', 'registration_billing_email_logs',
    'member_meeting_submissions'
  ];
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
    v_permission := CASE v_table
      WHEN 'sessions' THEN 'sessions.view'
      WHEN 'scanner_stations' THEN 'display.view'
      WHEN 'attendance' THEN 'attendance.view'
      WHEN 'scan_events' THEN 'display.view'
      WHEN 'participant_travel' THEN 'participants.view'
      WHEN 'participant_room_assignments' THEN 'rooms.view'
      WHEN 'participant_pickup_assignments' THEN 'pickup.view'
      WHEN 'member_meeting_participants' THEN 'member_meetings.view'
      WHEN 'member_meeting_submissions' THEN 'member_meetings.view'
      ELSE 'participants.view'
    END;
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.has_event_permission((SELECT auth.uid()), event_id, %L))',
      v_table || '_tenant_select', v_table, v_permission
    );
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON TABLE public.%I FROM PUBLIC, anon, authenticated', v_table);
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO authenticated', v_table);
  END LOOP;
END;
$$;

-- Replace the pre-tenancy policy that exposed every session to every signed-in user.
DROP POLICY IF EXISTS sessions_select_authenticated ON public.sessions;
DROP POLICY IF EXISTS sessions_tenant_select ON public.sessions;
CREATE POLICY sessions_tenant_select ON public.sessions
  FOR SELECT TO authenticated
  USING (
    public.has_event_permission((SELECT auth.uid()), event_id, 'sessions.view')
    OR public.has_event_permission((SELECT auth.uid()), event_id, 'display.view')
  );

DROP POLICY IF EXISTS live_display_broadcast_select ON realtime.messages;
CREATE POLICY live_display_broadcast_select
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.messages.extension = 'broadcast'
  AND (
    (
      realtime.topic() ~ '^akkai:dashboard:[0-9a-f-]{36}$'
      AND EXISTS (
        SELECT 1 FROM public.sessions AS session
        WHERE session.id::text = substring(realtime.topic() FROM '^akkai:dashboard:([0-9a-f-]{36})$')
          AND public.has_event_permission((SELECT auth.uid()), session.event_id, 'display.view')
      )
    )
    OR (
      realtime.topic() ~ '^akkai:display:station:[0-9a-f-]{36}$'
      AND EXISTS (
        SELECT 1 FROM public.scanner_stations AS station
        WHERE station.id::text = substring(realtime.topic() FROM '^akkai:display:station:([0-9a-f-]{36})$')
          AND public.has_event_permission((SELECT auth.uid()), station.event_id, 'display.view')
      )
    )
  )
);

GRANT SELECT ON public.companies, public.events, public.company_memberships,
  public.registration_forms, public.registration_form_versions, public.registration_form_submissions
TO authenticated;
GRANT SELECT ON public.registration_form_versions TO anon;
GRANT SELECT ON public.events TO anon;
REVOKE INSERT, UPDATE, DELETE ON public.companies, public.events, public.company_memberships,
  public.registration_forms, public.registration_form_versions, public.registration_form_submissions
FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies, public.events, public.company_memberships,
  public.registration_forms, public.registration_form_versions, public.registration_form_submissions
TO service_role;

CREATE OR REPLACE FUNCTION public.set_event_registration_open(p_event_id uuid, p_open boolean, p_updated_by uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.has_event_permission(p_updated_by, p_event_id, 'forms.manage') THEN
    RAISE EXCEPTION 'Form management permission is required.' USING ERRCODE = '42501';
  END IF;
  IF p_open AND NOT EXISTS (
    SELECT 1 FROM public.registration_forms AS form
    WHERE form.event_id = p_event_id AND form.published_version_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'A published registration form is required before opening registration.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.events SET registration_open = p_open, updated_at = now() WHERE id = p_event_id;
  RETURN FOUND;
END;
$$;

CREATE TRIGGER companies_set_updated_at BEFORE UPDATE ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER events_set_updated_at BEFORE UPDATE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER registration_forms_set_updated_at BEFORE UPDATE ON public.registration_forms
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER company_memberships_set_updated_at BEFORE UPDATE ON public.company_memberships
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

REVOKE ALL ON FUNCTION public.set_event_registration_open(uuid, boolean, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_event_registration_open(uuid, boolean, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.create_company_with_event(
  p_actor_id uuid,
  p_company_slug text,
  p_company_name text,
  p_event_slug text,
  p_event_code text,
  p_event_name text,
  p_starts_on date,
  p_ends_on date
)
RETURNS TABLE (company_id uuid, event_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_id uuid;
  v_event_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles AS profile
    WHERE profile.id = p_actor_id
      AND profile.is_active = true
      AND profile.role::text = 'SUPER_ADMIN'
  ) THEN
    RAISE EXCEPTION 'Global Super Admin access is required.' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.companies (slug, name)
  VALUES (lower(btrim(p_company_slug)), btrim(p_company_name))
  RETURNING id INTO v_company_id;

  INSERT INTO public.events (company_id, slug, event_code, name, starts_on, ends_on)
  VALUES (
    v_company_id,
    lower(btrim(p_event_slug)),
    upper(btrim(p_event_code)),
    btrim(p_event_name),
    p_starts_on,
    p_ends_on
  )
  RETURNING id INTO v_event_id;

  INSERT INTO public.sessions (event_id, code, name, event_date, status)
  VALUES
    (v_event_id, 'ARRIVAL', 'Registrasi Kedatangan', coalesce(p_starts_on, current_date), 'CLOSED'),
    (v_event_id, 'DAY1_MEMBER_MEETING', 'Hari 1 — Pembukaan', coalesce(p_starts_on, current_date), 'CLOSED'),
    (v_event_id, 'SEMINAR', 'Seminar', coalesce(p_starts_on, current_date) + 1, 'CLOSED'),
    (v_event_id, 'DAY2_AKKAI_NIGHT', 'Hari 2 — Acara Malam', coalesce(p_starts_on, current_date) + 1, 'CLOSED'),
    (v_event_id, 'DAY3', 'Registrasi Kepulangan', coalesce(p_starts_on, current_date) + 2, 'CLOSED');

  RETURN QUERY SELECT v_company_id, v_event_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_event_for_company(
  p_actor_id uuid,
  p_company_id uuid,
  p_event_slug text,
  p_event_code text,
  p_event_name text,
  p_starts_on date,
  p_ends_on date
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_event_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles AS profile
    WHERE profile.id = p_actor_id
      AND profile.is_active = true
      AND profile.role::text = 'SUPER_ADMIN'
  ) THEN
    RAISE EXCEPTION 'Global Super Admin access is required.' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.events (company_id, slug, event_code, name, starts_on, ends_on)
  VALUES (
    p_company_id,
    lower(btrim(p_event_slug)),
    upper(btrim(p_event_code)),
    btrim(p_event_name),
    p_starts_on,
    p_ends_on
  )
  RETURNING id INTO v_event_id;

  INSERT INTO public.sessions (event_id, code, name, event_date, status)
  VALUES
    (v_event_id, 'ARRIVAL', 'Registrasi Kedatangan', coalesce(p_starts_on, current_date), 'CLOSED'),
    (v_event_id, 'DAY1_MEMBER_MEETING', 'Hari 1 — Pembukaan', coalesce(p_starts_on, current_date), 'CLOSED'),
    (v_event_id, 'SEMINAR', 'Seminar', coalesce(p_starts_on, current_date) + 1, 'CLOSED'),
    (v_event_id, 'DAY2_AKKAI_NIGHT', 'Hari 2 — Acara Malam', coalesce(p_starts_on, current_date) + 1, 'CLOSED'),
    (v_event_id, 'DAY3', 'Registrasi Kepulangan', coalesce(p_starts_on, current_date) + 2, 'CLOSED');
  RETURN v_event_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_company_membership(
  p_actor_id uuid,
  p_profile_id uuid,
  p_company_id uuid,
  p_role text,
  p_is_active boolean
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_membership_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles AS profile
    WHERE profile.id = p_actor_id
      AND profile.is_active = true
      AND profile.role::text = 'SUPER_ADMIN'
  ) THEN
    RAISE EXCEPTION 'Global Super Admin access is required.' USING ERRCODE = '42501';
  END IF;
  IF p_role NOT IN ('ADMIN', 'OPERATIONAL', 'REGISTRATION', 'OPERATOR', 'SCANNER') THEN
    RAISE EXCEPTION 'Company membership role is invalid.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_profile_id)
     OR NOT EXISTS (SELECT 1 FROM public.companies WHERE id = p_company_id) THEN
    RAISE EXCEPTION 'Membership target was not found.' USING ERRCODE = '23503';
  END IF;

  INSERT INTO public.company_memberships (profile_id, company_id, role, is_active)
  VALUES (p_profile_id, p_company_id, p_role, p_is_active)
  ON CONFLICT (profile_id, company_id) DO UPDATE
    SET role = EXCLUDED.role,
        is_active = EXCLUDED.is_active,
        updated_at = now()
  RETURNING id INTO v_membership_id;
  RETURN v_membership_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_company_with_event(uuid, text, text, text, text, text, date, date)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_event_for_company(uuid, uuid, text, text, text, date, date)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.upsert_company_membership(uuid, uuid, uuid, text, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_company_with_event(uuid, text, text, text, text, text, date, date)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.create_event_for_company(uuid, uuid, text, text, text, date, date)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.upsert_company_membership(uuid, uuid, uuid, text, boolean)
  TO service_role;
