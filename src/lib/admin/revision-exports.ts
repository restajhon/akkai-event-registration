import * as XLSX from "@e965/xlsx";

import type { PickupParticipant, RoomParticipant } from "./assignment-types";
import { getEffectivePickupPoint } from "./pickup-mapping";

type AttendanceExportValue = { status: string; time: string; method: string; operator: string };

export type ParticipantExportRow = {
  registrationId: string;
  batchCode: string;
  name: string;
  kka: string;
  position: string;
  phone: string;
  email: string;
  memberNumber: string;
  institution: string;
  participantCategory: string;
  packageType: string;
  packagePrice: number | null;
  currency: string;
  participationScope: string;
  ciacCategory: string;
  poloModel: string;
  poloSize: string;
  attendsPaiCongress: string;
  registrationStatus: "REGISTERED" | "CANCELLED";
  billingNumber: string;
  billingStatus: "PAID" | "UNPAID" | null;
  paidAt: string;
  paidBy: string;
  certificateStatus: string;
  certificateFileName: string;
  certificateMime: string;
  certificateSize: number | null;
  certificateCreatedAt: string;
  arrivalTravelStatus: string;
  arrivalDate: string;
  arrivalTime: string;
  arrivalMode: string;
  arrivalNumber: string;
  arrivalOrigin: string;
  arrivalDestination: string;
  departureTravelStatus: string;
  departureDate: string;
  departureTime: string;
  departureMode: string;
  departureNumber: string;
  departureDestination: string;
  extendStay: string;
  arrivalPickupPoint: string;
  arrivalPickupPointSource: string;
  arrivalAssignmentStatus: string;
  arrivalPickupAt: string;
  arrivalVehicle: string;
  arrivalDriver: string;
  arrivalNotes: string;
  departureDropoffPoint: string;
  departureDropoffPointSource: string;
  departureAssignmentStatus: string;
  departurePickupAt: string;
  departureVehicle: string;
  departureDriver: string;
  departureNotes: string;
  arrivalAttendance: AttendanceExportValue;
  seminarAttendance: AttendanceExportValue;
  day3Attendance: AttendanceExportValue;
  emailStatus: string;
  emailLastSentAt: string;
  latestEmailStatus: string;
  latestEmailAt: string;
  billingEmailStatus: string;
  billingEmailSentAt: string;
  privacyConsentAt: string;
  createdAt: string;
  updatedAt: string;
};

function registrationStatus(value: ParticipantExportRow["registrationStatus"]) {
  return value === "REGISTERED" ? "Terdaftar" : "Dibatalkan";
}

function billingStatus(value: ParticipantExportRow["billingStatus"]) {
  return value === "PAID" ? "Lunas" : value === "UNPAID" ? "Belum Dibayar" : "Belum tersedia";
}

function worksheet(headers: string[], rows: Array<Record<string, string | number>>) {
  return XLSX.utils.aoa_to_sheet([
    headers,
    ...rows.map((row) => headers.map((header) => row[header] ?? "")),
  ]);
}

function sizeLabel(value: number | null) {
  return value === null ? "" : `${value} byte`;
}

