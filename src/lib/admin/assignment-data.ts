import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

import type {
  ParticipantRegistrationStatus,
  ParticipantTravel,
  PickupAssignment,
  PickupParticipant,
  RoomParticipant,
} from "./assignment-types";

type ParticipantRow = {
  id: string;
  registration_id: string;
  full_name: string;
  package_type: string | null;
  participant_category: string | null;
  registration_status: ParticipantRegistrationStatus;
};

type RoomAssignmentRow = {
  participant_id: string;
  room_number: string | null;
  room_type: string | null;
  check_in_date: string | null;
  check_out_date: string | null;
  notes: string | null;
  updated_at: string;
};

type PickupAssignmentRow = {
  participant_id: string;
  transfer_type: PickupAssignment["transferType"];
  status: PickupAssignment["status"];
  pickup_at: string | null;
  pickup_point: string | null;
  dropoff_point: string | null;
  vehicle_label: string | null;
  pic_driver: string | null;
  notes: string | null;
  updated_at: string;
};

type TravelRow = {
  participant_id: string;
  outbound_date: string;
  outbound_time: string;
  outbound_transport_mode: string;
  outbound_transport_number: string | null;
  outbound_origin: string;
  outbound_destination: string;
  return_date: string;
  return_time: string;
  return_transport_mode: string;
  return_transport_number: string | null;
  return_destination: string;
};

const participantSelect =
  "id, registration_id, full_name, package_type, participant_category, registration_status";

async function loadParticipants(registrationId?: string) {
  const supabase = createAdminClient();
  let query = supabase
    .from("participants")
    .select(participantSelect)
    .order("created_at", { ascending: false });

  if (registrationId) {
    query = query.eq("registration_id", registrationId);
  }

  const { data, error } = await query;

  if (error) {
    return null;
  }

  return (data ?? []) as ParticipantRow[];
}

function toRoomParticipant(
  participant: ParticipantRow,
  assignment?: RoomAssignmentRow,
): RoomParticipant {
  return {
    registrationId: participant.registration_id,
    fullName: participant.full_name,
    packageType: participant.package_type,
    participantCategory: participant.participant_category,
    registrationStatus: participant.registration_status,
    assignment: assignment
      ? {
          roomNumber: assignment.room_number,
          roomType: assignment.room_type,
          checkInDate: assignment.check_in_date,
          checkOutDate: assignment.check_out_date,
          notes: assignment.notes,
          updatedAt: assignment.updated_at,
        }
      : null,
  };
}

