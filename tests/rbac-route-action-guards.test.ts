import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorizePermission: vi.fn(),
  createAdminClient: vi.fn(),
  getAuthorizedProfile: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/server", () => ({
  authorizePermission: mocks.authorizePermission,
  getAuthorizedProfile: mocks.getAuthorizedProfile,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

vi.mock("@/lib/stations/pairing", () => ({
  createPairingCredentials: vi.fn(),
  verifyPairingCode: vi.fn(),
}));

import { updateProfileAccess } from "@/app/admin/(protected)/(admin-shell)/access/actions";
import { createStation } from "@/app/admin/(protected)/(admin-shell)/display/setup/actions";
import { pairStation } from "@/app/admin/(protected)/(admin-shell)/scanner/pair/actions";
import { correctParticipantEmail, updateParticipantData, updateRegistrationBillingPaymentStatus } from "@/app/admin/(protected)/(admin-shell)/participants/actions";
import { POST as scannerCheckIn } from "@/app/admin/(protected)/(focused)/scanner/check-in/route";
import { GET as privateCertificate } from "@/app/api/admin/participants/[registrationId]/certificate/route";
import { hasPermission } from "@/lib/auth/permissions";

beforeEach(() => {
  mocks.authorizePermission.mockReset();
  mocks.createAdminClient.mockReset();
  mocks.getAuthorizedProfile.mockReset();
});

