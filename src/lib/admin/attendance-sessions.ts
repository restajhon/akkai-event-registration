import { OPERATIONAL_SESSION_CODES, type OperationalSessionCode } from "./operational-sessions";

type AttendanceSessionExportDetails = {
  exportLabel: string;
  downloadLabel: string;
  exportFilename: string;
};

const attendanceSessionExportDetails = {
  ARRIVAL: {
    exportLabel: "Registrasi Kedatangan",
    downloadLabel: "Unduh Arrival — Registrasi Kedatangan",
    exportFilename: "AKKAI-2026-Arrival-Registrasi-Kedatangan.xlsx",
  },
  DAY1_MEMBER_MEETING: {
    exportLabel: "Day 1 — Rapat Anggota",
    downloadLabel: "Unduh Day 1 — Rapat Anggota",
    exportFilename: "AKKAI-2026-Day-1-Rapat-Anggota.xlsx",
  },
  SEMINAR: {
    exportLabel: "Seminar AKKAI 2026",
    downloadLabel: "Unduh Seminar AKKAI 2026",
    exportFilename: "AKKAI-2026-Seminar.xlsx",
  },
  DAY2_AKKAI_NIGHT: {
    exportLabel: "Day 2 — Akkai Night",
    downloadLabel: "Unduh Day 2 — Akkai Night",
    exportFilename: "AKKAI-2026-Day-2-Akkai-Night.xlsx",
  },
  DAY3: {
    exportLabel: "Registrasi Kepulangan",
    downloadLabel: "Unduh Registrasi Kepulangan — Day 3",
    exportFilename: "AKKAI-2026-Day-3-Registrasi-Kepulangan.xlsx",
  },
} satisfies Record<OperationalSessionCode, AttendanceSessionExportDetails>;

export const ATTENDANCE_SESSIONS = OPERATIONAL_SESSION_CODES.map((code) => ({
  code,
  ...attendanceSessionExportDetails[code],
}));

export function isAttendanceSessionCode(
  code: string | null,
): code is OperationalSessionCode {
  return code !== null && (OPERATIONAL_SESSION_CODES as readonly string[]).includes(code);
}

export function getAttendanceSession(code: OperationalSessionCode) {
  return { code, ...attendanceSessionExportDetails[code] };
}