async function loadRoomAssignments(participantIds: string[]) {
  const assignments = new Map<string, RoomAssignmentRow>();

  if (participantIds.length === 0) {
    return assignments;
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("participant_room_assignments")
    .select(
      "participant_id, room_number, room_type, check_in_date, check_out_date, notes, updated_at",
    )
    .in("participant_id", participantIds);

  if (error) {
    return null;
  }

  for (const assignment of (data ?? []) as RoomAssignmentRow[]) {
    assignments.set(assignment.participant_id, assignment);
  }

  return assignments;
}

export async function loadRoomAssignmentPage(): Promise<RoomParticipant[] | null> {
  try {
    const participants = await loadParticipants();

    if (!participants) {
      return null;
    }

    const assignments = await loadRoomAssignments(
      participants.map((participant) => participant.id),
    );

    if (!assignments) {
      return null;
    }

    return participants.map((participant) =>
      toRoomParticipant(participant, assignments.get(participant.id)),
    );
  } catch {
    return null;
  }
}

export async function loadRoomAssignmentDetail(
  registrationId: string,
): Promise<RoomParticipant | null> {
  try {
    const participants = await loadParticipants(registrationId);

    if (!participants || participants.length !== 1) {
      return null;
    }

    const participant = participants[0];
    const assignments = await loadRoomAssignments([participant.id]);

    if (!assignments) {
      return null;
    }

    return toRoomParticipant(participant, assignments.get(participant.id));
  } catch {
    return null;
  }
}

function toPickupAssignment(row: PickupAssignmentRow): PickupAssignment {
  return {
    transferType: row.transfer_type,
    status: row.status,
    pickupAt: row.pickup_at,
    pickupPoint: row.pickup_point,
    dropoffPoint: row.dropoff_point,
    vehicleLabel: row.vehicle_label,
    picDriver: row.pic_driver,
    notes: row.notes,
    updatedAt: row.updated_at,
  };
}

function toParticipantTravel(row: TravelRow): ParticipantTravel {
  return {
    outboundDate: row.outbound_date,
    outboundTime: row.outbound_time,
    outboundTransportMode: row.outbound_transport_mode,
    outboundTransportNumber: row.outbound_transport_number,
    outboundOrigin: row.outbound_origin,
    outboundDestination: row.outbound_destination,
    returnDate: row.return_date,
    returnTime: row.return_time,
    returnTransportMode: row.return_transport_mode,
    returnTransportNumber: row.return_transport_number,
    returnDestination: row.return_destination,
  };
}

async function loadPickupData(participantIds: string[]) {
  const supabase = createAdminClient();
  const assignments = new Map<string, PickupAssignmentRow[]>();
  const travel = new Map<string, TravelRow>();

  if (participantIds.length === 0) {
    return { assignments, travel };
  }

  const [assignmentsResult, travelResult] = await Promise.all([
    supabase
      .from("participant_pickup_assignments")
      .select(
        "participant_id, transfer_type, status, pickup_at, pickup_point, dropoff_point, vehicle_label, pic_driver, notes, updated_at",
      )
      .in("participant_id", participantIds),
    supabase
      .from("participant_travel")
      .select(
        "participant_id, outbound_date, outbound_time, outbound_transport_mode, outbound_transport_number, outbound_origin, outbound_destination, return_date, return_time, return_transport_mode, return_transport_number, return_destination",
      )
      .in("participant_id", participantIds),
  ]);

  if (assignmentsResult.error || travelResult.error) {
    return null;
  }

  for (const assignment of (assignmentsResult.data ?? []) as PickupAssignmentRow[]) {
    const current = assignments.get(assignment.participant_id) ?? [];
    current.push(assignment);
    assignments.set(assignment.participant_id, current);
  }

  for (const row of (travelResult.data ?? []) as TravelRow[]) {
    travel.set(row.participant_id, row);
  }

  return { assignments, travel };
}

function toPickupParticipant(
  participant: ParticipantRow,
  pickupData: Awaited<ReturnType<typeof loadPickupData>>,
): PickupParticipant {
  const rows = pickupData?.assignments.get(participant.id) ?? [];
  const arrival = rows.find((row) => row.transfer_type === "ARRIVAL");
  const departure = rows.find((row) => row.transfer_type === "DEPARTURE");
  const travel = pickupData?.travel.get(participant.id);

  return {
    registrationId: participant.registration_id,
    fullName: participant.full_name,
    participantCategory: participant.participant_category,
    registrationStatus: participant.registration_status,
    travel: travel ? toParticipantTravel(travel) : null,
    arrivalAssignment: arrival ? toPickupAssignment(arrival) : null,
    departureAssignment: departure ? toPickupAssignment(departure) : null,
  };
}

export async function loadPickupAssignmentPage(): Promise<PickupParticipant[] | null> {
  try {
    const participants = await loadParticipants();

    if (!participants) {
      return null;
    }

    const pickupData = await loadPickupData(
      participants.map((participant) => participant.id),
    );

    if (!pickupData) {
      return null;
    }

    return participants.map((participant) => toPickupParticipant(participant, pickupData));
  } catch {
    return null;
  }
}

export async function loadPickupAssignmentDetail(
  registrationId: string,
): Promise<PickupParticipant | null> {
  try {
    const participants = await loadParticipants(registrationId);

    if (!participants || participants.length !== 1) {
      return null;
    }

    const pickupData = await loadPickupData([participants[0].id]);

    if (!pickupData) {
      return null;
    }

    return toPickupParticipant(participants[0], pickupData);
  } catch {
    return null;
  }
}
