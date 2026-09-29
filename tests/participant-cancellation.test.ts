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
import { canChangeRegistrationStatus } from "@/lib/admin/participant-ui";

const registeredId = "AKKAI26-000001";
const restorePermissionMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260923090000_restrict_participant_registration_restore.sql",
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
  it("shows cancellation and restore actions only to SUPER_ADMIN", () => {
    expect(canChangeRegistrationStatus("ADMIN")).toBe(false);
    expect(canChangeRegistrationStatus("SUPER_ADMIN")).toBe(true);
    expect(canChangeRegistrationStatus("OPERATOR")).toBe(false);
  });

  it("allows SUPER_ADMIN to cancel one participant with an exact ID confirmation and reason", async () => {
    mocks.getAuthorizedProfile.mockResolvedValue({ id: "super-admin-1", role: "SUPER_ADMIN", is_active: true });
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
    expect(rpc).toHaveBeenCalledWith("set_participant_registration_status", {
      p_registration_id: registeredId,
      p_target_status: "CANCELLED",
      p_changed_by: "super-admin-1",
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

  it.each([
    { id: "admin-1", role: "ADMIN" as const },
    { id: "operator-1", role: "OPERATOR" as const },
  ])("rejects $role cancellation", async ({ id, role }) => {
    mocks.getAuthorizedProfile.mockResolvedValue({ id, role, is_active: true });

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

  it("rejects ADMIN restore before calling the status RPC", async () => {
    mocks.getAuthorizedProfile.mockResolvedValue({ id: "admin-1", role: "ADMIN", is_active: true });

    const result = await restoreParticipantRegistration(
      { status: "idle", message: null },
      formData({ registrationId: registeredId }),
    );

    expect(result.status).toBe("error");
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("enforces restore authorization and keeps the audit log in the database RPC", () => {
    expect(restorePermissionMigration).toContain(
      "OR v_actor_role <> 'SUPER_ADMIN'::public.user_role",
    );
    expect(restorePermissionMigration).toContain(
      "INSERT INTO public.participant_registration_status_changes",
    );
    expect(restorePermissionMigration).toContain("TO service_role;");
    expect(restorePermissionMigration).toContain("FROM PUBLIC, anon, authenticated;");
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
