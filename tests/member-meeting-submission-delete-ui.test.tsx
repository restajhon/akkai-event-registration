import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/admin/(protected)/(admin-shell)/member-meetings/actions", () => ({
  deleteMemberMeetingSubmission: vi.fn(),
}));

import { MemberMeetingSubmissionDelete } from "@/app/admin/(protected)/(admin-shell)/member-meetings/member-meeting-submission-delete";

describe("member meeting submission deletion confirmation", () => {
  it("shows the delete action and presents row identity in its confirmation dialog", () => {
    const markup = renderToStaticMarkup(
      <MemberMeetingSubmissionDelete
        submissionId="00000000-0000-4000-8000-000000000001"
        name="Pemimpin KKA"
        consultingFirm="Kantor Aktuaria"
        createdAt="2 Januari 2026 pukul 08.00"
      />,
    );
    const source = readFileSync(
      "src/app/admin/(protected)/(admin-shell)/member-meetings/member-meeting-submission-delete.tsx",
      "utf8",
    );

    expect(markup).toContain("Hapus submission");
    expect(source).toContain("{name}");
    expect(source).toContain("{consultingFirm}");
    expect(source).toContain("{createdAt}");
    expect(source).toContain("Data peserta global");
  });
});
