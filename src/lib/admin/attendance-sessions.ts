export const ATTENDANCE_SESSIONS = [
  {
    code: "ARRIVAL",
    label: "Registrasi Kedatangan",
    summaryLabel: "ARRIVAL",
    key: "arrival",
  },
  {
    code: "SEMINAR",
    label: "Seminar AKKAI 2026",
    summaryLabel: "SEMINAR",
    key: "seminar",
  },
  {
    code: "DAY3",
    label: "Registrasi Kepulangan",
    summaryLabel: "DAY3",
    key: "day3",
  },
  {
    code: "DAY1_MEMBER_MEETING",
    label: "Day 1 — Rapat Anggota",
    summaryLabel: "Day 1 — Rapat Anggota",
    key: "day1MemberMeeting",
  },
  {
    code: "DAY2_AKKAI_NIGHT",
    label: "Day 2 — Akkai Night",
    summaryLabel: "Day 2 — Akkai Night",
    key: "day2AkkaiNight",
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

export const SEPARATE_ATTENDANCE_EXPORT_CODES = [
  "DAY1_MEMBER_MEETING",
  "DAY2_AKKAI_NIGHT",
] as const;

export type SeparateAttendanceExportCode =
  (typeof SEPARATE_ATTENDANCE_EXPORT_CODES)[number];

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
  return code !== null && (SEPARATE_ATTENDANCE_EXPORT_CODES as readonly string[]).includes(code);
}

export function getAttendanceSession(code: AttendanceSessionCode) {
  return ATTENDANCE_SESSIONS.find((session) => session.code === code)!;
}
