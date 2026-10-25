import * as XLSX from "@e965/xlsx";

import { getAttendanceSession } from "./attendance-sessions";
import type { OperationalParticipant } from "./operational-data";
import { OPERATIONAL_SESSION_CODES, type OperationalSessionCode } from "./operational-sessions";

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

function formAnswerRows(participants: OperationalParticipant[]) {
  return participants.flatMap((participant) => participant.formAnswers.map((answer) => ({
    "Registration ID": participant.registrationId,
    "Versi Form": String(answer.versionNumber),
    Key: answer.key,
    Pertanyaan: answer.label,
    Jawaban: answer.value,
  })));
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
  const attendance = participants.map((participant) => {
    const row: Record<string, string> = {
      "Status Registrasi": registrationStatus(participant.registrationStatus),
      "Registration ID": participant.registrationId,
      Nama: participant.fullName,
    };

    for (const code of OPERATIONAL_SESSION_CODES) {
      const sessionAttendance = participant.attendanceBySession[code];
      row[code] = attendanceStatus(sessionAttendance.checkedIn);
      row[`${code} Check-in`] = readableDateTime(sessionAttendance.checkedInAt);
    }

    return row;
  });
  const attendanceHeaders = [
    "Status Registrasi",
    "Registration ID",
    "Nama",
    ...OPERATIONAL_SESSION_CODES.flatMap((code) => [code, `${code} Check-in`]),
  ];

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
  XLSX.utils.book_append_sheet(
    workbook,
    worksheet(["Registration ID", "Versi Form", "Key", "Pertanyaan", "Jawaban"], formAnswerRows(participants)),
    "Jawaban Tambahan",
  );

  return workbook;
}

export function buildAttendanceSessionWorkbook(
  participants: OperationalParticipant[],
  sessionCode: OperationalSessionCode,
) {
  const session = getAttendanceSession(sessionCode);
  const headers = [
    "Registration ID",
    "Nama",
    "Status Registrasi",
    session.exportLabel,
    `${session.exportLabel} Check-in`,
  ];
  const rows = participants.map((participant) => {
    const attendance = participant.attendanceBySession[sessionCode];

    return {
      "Registration ID": participant.registrationId,
      Nama: participant.fullName,
      "Status Registrasi": registrationStatus(participant.registrationStatus),
      [session.exportLabel]: attendanceStatus(attendance.checkedIn),
      [`${session.exportLabel} Check-in`]: readableDateTime(attendance.checkedInAt),
    };
  });
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet(headers, rows), "Kehadiran");
  XLSX.utils.book_append_sheet(
    workbook,
    worksheet(["Registration ID", "Versi Form", "Key", "Pertanyaan", "Jawaban"], formAnswerRows(participants)),
    "Jawaban Tambahan",
  );
  return workbook;
}
