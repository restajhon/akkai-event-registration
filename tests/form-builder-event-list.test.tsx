import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(), listAccessibleEvents: vi.fn(), createAdminClient: vi.fn(), createClient: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/server", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/lib/tenant/server-context", () => ({ listAccessibleEvents: mocks.listAccessibleEvents }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/app/admin/tenant-actions", () => ({ selectActiveEvent: vi.fn() }));
vi.mock("@/app/admin/(protected)/(admin-shell)/forms/actions", () => ({
  saveRegistrationFormDraft: vi.fn(), publishRegistrationFormDraft: vi.fn(), setEventRegistrationOpen: vi.fn(),
}));

import RegistrationFormBuilderPage from "@/app/admin/(protected)/(admin-shell)/forms/page";
import { defaultEventForm } from "@/lib/forms/default-event-form";

it("lists only manageable events with separate form and registration statuses and uses the active slug", async () => {
  mocks.requirePermission.mockResolvedValue({ activeEventId: "event-b", activeEventRegistrationOpen: false });
  mocks.listAccessibleEvents.mockResolvedValue([
    { id: "event-a", eventName: "Event A", eventSlug: "event-a", companyName: "Perusahaan A", role: "ADMIN", registrationOpen: true },
    { id: "event-b", eventName: "Event B", eventSlug: "event-b", companyName: "Perusahaan B", role: "ADMIN", registrationOpen: false },
    { id: "event-secret", eventName: "Rahasia", eventSlug: "secret", companyName: "C", role: "OPERATOR", registrationOpen: false },
  ]);
  function query(data: unknown) {
    const chain = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data, error: null }) };
    chain.select.mockReturnValue(chain);
    chain.eq.mockReturnValue(chain);
    return chain;
  }
  mocks.createAdminClient.mockReturnValue({ from: vi.fn((table: string) => table === "registration_forms"
    ? query({ draft_config: defaultEventForm("Event B"), published_version_id: "version-b" })
    : query({ version_number: 3, config: defaultEventForm("Event B") })) });
  mocks.createClient.mockResolvedValue({ from: vi.fn(() => ({
    select: vi.fn(() => ({ in: vi.fn().mockResolvedValue({ data: [
      { event_id: "event-a", published_version_id: null },
      { event_id: "event-b", published_version_id: "version-b" },
    ], error: null }) })),
  })) });

  const html = renderToStaticMarkup(await RegistrationFormBuilderPage());
  expect(html).toContain("Event A");
  expect(html).toContain("Event B");
  expect(html).not.toContain("Rahasia");
  expect(html).toContain("Form: Draft · Pendaftaran: Buka");
  expect(html).toContain("Form: Terbit · Pendaftaran: Tutup");
  expect(html).toContain("/events/event-b/register");
  expect(html).not.toContain("/events/event-a/register");
  expect(mocks.requirePermission).toHaveBeenCalledWith("forms.manage");
});
