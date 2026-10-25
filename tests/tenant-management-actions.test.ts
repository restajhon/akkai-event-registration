import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthorizedProfile: vi.fn(),
  createAdminClient: vi.fn(),
  rpc: vi.fn(),
  redirect: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/server", () => ({ getAuthorizedProfile: mocks.getAuthorizedProfile }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import {
  createCompanyWithEvent,
  createEventForCompany,
  upsertCompanyMembership,
} from "@/app/admin/(protected)/(admin-shell)/tenants/actions";

const actorId = "00000000-0000-4000-8000-000000000001";

beforeEach(() => {
  mocks.getAuthorizedProfile.mockReset();
  mocks.createAdminClient.mockReset();
  mocks.rpc.mockReset().mockResolvedValue({ data: "result-id", error: null });
  mocks.redirect.mockReset().mockImplementation((href: string) => { throw new Error(`REDIRECT:${href}`); });
  mocks.revalidatePath.mockReset();
  mocks.getAuthorizedProfile.mockResolvedValue({ id: actorId, role: "SUPER_ADMIN", is_active: true });
  mocks.createAdminClient.mockReturnValue({ rpc: mocks.rpc });
});

describe("global tenant management actions", () => {
  it("creates a company and its first event only in Super Admin global scope", async () => {
    const formData = new FormData();
    formData.set("companySlug", "new-company");
    formData.set("companyName", "New Company");
    formData.set("eventSlug", "new-event-2027");
    formData.set("eventCode", "EVT27");
    formData.set("eventName", "New Company Summit");

    await expect(createCompanyWithEvent(formData)).rejects.toThrow("REDIRECT:/admin/tenants?success=");
    expect(mocks.createAdminClient).toHaveBeenCalledWith({ scope: "global" });
    expect(mocks.rpc).toHaveBeenCalledWith("create_company_with_event", expect.objectContaining({
      p_actor_id: actorId,
      p_company_slug: "new-company",
      p_event_code: "EVT27",
    }));
  });

  it("creates additional events and upserts company roles", async () => {
    const eventData = new FormData();
    eventData.set("companyId", "00000000-0000-4000-8000-000000000002");
    eventData.set("eventSlug", "second-event");
    eventData.set("eventCode", "EVT28");
    eventData.set("eventName", "Second Event");
    await expect(createEventForCompany(eventData)).rejects.toThrow("REDIRECT:/admin/tenants?success=");
    expect(mocks.rpc).toHaveBeenCalledWith("create_event_for_company", expect.objectContaining({
      p_actor_id: actorId,
      p_company_id: "00000000-0000-4000-8000-000000000002",
    }));

    mocks.rpc.mockClear();
    const membershipData = new FormData();
    membershipData.set("profileId", "00000000-0000-4000-8000-000000000003");
    membershipData.set("companyId", "00000000-0000-4000-8000-000000000002");
    membershipData.set("role", "OPERATIONAL");
    membershipData.set("isActive", "true");
    await expect(upsertCompanyMembership(membershipData)).rejects.toThrow("REDIRECT:/admin/tenants?success=");
    expect(mocks.rpc).toHaveBeenCalledWith("upsert_company_membership", expect.objectContaining({
      p_actor_id: actorId,
      p_profile_id: "00000000-0000-4000-8000-000000000003",
      p_role: "OPERATIONAL",
    }));
  });

  it("blocks non-Super-Admin changes to global tenants and memberships", async () => {
    mocks.getAuthorizedProfile.mockResolvedValue({ id: actorId, role: "ADMIN", is_active: true });
    const formData = new FormData();
    await expect(createCompanyWithEvent(formData)).rejects.toThrow("REDIRECT:/admin/unauthorized");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
