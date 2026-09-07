import { beforeEach, describe, expect, it, vi } from "vitest";
import * as XLSX from "@e965/xlsx";

const mocks = vi.hoisted(() => ({
  getCurrentUserProfile: vi.fn(),
  loadMemberMeetingSubmissions: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/server", () => ({
  getCurrentUserProfile: mocks.getCurrentUserProfile,
}));

vi.mock("@/lib/member-meeting/admin-data", () => ({
  loadMemberMeetingSubmissions: mocks.loadMemberMeetingSubmissions,
}));

import { GET } from "@/app/api/admin/member-meetings-export/route";

const headers = [
  "Nama",
  "Kantor Konsultan Aktuaria",
  "Jabatan",
  "No. HP",
  "Alamat Email",
  "Status Kehadiran",
  "Nama Penerima Kuasa",
  "Jabatan Penerima Kuasa",
  "Nama File Surat Kuasa",
  "Ukuran File Surat Kuasa",
  "Tanggal Pendaftaran",
];

const submissions = [
  {
    id: "submission-self",
    name: "Pemimpin Self",
    consulting_firm: "Kantor Self",
    position: "Direktur",
    phone: "081234567890",
    email: "self@example.com",
    attendance_type: "SELF" as const,
    proxy_name: null,
    proxy_position: null,
    authorization_file_path: null,
    authorization_file_name: null,
    authorization_file_mime: null,
    authorization_file_size: null,
    created_at: "2026-01-02T01:04:05.000Z",
    updated_at: "2026-01-02T01:04:05.000Z",
  },
  {
    id: "submission-proxy",
    name: "Pemimpin Proxy",
    consulting_firm: "Kantor Proxy",
    position: "Komisaris",
    phone: "081111111111",
    email: "proxy@example.com",
    attendance_type: "PROXY" as const,
    proxy_name: "Penerima Kuasa",
    proxy_position: "Manajer",
    authorization_file_path: "submissions/private-file.pdf",
    authorization_file_name: "surat-kuasa.pdf",
    authorization_file_mime: "application/pdf",
    authorization_file_size: 2048,
    created_at: "2026-01-03T01:04:05.000Z",
    updated_at: "2026-01-03T01:04:05.000Z",
  },
];

function readRows(response: Response) {
  return response.arrayBuffer().then((body) => {
    const workbook = XLSX.read(body, { type: "array" });
    return XLSX.utils.sheet_to_json(workbook.Sheets["Rapat Anggota"], {
      header: 1,
    }) as unknown[][];
  });
}

beforeEach(() => {
  mocks.getCurrentUserProfile.mockReset();
  mocks.loadMemberMeetingSubmissions.mockReset();
});

describe("member meeting Excel export API", () => {
  it("rejects unauthenticated export requests", async () => {
    mocks.getCurrentUserProfile.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(mocks.loadMemberMeetingSubmissions).not.toHaveBeenCalled();
  });

  it("rejects users without the member meeting access role", async () => {
    mocks.getCurrentUserProfile.mockResolvedValue({
      id: "profile-1",
      full_name: "Operational",
      email: "operational@example.com",
      role: "OPERATIONAL",
      is_active: true,
    });

    const response = await GET();

    expect(response.status).toBe(403);
    expect(mocks.loadMemberMeetingSubmissions).not.toHaveBeenCalled();
  });

  it("returns an xlsx with safe headers and SELF/PROXY metadata mapping", async () => {
    mocks.getCurrentUserProfile.mockResolvedValue({
      id: "profile-1",
      full_name: "Admin",
      email: "admin@example.com",
      role: "ADMIN",
      is_active: true,
    });
    mocks.loadMemberMeetingSubmissions.mockResolvedValue(submissions);

    const response = await GET();
    const rows = await readRows(response);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Content-Disposition")).toMatch(
      /^attachment; filename="rapat-anggota-akkai-2026-\d{4}-\d{2}-\d{2}\.xlsx"$/,
    );
    expect(rows[0]).toEqual(headers);
    expect(rows[1]?.slice(0, 10)).toEqual([
      "Pemimpin Self",
      "Kantor Self",
      "Direktur",
      "081234567890",
      "self@example.com",
      "Hadir Sendiri",
      "Tidak ada",
      "Tidak ada",
      "Tidak ada",
      "Tidak ada",
    ]);
    expect(rows[2]?.slice(0, 10)).toEqual([
      "Pemimpin Proxy",
      "Kantor Proxy",
      "Komisaris",
      "081111111111",
      "proxy@example.com",
      "Diwakilkan",
      "Penerima Kuasa",
      "Manajer",
      "surat-kuasa.pdf",
      "2048 bytes",
    ]);
    expect(JSON.stringify(rows)).not.toContain("submissions/private-file.pdf");
    expect(JSON.stringify(rows)).not.toContain("application/pdf");
    expect(mocks.loadMemberMeetingSubmissions).toHaveBeenCalledOnce();
  });

  it("returns a valid header-only workbook for empty data without mutation", async () => {
    mocks.getCurrentUserProfile.mockResolvedValue({
      id: "profile-1",
      full_name: "Super Admin",
      email: "super-admin@example.com",
      role: "SUPER_ADMIN",
      is_active: true,
    });
    mocks.loadMemberMeetingSubmissions.mockResolvedValue([]);

    const response = await GET();
    const rows = await readRows(response);

    expect(response.status).toBe(200);
    expect(rows).toEqual([headers]);
    expect(mocks.loadMemberMeetingSubmissions).toHaveBeenCalledOnce();
  });
});
