export const ARRIVAL_SESSION_CODE = "ARRIVAL" as const;

export const ATTENDANCE_SESSIONS = [
  {
    code: ARRIVAL_SESSION_CODE,
    label: "Registrasi Kedatangan",
    summaryLabel: "ARRIVAL",
    key: "arrival",
    downloadLabel: "Unduh Arrival — Registrasi Kedatangan",
    exportFilename: "AKKAI-2026-Arrival-Registrasi-Kedatangan.xlsx",
  },
  {
    code: "DAY1_MEMBER_MEETING",
    label: "Day 1 — Rapat Anggota",
    summaryLabel: "Day 1 — Rapat Anggota",
    key: "day1MemberMeeting",
    downloadLabel: "Unduh Day 1 — Rapat Anggota",
    exportFilename: "AKKAI-2026-Day-1-Rapat-Anggota.xlsx",
  },
  {
    code: "SEMINAR",
    label: "Seminar AKKAI 2026",
    summaryLabel: "SEMINAR",
    key: "seminar",
    downloadLabel: "Unduh Seminar AKKAI 2026",
    exportFilename: "AKKAI-2026-Seminar.xlsx",
  },
  {
    code: "DAY2_AKKAI_NIGHT",
    label: "Day 2 — Akkai Night",
    summaryLabel: "Day 2 — Akkai Night",
    key: "day2AkkaiNight",
    downloadLabel: "Unduh Day 2 — Akkai Night",
    exportFilename: "AKKAI-2026-Day-2-Akkai-Night.xlsx",
  },
  {
    code: "DAY3",
    label: "Registrasi Kepulangan",
    summaryLabel: "DAY3",
    key: "day3",
    downloadLabel: "Unduh Registrasi Kepulangan — Day 3",
    exportFilename: "AKKAI-2026-Day-3-Registrasi-Kepulangan.xlsx",
  },
] as const;

export type AttendanceSessionCode = (typeof ATTENDANCE_SESSIONS)[number]["code"];
export type AttendanceSessionKey = (typeof ATTENDANCE_SESSIONS)[number]["key"];

export const ATTENDANCE_SESSION_CODES = ATTENDANCE_SESSIONS.map(
  (session) => session.code,
) as AttendanceSessionCode[];

export const ATTENDANCE_SESSION_KEY_BY_CODE = Object.fromEntries(
  ATTENDANCE_SESSIONS.map(({ code, key }) => [code, key]),
) as Record<AttendanceSessionCode, AttendanceSessionKey>;

export const SEPARATE_ATTENDANCE_EXPORT_CODES = ATTENDANCE_SESSION_CODES;

export type SeparateAttendanceExportCode = AttendanceSessionCode;

export function isAttendanceSessionCode(
  code: string | null | undefined,
): code is AttendanceSessionCode {
  return typeof code === "string" && ATTENDANCE_SESSION_CODES.includes(
    code as AttendanceSessionCode,
  );
}

export function isSeparateAttendanceExportCode(
  code: string | null,
): code is SeparateAttendanceExportCode {
  return code !== null && isAttendanceSessionCode(code);
}

export function getAttendanceSession(code: AttendanceSessionCode) {
  return ATTENDANCE_SESSIONS.find((session) => session.code === code)!;
}
