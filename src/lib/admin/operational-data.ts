import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  ATTENDANCE_SESSIONS,
  ATTENDANCE_SESSION_CODES,
  ATTENDANCE_SESSION_KEY_BY_CODE,
  type AttendanceSessionCode,
  type AttendanceSessionKey,
} from "@/lib/admin/attendance-sessions";

export type OperationalSessionCode = AttendanceSessionCode;

export type OperationalAttendance = {
  checkedIn: boolean;
  checkedInAt: string | null;
};

export type OperationalRoomAssignment = {
  roomNumber: string | null;
  notes: string | null;
  checkInDate: string | null;
  checkOutDate: string | null;
};

export type OperationalPickupAssignment = {
  transferType: "ARRIVAL" | "DEPARTURE";
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED";
  pickupAt: string | null;
  pickupPoint: string | null;
  dropoffPoint: string | null;
  vehicleLabel: string | null;
  notes: string | null;
};

export type OperationalTravel = {
  outboundDate: string;
  outboundTime: string;
  outboundTransportMode: string;
  outboundTransportNumber: string | null;
  outboundOrigin: string;
  outboundDestination: string;
  returnDate: string;
  returnTime: string;
  returnTransportMode: string;
  returnTransportNumber: string | null;
  returnDestination: string;
};

export type OperationalParticipant = {
  id: string;
  registrationId: string;
  fullName: string;
  packageType: "Twin Share" | "Single" | string | null;
  registrationStatus: "REGISTERED" | "CANCELLED";
  roomAssignment: OperationalRoomAssignment | null;
  travel: OperationalTravel | null;
  arrivalAssignment: OperationalPickupAssignment | null;
  departureAssignment: OperationalPickupAssignment | null;
} & Record<AttendanceSessionKey, OperationalAttendance>;

type ParticipantRow = Pick<OperationalParticipant, "id" | "registrationId" | "fullName" | "packageType" | "registrationStatus">;

type RoomRow = {
  participant_id: string;
  room_number: string | null;
  notes: string | null;
  check_in_date: string | null;
  check_out_date: string | null;
};

