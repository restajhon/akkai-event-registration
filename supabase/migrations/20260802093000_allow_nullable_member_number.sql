-- Allow nonmember participants to omit member_number without changing
-- uniqueness, registration, QR, consent, RLS, or other participant behavior.

-- Abort before changing the schema if existing values do not satisfy the
-- normalized member-number rules. No participant data is modified here.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.participants
    WHERE member_number IS NOT NULL
      AND (
        btrim(member_number) = ''
        OR char_length(btrim(member_number)) NOT BETWEEN 3 AND 50
        OR member_number <> upper(member_number)
      )
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Migration aborted: incompatible participants.member_number data exists.';
  END IF;
END
$$;

ALTER TABLE public.participants
  ALTER COLUMN member_number DROP NOT NULL;

ALTER TABLE public.participants
  DROP CONSTRAINT participants_member_number_length,
  DROP CONSTRAINT participants_member_number_normalized;

ALTER TABLE public.participants
  ADD CONSTRAINT participants_member_number_length CHECK (
    member_number IS NULL
    OR char_length(btrim(member_number)) BETWEEN 3 AND 50
  ),
  ADD CONSTRAINT participants_member_number_normalized CHECK (
    member_number IS NULL
    OR member_number = upper(member_number)
  );
