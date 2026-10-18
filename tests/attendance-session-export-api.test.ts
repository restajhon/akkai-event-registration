import * as XLSX from "@e965/xlsx";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  authorizePermission: vi.fn(),
  loadOperationalData: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/server", () => ({ authorizePermission: mocks.authorizePermission }));
vi.mock("@/lib/admin/operational-data", () => ({ loadOperationalData: mocks.loadOperationalData }));

import { GET } from "@/app/api/admin/attendance-export/route";
import { AttendanceBoard } from "@/app/admin/(protected)/(admin-shell)/attendance/attendance-board";
import type {
  OperationalAttendance,
  OperationalParticipant,
} from "@/lib/admin/operational-data";
import type { AttendanceSessionKey } from "@/lib/admin/attendance-sessions";
import { ATTENDANCE_SESSIONS } from "@/lib/admin/attendance-sessions";
import { buildOperationalWorkbook } from "@/lib/admin/operational-workbook";

const participant: OperationalParticipant = {
  id: "participant-1",
  registrationId: "AKKAI26-000001",
  fullName: "Peserta AKKAI",
  packageType: "Single",
  registrationStatus: "REGISTERED",
  roomAssignment: null,
  travel: null,
  arrivalAssignment: null,
  departureAssignment: null,
  arrival: { checkedIn: false, checkedInAt: null },
  seminar: { checkedIn: false, checkedInAt: null },
  day3: { checkedIn: false, checkedInAt: null },
  day1MemberMeeting: {
    checkedIn: true,
    checkedInAt: "2026-10-19T10:30:00+07:00",
  },
  day2AkkaiNight: {
    checkedIn: false,
    checkedInAt: null,
  },
};

beforeEach(() => {
  mocks.authorizePermission.mockReset();
  mocks.loadOperationalData.mockReset();
});

function makeSessionParticipant(
  session: (typeof ATTENDANCE_SESSIONS)[number],
  index: number,
): OperationalParticipant {
  const attendance: Record<AttendanceSessionKey, OperationalAttendance> = {
    arrival: { checkedIn: false, checkedInAt: null },
    seminar: { checkedIn: false, checkedInAt: null },
    day3: { checkedIn: false, checkedInAt: null },
    day1MemberMeeting: { checkedIn: false, checkedInAt: null },
    day2AkkaiNight: { checkedIn: false, checkedInAt: null },
  };

  attendance[session.key] = {
    checkedIn: true,
    checkedInAt: "2026-10-19T10:30:00+07:00",
  };

  return {
    ...participant,
    id: `participant-${index + 1}`,
    registrationId: `AKKAI26-${String(index + 1).padStart(6, "0")}`,
    fullName: `Peserta Sesi ${session.code}`,
    registrationStatus: session.code === "DAY2_AKKAI_NIGHT" ? "CANCELLED" : "REGISTERED",
    ...attendance,
  };
}

const sessionParticipants = ATTENDANCE_SESSIONS.map(makeSessionParticipant);
const expectedAttendanceOrder = [
  "ARRIVAL",
  "DAY1_MEMBER_MEETING",
  "SEMINAR",
  "DAY2_AKKAI_NIGHT",
  "DAY3",
] as const;

