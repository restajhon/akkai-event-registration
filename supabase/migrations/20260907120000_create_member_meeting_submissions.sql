-- Standalone public submissions for the AKKAI 2026 member meeting.
-- This data is intentionally separate from participants and event operations.

CREATE TABLE public.member_meeting_submissions (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  name text NOT NULL,
  consulting_firm text NOT NULL,
  position text NOT NULL,
  phone text NOT NULL,
  email text NOT NULL,
  attendance_type text NOT NULL,
  proxy_name text,
  proxy_position text,
  authorization_file_path text,
  authorization_file_name text,
  authorization_file_mime text,
  authorization_file_size bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT member_meeting_name_valid CHECK (
    name = btrim(name)
    AND char_length(name) BETWEEN 3 AND 100
  ),
  CONSTRAINT member_meeting_consulting_firm_valid CHECK (
    consulting_firm = btrim(consulting_firm)
    AND char_length(consulting_firm) BETWEEN 1 AND 150
  ),
  CONSTRAINT member_meeting_position_valid CHECK (
    position = btrim(position)
    AND char_length(position) BETWEEN 1 AND 100
  ),
  CONSTRAINT member_meeting_phone_valid CHECK (
    phone = btrim(phone)
    AND char_length(phone) BETWEEN 8 AND 25
  ),
  CONSTRAINT member_meeting_email_valid CHECK (
    email = btrim(email)
    AND email = lower(email)
    AND char_length(email) BETWEEN 3 AND 254
  ),
  CONSTRAINT member_meeting_attendance_type_valid CHECK (
    attendance_type IN ('SELF', 'PROXY')
  ),
  CONSTRAINT member_meeting_proxy_fields_valid CHECK (
    (
      attendance_type = 'SELF'
      AND proxy_name IS NULL
      AND proxy_position IS NULL
    )
    OR (
      attendance_type = 'PROXY'
      AND proxy_name IS NOT NULL
      AND proxy_position IS NOT NULL
      AND proxy_name = btrim(proxy_name)
      AND proxy_position = btrim(proxy_position)
      AND char_length(proxy_name) BETWEEN 1 AND 100
      AND char_length(proxy_position) BETWEEN 1 AND 100
    )
  ),
  CONSTRAINT member_meeting_file_metadata_valid CHECK (
    (
      attendance_type = 'SELF'
      AND authorization_file_path IS NULL
      AND authorization_file_name IS NULL
      AND authorization_file_mime IS NULL
      AND authorization_file_size IS NULL
    )
    OR (
      attendance_type = 'PROXY'
      AND authorization_file_path IS NOT NULL
      AND authorization_file_name IS NOT NULL
      AND authorization_file_mime IS NOT NULL
      AND authorization_file_size IS NOT NULL
      AND authorization_file_path ~ '^submissions/[0-9a-f-]{36}\.(doc|docx|pdf|png|jpg|jpeg)$'
      AND char_length(authorization_file_name) BETWEEN 1 AND 255
      AND authorization_file_mime IN (
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/pdf',
        'image/png',
        'image/jpeg'
      )
       AND authorization_file_size BETWEEN 1 AND 2097152
    )
  )
);

CREATE INDEX member_meeting_submissions_created_at_idx
ON public.member_meeting_submissions (created_at DESC);

CREATE INDEX member_meeting_submissions_attendance_type_idx
ON public.member_meeting_submissions (attendance_type);

CREATE OR REPLACE TRIGGER member_meeting_submissions_set_updated_at
BEFORE UPDATE ON public.member_meeting_submissions
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.member_meeting_submissions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.member_meeting_submissions
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT ON TABLE public.member_meeting_submissions TO service_role;

-- The bucket is private. Storage access is performed only by the server-side
-- service client, and no browser role receives storage object policies.
INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'member-meeting-authorizations',
  'member-meeting-authorizations',
  false,
   2097152,
  ARRAY[
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/pdf',
    'image/png',
    'image/jpeg'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE
SET public = false,
     file_size_limit = 2097152,
    allowed_mime_types = EXCLUDED.allowed_mime_types;
