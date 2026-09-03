-- Existing generic pickup rows are preserved as ARRIVAL assignments. The
-- original model had no transfer distinction, and arrival is the least
-- surprising interpretation for rows created before this migration.
ALTER TABLE public.participant_pickup_assignments
  ADD COLUMN transfer_type text NOT NULL DEFAULT 'ARRIVAL',
  ADD COLUMN dropoff_point text;

ALTER TABLE public.participant_pickup_assignments
  DROP CONSTRAINT participant_pickup_assignments_pkey;

ALTER TABLE public.participant_pickup_assignments
  ADD CONSTRAINT participant_pickup_assignments_pkey
  PRIMARY KEY (participant_id, transfer_type);

ALTER TABLE public.participant_pickup_assignments
  ADD CONSTRAINT participant_pickup_transfer_type_valid CHECK (
    transfer_type IN ('ARRIVAL', 'DEPARTURE')
  ),
  ADD CONSTRAINT participant_pickup_dropoff_point_valid CHECK (
    dropoff_point IS NULL
    OR (
      dropoff_point = btrim(dropoff_point)
      AND char_length(dropoff_point) BETWEEN 1 AND 150
    )
  );

ALTER TABLE public.participant_pickup_assignments
  DROP CONSTRAINT participant_pickup_scheduled_fields_valid;

ALTER TABLE public.participant_pickup_assignments
  ADD CONSTRAINT participant_pickup_scheduled_fields_valid CHECK (
    status = 'CANCELLED'
    OR (
      pickup_at IS NOT NULL
      AND pickup_point IS NOT NULL
      AND btrim(pickup_point) <> ''
      AND (
        transfer_type <> 'DEPARTURE'
        OR (
          dropoff_point IS NOT NULL
          AND btrim(dropoff_point) <> ''
        )
      )
    )
  );

CREATE INDEX participant_pickup_assignments_transfer_type_idx
ON public.participant_pickup_assignments (transfer_type);

CREATE INDEX participant_pickup_assignments_transfer_status_idx
ON public.participant_pickup_assignments (transfer_type, status);

DROP FUNCTION public.upsert_participant_pickup_assignment(
  text,
  text,
  timestamptz,
  text,
  text,
  text,
  text,
  uuid
);

CREATE FUNCTION public.upsert_participant_pickup_assignment(
  p_registration_id text,
  p_transfer_type text,
  p_status text,
  p_pickup_at timestamptz,
  p_pickup_point text,
  p_dropoff_point text,
  p_vehicle_label text,
  p_pic_driver text,
  p_notes text,
  p_updated_by uuid
)
RETURNS TABLE (result_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_registration_id text;
  v_transfer_type text;
  v_status text;
  v_pickup_point text;
  v_dropoff_point text;
  v_vehicle_label text;
  v_pic_driver text;
  v_notes text;
  v_participant public.participants%ROWTYPE;
  v_actor public.profiles%ROWTYPE;
BEGIN
  v_registration_id := upper(btrim(COALESCE(p_registration_id, '')));
  v_transfer_type := upper(btrim(COALESCE(p_transfer_type, '')));
  v_status := upper(btrim(COALESCE(p_status, '')));
  v_pickup_point := NULLIF(btrim(COALESCE(p_pickup_point, '')), '');
  v_dropoff_point := NULLIF(btrim(COALESCE(p_dropoff_point, '')), '');
  v_vehicle_label := NULLIF(btrim(COALESCE(p_vehicle_label, '')), '');
  v_pic_driver := NULLIF(btrim(COALESCE(p_pic_driver, '')), '');
  v_notes := NULLIF(btrim(COALESCE(p_notes, '')), '');

  SELECT profile.*
  INTO v_actor
  FROM public.profiles AS profile
  WHERE profile.id = p_updated_by
  FOR UPDATE;

  IF NOT FOUND OR v_actor.is_active IS DISTINCT FROM true
     OR v_actor.role <> 'ADMIN'::public.user_role THEN
    RETURN QUERY SELECT 'UNAUTHORIZED'::text;
    RETURN;
  END IF;

  SELECT participant.*
  INTO v_participant
  FROM public.participants AS participant
  WHERE participant.registration_id = v_registration_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'NOT_FOUND'::text;
    RETURN;
  END IF;

  IF v_participant.registration_status <> 'REGISTERED'::public.registration_status THEN
    RETURN QUERY SELECT 'PARTICIPANT_NOT_ACTIVE'::text;
    RETURN;
  END IF;

  IF v_transfer_type NOT IN ('ARRIVAL', 'DEPARTURE')
     OR v_status NOT IN ('SCHEDULED', 'COMPLETED', 'CANCELLED')
     OR (
       v_status IN ('SCHEDULED', 'COMPLETED')
       AND (
         p_pickup_at IS NULL
         OR v_pickup_point IS NULL
         OR (
           v_transfer_type = 'DEPARTURE'
           AND v_dropoff_point IS NULL
         )
       )
     )
     OR (
       v_pickup_point IS NOT NULL
       AND char_length(v_pickup_point) NOT BETWEEN 1 AND 150
     )
     OR (
       v_dropoff_point IS NOT NULL
       AND char_length(v_dropoff_point) NOT BETWEEN 1 AND 150
     )
     OR (
       v_vehicle_label IS NOT NULL
       AND char_length(v_vehicle_label) NOT BETWEEN 1 AND 100
     )
     OR (
       v_pic_driver IS NOT NULL
       AND char_length(v_pic_driver) NOT BETWEEN 1 AND 150
     )
     OR (
       v_notes IS NOT NULL
       AND char_length(v_notes) NOT BETWEEN 1 AND 500
     ) THEN
    RETURN QUERY SELECT 'INVALID_INPUT'::text;
    RETURN;
  END IF;

  IF v_status = 'CANCELLED' THEN
    p_pickup_at := NULL;
    v_pickup_point := NULL;
    v_dropoff_point := NULL;
    v_vehicle_label := NULL;
    v_pic_driver := NULL;
    v_notes := NULL;
  END IF;

  INSERT INTO public.participant_pickup_assignments (
    participant_id,
    transfer_type,
    status,
    pickup_at,
    pickup_point,
    dropoff_point,
    vehicle_label,
    pic_driver,
    notes,
    updated_by
  )
  VALUES (
    v_participant.id,
    v_transfer_type,
    v_status,
    p_pickup_at,
    v_pickup_point,
    v_dropoff_point,
    v_vehicle_label,
    v_pic_driver,
    v_notes,
    v_actor.id
  )
  ON CONFLICT (participant_id, transfer_type) DO UPDATE
  SET status = EXCLUDED.status,
      pickup_at = EXCLUDED.pickup_at,
      pickup_point = EXCLUDED.pickup_point,
      dropoff_point = EXCLUDED.dropoff_point,
      vehicle_label = EXCLUDED.vehicle_label,
      pic_driver = EXCLUDED.pic_driver,
      notes = EXCLUDED.notes,
      updated_by = EXCLUDED.updated_by,
      updated_at = now();

  RETURN QUERY SELECT 'SAVED'::text;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.upsert_participant_pickup_assignment(
  text,
  text,
  text,
  timestamptz,
  text,
  text,
  text,
  text,
  text,
  uuid
)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.upsert_participant_pickup_assignment(
  text,
  text,
  text,
  timestamptz,
  text,
  text,
  text,
  text,
  text,
  uuid
)
TO service_role;
