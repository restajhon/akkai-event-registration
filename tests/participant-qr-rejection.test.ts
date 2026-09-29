import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorizePermission: vi.fn(),
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/auth/server", () => ({ authorizePermission: mocks.authorizePermission }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));

import { POST } from "@/app/admin/(protected)/(focused)/scanner/check-in/route";

describe("cancelled QR rejection", () => {
  it("returns the cancelled-participant result without creating attendance", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{
        status_code: "cancelled-participant",
        result_status: "CANCELLED_PARTICIPANT",
        registration_id: "AKKAI26-000001",
        full_name: "Peserta Batal",
        institution: "KKA",
        participant_category: "Tamu",
        session_code: "ARRIVAL",
        session_name: "Registrasi Kedatangan",
        checked_at: null,
        is_duplicate: false,
      }],
      error: null,
    });
    mocks.authorizePermission.mockResolvedValue({
      authorized: true,
      status: 200,
      profile: { id: "operator-1", role: "OPERATOR", is_active: true },
    });
    mocks.createAdminClient.mockReturnValue({ rpc });

    const response = await POST(new Request("http://localhost/admin/scanner/check-in", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        stationId: "00000000-0000-4000-8000-000000000001",
        qrValue: "cancelled-qr-token",
      }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "cancelled-participant",
      message: "Pendaftaran peserta telah dibatalkan.",
    });
    expect(rpc).toHaveBeenCalledWith("process_qr_scan", expect.objectContaining({
      p_qr_token: "cancelled-qr-token",
    }));
  });
});
