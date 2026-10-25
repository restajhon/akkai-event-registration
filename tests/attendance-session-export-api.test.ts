import * as XLSX from "@e965/xlsx";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorizePermission: vi.fn(),
  loadOperationalData: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/server", () => ({ authorizePermission: mocks.authorizePermission }));
vi.mock("@/lib/admin/operational-data", () => ({ loadOperationalData: mocks.loadOperationalData }));

import { GET } from "@/app/api/admin/attendance-export/route";
import { ATTENDANCE_SESSIONS } from "@/lib/admin/attendance-sessions";
import type { OperationalParticipant } from "@/lib/admin/operational-data";
import { OPERATIONAL_SESSION_CODES } from "@/lib/admin/operational-sessions";

const checkInTime = "2026-10-19T10:30:00+07:00";

function makeParticipant(checkedInCode: (typeof OPERATIONAL_SESSION_CODES)[number], index: number): OperationalParticipant {
  const attendanceBySession = Object.fromEntries(
    OPERATIONAL_SESSION_CODES.map((code) => [
      code,
      {
        checkedIn: code === checkedInCode,
        checkedInAt: code === checkedInCode ? checkInTime : null,
      },
    ]),
  ) as OperationalParticipant["attendanceBySession"];

  return {
    id: `participant-${index + 1}`,
    registrationId: `AKKAI26-${String(index + 1).padStart(6, "0")}`,
    fullName: `Peserta ${checkedInCode}`,
    packageType: "Single",
    registrationStatus: checkedInCode === "DAY2_AKKAI_NIGHT" ? "CANCELLED" : "REGISTERED",
    roomAssignment: null,
    travel: null,
    arrivalAssignment: null,
    departureAssignment: null,
    attendanceBySession,
    formAnswers: [],
  };
}

const participants = OPERATIONAL_SESSION_CODES.map(makeParticipant);

beforeEach(() => {
  mocks.authorizePermission.mockReset();
  mocks.loadOperationalData.mockReset();
});

describe("separate attendance session exports", () => {
  it.each(ATTENDANCE_SESSIONS)("exports only $code attendance mapped by session code", async (session) => {
    mocks.authorizePermission.mockResolvedValue({
      profile: { id: "admin-1", role: "ADMIN", is_active: true },
      authorized: true,
      status: 200,
    });
    mocks.loadOperationalData.mockResolvedValue(participants);

    const response = await GET(
      new Request(`http://localhost/api/admin/attendance-export?sessionCode=${session.code}`),
    );

    expect(mocks.authorizePermission).toHaveBeenCalledWith("attendance.export");
    expect(mocks.loadOperationalData).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain(session.exportFilename);
    expect(response.headers.get("content-type")).toContain(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );

    const workbook = XLSX.read(await response.arrayBuffer(), { type: "array" });
    expect(workbook.SheetNames).toEqual(["Kehadiran", "Jawaban Tambahan"]);
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(
      workbook.Sheets.Kehadiran,
      { defval: "" },
    );
    const checkedInIndex = OPERATIONAL_SESSION_CODES.indexOf(session.code);

    expect(rows).toHaveLength(participants.length);
    expect(Object.keys(rows[0])).toEqual([
      "Registration ID",
      "Nama",
      "Status Registrasi",
      session.exportLabel,
      `${session.exportLabel} Check-in`,
    ]);

    rows.forEach((row, index) => {
      const participant = participants[index];
      const isCheckedIn = index === checkedInIndex;

      expect(row).toMatchObject({
        "Registration ID": participant.registrationId,
        Nama: participant.fullName,
        "Status Registrasi": participant.registrationStatus === "REGISTERED" ? "ACTIVE" : "CANCELLED",
        [session.exportLabel]: isCheckedIn ? "Hadir" : "Belum hadir",
      });
      if (isCheckedIn) {
        expect(row[`${session.exportLabel} Check-in`]).not.toBe("");
      } else {
        expect(row[`${session.exportLabel} Check-in`]).toBe("");
      }
    });
  });

  it("requires attendance.export before loading participant data", async () => {
    mocks.authorizePermission.mockResolvedValue({
      profile: null,
      authorized: false,
      status: 403,
    });

    const response = await GET(
      new Request("http://localhost/api/admin/attendance-export?sessionCode=ARRIVAL"),
    );

    expect(response.status).toBe(403);
    expect(mocks.authorizePermission).toHaveBeenCalledWith("attendance.export");
    expect(mocks.loadOperationalData).not.toHaveBeenCalled();
  });

  it("rejects unknown session codes instead of broadening the export", async () => {
    mocks.authorizePermission.mockResolvedValue({
      profile: { id: "admin-1", role: "ADMIN", is_active: true },
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