export function buildParticipantWorkbook(rows: ParticipantExportRow[]) {
  const workbook = XLSX.utils.book_new();
  const headers = [
    "Registration ID", "Batch Code", "Nama", "KKA", "Jabatan", "No. HP", "Alamat Email", "Nomor Anggota", "Institusi", "Kategori Peserta",
    "Paket", "Harga Paket", "Mata Uang", "Pilihan Mengikuti Acara", "Kategori CIAC", "Model Poloshirt", "Ukuran Poloshirt", "Kehadiran Kongres PAI", "Status Registrasi",
    "Nomor Tagihan", "Status Billing", "Paid at", "Aktor/Admin Pembayaran",
    "Status Surat Keterangan Kerja", "Nama File SK", "Tipe File SK", "Ukuran File SK", "Waktu Upload SK",
    "Status Travel Arrival", "Tanggal Arrival", "Waktu Arrival", "Moda Arrival", "Nomor Arrival", "Asal Arrival", "Tujuan Arrival",
    "Status Travel Departure", "Tanggal Departure", "Waktu Departure", "Moda Departure", "Nomor Departure", "Tujuan Departure", "Extend Stay",
    "Titik Jemput Arrival", "Sumber Titik Jemput Arrival", "Status Assignment Arrival", "Waktu Pickup Arrival", "Kendaraan Arrival", "Driver Arrival", "Catatan Arrival",
    "Titik Antar Departure", "Sumber Titik Antar Departure", "Status Assignment Departure", "Waktu Pickup Departure", "Kendaraan Departure", "Driver Departure", "Catatan Departure",
    "Attendance ARRIVAL", "Waktu ARRIVAL", "Metode ARRIVAL", "Operator ARRIVAL", "Attendance SEMINAR", "Waktu SEMINAR", "Metode SEMINAR", "Operator SEMINAR", "Attendance DAY3", "Waktu DAY3", "Metode DAY3", "Operator DAY3",
    "Status Email", "Email Terakhir Dikirim", "Status Log Email Terakhir", "Waktu Log Email Terakhir", "Status Email Tagihan", "Email Tagihan Dikirim", "Privacy Consent At", "Created At", "Updated At",
  ];
  const values = rows.map((row) => ({
    "Registration ID": row.registrationId,
    "Batch Code": row.batchCode,
    Nama: row.name,
    KKA: row.kka,
    Jabatan: row.position,
    "No. HP": row.phone,
    "Alamat Email": row.email,
    "Nomor Anggota": row.memberNumber,
    Institusi: row.institution,
    "Kategori Peserta": row.participantCategory,
    Paket: row.packageType,
    "Harga Paket": row.packagePrice ?? "",
    "Mata Uang": row.currency,
    "Pilihan Mengikuti Acara": row.participationScope,
    "Kategori CIAC": row.ciacCategory,
    "Model Poloshirt": row.poloModel,
    "Ukuran Poloshirt": row.poloSize,
    "Kehadiran Kongres PAI": row.attendsPaiCongress,
    "Status Registrasi": registrationStatus(row.registrationStatus),
    "Nomor Tagihan": row.billingNumber,
    "Status Billing": billingStatus(row.billingStatus),
    "Paid at": row.paidAt,
    "Aktor/Admin Pembayaran": row.paidBy,
    "Status Surat Keterangan Kerja": row.certificateStatus,
    "Nama File SK": row.certificateFileName,
    "Tipe File SK": row.certificateMime,
    "Ukuran File SK": sizeLabel(row.certificateSize),
    "Waktu Upload SK": row.certificateCreatedAt,
    "Status Travel Arrival": row.arrivalTravelStatus,
    "Tanggal Arrival": row.arrivalDate,
    "Waktu Arrival": row.arrivalTime,
    "Moda Arrival": row.arrivalMode,
    "Nomor Arrival": row.arrivalNumber,
    "Asal Arrival": row.arrivalOrigin,
    "Tujuan Arrival": row.arrivalDestination,
    "Status Travel Departure": row.departureTravelStatus,
    "Tanggal Departure": row.departureDate,
    "Waktu Departure": row.departureTime,
    "Moda Departure": row.departureMode,
    "Nomor Departure": row.departureNumber,
    "Tujuan Departure": row.departureDestination,
    "Extend Stay": row.extendStay,
    "Titik Jemput Arrival": row.arrivalPickupPoint,
    "Sumber Titik Jemput Arrival": row.arrivalPickupPointSource,
    "Status Assignment Arrival": row.arrivalAssignmentStatus,
    "Waktu Pickup Arrival": row.arrivalPickupAt,
    "Kendaraan Arrival": row.arrivalVehicle,
    "Driver Arrival": row.arrivalDriver,
    "Catatan Arrival": row.arrivalNotes,
    "Titik Antar Departure": row.departureDropoffPoint,
    "Sumber Titik Antar Departure": row.departureDropoffPointSource,
    "Status Assignment Departure": row.departureAssignmentStatus,
    "Waktu Pickup Departure": row.departurePickupAt,
    "Kendaraan Departure": row.departureVehicle,
    "Driver Departure": row.departureDriver,
    "Catatan Departure": row.departureNotes,
    "Attendance ARRIVAL": row.arrivalAttendance.status,
    "Waktu ARRIVAL": row.arrivalAttendance.time,
    "Metode ARRIVAL": row.arrivalAttendance.method,
    "Operator ARRIVAL": row.arrivalAttendance.operator,
    "Attendance SEMINAR": row.seminarAttendance.status,
    "Waktu SEMINAR": row.seminarAttendance.time,
    "Metode SEMINAR": row.seminarAttendance.method,
    "Operator SEMINAR": row.seminarAttendance.operator,
    "Attendance DAY3": row.day3Attendance.status,
    "Waktu DAY3": row.day3Attendance.time,
    "Metode DAY3": row.day3Attendance.method,
    "Operator DAY3": row.day3Attendance.operator,
    "Status Email": row.emailStatus,
    "Email Terakhir Dikirim": row.emailLastSentAt,
    "Status Log Email Terakhir": row.latestEmailStatus,
    "Waktu Log Email Terakhir": row.latestEmailAt,
    "Status Email Tagihan": row.billingEmailStatus,
    "Email Tagihan Dikirim": row.billingEmailSentAt,
    "Privacy Consent At": row.privacyConsentAt,
    "Created At": row.createdAt,
    "Updated At": row.updatedAt,
  }));

  XLSX.utils.book_append_sheet(workbook, worksheet(headers, values), "Peserta");
  return workbook;
}

