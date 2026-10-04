import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { getMemberMeetingSubmissionCounts } from "@/lib/member-meeting/metrics";

describe("active Rapat Anggota submissions", () => {
  it("uses cancelled_at null for counts, list queries, and Excel rows", () => {
    const adminData = readFileSync("src/lib/member-meeting/admin-data.ts", "utf8");
    const workbook = readFileSync("src/lib/member-meeting/member-meeting-workbook.ts", "utf8");
    expect(adminData).toContain('.is("cancelled_at", null)');
    expect(workbook).toContain("submission.cancelled_at === null");

    const rows = [
      { attendance_type: "SELF" as const, cancelled_at: null },
      { attendance_type: "PROXY" as const, cancelled_at: null },
      { attendance_type: "PROXY" as const, cancelled_at: "2026-10-02T00:00:00Z" },
    ];
    expect(getMemberMeetingSubmissionCounts(rows)).toEqual({ total: 2, self: 1, proxy: 1 });
  });

  it("does not make Rapat Anggota admin data dependent on global participants", () => {
    const adminData = readFileSync("src/lib/member-meeting/admin-data.ts", "utf8");
    const listPage = readFileSync(
      "src/app/admin/(protected)/(admin-shell)/member-meetings/page.tsx",
      "utf8",
    );
    expect(adminData).not.toContain('.from("participants")');
    expect(adminData).not.toContain('.from("member_meeting_participants")');
    expect(listPage).not.toContain("loadMemberMeetingParticipants");
  });
});
