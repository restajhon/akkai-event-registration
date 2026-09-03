import * as XLSX from "@e965/xlsx";

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

function roomAssignmentLabel(room: OperationalParticipant["roomAssignment"]) {
  return room ? [room.roomNumber, room.roomType].filter(Boolean).join(" / ") : "";
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
      "Pickup point": assignment?.pickupPoint ?? "",
      "Dropoff point": assignment?.dropoffPoint ?? "",
      Driver: assignment?.picDriver ?? "",
      Kendaraan: assignment?.vehicleLabel ?? "",
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
    "Room assignment": roomAssignmentLabel(participant.roomAssignment),
    "Nomor kamar": participant.roomAssignment?.roomNumber ?? "",
    "Tipe kamar": participant.roomAssignment?.roomType ?? "",
    "Check-in": participant.roomAssignment?.checkInDate ?? "",
    "Check-out": participant.roomAssignment?.checkOutDate ?? "",
    "Status Assignment": participant.roomAssignment?.roomNumber ? "Sudah di-assign" : "Belum di-assign",
  }));
  const attendance = participants.map((participant) => ({
    "Registration ID": participant.registrationId,
    Nama: participant.fullName,
    "Status Registrasi": registrationStatus(participant.registrationStatus),
    ARRIVAL: attendanceStatus(participant.arrival.checkedIn),
    "ARRIVAL Check-in": readableDateTime(participant.arrival.checkedInAt),
    SEMINAR: attendanceStatus(participant.seminar.checkedIn),
    "SEMINAR Check-in": readableDateTime(participant.seminar.checkedInAt),
    DAY3: attendanceStatus(participant.day3.checkedIn),
    "DAY3 Check-in": readableDateTime(participant.day3.checkedInAt),
  }));

  XLSX.utils.book_append_sheet(
    workbook,
    worksheet(
      ["Registration ID", "Nama", "Status Registrasi", "Paket", "Room assignment", "Nomor kamar", "Tipe kamar", "Check-in", "Check-out", "Status Assignment"],
      rooms,
    ),
    "Rooms",
  );
  XLSX.utils.book_append_sheet(
    workbook,
    worksheet(
      ["Registration ID", "Nama", "Status Registrasi", "Travel tersedia", "Arrival transport", "Nomor penerbangan/kereta", "Tanggal / waktu", "Lokasi travel", "Pickup assignment", "Pickup point", "Dropoff point", "Driver", "Kendaraan", "Transfer status"],
      pickupRows(participants, "ARRIVAL"),
    ),
    "Pickup Kedatangan",
  );
  XLSX.utils.book_append_sheet(
    workbook,
    worksheet(
      ["Registration ID", "Nama", "Status Registrasi", "Travel tersedia", "Departure transport", "Nomor penerbangan/kereta", "Tanggal / waktu", "Lokasi travel", "Pickup assignment", "Pickup point", "Dropoff point", "Driver", "Kendaraan", "Transfer status"],
      pickupRows(participants, "DEPARTURE"),
    ),
    "Pickup Kepulangan",
  );
  XLSX.utils.book_append_sheet(
    workbook,
    worksheet(
      ["Registration ID", "Nama", "Status Registrasi", "ARRIVAL", "ARRIVAL Check-in", "SEMINAR", "SEMINAR Check-in", "DAY3", "DAY3 Check-in"],
      attendance,
    ),
    "Kehadiran",
  );

  return workbook;
}
