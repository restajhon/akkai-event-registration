import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  activeTenant: vi.fn(),
  globalProfile: vi.fn(),
  isPublishedEvent: vi.fn(),
  authorizePermission: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/tenant/server-context", () => ({
  resolveActiveTenantContext: mocks.activeTenant,
  resolveGlobalAdminProfileId: mocks.globalProfile,
}));
vi.mock("@/lib/tenant/public-events", () => ({
  isPublishedRegistrationEvent: mocks.isPublishedEvent,
}));
vi.mock("@/lib/auth/server", () => ({
  authorizePermission: mocks.authorizePermission,
}));

const EVENT_A = "00000000-0000-4000-8000-00000000000a";
const EVENT_B = "00000000-0000-4000-8000-00000000000b";
const PROFILE_A = "00000000-0000-4000-8000-0000000000a1";

describe("service-role tenant fence", () => {
  let createAdminClient: typeof import("@/lib/supabase/admin").createAdminClient;
  let requests: URL[];

  beforeAll(async () => {
    vi.stubGlobal("fetch", mocks.fetch);
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://tenant-test.supabase.co";
    process.env.SUPABASE_SECRET_KEY = "service-role-test-key";
    ({ createAdminClient } = await import("@/lib/supabase/admin"));
  });

  beforeEach(() => {
    requests = [];
    mocks.globalProfile.mockReset().mockResolvedValue(null);
    mocks.isPublishedEvent.mockReset().mockResolvedValue(true);
    mocks.authorizePermission.mockReset().mockResolvedValue({
      authorized: true,
      status: 200,
      profile: { id: PROFILE_A, role: "ADMIN", is_active: true, activeEventId: EVENT_A },
    });
    mocks.activeTenant.mockResolvedValue({
      id: EVENT_A,
      companyId: "00000000-0000-4000-8000-0000000000c1",
      companyName: "Company A",
      companySlug: "company-a",
      eventName: "Event A",
      eventSlug: "event-a",
      eventCode: "EVTA",
      role: "ADMIN",
      profileId: PROFILE_A,
    });
    mocks.fetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      requests.push(url);
      if (url.pathname.endsWith("/participants") && url.searchParams.get("registration_id") === "eq.EVTA-000001") {
        return Response.json([{ event_id: EVENT_A }]);
      }
      return Response.json([]);
    });
  });

  it.each([
    ["API participant lookup", "participants"],
    ["export participant billing", "registration_billings"],
    ["attendance", "attendance"],
    ["scanner", "scanner_stations"],
    ["room assignment", "participant_room_assignments"],
    ["pickup assignment", "participant_pickup_assignments"],
    ["registration form answers", "registration_form_submissions"],
  ])("forces %s queries into the active event", async (_label, table) => {
    const supabase = createAdminClient();
    const result = await supabase.from(table).select("id").eq("event_id", EVENT_B);

    expect(result.error).toBeNull();
    expect(requests).toHaveLength(1);
    expect(requests[0].searchParams.get("event_id")).toBe(`eq.${EVENT_A}`);
  });

  it("allows an RPC only after its target row is confirmed in the active event", async () => {
    const supabase = createAdminClient();
    const result = await supabase.rpc("set_participant_registration_status", {
      p_registration_id: "EVTA-000001",
      p_target_status: "CANCELLED",
      p_changed_by: PROFILE_A,
      p_cancellation_reason: "Test",
    });

    expect(result.error).toBeNull();
    expect(requests).toHaveLength(2);
    expect(requests[0].pathname).toBe("/rest/v1/participants");
    expect(requests[0].searchParams.get("event_id")).toBe(`eq.${EVENT_A}`);
    expect(requests[1].pathname).toBe("/rest/v1/rpc/set_participant_registration_status");
  });

  it("rejects cross-event insert data before calling Supabase", async () => {
    const supabase = createAdminClient();
    const result = await supabase.from("participants").insert({
      event_id: EVENT_B,
      full_name: "Attempted cross-tenant participant",
    });

    expect(result.error).not.toBeNull();
    expect(requests).toHaveLength(0);
  });

  it("does not allow a tenant-scoped service client to modify global profiles", async () => {
    const supabase = createAdminClient();
    const result = await supabase.from("profiles").update({ role: "SUPER_ADMIN" }).eq("id", PROFILE_A);

    expect(result.error).not.toBeNull();
    expect(requests).toHaveLength(0);
  });

  it.each([
    ["billing", "set_registration_billing_payment_status", { p_billing_id: "billing-b", p_paid_by: PROFILE_A }],
    ["attendance scanner", "process_qr_scan", { p_station_id: "station-b", p_operator_profile_id: PROFILE_A }],
    ["manual scanner", "process_manual_check_in", { p_station_id: "station-b", p_operator_profile_id: PROFILE_A }],
    ["room", "upsert_participant_room_assignment", { p_registration_id: "EVTB-000001", p_updated_by: PROFILE_A }],
    ["pickup", "upsert_participant_pickup_assignment", { p_registration_id: "EVTB-000001", p_updated_by: PROFILE_A }],
  ])("rejects cross-event %s RPC targets", async (_label, rpc, args) => {
    const supabase = createAdminClient();
    const result = await supabase.rpc(rpc, args);

    expect(result.error).not.toBeNull();
    expect(requests.some((url) => url.pathname.endsWith(`/rpc/${rpc}`))).toBe(false);
    expect(requests.every((url) => url.searchParams.get("event_id") === `eq.${EVENT_A}`)).toBe(true);
  });

  it("rejects a cross-tenant RPC name outside the authorization allowlist", async () => {
    const supabase = createAdminClient();
    const result = await supabase.rpc("unreviewed_tenant_rpc", {});

    expect(result.error).not.toBeNull();
    expect(requests).toHaveLength(0);
  });

  it("keeps global company/event management exclusive to verified Super Admin scope", async () => {
    mocks.globalProfile.mockResolvedValue(PROFILE_A);
    const supabase = createAdminClient({ scope: "global" });
    const result = await supabase.rpc("create_company_with_event", { p_actor_id: PROFILE_A });

    expect(result.error).toBeNull();
    expect(requests[0].pathname).toBe("/rest/v1/rpc/create_company_with_event");
  });

  it("binds global tenant-management RPC actors to the current Super Admin", async () => {
    mocks.globalProfile.mockResolvedValue(PROFILE_A);
    const supabase = createAdminClient({ scope: "global" });
    const result = await supabase.rpc("create_company_with_event", { p_actor_id: EVENT_B });

    expect(result.error).not.toBeNull();
    expect(requests).toHaveLength(0);
  });

  it("rejects a public server-action submission that substitutes another event ID", async () => {
    mocks.isPublishedEvent.mockResolvedValue(true);
    const supabase = createAdminClient({ scope: "public-event", eventId: EVENT_A });
    const result = await supabase.rpc("create_participant_with_registration_reservation_v7", {
      p_event_id: EVENT_B,
      p_form_version_id: "00000000-0000-4000-8000-00000000000c",
      p_answers: {},
    });

    expect(result.error).not.toBeNull();
    expect(requests).toHaveLength(0);
  });

  it("rejects a collective registration RPC with an upload intent outside its event", async () => {
    const supabase = createAdminClient({ scope: "public-event", eventId: EVENT_B });
    const result = await supabase.rpc("create_participant_with_registration_reservation_v8", {
      p_event_id: EVENT_B,
      p_form_version_id: "00000000-0000-4000-8000-00000000000c",
      p_certificate_upload_intent_id: "00000000-0000-4000-8000-00000000000d",
      p_answers: {},
    });

    expect(result.error).not.toBeNull();
    expect(requests).toHaveLength(1);
    expect(requests[0].pathname).toBe("/rest/v1/registration_certificate_upload_intents");
    expect(requests[0].searchParams.get("event_id")).toBe(`eq.${EVENT_B}`);
    expect(requests[0].searchParams.get("id")).toBe("eq.00000000-0000-4000-8000-00000000000d");
    expect(requests.some((url) => url.pathname.endsWith("/rpc/create_participant_with_registration_reservation_v8"))).toBe(false);
  });

  it("limits closed-event upload cleanup to CLEANING intents in the selected event", async () => {
    const supabase = createAdminClient({ scope: "public-event-cleanup", eventId: EVENT_A });
    const result = await supabase
      .from("registration_certificate_upload_intents")
      .delete()
      .eq("id", "00000000-0000-4000-8000-00000000000d")
      .eq("status", "CLEANING");

    expect(result.error).toBeNull();
    expect(requests).toHaveLength(1);
    expect(requests[0].pathname).toBe("/rest/v1/registration_certificate_upload_intents");
    expect(requests[0].searchParams.get("event_id")).toBe(`eq.${EVENT_A}`);
    expect(requests[0].searchParams.get("status")).toBe("eq.CLEANING");
  });

  it("does not allow the cleanup client to directly delete a still-pending intent", async () => {
    const supabase = createAdminClient({ scope: "public-event-cleanup", eventId: EVENT_A });
    const result = await supabase
      .from("registration_certificate_upload_intents")
      .delete()
      .eq("id", "00000000-0000-4000-8000-00000000000d")
      .eq("status", "PENDING");

    expect(result.error).not.toBeNull();
    expect(requests).toHaveLength(0);
  });

  it("allows cleanup storage removal only while the matching-event intent is CLEANING", async () => {
    mocks.fetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      requests.push(url);
      if (url.pathname.endsWith("/registration_certificate_upload_intents")) {
        return Response.json([{ event_id: EVENT_A, status: "CLEANING" }]);
      }
      return Response.json([]);
    });
    const supabase = createAdminClient({ scope: "public-event-cleanup", eventId: EVENT_A });
    const result = await supabase.storage
      .from("registration-certificates")
      .remove(["certificates/00000000-0000-4000-8000-00000000000e.pdf"]);

    expect(result.error).toBeNull();
    expect(requests).toHaveLength(2);
    expect(requests[0].searchParams.get("event_id")).toBe(`eq.${EVENT_A}`);
    expect(requests[0].searchParams.get("status")).toBe("eq.CLEANING");
    expect(requests[1].pathname).toBe("/storage/v1/object/registration-certificates");
  });

  it("rejects cleanup storage removal for a CLEANING intent from another event", async () => {
    mocks.fetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      requests.push(url);
      return Response.json([{ event_id: EVENT_B, status: "CLEANING" }]);
    });
    const supabase = createAdminClient({ scope: "public-event-cleanup", eventId: EVENT_A });
    const result = await supabase.storage
      .from("registration-certificates")
      .remove(["certificates/foreign.pdf"]);

    expect(result.error).not.toBeNull();
    expect(requests).toHaveLength(1);
    expect(requests[0].searchParams.get("event_id")).toBe(`eq.${EVENT_A}`);
    expect(requests.some((url) => url.pathname.startsWith("/storage/v1/object/"))).toBe(false);
  });

  it("keeps the participant export loader inside the selected membership event", async () => {
    const { loadParticipantExportRows } = await import("@/lib/admin/revision-export-data");
    await expect(loadParticipantExportRows()).resolves.toEqual([]);

    expect(requests.length).toBeGreaterThan(0);
    expect(requests.every((url) => url.searchParams.get("event_id") === `eq.${EVENT_A}`)).toBe(true);
  });

  it("keeps the authenticated participant export API inside company A", async () => {
    const { GET } = await import("@/app/api/admin/participant-export/route");
    const response = await GET(new Request("http://localhost/api/admin/participant-export?registrationStatus=all"));

    expect(response.status).toBe(200);
    expect(mocks.authorizePermission).toHaveBeenCalledWith("participants.export");
    expect(requests.length).toBeGreaterThan(0);
    expect(requests.every((url) => url.searchParams.get("event_id") === `eq.${EVENT_A}`)).toBe(true);
  });
});
