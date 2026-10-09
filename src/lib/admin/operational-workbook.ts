import * as XLSX from "@e965/xlsx";

import {
  ATTENDANCE_SESSIONS,
  getAttendanceSession,
  type SeparateAttendanceExportCode,
} from "./attendance-sessions";
import type { OperationalParticipant } from "./operational-data";

function registrationStatus(value: OperationalParticipant["registrationStatus"]) {
  return value === "REGISTERED" ? "ACTIVE" : "CANCELLED";
}

function assignmentStatus(assignment: OperationalParticipant["arrivalAssignment"]) {
  if (!assignment) {
    return "Belum di-assign";
  }

  if (assignment.status === "CANCELLED") {
    return "Dibatalkan";
  }

  return assignment.status === "SCHEDULED" ? "Terjadwal" : "Selesai";
}

function attendanceStatus(checkedIn: boolean) {
  return checkedIn ? "Hadir" : "Belum hadir";
}

function readableDateTime(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Jakarta",
      }).format(date);
}

function pickupRows(
  participants: OperationalParticipant[],
  transferType: "ARRIVAL" | "DEPARTURE",
): Array<Record<string, string>> {
  return participants.map((participant) => {
    const arrival = transferType === "ARRIVAL";
    const assignment = arrival ? participant.arrivalAssignment : participant.departureAssignment;
    const travel = participant.travel;

    return {
      "Registration ID": participant.registrationId,
      Nama: participant.fullName,
      "Status Registrasi": registrationStatus(participant.registrationStatus),
      "Travel tersedia": travel ? "Ya" : "Tidak",
      [arrival ? "Arrival transport" : "Departure transport"]: travel
        ? arrival
          ? travel.outboundTransportMode
          : travel.returnTransportMode
        : "",
      "Nomor penerbangan/kereta": travel
        ? (arrival ? travel.outboundTransportNumber : travel.returnTransportNumber) ?? ""
        : "",
      "Tanggal / waktu": travel
        ? `${arrival ? travel.outboundDate : travel.returnDate} ${arrival ? travel.outboundTime : travel.returnTime}`
        : "",
      "Lokasi travel": travel
        ? arrival
          ? travel.outboundDestination
          : travel.returnDestination
        : "",
       "Pickup assignment": assignment ? "Ya" : "Tidak",
       [arrival ? "Titik Jemput" : "Titik Antar"]: arrival
         ? assignment?.pickupPoint ?? ""
         : assignment?.dropoffPoint ?? "",
       Kendaraan: assignment?.vehicleLabel ?? "",
       Catatan: assignment?.notes ?? "",
       "Transfer status": assignmentStatus(assignment),
    };
  });
}

function worksheet(headers: string[], rows: Array<Record<string, string>>) {
  return XLSX.utils.aoa_to_sheet([
    headers,
    ...rows.map((row) => headers.map((header) => row[header] ?? "")),
  ]);
}

export function buildOperationalWorkbook(participants: OperationalParticipant[]) {
  const workbook = XLSX.utils.book_new();
  const rooms = participants.map((participant) => ({
    "Registration ID": participant.registrationId,
    Nama: participant.fullName,
    "Status Registrasi": registrationStatus(participant.registrationStatus),
    Paket: participant.packageType ?? "",
    "Nomor kamar": participant.roomAssignment?.roomNumber ?? "",
    Catatan: participant.roomAssignment?.notes ?? "",
    "Status Assignment": participant.roomAssignment?.roomNumber ? "Sudah di-assign" : "Belum di-assign",
  }));
  const attendanceHeaders = [
    "Registration ID",
    "Nama",
    "Status Registrasi",
    ...ATTENDANCE_SESSIONS.flatMap(({ summaryLabel }) => [
      summaryLabel,
      `${summaryLabel} Check-in`,
    ]),
  ];
  const attendance = participants.map((participant) => {
    const row: Record<string, string> = {
      "Registration ID": participant.registrationId,
      Nama: participant.fullName,
      "Status Registrasi": registrationStatus(participant.registrationStatus),
    };

    for (const session of ATTENDANCE_SESSIONS) {
      const attendance = participant[session.key];
      row[session.summaryLabel] = attendanceStatus(attendance.checkedIn);
      row[`${session.summaryLabel} Check-in`] = readableDateTime(attendance.checkedInAt);
    }

    return row;
  });

  XLSX.utils.book_append_sheet(
    workbook,
    worksheet(
       ["Registration ID", "Nama", "Status Registrasi", "Paket", "Nomor kamar", "Catatan", "Status Assignment"],
      rooms,
    ),
    "Rooms",
  );
  XLSX.utils.book_append_sheet(
    workbook,
    worksheet(
       ["Registration ID", "Nama", "Status Registrasi", "Travel tersedia", "Arrival transport", "Nomor penerbangan/kereta", "Tanggal / waktu", "Lokasi travel", "Pickup assignment", "Titik Jemput", "Kendaraan", "Catatan", "Transfer status"],
      pickupRows(participants, "ARRIVAL"),
    ),
    "Pickup Kedatangan",
  );
  XLSX.utils.book_append_sheet(
    workbook,
    worksheet(
       ["Registration ID", "Nama", "Status Registrasi", "Travel tersedia", "Departure transport", "Nomor penerbangan/kereta", "Tanggal / waktu", "Lokasi travel", "Pickup assignment", "Titik Antar", "Kendaraan", "Catatan", "Transfer status"],
      pickupRows(participants, "DEPARTURE"),
    ),
    "Pickup Kepulangan",
  );
  XLSX.utils.book_append_sheet(
    workbook,
    worksheet(
      attendanceHeaders,
      attendance,
    ),
    "Kehadiran",
  );

  return workbook;
}

export function buildAttendanceSessionWorkbook(
  participants: OperationalParticipant[],
  sessionCode: SeparateAttendanceExportCode,
) {
  const session = getAttendanceSession(sessionCode);
  const headers = [
    "Registration ID",
    "Nama",
    "Status Registrasi",
    session.label,
    `${session.label} Check-in`,
  ];
  const rows = participants.map((participant) => {
    const attendance = participant[session.key];

    return {
      "Registration ID": participant.registrationId,
      Nama: participant.fullName,
      "Status Registrasi": registrationStatus(participant.registrationStatus),
      [session.label]: attendanceStatus(attendance.checkedIn),
      [`${session.label} Check-in`]: readableDateTime(attendance.checkedInAt),
    };
  });
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet(headers, rows), "Kehadiran");
  return workbook;
}