function assignmentStatus(assignment: PickupParticipant["arrivalAssignment"]) {
  if (!assignment) return "Belum di-assign";
  if (assignment.status === "CANCELLED") return "Dibatalkan";
  return assignment.status === "COMPLETED" ? "Selesai" : "Terjadwal";
}

function pickupRows(participants: PickupParticipant[], transferType: "ARRIVAL" | "DEPARTURE") {
  const arrival = transferType === "ARRIVAL";
  return participants.map((participant) => {
    const assignment = arrival ? participant.arrivalAssignment : participant.departureAssignment;
    const travel = participant.travel;
    return {
      "Registration ID": participant.registrationId,
      Nama: participant.fullName,
      "Travel context": travel ? arrival
        ? `${travel.outboundTransportMode} ${travel.outboundTransportNumber ?? ""} ${travel.outboundDate} ${travel.outboundTime}`.trim()
        : `${travel.returnTransportMode} ${travel.returnTransportNumber ?? ""} ${travel.returnDate} ${travel.returnTime}`.trim() : "",
      [arrival ? "Titik Jemput" : "Titik Antar"]: getEffectivePickupPoint(transferType, assignment, travel).value ?? "",
      Kendaraan: assignment?.vehicleLabel ?? "",
      Catatan: assignment?.notes ?? "",
      "Assignment Status": assignmentStatus(assignment),
    };
  });
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

export function buildPickupAssignmentWorkbook(participants: PickupParticipant[]) {
  const workbook = XLSX.utils.book_new();
  const arrivalHeaders = ["Registration ID", "Nama", "Travel context", "Titik Jemput", "Kendaraan", "Catatan", "Assignment Status"];
  const departureHeaders = ["Registration ID", "Nama", "Travel context", "Titik Antar", "Kendaraan", "Catatan", "Assignment Status"];
  XLSX.utils.book_append_sheet(workbook, worksheet(arrivalHeaders, pickupRows(participants, "ARRIVAL")), "Pickup Kedatangan");
  XLSX.utils.book_append_sheet(workbook, worksheet(departureHeaders, pickupRows(participants, "DEPARTURE")), "Pickup Kepulangan");
  return workbook;
}
