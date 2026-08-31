-- H-3D1 additive participant and operational data model.
-- Existing participant, scan, attendance, and email contracts remain intact.

ALTER TABLE public.participants
  ALTER COLUMN institution DROP NOT NULL;

ALTER TABLE public.participants
  ADD COLUMN kka_name text,
  ADD COLUMN polo_size text,
  ADD COLUMN polo_model text;

ALTER TABLE public.participants
  ADD CONSTRAINT participants_kka_name_valid CHECK (
    kka_name IS NULL
    OR (
      kka_name = btrim(kka_name)
      AND char_length(kka_name) BETWEEN 1 AND 150
    )
  ),
  ADD CONSTRAINT participants_polo_size_valid CHECK (
    polo_size IS NULL
    OR polo_size IN ('S', 'M', 'L', 'XL', 'XXL', 'XXXL')
  ),
  ADD CONSTRAINT participants_polo_model_valid CHECK (
    polo_model IS NULL
    OR polo_model IN ('Lengan Panjang', 'Lengan Pendek')
  );

CREATE INDEX participants_kka_name_idx
ON public.participants (kka_name);

CREATE INDEX participants_polo_size_idx
ON public.participants (polo_size);

CREATE INDEX participants_polo_model_idx
ON public.participants (polo_model);

CREATE INDEX participants_category_idx
ON public.participants (participant_category);

CREATE TABLE public.participant_travel (
  participant_id uuid PRIMARY KEY REFERENCES public.participants(id) ON DELETE RESTRICT,
  outbound_date date NOT NULL,
  outbound_time time NOT NULL,
  outbound_transport_mode text NOT NULL,
  outbound_transport_number text,
  outbound_origin text NOT NULL,
  outbound_destination text NOT NULL,
  return_date date NOT NULL,
  return_time time NOT NULL,
  return_transport_mode text NOT NULL,
  return_transport_number text,
  return_destination text NOT NULL,
  extend_stay boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT participant_travel_dates_valid CHECK (
    return_date >= outbound_date
  ),
  CONSTRAINT participant_travel_outbound_mode_valid CHECK (
    outbound_transport_mode = btrim(outbound_transport_mode)
    AND char_length(outbound_transport_mode) BETWEEN 1 AND 50
  ),
  CONSTRAINT participant_travel_return_mode_valid CHECK (
    return_transport_mode = btrim(return_transport_mode)
    AND char_length(return_transport_mode) BETWEEN 1 AND 50
  ),
  CONSTRAINT participant_travel_outbound_number_valid CHECK (
    outbound_transport_number IS NULL
    OR (
      outbound_transport_number = btrim(outbound_transport_number)
      AND char_length(outbound_transport_number) BETWEEN 1 AND 100
    )
  ),
  CONSTRAINT participant_travel_return_number_valid CHECK (
    return_transport_number IS NULL
    OR (
      return_transport_number = btrim(return_transport_number)
      AND char_length(return_transport_number) BETWEEN 1 AND 100
    )
  ),
  CONSTRAINT participant_travel_outbound_origin_valid CHECK (
    outbound_origin = btrim(outbound_origin)
    AND char_length(outbound_origin) BETWEEN 1 AND 150
  ),
  CONSTRAINT participant_travel_outbound_destination_valid CHECK (
    outbound_destination = btrim(outbound_destination)
    AND char_length(outbound_destination) BETWEEN 1 AND 150
  ),
  CONSTRAINT participant_travel_return_destination_valid CHECK (
    return_destination = btrim(return_destination)
    AND char_length(return_destination) BETWEEN 1 AND 150
  )
);

CREATE INDEX participant_travel_outbound_date_idx
ON public.participant_travel (outbound_date);

CREATE INDEX participant_travel_return_date_idx
ON public.participant_travel (return_date);

CREATE INDEX participant_travel_outbound_mode_idx
ON public.participant_travel (outbound_transport_mode);

CREATE INDEX participant_travel_return_mode_idx
ON public.participant_travel (return_transport_mode);

