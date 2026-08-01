-- Initial AKKAI 2026 database schema.
-- All operational writes are expected to go through a privileged server client.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE public.user_role AS ENUM (
  'ADMIN',
  'OPERATOR'
);

CREATE TYPE public.registration_status AS ENUM (
  'REGISTERED',
  'CANCELLED'
);

CREATE TYPE public.email_status AS ENUM (
  'PENDING',
  'SENT',
  'FAILED'
);

CREATE TYPE public.session_status AS ENUM (
  'OPEN',
  'CLOSED'
);

CREATE TYPE public.check_in_method AS ENUM (
  'QR',
  'MANUAL'
);

CREATE TYPE public.station_status AS ENUM (
  'WAITING_PAIRING',
  'PAIRED',
  'ACTIVE',
  'DISCONNECTED',
  'CLOSED'
);

CREATE TYPE public.scan_result_status AS ENUM (
  'SUCCESS',
  'SUCCESS_WITH_WARNING',
  'ALREADY_CHECKED_IN',
  'INVALID_QR',
  'CANCELLED_PARTICIPANT',
  'SESSION_CLOSED',
  'STATION_INACTIVE',
  'ERROR'
);

CREATE TYPE public.email_type AS ENUM (
  'REGISTRATION',
  'RESEND'
);

CREATE SEQUENCE public.registration_id_seq
  AS bigint
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 999999
  NO CYCLE;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_registration_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  next_number bigint;
BEGIN
  BEGIN
    next_number := nextval('public.registration_id_seq');
  EXCEPTION
    WHEN SQLSTATE '2200H' THEN
      RAISE EXCEPTION USING
        ERRCODE = '2200H',
        MESSAGE = 'Registration ID limit reached at AKKAI26-999999.';
  END;

  NEW.registration_id := 'AKKAI26-' || lpad(next_number::text, 6, '0');
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_registration_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_registration_id() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_registration_id() TO service_role;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
  full_name text NOT NULL,
  email text NOT NULL,
  role public.user_role NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_full_name_not_blank CHECK (btrim(full_name) <> ''),
  CONSTRAINT profiles_email_not_blank CHECK (btrim(email) <> '')
);

CREATE TABLE public.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  event_date date NOT NULL,
  status public.session_status NOT NULL DEFAULT 'CLOSED',
  opened_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sessions_code_valid CHECK (
    btrim(code) <> ''
    AND code = upper(code)
  ),
  CONSTRAINT sessions_name_not_blank CHECK (btrim(name) <> '')
);

CREATE TABLE public.participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id text NOT NULL UNIQUE,
  full_name text NOT NULL,
  member_number text NOT NULL,
  email text NOT NULL,
  phone_number text NOT NULL,
  institution text NOT NULL,
  participant_category text NOT NULL,
  registration_status public.registration_status NOT NULL DEFAULT 'REGISTERED',
  email_status public.email_status NOT NULL DEFAULT 'PENDING',
  qr_token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  last_email_sent_at timestamptz,
  privacy_consent_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT participants_registration_id_format CHECK (
    registration_id ~ '^AKKAI26-[0-9]{6}$'
  ),
  CONSTRAINT participants_full_name_length CHECK (
    char_length(btrim(full_name)) BETWEEN 3 AND 100
  ),
  CONSTRAINT participants_member_number_length CHECK (
    char_length(btrim(member_number)) BETWEEN 3 AND 50
  ),
  CONSTRAINT participants_member_number_normalized CHECK (
    member_number = upper(member_number)
  ),
  CONSTRAINT participants_email_normalized CHECK (
    email = lower(email)
  ),
  CONSTRAINT participants_email_not_blank CHECK (btrim(email) <> ''),
  CONSTRAINT participants_phone_number_not_blank CHECK (btrim(phone_number) <> ''),
  CONSTRAINT participants_institution_length CHECK (
    char_length(btrim(institution)) BETWEEN 2 AND 150
  ),
  CONSTRAINT participants_category_valid CHECK (
    char_length(btrim(participant_category)) BETWEEN 1 AND 100
  ),
  CONSTRAINT participants_qr_token_format CHECK (
    qr_token ~ '^[0-9a-f]{64}$'
  )
);

CREATE OR REPLACE TRIGGER participants_set_registration_id
BEFORE INSERT ON public.participants
FOR EACH ROW
EXECUTE FUNCTION public.set_registration_id();

