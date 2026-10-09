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
import type { OperationalParticipant } from "@/lib/admin/operational-data";
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

describe("separate attendance session exports", () => {
  it("keeps existing attendance workbook columns and adds both new sessions", () => {
    const workbook = buildOperationalWorkbook([participant]);
    const attendanceSheet = workbook.Sheets.Kehadiran;
    const headers = XLSX.utils.sheet_to_json<string[]>(attendanceSheet, { header: 1 })[0];

    expect(headers).toEqual(expect.arrayContaining([
      "ARRIVAL",
      "SEMINAR",
      "DAY3",
      "Day 1 — Rapat Anggota",
      "Day 2 — Akkai Night",
    ]));
  });

  it.each([
    {
      code: "DAY1_MEMBER_MEETING",
      label: "Day 1 — Rapat Anggota",
      checkIn: "Hadir",
      filename: "AKKAI-2026-Day-1-Rapat-Anggota.xlsx",
      otherLabel: "Day 2 — Akkai Night",
    },
    {
      code: "DAY2_AKKAI_NIGHT",
      label: "Day 2 — Akkai Night",
      checkIn: "Belum hadir",
      filename: "AKKAI-2026-Day-2-Akkai-Night.xlsx",
      otherLabel: "Day 1 — Rapat Anggota",
    },
  ])("exports $label independently", async ({ code, label, checkIn, filename, otherLabel }) => {
    mocks.authorizePermission.mockResolvedValue({
      profile: { id: "admin-1", role: "ADMIN", is_active: true },
      authorized: true,
      status: 200,
    });
    mocks.loadOperationalData.mockResolvedValue([participant]);

    const response = await GET(
      new Request(`http://localhost/api/admin/attendance-export?sessionCode=${code}`),
    );

    expect(mocks.authorizePermission).toHaveBeenCalledWith("attendance.export");
    expect(mocks.loadOperationalData).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain(filename);

    const workbook = XLSX.read(await response.arrayBuffer(), { type: "array" });
    expect(workbook.SheetNames).toEqual(["Kehadiran"]);
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(
      workbook.Sheets.Kehadiran,
      { defval: "" },
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      "Registration ID": "AKKAI26-000001",
      Nama: "Peserta AKKAI",
      [label]: checkIn,
    });
    expect(Object.keys(rows[0])).not.toContain(otherLabel);
  });

  it.each([
    { status: 401 as const },
    { status: 403 as const },
  ])("requires attendance.export before loading data (HTTP $status)", async ({ status }) => {
    mocks.authorizePermission.mockResolvedValue({
      profile: null,
      authorized: false,
      status,
    });

    const response = await GET(
      new Request("http://localhost/api/admin/attendance-export?sessionCode=DAY1_MEMBER_MEETING"),
    );

    expect(response.status).toBe(status);
    expect(mocks.authorizePermission).toHaveBeenCalledWith("attendance.export");
    expect(mocks.loadOperationalData).not.toHaveBeenCalled();
  });

  it("rejects all-session and unknown-code requests instead of broadening the export", async () => {
    mocks.authorizePermission.mockResolvedValue({
      profile: { id: "admin-1", role: "ADMIN", email: "admin@example.com", full_name: "Admin", is_active: true },
      authorized: true,
      status: 200,
    });

    const response = await GET(
      new Request("http://localhost/api/admin/attendance-export?sessionCode=ARRIVAL"),
    );

    expect(response.status).toBe(400);
    expect(mocks.loadOperationalData).not.toHaveBeenCalled();
  });
});