describe("RBAC route and action guards", () => {
  it("rejects ADMIN from the access-management action", async () => {
    mocks.getAuthorizedProfile.mockImplementation(async (permission: string) => {
      expect(permission).toBe("access.manage");
      return null;
    });

    const formData = new FormData();
    formData.set("profileId", "00000000-0000-4000-8000-000000000001");
    formData.set("role", "ADMIN");
    formData.set("isActive", "true");

    await expect(
      updateProfileAccess(
        { status: "idle", message: null },
        formData,
      ),
    ).resolves.toMatchObject({ status: "error" });
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("rejects OPERATIONAL from display and scanner actions", async () => {
    mocks.getAuthorizedProfile.mockResolvedValue(null);

    const stationForm = new FormData();
    stationForm.set("stationName", "Scanner Station");
    stationForm.set("sessionId", "00000000-0000-4000-8000-000000000001");

    const pairingForm = new FormData();
    pairingForm.set("stationId", "00000000-0000-4000-8000-000000000001");
    pairingForm.set("pairingCode", "123456");

    await expect(
      createStation(
        { status: "idle", message: null },
        stationForm,
      ),
    ).resolves.toMatchObject({ status: "error" });
    await expect(
      pairStation(
        { status: "idle", message: null },
        pairingForm,
      ),
    ).resolves.toMatchObject({ status: "error" });

    expect(mocks.getAuthorizedProfile).toHaveBeenNthCalledWith(1, "display.manage");
    expect(mocks.getAuthorizedProfile).toHaveBeenNthCalledWith(2, "scanner.pair");
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("rejects OPERATIONAL from the scanner check-in API", async () => {
    mocks.authorizePermission.mockResolvedValue({
      profile: {
        id: "profile-1",
        full_name: "Operational",
        email: "operational@example.com",
        role: "OPERATIONAL",
        is_active: true,
      },
      authorized: false,
      status: 403,
    });

    const response = await scannerCheckIn(
      new Request("http://localhost/admin/scanner/check-in", {
        body: JSON.stringify({
          stationId: "00000000-0000-4000-8000-000000000001",
          qrValue: "qr-token",
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );

    expect(mocks.authorizePermission).toHaveBeenCalledWith("scanner.checkin");
    expect(response.status).toBe(403);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("uses existing participant management permission for payment status", async () => {
    mocks.getAuthorizedProfile.mockResolvedValue(null);

    const formData = new FormData();
    formData.set("billingId", "00000000-0000-4000-8000-000000000001");
    formData.set("registrationId", "AKKAI26-000001");
    formData.set("paymentStatus", "PAID");

    await expect(
      updateRegistrationBillingPaymentStatus(
        { status: "idle", message: null },
        formData,
      ),
    ).resolves.toMatchObject({ status: "error" });
    expect(mocks.getAuthorizedProfile).toHaveBeenCalledWith("participants.manage");
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it.each(["ADMIN", "OPERATIONAL"] as const)("rejects %s participant edits before database access", async (role) => {
    mocks.getAuthorizedProfile.mockImplementation(async (permission: string) =>
      permission === "participants.edit" && hasPermission(role, "participants.edit")
        ? { id: `${role.toLowerCase()}-1`, full_name: role, email: "user@example.com", role, is_active: true }
        : null,
    );
    const formData = new FormData();
    formData.set("registrationId", "AKKAI26-000001");

    await expect(updateParticipantData({ status: "idle", message: null }, formData)).resolves.toMatchObject({ status: "error" });
    expect(mocks.getAuthorizedProfile).toHaveBeenCalledWith("participants.edit");
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("rejects direct participant-edit requests without a verified session before database access", async () => {
    mocks.getAuthorizedProfile.mockResolvedValue(null);
    const formData = new FormData();
    formData.set("registrationId", "AKKAI26-000001");
    formData.set("actorId", "00000000-0000-4000-8000-000000000001");

    await expect(updateParticipantData({ status: "idle", message: null }, formData)).resolves.toMatchObject({ status: "error" });
    expect(mocks.getAuthorizedProfile).toHaveBeenCalledWith("participants.edit");
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("rejects direct participant-email edits for users without participant edit permission", async () => {
    mocks.getAuthorizedProfile.mockResolvedValue(null);
    await expect(correctParticipantEmail({ status: "idle", message: null }, new FormData())).resolves.toMatchObject({ status: "error" });
    expect(mocks.getAuthorizedProfile).toHaveBeenCalledWith("participants.edit");
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("updates editable fields through the protected participant RPC for SUPER_ADMIN", async () => {
    mocks.getAuthorizedProfile.mockResolvedValue({ id: "super-admin-1", full_name: "Super Admin", email: "admin@example.com", role: "SUPER_ADMIN", is_active: true });
    const rpc = vi.fn().mockResolvedValue({ data: [{ result_code: "UPDATED", billing_amount: 7_000_000 }], error: null });
    const participantQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: "participant-1", email: "old@example.com", email_generation: 0 }, error: null }),
    };
    mocks.createAdminClient.mockReturnValue({ from: vi.fn().mockReturnValue(participantQuery), rpc });
    const formData = new FormData();
    for (const [key, value] of Object.entries({
      registrationId: "AKKAI26-000001", actorId: "00000000-0000-4000-8000-000000000001", emailGeneration: "0", full_name: "Peserta Diperbarui",
      email: "old@example.com", phone_number: "081234567890", member_number: "", institution: "",
      position: "Konsultan", kka_name: "KKA Maju", package_type: "Single",
      participation_scope: "Seluruh acara", polo_size: "L", polo_model: "Lengan Panjang",
      actuarial_consultant_status: "Penerima Grandfathering CIAC", attends_pai_congress: "true",
      extend_stay: "false",
    })) formData.set(key, value);

    await expect(updateParticipantData({ status: "idle", message: null }, formData)).resolves.toMatchObject({ status: "success" });
    expect(mocks.getAuthorizedProfile).toHaveBeenCalledWith("participants.edit");
    expect(rpc).toHaveBeenCalledWith("update_participant_data", expect.objectContaining({
      p_actor_id: "super-admin-1",
      p_package_type: "Single",
      p_participant_id: "participant-1",
    }));
  });

  it("allows an existing participant manager to update payment status", async () => {
    mocks.getAuthorizedProfile.mockResolvedValue({
      id: "admin-1",
      full_name: "Admin",
      email: "admin@example.com",
      role: "ADMIN",
      is_active: true,
    });
    const rpc = vi.fn().mockResolvedValue({ data: [{ result_code: "UPDATED" }], error: null });
    mocks.createAdminClient.mockReturnValue({ rpc });

    const formData = new FormData();
    formData.set("billingId", "00000000-0000-4000-8000-000000000001");
    formData.set("registrationId", "AKKAI26-000001");
    formData.set("paymentStatus", "PAID");

    await expect(
      updateRegistrationBillingPaymentStatus(
        { status: "idle", message: null },
        formData,
      ),
    ).resolves.toMatchObject({ status: "success" });
    expect(rpc).toHaveBeenCalledWith("set_registration_billing_payment_status", {
      p_billing_id: "00000000-0000-4000-8000-000000000001",
      p_payment_status: "PAID",
      p_paid_by: "admin-1",
    });
  });

  it("rejects unauthorized private certificate access", async () => {
    mocks.authorizePermission.mockResolvedValue({
      profile: null,
      authorized: false,
      status: 401,
    });

    const response = await privateCertificate(
      new Request("http://localhost/api/admin/participants/AKKAI26-000001/certificate"),
      { params: Promise.resolve({ registrationId: "AKKAI26-000001" }) },
    );

    expect(response.status).toBe(401);
    expect(mocks.authorizePermission).toHaveBeenCalledWith("participants.view");
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });
});