CREATE TABLE public.scanner_stations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_name text NOT NULL,
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE RESTRICT,
  status public.station_status NOT NULL DEFAULT 'WAITING_PAIRING',
  pairing_code_hash text NOT NULL,
  pairing_token_hash text NOT NULL,
  pairing_expires_at timestamptz NOT NULL,
  paired_operator_id uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  paired_at timestamptz,
  last_activity_at timestamptz,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  CONSTRAINT scanner_stations_name_length CHECK (
    char_length(btrim(station_name)) BETWEEN 3 AND 100
  ),
  CONSTRAINT scanner_stations_pairing_code_hash_not_blank CHECK (
    btrim(pairing_code_hash) <> ''
  ),
  CONSTRAINT scanner_stations_pairing_token_hash_not_blank CHECK (
    btrim(pairing_token_hash) <> ''
  )
);

CREATE TABLE public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE RESTRICT,
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE RESTRICT,
  check_in_time timestamptz NOT NULL DEFAULT now(),
  check_in_method public.check_in_method NOT NULL,
  operator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  station_id uuid REFERENCES public.scanner_stations(id) ON DELETE RESTRICT,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attendance_participant_session_unique UNIQUE (participant_id, session_id),
  CONSTRAINT attendance_notes_length CHECK (notes IS NULL OR char_length(notes) <= 250)
);

CREATE TABLE public.scan_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES public.scanner_stations(id) ON DELETE RESTRICT,
  participant_id uuid REFERENCES public.participants(id) ON DELETE RESTRICT,
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE RESTRICT,
  attendance_id uuid REFERENCES public.attendance(id) ON DELETE RESTRICT,
  result_status public.scan_result_status NOT NULL,
  result_message text NOT NULL,
  operator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  scanned_at timestamptz NOT NULL DEFAULT now(),
  displayed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE public.email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE RESTRICT,
  email_type public.email_type NOT NULL,
  recipient_email text NOT NULL,
  provider_message_id text,
  status public.email_status NOT NULL,
  error_message text,
  sent_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

CREATE OR REPLACE TRIGGER profiles_set_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER sessions_set_updated_at
BEFORE UPDATE ON public.sessions
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER participants_set_updated_at
BEFORE UPDATE ON public.participants
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE UNIQUE INDEX participants_email_lower_unique
ON public.participants (lower(email));

CREATE UNIQUE INDEX participants_member_number_upper_unique
ON public.participants (upper(member_number));

CREATE INDEX participants_status_created_at_idx
ON public.participants (registration_status, created_at DESC);

CREATE INDEX participants_full_name_lower_idx
ON public.participants (lower(full_name));

CREATE INDEX sessions_status_event_date_idx
ON public.sessions (status, event_date);

CREATE INDEX scanner_stations_session_status_idx
ON public.scanner_stations (session_id, status);

CREATE INDEX scanner_stations_paired_operator_idx
ON public.scanner_stations (paired_operator_id);

CREATE INDEX attendance_session_check_in_time_idx
ON public.attendance (session_id, check_in_time DESC);

CREATE INDEX attendance_operator_check_in_time_idx
ON public.attendance (operator_id, check_in_time DESC);

CREATE INDEX scan_events_station_scanned_at_idx
ON public.scan_events (station_id, scanned_at DESC);

CREATE INDEX scan_events_session_scanned_at_idx
ON public.scan_events (session_id, scanned_at DESC);

CREATE INDEX email_logs_participant_created_at_idx
ON public.email_logs (participant_id, created_at DESC);

CREATE INDEX email_logs_status_created_at_idx
ON public.email_logs (status, created_at DESC);

-- Seed the fixed MVP sessions without changing existing session records.
INSERT INTO public.sessions (code, name, event_date, status)
VALUES
  ('ARRIVAL', 'Registrasi Kedatangan', DATE '2026-10-19', 'CLOSED'),
  ('SEMINAR', 'Seminar AKKAI 2026', DATE '2026-10-20', 'CLOSED')
ON CONFLICT (code) DO NOTHING;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scanner_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Only active authenticated users may read their own profile.
CREATE POLICY profiles_select_self
ON public.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid() AND is_active = true);

-- Session metadata is safe for authenticated operational clients to read.
CREATE POLICY sessions_select_authenticated
ON public.sessions
FOR SELECT
TO authenticated
USING (true);

-- No anon policy and no direct client policies are created for operational data.
-- Server routes use the privileged server client and must enforce authorization.
