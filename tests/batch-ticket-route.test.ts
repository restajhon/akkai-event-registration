import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorizePermission: vi.fn(),
  createAdminClient: vi.fn(),
  loadParticipantTicketData: vi.fn(),
  generateParticipantQrPng: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/server", () => ({ authorizePermission: mocks.authorizePermission }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/registration/participant-ticket-data", () => ({ loadParticipantTicketData: mocks.loadParticipantTicketData }));
vi.mock("@/lib/qr/participant-qr", () => ({ generateParticipantQrPng: mocks.generateParticipantQrPng }));

import { GET } from "@/app/api/admin/batches/[batchCode]/tickets/route";

describe("batch ticket route authorization", () => {
  it("rejects unauthenticated batch downloads before reading batch data", async () => {
    mocks.authorizePermission.mockResolvedValue({ authorized: false, status: 401, profile: null });
    const response = await GET(
      new Request("http://localhost/api/admin/batches/BATCH-ABCDEFGHIJ/tickets"),
      { params: Promise.resolve({ batchCode: "BATCH-ABCDEFGHIJ" }) },
    );

    expect(response.status).toBe(401);
    expect(mocks.authorizePermission).toHaveBeenCalledWith("participants.view");
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("puts actual QR PNG files in a batch archive", async () => {
    mocks.authorizePermission.mockResolvedValue({ authorized: true, status: 200, profile: { role: "ADMIN" } });
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "registration_batches") {
          return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: { id: "batch-1" }, error: null }) };
        }
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockResolvedValue({ data: [{ registration_id: "AKKAI26-000001" }], error: null }) };
      }),
    });
    mocks.loadParticipantTicketData.mockResolvedValue({ registrationId: "AKKAI26-000001", fullName: "Peserta Satu", qrToken: "qr-token" });
    mocks.generateParticipantQrPng.mockResolvedValue(Buffer.from("PNG-QR"));

    const response = await GET(
      new Request("http://localhost/api/admin/batches/BATCH-ABCDEFGHIJ/tickets"),
      { params: Promise.resolve({ batchCode: "BATCH-ABCDEFGHIJ" }) },
    );
    const archive = Buffer.from(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/zip");
    expect(archive.includes(Buffer.from("AKKAI26-000001_Peserta_Satu_QR.png"))).toBe(true);
    expect(mocks.generateParticipantQrPng).toHaveBeenCalledWith("qr-token");
  });
});
