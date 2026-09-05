import * as XLSX from "@e965/xlsx";

import type { PickupParticipant, RoomParticipant } from "./assignment-types";

export type ParticipantExportRow = {
  registration_id: string;
  full_name: string;
  email: string;
  phone_number: string;
  package_type: string | null;
  participation_scope: string | null;
  actuarial_consultant_status: string | null;
  attends_pai_congress: boolean | null;
  polo_size: string | null;
  registration_status: "REGISTERED" | "CANCELLED";
};

function registrationStatus(value: ParticipantExportRow["registration_status"]) {
  return value === "REGISTERED" ? "ACTIVE" : "CANCELLED";
}

function assignmentStatus(assignment: PickupParticipant["arrivalAssignment"]) {
  if (!assignment) {
    return "Belum di-assign";
  }

  if (assignment.status === "CANCELLED") {
    return "Dibatalkan";
  }

  return assignment.status === "COMPLETED" ? "Selesai" : assignment.status === "SCHEDULED" ? "Terjadwal" : "Sudah di-assign";
}

function worksheet(headers: string[], rows: Array<Record<string, string>>) {
  return XLSX.utils.aoa_to_sheet([
    headers,
    ...rows.map((row) => headers.map((header) => row[header] ?? "")),
  ]);
}

function booleanLabel(value: boolean | null) {
  return value === null ? "-" : value ? "Ya" : "Tidak";
}

export function buildParticipantWorkbook(rows: ParticipantExportRow[]) {
  const workbook = XLSX.utils.book_new();
  const headers = [
    "Registration ID",
    "Nama",
    "Email",
    "WhatsApp / Kontak",
    "Paket",
    "Mengikuti",
    "Konsultan Aktuaria",
    "Hadir Kongres PAI",
    "Ukuran Polo",
    "Registration Status",
  ];
  const values = rows.map((row) => ({
    "Registration ID": row.registration_id,
    Nama: row.full_name,
    Email: row.email,
    "WhatsApp / Kontak": row.phone_number,
    Paket: row.package_type ?? "",
    Mengikuti: row.participation_scope ?? "",
    "Konsultan Aktuaria": row.actuarial_consultant_status ?? "",
    "Hadir Kongres PAI": booleanLabel(row.attends_pai_congress),
    "Ukuran Polo": row.polo_size ?? "",
    "Registration Status": registrationStatus(row.registration_status),
  }));

  XLSX.utils.book_append_sheet(workbook, worksheet(headers, values), "Peserta");
  return workbook;
}

export function buildRoomAssignmentWorkbook(participants: RoomParticipant[]) {
  const workbook = XLSX.utils.book_new();
  const headers = ["Registration ID", "Nama Peserta", "Paket", "Nomor Kamar", "Catatan", "Assignment Status"];
  const rows = participants.map((participant) => ({
    "Registration ID": participant.registrationId,
    "Nama Peserta": participant.fullName,
    Paket: participant.packageType ?? "",
    "Nomor Kamar": participant.assignment?.roomNumber ?? "",
    Catatan: participant.assignment?.notes ?? "",
    "Assignment Status": participant.assignment?.roomNumber ? "Sudah di-assign" : "Belum di-assign",
  }));

  XLSX.utils.book_append_sheet(workbook, worksheet(headers, rows), "Room Assignment");
  return workbook;
}

function pickupRows(participants: PickupParticipant[], transferType: "ARRIVAL" | "DEPARTURE") {
  const arrival = transferType === "ARRIVAL";
  return participants.map((participant) => {
    const assignment = arrival ? participant.arrivalAssignment : participant.departureAssignment;
    const travel = participant.travel;

    return {
      "Registration ID": participant.registrationId,
      Nama: participant.fullName,
      "Travel context": travel
        ? arrival
          ? `${travel.outboundTransportMode} ${travel.outboundTransportNumber ?? ""} ${travel.outboundDate} ${travel.outboundTime}`.trim()
          : `${travel.returnTransportMode} ${travel.returnTransportNumber ?? ""} ${travel.returnDate} ${travel.returnTime}`.trim()
        : "",
      [arrival ? "Titik Jemput" : "Titik Antar"]: arrival
        ? assignment?.pickupPoint ?? ""
        : assignment?.dropoffPoint ?? "",
      Kendaraan: assignment?.vehicleLabel ?? "",
      Catatan: assignment?.notes ?? "",
      "Assignment Status": assignmentStatus(assignment),
    };
  });
}

export function buildPickupAssignmentWorkbook(participants: PickupParticipant[]) {
  const workbook = XLSX.utils.book_new();
  const arrivalHeaders = ["Registration ID", "Nama", "Travel context", "Titik Jemput", "Kendaraan", "Catatan", "Assignment Status"];
  const departureHeaders = ["Registration ID", "Nama", "Travel context", "Titik Antar", "Kendaraan", "Catatan", "Assignment Status"];

  XLSX.utils.book_append_sheet(workbook, worksheet(arrivalHeaders, pickupRows(participants, "ARRIVAL")), "Pickup Kedatangan");
  XLSX.utils.book_append_sheet(workbook, worksheet(departureHeaders, pickupRows(participants, "DEPARTURE")), "Pickup Kepulangan");
  return workbook;
}