describe("separate attendance session exports", () => {
  it("keeps the combined workbook and board ordered across all five sessions", () => {
    const workbook = buildOperationalWorkbook([participant]);
    const attendanceSheet = workbook.Sheets.Kehadiran;
    const headers = XLSX.utils.sheet_to_json<string[]>(attendanceSheet, { header: 1 })[0];
    const sessionHeaders = ATTENDANCE_SESSIONS.flatMap(({ summaryLabel }) => [
      summaryLabel,
      `${summaryLabel} Check-in`,
    ]);

    expect(ATTENDANCE_SESSIONS.map(({ code }) => code)).toEqual(expectedAttendanceOrder);
    expect(headers).toEqual([
      "Registration ID",
      "Nama",
      "Status Registrasi",
      ...sessionHeaders,
    ]);
  });

  it("renders five separate session downloads and the combined workbook download", () => {
    const markup = renderToStaticMarkup(
      createElement(AttendanceBoard, {
        canExportAttendance: true,
        participants: [participant],
      }),
    );
    const sessionCodes = [...markup.matchAll(/href="\/api\/admin\/attendance-export\?sessionCode=([A-Z0-9_]+)"/g)]
      .map((match) => match[1]);

    expect(markup).toContain('href="/api/admin/operational-export"');
    expect(sessionCodes).toEqual(expectedAttendanceOrder);
  });

  it.each(ATTENDANCE_SESSIONS)("exports $code independently", async (session) => {
    mocks.authorizePermission.mockResolvedValue({
      profile: { id: "admin-1", role: "ADMIN", is_active: true },
      authorized: true,
      status: 200,
    });
    mocks.loadOperationalData.mockResolvedValue(sessionParticipants);

    const response = await GET(
      new Request(`http://localhost/api/admin/attendance-export?sessionCode=${session.code}`),
    );

    expect(mocks.authorizePermission).toHaveBeenCalledWith("attendance.export");
    expect(mocks.loadOperationalData).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain(session.exportFilename);

    const workbook = XLSX.read(await response.arrayBuffer(), { type: "array" });
    expect(workbook.SheetNames).toEqual(["Kehadiran"]);
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(
      workbook.Sheets.Kehadiran,
      { defval: "" },
    );

    expect(rows).toHaveLength(ATTENDANCE_SESSIONS.length);
    expect(Object.keys(rows[0])).toEqual([
      "Registration ID",
      "Nama",
      "Status Registrasi",
      session.label,
      `${session.label} Check-in`,
    ]);

    for (const [index, row] of rows.entries()) {
      const participantForSession = sessionParticipants[index];
      expect(row).toMatchObject({
        "Registration ID": participantForSession.registrationId,
        Nama: participantForSession.fullName,
        "Status Registrasi": participantForSession.registrationStatus === "REGISTERED" ? "ACTIVE" : "CANCELLED",
        [session.label]: index === ATTENDANCE_SESSIONS.indexOf(session) ? "Hadir" : "Belum hadir",
      });
      expect(Object.keys(row)).not.toContain(
        ATTENDANCE_SESSIONS.find(({ code }) => code !== session.code)?.label,
      );
    }

    const cancelledParticipantRow = rows.find(
      (row) => row["Status Registrasi"] === "CANCELLED",
    );
    expect(cancelledParticipantRow).toBeDefined();
    expect(cancelledParticipantRow?.[session.label]).toBe(
      session.code === "DAY2_AKKAI_NIGHT" ? "Hadir" : "Belum hadir",
    );
  });

  it.each(ATTENDANCE_SESSIONS.flatMap(({ code }) => [
    { code, status: 401 as const },
    { code, status: 403 as const },
  ]))("requires attendance.export for $code before loading data (HTTP $status)", async ({ code, status }) => {
    mocks.authorizePermission.mockResolvedValue({
      profile: null,
      authorized: false,
      status,
    });

    const response = await GET(
      new Request(`http://localhost/api/admin/attendance-export?sessionCode=${code}`),
    );

    expect(response.status).toBe(status);
    expect(mocks.authorizePermission).toHaveBeenCalledWith("attendance.export");
    expect(mocks.loadOperationalData).not.toHaveBeenCalled();
  });

  it("rejects unknown-code requests instead of broadening the export", async () => {
    mocks.authorizePermission.mockResolvedValue({
      profile: { id: "admin-1", role: "ADMIN", email: "admin@example.com", full_name: "Admin", is_active: true },
      authorized: true,
      status: 200,
    });

    const response = await GET(
      new Request("http://localhost/api/admin/attendance-export?sessionCode=UNKNOWN"),
    );

    expect(response.status).toBe(400);
    expect(mocks.loadOperationalData).not.toHaveBeenCalled();
  });
});
