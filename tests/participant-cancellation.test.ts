import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthorizedProfile: vi.fn(),
  createAdminClient: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/server", () => ({ getAuthorizedProfile: mocks.getAuthorizedProfile }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));

import {
  cancelParticipantRegistration,
  restoreParticipantRegistration,
} from "@/app/admin/(protected)/(admin-shell)/participants/actions";
import { loadParticipantTicketData } from "@/lib/registration/participant-ticket-data";
import {
  canChangeRegistrationStatus,
  canRestoreParticipantRegistration,
} from "@/lib/admin/participant-ui";

const registeredId = "AKKAI26-000001";
const cancellationPermissionMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260929110000_allow_operational_participant_cancellation.sql",
  ),
  "utf8",
);

function formData(values: Record<string, string>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(values)) form.set(key, value);
  return form;
}

beforeEach(() => {
  mocks.getAuthorizedProfile.mockReset();
  mocks.createAdminClient.mockReset();
});

describe("participant cancellation", () => {
  it("shows cancellation for SUPER_ADMIN, ADMIN, and OPERATIONAL; restore only for SUPER_ADMIN", () => {
    expect(canChangeRegistrationStatus("ADMIN")).toBe(true);
    expect(canChangeRegistrationStatus("SUPER_ADMIN")).toBe(true);
    expect(canChangeRegistrationStatus("OPERATIONAL")).toBe(true);
    expect(canChangeRegistrationStatus("OPERATOR")).toBe(false);
    expect(canRestoreParticipantRegistration("SUPER_ADMIN")).toBe(true);
    expect(canRestoreParticipantRegistration("ADMIN")).toBe(false);
    expect(canRestoreParticipantRegistration("OPERATIONAL")).toBe(false);
    expect(canRestoreParticipantRegistration("OPERATOR")).toBe(false);
  });

  it.each([
    { id: "super-admin-1", role: "SUPER_ADMIN" as const },
    { id: "admin-1", role: "ADMIN" as const },
    { id: "gita-1", role: "OPERATIONAL" as const },
  ])("allows $role to cancel with an exact ID confirmation and required reason", async ({ id, role }) => {
    mocks.getAuthorizedProfile.mockResolvedValue({ id, role, is_active: true });
    const rpc = vi.fn().mockResolvedValue({ data: [{ result_code: "UPDATED" }], error: null });
    mocks.createAdminClient.mockReturnValue({ rpc });

    const result = await cancelParticipantRegistration(
      { status: "idle", message: null },
      formData({
        registrationId: registeredId,
        registrationIdConfirmation: registeredId,
        cancellationReason: "Peserta mengajukan pembatalan.",
      }),
    );

    expect(result.status).toBe("success");
    expect(mocks.getAuthorizedProfile).toHaveBeenCalledWith("participants.cancel");
    expect(rpc).toHaveBeenCalledWith("set_participant_registration_status", {
      p_registration_id: registeredId,
      p_target_status: "CANCELLED",
      p_changed_by: id,
      p_cancellation_reason: "Peserta mengajukan pembatalan.",
    });
  });

  it("restores a cancelled participant without deleting its history", async () => {
    mocks.getAuthorizedProfile.mockResolvedValue({ id: "super-admin-1", role: "SUPER_ADMIN", is_active: true });
    const rpc = vi.fn().mockResolvedValue({ data: [{ result_code: "UPDATED" }], error: null });
    mocks.createAdminClient.mockReturnValue({ rpc });

    const result = await restoreParticipantRegistration(
      { status: "idle", message: null },
      formData({ registrationId: registeredId }),
    );

    expect(result.status).toBe("success");
    expect(rpc).toHaveBeenCalledWith("set_participant_registration_status", {
      p_registration_id: registeredId,
      p_target_status: "REGISTERED",
      p_changed_by: "super-admin-1",
      p_cancellation_reason: null,
    });
  });

  it("rejects OPERATOR cancellation", async () => {
    const id = "operator-1";
    mocks.getAuthorizedProfile.mockResolvedValue({ id, role: "OPERATOR", is_active: true });

    const result = await cancelParticipantRegistration(
      { status: "idle", message: null },
      formData({
        registrationId: registeredId,
        registrationIdConfirmation: registeredId,
        cancellationReason: "Tidak lagi hadir.",
      }),
    );

    expect(result.status).toBe("error");
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it.each([
    { id: "admin-1", role: "ADMIN" as const },
    { id: "operator-1", role: "OPERATOR" as const },
    { id: "operational-1", role: "OPERATIONAL" as const },
  ])("rejects $role restore before calling the status RPC", async ({ id, role }) => {
    mocks.getAuthorizedProfile.mockResolvedValue({ id, role, is_active: true });

    const result = await restoreParticipantRegistration(
      { status: "idle", message: null },
      formData({ registrationId: registeredId }),
    );

    expect(result.status).toBe("error");
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("enforces cancellation and restore roles and keeps the audit log in the RPC", () => {
    expect(cancellationPermissionMigration).toContain("'OPERATIONAL'::public.user_role");
    expect(cancellationPermissionMigration).not.toContain("'OPERATOR'::public.user_role");
    expect(cancellationPermissionMigration).toContain("v_actor_role <> 'SUPER_ADMIN'::public.user_role");
    expect(cancellationPermissionMigration).toContain(
      "INSERT INTO public.participant_registration_status_changes",
    );
    expect(cancellationPermissionMigration).toContain("TO service_role;");
    expect(cancellationPermissionMigration).toContain("FROM PUBLIC, anon, authenticated;");
  });

  it("rejects cancelled ticket data before reading billing history", async () => {
    const participantQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: "participant-1",
          registration_id: registeredId,
          full_name: "Peserta Batal",
          registration_status: "CANCELLED",
        },
        error: null,
      }),
    };
    const from = vi.fn().mockReturnValue(participantQuery);
    mocks.createAdminClient.mockReturnValue({ from });

    await expect(loadParticipantTicketData(registeredId)).resolves.toBeNull();
    expect(from).toHaveBeenCalledWith("participants");
    expect(from).not.toHaveBeenCalledWith("registration_billings");
  });
});
