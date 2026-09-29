import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

import { getEffectivePickupPoint } from "./pickup-mapping";
import type { ParticipantExportRow } from "./revision-exports";

type ParticipantRow = {
  id: string;
  registration_id: string;
  batch_id: string | null;
  full_name: string;
  member_number: string | null;
  email: string;
  phone_number: string;
  institution: string | null;
  participant_category: string | null;
  position: string | null;
  kka_name: string | null;
  polo_size: string | null;
  polo_model: string | null;
  package_type: string | null;
  participation_scope: string | null;
  actuarial_consultant_status: string | null;
  attends_pai_congress: boolean | null;
  registration_status: "REGISTERED" | "CANCELLED";
  email_status: "PENDING" | "SENT" | "FAILED";
  last_email_sent_at: string | null;
  privacy_consent_at: string;
  created_at: string;
  updated_at: string;
};

type BillingRow = {
  participant_id: string;
  billing_number: string;
  amount: number;
  currency: string;
  payment_status: "PAID" | "UNPAID";
  paid_at: string | null;
  paid_by: string | null;
  billing_email_status: "PENDING" | "SENT" | "FAILED";
  billing_email_sent_at: string | null;
};

type DocumentRow = {
  participant_id: string;
  file_name: string;
  file_mime: string;
  file_size: number;
  created_at: string;
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
  extend_stay: boolean;
};

type PickupRow = {
  participant_id: string;
  transfer_type: "ARRIVAL" | "DEPARTURE";
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED";
  pickup_at: string | null;
  pickup_point: string | null;
  dropoff_point: string | null;
  vehicle_label: string | null;
  pic_driver: string | null;
  notes: string | null;
  updated_by: string;
  updated_at: string;
};

type SessionRow = { id: string; code: "ARRIVAL" | "SEMINAR" | "DAY3" };
type AttendanceRow = {
  participant_id: string;
  session_id: string;
  check_in_time: string;
  check_in_method: "QR" | "MANUAL";
  operator_id: string;
};
type EmailLogRow = {
  participant_id: string;
  status: "PENDING" | "SENT" | "FAILED";
  sent_at: string | null;
  created_at: string;
};
type ProfileRow = { id: string; full_name: string };

function readableDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

function readableDateOnly(value: string | null) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00+07:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

function readableTime(value: string | null) {
  return value ? value.slice(0, 5) : "";
}

function booleanLabel(value: boolean | null) {
  return value === null ? "" : value ? "Ya" : "Tidak";
}

function assignmentStatus(value: PickupRow | undefined) {
  if (!value) return "Belum di-assign";
  if (value.status === "CANCELLED") return "Dibatalkan";
  return value.status === "COMPLETED" ? "Selesai" : "Terjadwal";
}

