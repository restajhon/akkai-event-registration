import * as XLSX from "@e965/xlsx";

import type { MemberMeetingSubmission } from "./admin-data";

const headers = [
  "Nama",
  "Kantor Konsultan Aktuaria",
  "Jabatan",
  "No. HP",
  "Alamat Email",
  "Status Kehadiran",
  "Nama Penerima Kuasa",
  "Jabatan Penerima Kuasa",
  "Nama File Surat Kuasa",
  "Ukuran File Surat Kuasa",
  "Tanggal Pendaftaran",
];

function formatRegistrationDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Jakarta",
      }).format(date);
}

function fileMetadataLabel(
  value: string | number | null,
  suffix = "",
) {
  return value === null ? "Tidak ada" : `${value}${suffix}`;
}

export function buildMemberMeetingWorkbook(
  submissions: MemberMeetingSubmission[],
) {
  const workbook = XLSX.utils.book_new();
  const rows = submissions.map((submission) => {
    const hasAuthorizationFile =
      submission.authorization_file_name !== null &&
      submission.authorization_file_size !== null;

    return [
      submission.name,
      submission.consulting_firm,
      submission.position,
      submission.phone,
      submission.email,
      submission.attendance_type === "PROXY" ? "Diwakilkan" : "Hadir Sendiri",
      submission.proxy_name ?? "Tidak ada",
      submission.proxy_position ?? "Tidak ada",
      hasAuthorizationFile
        ? submission.authorization_file_name
        : "Tidak ada",
      hasAuthorizationFile
        ? fileMetadataLabel(submission.authorization_file_size, " bytes")
        : "Tidak ada",
      formatRegistrationDate(submission.created_at),
    ];
  });

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([headers, ...rows]),
    "Rapat Anggota",
  );

  return workbook;
}
