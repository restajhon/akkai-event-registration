import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadMemberMeetingSubmission: vi.fn(),
  loadMemberMeetingSubmissions: vi.fn(),
  notFound: vi.fn(),
  requirePermission: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/server", () => ({
  requirePermission: mocks.requirePermission,
}));

vi.mock("@/lib/member-meeting/admin-data", () => ({
  loadMemberMeetingSubmission: mocks.loadMemberMeetingSubmission,
  loadMemberMeetingSubmissions: mocks.loadMemberMeetingSubmissions,
}));

vi.mock("next/link", () => ({ default: "a" }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));

import MemberMeetingDetailPage from "@/app/admin/(protected)/(admin-shell)/member-meetings/[id]/page";
import MemberMeetingsPage from "@/app/admin/(protected)/(admin-shell)/member-meetings/page";

const operationalProfile = {
  id: "profile-operational",
  full_name: "Operational",
  email: "operational@example.com",
  role: "OPERATIONAL" as const,
  is_active: true,
};

const adminProfile = {
  id: "profile-admin",
  full_name: "Admin",
  email: "admin@example.com",
  role: "ADMIN" as const,
  is_active: true,
};

const submission = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Pemimpin KKA",
  consulting_firm: "Kantor Konsultan Aktuaria",
  position: "Direktur",
  phone: "081234567890",
  email: "pemimpin@example.com",
  attendance_type: "PROXY" as const,
  proxy_name: "Penerima Kuasa",
  proxy_position: "Komisaris",
  authorization_file_path: "submissions/authorization.pdf",
  authorization_file_name: "surat-kuasa.pdf",
  authorization_file_mime: "application/pdf",
  authorization_file_size: 1024,
  created_at: "2026-01-02T01:04:05.000Z",
  updated_at: "2026-01-02T01:04:05.000Z",
};

beforeEach(() => {
  mocks.loadMemberMeetingSubmission.mockReset();
  mocks.loadMemberMeetingSubmissions.mockReset();
  mocks.notFound.mockReset();
  mocks.requirePermission.mockReset();
});

describe("member meeting page guards", () => {
  it("allows OPERATIONAL to view the list without showing export", async () => {
    mocks.requirePermission.mockResolvedValue(operationalProfile);
    mocks.loadMemberMeetingSubmissions.mockResolvedValue([submission]);

    const markup = renderToStaticMarkup(await MemberMeetingsPage());

    expect(mocks.requirePermission).toHaveBeenCalledWith("member_meetings.view");
    expect(markup).toContain("Pemimpin KKA");
    expect(markup).not.toContain("/api/admin/member-meetings-export");
  });

  it("allows OPERATIONAL to view detail without showing file download", async () => {
    mocks.requirePermission.mockResolvedValue(operationalProfile);
    mocks.loadMemberMeetingSubmission.mockResolvedValue(submission);

    const markup = renderToStaticMarkup(
      await MemberMeetingDetailPage({
        params: Promise.resolve({ id: submission.id }),
      }),
    );

    expect(mocks.requirePermission).toHaveBeenCalledWith("member_meetings.view");
    expect(markup).toContain("surat-kuasa.pdf");
    expect(markup).not.toContain(
      "/api/admin/member-meetings/00000000-0000-4000-8000-000000000001/authorization",
    );
  });

  it("keeps export and file download visible for ADMIN", async () => {
    mocks.requirePermission.mockResolvedValue(adminProfile);
    mocks.loadMemberMeetingSubmissions.mockResolvedValue([]);
    mocks.loadMemberMeetingSubmission.mockResolvedValue(submission);

    const listMarkup = renderToStaticMarkup(await MemberMeetingsPage());
    const detailMarkup = renderToStaticMarkup(
      await MemberMeetingDetailPage({
        params: Promise.resolve({ id: submission.id }),
      }),
    );

    expect(listMarkup).toContain("/api/admin/member-meetings-export");
    expect(detailMarkup).toContain(
      "/api/admin/member-meetings/00000000-0000-4000-8000-000000000001/authorization",
    );
  });
});