export async function loadParticipantExportRows(
  batchCode = "all",
  registrationStatus: "REGISTERED" | "CANCELLED" | "all" = "REGISTERED",
): Promise<ParticipantExportRow[] | null> {
  try {
    const supabase = createAdminClient();
    let batchId: string | null = null;
    if (batchCode !== "all") {
      const batchResult = await supabase.from("registration_batches").select("id").eq("batch_code", batchCode).maybeSingle();
      if (batchResult.error) return null;
      batchId = batchResult.data?.id ?? null;
      if (!batchId) return [];
    }
    const batchResult = await supabase.from("registration_batches").select("id, batch_code");
    if (batchResult.error) return null;
    const batchCodeById = new Map((batchResult.data ?? []).map((row) => [row.id as string, row.batch_code as string]));
    let participantQuery = supabase.from("participants").select("id, registration_id, batch_id, full_name, member_number, email, phone_number, institution, participant_category, position, kka_name, polo_size, polo_model, package_type, participation_scope, actuarial_consultant_status, attends_pai_congress, registration_status, email_status, last_email_sent_at, privacy_consent_at, created_at, updated_at").order("created_at", { ascending: false });
    if (batchId) participantQuery = participantQuery.eq("batch_id", batchId);
    if (registrationStatus !== "all") participantQuery = participantQuery.eq("registration_status", registrationStatus);
    const [participantsResult, billingsResult, documentsResult, travelResult, pickupResult, sessionsResult, attendanceResult, emailLogsResult] = await Promise.all([
      participantQuery,
      supabase.from("registration_billings").select("participant_id, billing_number, amount, currency, payment_status, paid_at, paid_by, billing_email_status, billing_email_sent_at"),
      supabase.from("registration_documents").select("participant_id, file_name, file_mime, file_size, created_at"),
      supabase.from("participant_travel").select("participant_id, outbound_date, outbound_time, outbound_transport_mode, outbound_transport_number, outbound_origin, outbound_destination, return_date, return_time, return_transport_mode, return_transport_number, return_destination, extend_stay"),
      supabase.from("participant_pickup_assignments").select("participant_id, transfer_type, status, pickup_at, pickup_point, dropoff_point, vehicle_label, pic_driver, notes, updated_by, updated_at"),
      supabase.from("sessions").select("id, code").in("code", ["ARRIVAL", "SEMINAR", "DAY3"]),
      supabase.from("attendance").select("participant_id, session_id, check_in_time, check_in_method, operator_id"),
      supabase.from("email_logs").select("participant_id, status, sent_at, created_at").order("created_at", { ascending: false }),
    ]);

    if ([participantsResult, billingsResult, documentsResult, travelResult, pickupResult, sessionsResult, attendanceResult, emailLogsResult].some((result) => result.error)) {
      return null;
    }

    const participants = (participantsResult.data ?? []) as ParticipantRow[];
    const billings = (billingsResult.data ?? []) as BillingRow[];
    const documents = (documentsResult.data ?? []) as DocumentRow[];
    const travels = (travelResult.data ?? []) as TravelRow[];
    const pickups = (pickupResult.data ?? []) as PickupRow[];
    const sessions = (sessionsResult.data ?? []) as SessionRow[];
    const attendance = (attendanceResult.data ?? []) as AttendanceRow[];
    const emailLogs = (emailLogsResult.data ?? []) as EmailLogRow[];
    const profileIds = Array.from(new Set([
      ...billings.map((billing) => billing.paid_by),
      ...pickups.map((pickup) => pickup.updated_by),
      ...attendance.map((row) => row.operator_id),
    ].filter((id): id is string => Boolean(id))));
    const profilesResult = profileIds.length > 0
      ? await supabase.from("profiles").select("id, full_name").in("id", profileIds)
      : { data: [], error: null };

    if (profilesResult.error) return null;

    const billingByParticipant = new Map(billings.map((row) => [row.participant_id, row]));
    const documentByParticipant = new Map(documents.map((row) => [row.participant_id, row]));
    const travelByParticipant = new Map(travels.map((row) => [row.participant_id, row]));
    const profileNameById = new Map((profilesResult.data as ProfileRow[]).map((row) => [row.id, row.full_name]));
    const sessionCodeById = new Map(sessions.map((row) => [row.id, row.code]));
    const pickupByParticipant = new Map<string, PickupRow[]>();
    const attendanceByParticipant = new Map<string, AttendanceRow[]>();
    const latestEmailByParticipant = new Map<string, EmailLogRow>();

    for (const row of pickups) pickupByParticipant.set(row.participant_id, [...(pickupByParticipant.get(row.participant_id) ?? []), row]);
    for (const row of attendance) attendanceByParticipant.set(row.participant_id, [...(attendanceByParticipant.get(row.participant_id) ?? []), row]);
    for (const row of emailLogs) if (!latestEmailByParticipant.has(row.participant_id)) latestEmailByParticipant.set(row.participant_id, row);

    return participants.map((participant) => {
      const billing = billingByParticipant.get(participant.id);
      const document = documentByParticipant.get(participant.id);
      const travel = travelByParticipant.get(participant.id);
      const participantPickups = pickupByParticipant.get(participant.id) ?? [];
      const arrival = participantPickups.find((row) => row.transfer_type === "ARRIVAL");
      const departure = participantPickups.find((row) => row.transfer_type === "DEPARTURE");
      const travelModel = travel ? {
        outboundDate: travel.outbound_date,
        outboundTime: travel.outbound_time,
        outboundTransportMode: travel.outbound_transport_mode,
        outboundTransportNumber: travel.outbound_transport_number,
        outboundOrigin: travel.outbound_origin,
        outboundDestination: travel.outbound_destination,
        returnDate: travel.return_date,
        returnTime: travel.return_time,
        returnTransportMode: travel.return_transport_mode,
        returnTransportNumber: travel.return_transport_number,
        returnDestination: travel.return_destination,
      } : null;
      const arrivalPoint = getEffectivePickupPoint("ARRIVAL", arrival ? {
        transferType: "ARRIVAL", status: arrival.status, pickupAt: arrival.pickup_at, pickupPoint: arrival.pickup_point, dropoffPoint: arrival.dropoff_point, vehicleLabel: arrival.vehicle_label, picDriver: arrival.pic_driver, notes: arrival.notes, updatedAt: arrival.updated_at,
      } : null, travelModel);
      const departurePoint = getEffectivePickupPoint("DEPARTURE", departure ? {
        transferType: "DEPARTURE", status: departure.status, pickupAt: departure.pickup_at, pickupPoint: departure.pickup_point, dropoffPoint: departure.dropoff_point, vehicleLabel: departure.vehicle_label, picDriver: departure.pic_driver, notes: departure.notes, updatedAt: departure.updated_at,
      } : null, travelModel);
      const attendanceRows = attendanceByParticipant.get(participant.id) ?? [];
      const attendanceFor = (code: SessionRow["code"]) => {
        const row = attendanceRows.find((item) => sessionCodeById.get(item.session_id) === code);
        return {
          status: row ? "Sudah Check-in" : "Belum Check-in",
          time: readableDate(row?.check_in_time ?? null),
          method: row?.check_in_method ?? "",
          operator: row ? profileNameById.get(row.operator_id) ?? row.operator_id : "",
        };
      };
      const latestEmail = latestEmailByParticipant.get(participant.id);

      return {
        registrationId: participant.registration_id,
        batchCode: participant.batch_id ? batchCodeById.get(participant.batch_id) ?? "" : "",
        name: participant.full_name,
        kka: participant.kka_name ?? "",
        position: participant.position ?? "",
        phone: participant.phone_number,
        email: participant.email,
        memberNumber: participant.member_number ?? "",
        institution: participant.institution ?? "",
        participantCategory: participant.participant_category ?? "",
        packageType: participant.package_type ?? "",
        packagePrice: billing?.amount ?? null,
        currency: billing?.currency ?? "IDR",
        participationScope: participant.participation_scope ?? "",
        ciacCategory: participant.actuarial_consultant_status ?? "",
        poloModel: participant.polo_model ?? "",
        poloSize: participant.polo_size ?? "",
        attendsPaiCongress: booleanLabel(participant.attends_pai_congress),
        registrationStatus: participant.registration_status,
        billingNumber: billing?.billing_number ?? "",
        billingStatus: billing?.payment_status ?? null,
        paidAt: readableDate(billing?.paid_at ?? null),
        paidBy: billing?.paid_by ? profileNameById.get(billing.paid_by) ?? billing.paid_by : "",
        certificateStatus: document ? "Terunggah" : "Belum diunggah",
        certificateFileName: document?.file_name ?? "",
        certificateMime: document?.file_mime ?? "",
        certificateSize: document?.file_size ?? null,
        certificateCreatedAt: readableDate(document?.created_at ?? null),
        arrivalTravelStatus: travel ? "Lengkap" : "Belum diisi",
        arrivalDate: readableDateOnly(travel?.outbound_date ?? null),
        arrivalTime: readableTime(travel?.outbound_time ?? null),
        arrivalMode: travel?.outbound_transport_mode ?? "",
        arrivalNumber: travel?.outbound_transport_number ?? "",
        arrivalOrigin: travel?.outbound_origin ?? "",
        arrivalDestination: travel?.outbound_destination ?? "",
        departureTravelStatus: travel ? "Lengkap" : "Belum diisi",
        departureDate: readableDateOnly(travel?.return_date ?? null),
        departureTime: readableTime(travel?.return_time ?? null),
        departureMode: travel?.return_transport_mode ?? "",
        departureNumber: travel?.return_transport_number ?? "",
        departureDestination: travel?.return_destination ?? "",
        extendStay: travel ? booleanLabel(travel.extend_stay) : "",
        arrivalPickupPoint: arrivalPoint.value ?? "",
        arrivalPickupPointSource: arrivalPoint.source === "MANUAL" ? "Koreksi manual" : arrivalPoint.source === "TRAVEL" ? "Travel peserta" : "Belum diisi",
        arrivalAssignmentStatus: assignmentStatus(arrival),
        arrivalPickupAt: readableDate(arrival?.pickup_at ?? null),
        arrivalVehicle: arrival?.vehicle_label ?? "",
        arrivalDriver: arrival?.pic_driver ?? "",
        arrivalNotes: arrival?.notes ?? "",
        departureDropoffPoint: departurePoint.value ?? "",
        departureDropoffPointSource: departurePoint.source === "MANUAL" ? "Koreksi manual" : departurePoint.source === "TRAVEL" ? "Travel peserta" : "Belum diisi",
        departureAssignmentStatus: assignmentStatus(departure),
        departurePickupAt: readableDate(departure?.pickup_at ?? null),
        departureVehicle: departure?.vehicle_label ?? "",
        departureDriver: departure?.pic_driver ?? "",
        departureNotes: departure?.notes ?? "",
        arrivalAttendance: attendanceFor("ARRIVAL"),
        seminarAttendance: attendanceFor("SEMINAR"),
        day3Attendance: attendanceFor("DAY3"),
        emailStatus: participant.email_status,
        emailLastSentAt: readableDate(participant.last_email_sent_at),
        latestEmailStatus: latestEmail?.status ?? "",
        latestEmailAt: readableDate(latestEmail?.sent_at ?? latestEmail?.created_at ?? null),
        billingEmailStatus: billing?.billing_email_status ?? "",
        billingEmailSentAt: readableDate(billing?.billing_email_sent_at ?? null),
        privacyConsentAt: readableDate(participant.privacy_consent_at),
        createdAt: readableDate(participant.created_at),
        updatedAt: readableDate(participant.updated_at),
      } satisfies ParticipantExportRow;
    });
  } catch {
    return null;
  }
}
