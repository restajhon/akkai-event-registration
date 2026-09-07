-- One-time upload intents keep authorization files out of Vercel Server Action
-- request bodies. The browser receives only a short-lived Storage token.

CREATE TABLE public.member_meeting_upload_intents (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  email text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  file_name text NOT NULL,
  file_mime text NOT NULL,
  file_size bigint NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '2 hours'),
  consumed_at timestamptz,
  CONSTRAINT member_meeting_upload_intent_email_valid CHECK (
    email = btrim(email)
    AND email = lower(email)
    AND char_length(email) BETWEEN 3 AND 254
  ),
  CONSTRAINT member_meeting_upload_intent_path_valid CHECK (
    storage_path ~ '^submissions/[0-9a-f-]{36}\.(doc|docx|pdf|png|jpg|jpeg)$'
  ),
  CONSTRAINT member_meeting_upload_intent_file_name_valid CHECK (
    char_length(file_name) BETWEEN 1 AND 255
  ),
  CONSTRAINT member_meeting_upload_intent_mime_valid CHECK (
    file_mime IN (
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/pdf',
      'image/png',
      'image/jpeg'
    )
  ),
  CONSTRAINT member_meeting_upload_intent_size_valid CHECK (
     file_size BETWEEN 1 AND 2097152
  ),
  CONSTRAINT member_meeting_upload_intent_status_valid CHECK (
    status IN ('PENDING', 'CONSUMED')
  ),
  CONSTRAINT member_meeting_upload_intent_consumed_at_valid CHECK (
    (status = 'PENDING' AND consumed_at IS NULL)
    OR (status = 'CONSUMED' AND consumed_at IS NOT NULL)
  )
);

CREATE INDEX member_meeting_upload_intents_expiry_idx
ON public.member_meeting_upload_intents (expires_at)
WHERE status = 'PENDING';

ALTER TABLE public.member_meeting_upload_intents ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.member_meeting_upload_intents
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.member_meeting_upload_intents
TO service_role;
