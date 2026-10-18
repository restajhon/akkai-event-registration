import * as XLSX from "@e965/xlsx";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AttendanceBoard } from "@/app/admin/(protected)/(admin-shell)/attendance/attendance-board";
import { ATTENDANCE_SESSIONS } from "@/lib/admin/attendance-sessions";
import { buildOperationalWorkbook } from "@/lib/admin/operational-workbook";
import type { OperationalParticipant } from "@/lib/admin/operational-data";
import { OPERATIONAL_SESSION_CODES } from "@/lib/admin/operational-sessions";

const participant: OperationalParticipant = {
  id: "participant-1",
  registrationId: "AKKAI26-000001",
  fullName: "Peserta Uji",
  packageType: "Single",
  registrationStatus: "REGISTERED",
  roomAssignment: null,
  travel: null,
  arrivalAssignment: null,
  departureAssignment: null,
  attendanceBySession: {
    ARRIVAL: { checkedIn: true, checkedInAt: null },
    DAY1_MEMBER_MEETING: { checkedIn: false, checkedInAt: null },
    SEMINAR: { checkedIn: true, checkedInAt: null },
    DAY2_AKKAI_NIGHT: { checkedIn: false, checkedInAt: null },
    DAY3: { checkedIn: true, checkedInAt: null },
  },
};

const sessionLabels = [
  "Arrival",
  "Day 1 — Rapat Anggota",
  "Seminar",
  "Day 2 — Akkai Night",
  "Day 3",
];

describe("attendance session columns", () => {
  it("keeps registration status first and renders each table value by session code", () => {
    const markup = renderToStaticMarkup(
      <AttendanceBoard canExportAttendance={false} participants={[participant]} />,
    );
    const tableStart = markup.indexOf("<table");
    const tableEnd = markup.indexOf("</table>", tableStart) + "</table>".length;
    const table = markup.slice(tableStart, tableEnd);
    const header = table.slice(table.indexOf("<thead"), table.indexOf("</thead>"));
    const headers = [...header.matchAll(/<th\b[^>]*>(.*?)<\/th>/g)].map((match) =>
      match[1].replace(/<[^>]*>/g, ""),
    );

    expect(headers).toEqual(["Status Registrasi", "Registration ID", "Nama", ...sessionLabels]);

    const body = table.slice(table.indexOf("<tbody"), table.indexOf("</tbody>"));
    const cells = [...body.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map((match) => match[1]);
    const sessionPresence = cells.slice(3).map((cell) =>
      cell.includes("Belum hadir") ? "Belum hadir" : "Hadir",
    );

    expect(cells[0]).toContain("ACTIVE");
    expect(sessionPresence).toEqual(["Hadir", "Belum hadir", "Hadir", "Belum hadir", "Hadir"]);
  });

  it("exports session attendance columns in the same order with values keyed by code", () => {
    const workbook = buildOperationalWorkbook([participant]);
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets.Kehadiran, { header: 1 }) as string[][];

    expect(rows[0]).toEqual([
      "Status Registrasi",
      "Registration ID",
      "Nama",
      ...OPERATIONAL_SESSION_CODES.flatMap((code) => [code, `${code} Check-in`]),
    ]);
    expect(rows[1]).toEqual([
      "ACTIVE",
      "AKKAI26-000001",
      "Peserta Uji",
      "Hadir",
      "",
      "Belum hadir",
      "",
      "Hadir",
      "",
      "Belum hadir",
      "",
      "Hadir",
      "",
    ]);
  });

  it("shows five session downloads alongside the combined workbook download", () => {
    const permitted = renderToStaticMarkup(
      <AttendanceBoard canExportAttendance participants={[participant]} />,
    );
    const restricted = renderToStaticMarkup(
      <AttendanceBoard canExportAttendance={false} participants={[participant]} />,
    );

    expect(permitted).toContain("Unduh workbook Excel");
    expect(permitted).toContain('href="/api/admin/operational-export"');
    for (const session of ATTENDANCE_SESSIONS) {
      expect(permitted).toContain(session.downloadLabel);
      expect(permitted).toContain(`download="${session.exportFilename}"`);
      expect(permitted).toContain(
        `href="/api/admin/attendance-export?sessionCode=${session.code}"`,
      );
    }
    expect(restricted).not.toContain("/api/admin/attendance-export");
    expect(restricted).not.toContain("/api/admin/operational-export");
  });
});