type PickupRow = {
  participant_id: string;
  transfer_type: OperationalPickupAssignment["transferType"];
  status: OperationalPickupAssignment["status"];
  pickup_at: string | null;
  pickup_point: string | null;
  dropoff_point: string | null;
  vehicle_label: string | null;
  notes: string | null;
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

type SessionRow = {
  id: string;
  code: OperationalSessionCode;
};

type AttendanceRow = {
  participant_id: string;
  session_id: string;
  check_in_time: string;
};

const participantSelect =
  "id, registration_id, full_name, package_type, registration_status";
const sessionCodes: OperationalSessionCode[] = ATTENDANCE_SESSION_CODES;

function emptyAttendance(): OperationalAttendance {
  return { checkedIn: false, checkedInAt: null };
}

function emptyAttendanceBySession(): Record<AttendanceSessionKey, OperationalAttendance> {
  return Object.fromEntries(
    ATTENDANCE_SESSIONS.map(({ key }) => [key, emptyAttendance()]),
  ) as Record<AttendanceSessionKey, OperationalAttendance>;
}

function toTravel(row: TravelRow): OperationalTravel {
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

function toPickup(row: PickupRow): OperationalPickupAssignment {
  return {
    transferType: row.transfer_type,
    status: row.status,
    pickupAt: row.pickup_at,
    pickupPoint: row.pickup_point,
    dropoffPoint: row.dropoff_point,
    vehicleLabel: row.vehicle_label,
    notes: row.notes,
  };
}

export async function loadOperationalData(): Promise<OperationalParticipant[] | null> {
  try {
    const supabase = createAdminClient();
    const participantsResult = await supabase
      .from("participants")
      .select(participantSelect)
      .order("created_at", { ascending: false });

    if (participantsResult.error) {
      return null;
    }

    const participants = (participantsResult.data ?? []).map((row) => {
      const participant = row as {
        id: string;
        registration_id: string;
        full_name: string;
        package_type: string | null;
        registration_status: "REGISTERED" | "CANCELLED";
      };

      return {
        id: participant.id,
        registrationId: participant.registration_id,
        fullName: participant.full_name,
        packageType: participant.package_type,
        registrationStatus: participant.registration_status,
      } satisfies ParticipantRow;
    });
    const participantIds = participants.map((participant) => participant.id);

    const [roomsResult, pickupResult, travelResult, sessionsResult] = await Promise.all([
      participantIds.length > 0
        ? supabase
            .from("participant_room_assignments")
            .select("participant_id, room_number, notes, check_in_date, check_out_date")
            .in("participant_id", participantIds)
        : Promise.resolve({ data: [], error: null }),
      participantIds.length > 0
        ? supabase
            .from("participant_pickup_assignments")
            .select("participant_id, transfer_type, status, pickup_at, pickup_point, dropoff_point, vehicle_label, pic_driver, notes")
            .in("participant_id", participantIds)
        : Promise.resolve({ data: [], error: null }),
      participantIds.length > 0
        ? supabase
            .from("participant_travel")
            .select("participant_id, outbound_date, outbound_time, outbound_transport_mode, outbound_transport_number, outbound_origin, outbound_destination, return_date, return_time, return_transport_mode, return_transport_number, return_destination")
            .in("participant_id", participantIds)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from("sessions")
        .select("id, code")
        .in("code", sessionCodes),
    ]);

    if (
      roomsResult.error ||
      pickupResult.error ||
      travelResult.error ||
      sessionsResult.error
    ) {
      return null;
    }

    const attendanceRows: AttendanceRow[] = [];
    const sessionRows = (sessionsResult.data ?? []) as SessionRow[];

    if (participantIds.length > 0 && sessionRows.length > 0) {
      const attendanceResult = await supabase
        .from("attendance")
        .select("participant_id, session_id, check_in_time")
        .in("participant_id", participantIds)
        .in("session_id", sessionRows.map((session) => session.id));

      if (attendanceResult.error) {
        return null;
      }

      attendanceRows.push(...((attendanceResult.data ?? []) as AttendanceRow[]));
    }

    const rooms = new Map(
      ((roomsResult.data ?? []) as RoomRow[]).map((row) => [row.participant_id, row]),
    );
    const pickup = new Map<string, PickupRow[]>();
    const travel = new Map(
      ((travelResult.data ?? []) as TravelRow[]).map((row) => [row.participant_id, row]),
    );
    const sessionCodeById = new Map(sessionRows.map((session) => [session.id, session.code]));
    const attendance = new Map<string, Record<AttendanceSessionKey, OperationalAttendance>>();

    for (const row of (pickupResult.data ?? []) as PickupRow[]) {
      const rows = pickup.get(row.participant_id) ?? [];
      rows.push(row);
      pickup.set(row.participant_id, rows);
    }

    for (const row of attendanceRows) {
      const code = sessionCodeById.get(row.session_id);

      if (!code) {
        continue;
      }

      const current = attendance.get(row.participant_id) ?? emptyAttendanceBySession();
      const attendanceKey = ATTENDANCE_SESSION_KEY_BY_CODE[code];
      current[attendanceKey] = { checkedIn: true, checkedInAt: row.check_in_time };
      attendance.set(row.participant_id, current);
    }

    return participants.map((participant) => {
      const pickupRows = pickup.get(participant.id) ?? [];
      const attendanceRowsForParticipant = attendance.get(participant.id) ?? emptyAttendanceBySession();

      return {
        ...participant,
        ...attendanceRowsForParticipant,
        roomAssignment: (() => {
          const room = rooms.get(participant.id);
          return room
            ? {
                roomNumber: room.room_number,
                 notes: room.notes,
                checkInDate: room.check_in_date,
                checkOutDate: room.check_out_date,
              }
            : null;
        })(),
        travel: travel.has(participant.id) ? toTravel(travel.get(participant.id)!) : null,
        arrivalAssignment: (() => {
          const row = pickupRows.find((item) => item.transfer_type === "ARRIVAL");
          return row ? toPickup(row) : null;
        })(),
        departureAssignment: (() => {
          const row = pickupRows.find((item) => item.transfer_type === "DEPARTURE");
          return row ? toPickup(row) : null;
        })(),
      } satisfies OperationalParticipant;
    });
  } catch {
    return null;
  }
}