CREATE INDEX participant_travel_extend_stay_idx
ON public.participant_travel (extend_stay);

CREATE OR REPLACE TRIGGER participant_travel_set_updated_at
BEFORE UPDATE ON public.participant_travel
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.participant_room_assignments (
  participant_id uuid PRIMARY KEY REFERENCES public.participants(id) ON DELETE RESTRICT,
  room_number text,
  room_type text,
  check_in_date date,
  check_out_date date,
  notes text,
  updated_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT participant_room_number_valid CHECK (
    room_number IS NULL
    OR (
      room_number = btrim(room_number)
      AND char_length(room_number) BETWEEN 1 AND 50
    )
  ),
  CONSTRAINT participant_room_type_valid CHECK (
    room_type IS NULL
    OR (
      room_type = btrim(room_type)
      AND char_length(room_type) BETWEEN 1 AND 100
    )
  ),
  CONSTRAINT participant_room_dates_valid CHECK (
    check_in_date IS NULL
    OR check_out_date IS NULL
    OR check_out_date >= check_in_date
  ),
  CONSTRAINT participant_room_notes_valid CHECK (
    notes IS NULL
    OR (
      notes = btrim(notes)
      AND char_length(notes) BETWEEN 1 AND 500
    )
  )
);

CREATE INDEX participant_room_assignments_room_number_idx
ON public.participant_room_assignments (room_number);

CREATE INDEX participant_room_assignments_room_type_idx
ON public.participant_room_assignments (room_type);

CREATE OR REPLACE TRIGGER participant_room_assignments_set_updated_at
BEFORE UPDATE ON public.participant_room_assignments
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.participant_pickup_assignments (
  participant_id uuid PRIMARY KEY REFERENCES public.participants(id) ON DELETE RESTRICT,
  status text NOT NULL,
  pickup_at timestamptz,
  pickup_point text,
  vehicle_label text,
  pic_driver text,
  notes text,
  updated_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT participant_pickup_status_valid CHECK (
    status IN ('SCHEDULED', 'COMPLETED', 'CANCELLED')
  ),
  CONSTRAINT participant_pickup_scheduled_fields_valid CHECK (
    status = 'CANCELLED'
    OR (
      pickup_at IS NOT NULL
      AND pickup_point IS NOT NULL
      AND btrim(pickup_point) <> ''
    )
  ),
  CONSTRAINT participant_pickup_point_valid CHECK (
    pickup_point IS NULL
    OR (
      pickup_point = btrim(pickup_point)
      AND char_length(pickup_point) BETWEEN 1 AND 150
    )
  ),
  CONSTRAINT participant_pickup_vehicle_valid CHECK (
    vehicle_label IS NULL
    OR (
      vehicle_label = btrim(vehicle_label)
      AND char_length(vehicle_label) BETWEEN 1 AND 100
    )
  ),
  CONSTRAINT participant_pickup_pic_driver_valid CHECK (
    pic_driver IS NULL
    OR (
      pic_driver = btrim(pic_driver)
      AND char_length(pic_driver) BETWEEN 1 AND 150
    )
  ),
  CONSTRAINT participant_pickup_notes_valid CHECK (
    notes IS NULL
    OR (
      notes = btrim(notes)
      AND char_length(notes) BETWEEN 1 AND 500
    )
  )
);

CREATE INDEX participant_pickup_assignments_status_idx
ON public.participant_pickup_assignments (status);

CREATE INDEX participant_pickup_assignments_pickup_at_idx
ON public.participant_pickup_assignments (pickup_at);

CREATE OR REPLACE TRIGGER participant_pickup_assignments_set_updated_at
BEFORE UPDATE ON public.participant_pickup_assignments
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.participant_travel ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participant_room_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participant_pickup_assignments ENABLE ROW LEVEL SECURITY;

-- New operational data has no direct anon/authenticated policies. Server-side
-- reads and service-role-only RPCs are added by the next H-3D1 migration.
