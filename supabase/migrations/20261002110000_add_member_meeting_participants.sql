-- Keep Rapat Anggota participation separate from a participant's global registration.
CREATE TABLE public.member_meeting_participants (
  participant_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE RESTRICT,
  meeting_code text NOT NULL DEFAULT 'RAPAT_ANGGOTA_AKKAI_2026',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT member_meeting_participants_unique UNIQUE (participant_id, meeting_code)
);

CREATE INDEX member_meeting_participants_meeting_code_idx
  ON public.member_meeting_participants (meeting_code, participant_id);

ALTER TABLE public.member_meeting_participants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.member_meeting_participants FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.member_meeting_participants TO service_role;

-- Initial registration scope creates the meeting relation in the same database
-- transaction as participant creation. Later scope edits are explicit: changing
-- into a meeting scope joins; changing out removes that meeting relation. Other
-- participant edits and global registration-status changes do not touch it.
CREATE OR REPLACE FUNCTION public.sync_member_meeting_participation_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.participation_scope IS NOT DISTINCT FROM OLD.participation_scope THEN
    RETURN NEW;
  END IF;

  IF NEW.participation_scope IN ('Seluruh acara', 'Rapat Anggota AKKAI 2026') THEN
    INSERT INTO public.member_meeting_participants (participant_id)
    VALUES (NEW.id)
    ON CONFLICT (participant_id, meeting_code) DO NOTHING;
  ELSIF TG_OP = 'UPDATE' THEN
    DELETE FROM public.member_meeting_participants AS membership
    WHERE membership.participant_id = NEW.id
      AND membership.meeting_code = 'RAPAT_ANGGOTA_AKKAI_2026';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_member_meeting_participation_scope() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER participants_sync_member_meeting_participation_scope
AFTER INSERT OR UPDATE OF participation_scope ON public.participants
FOR EACH ROW
EXECUTE FUNCTION public.sync_member_meeting_participation_scope();

-- Backfill the current scope for participants that predate the relation table.
INSERT INTO public.member_meeting_participants (participant_id)
SELECT participant.id
FROM public.participants AS participant
WHERE participant.participation_scope IN (
  'Seluruh acara',
  'Rapat Anggota AKKAI 2026'
)
ON CONFLICT (participant_id, meeting_code) DO NOTHING;
