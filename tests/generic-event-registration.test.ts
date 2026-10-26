import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createAdminClient: vi.fn(), loadPublishedEventFormById: vi.fn(), rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/tenant/public-events", () => ({ loadPublishedEventFormById: mocks.loadPublishedEventFormById, loadPublishedEventForm: vi.fn() }));

import { submitGenericRegistration } from "@/app/register/actions";
import { defaultEventForm } from "@/lib/forms/default-event-form";
import { initialRegistrationState } from "@/lib/registration/registration-action-state";

const eventId = "00000000-0000-4000-8000-00000000000a";
const versionId = "00000000-0000-4000-8000-00000000000b";

function form(answers: unknown) {
  const data = new FormData();
  data.set("event_id", eventId);
  data.set("form_version_id", versionId);
  data.set("registration_idempotency_key", crypto.randomUUID());
  data.set("form_answers", JSON.stringify(answers));
  return data;
}

describe("generic event registration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadPublishedEventFormById.mockResolvedValue({
      eventId, versionId, eventSlug: "event-b", config: defaultEventForm("Event B"),
    });
    mocks.createAdminClient.mockReturnValue({ rpc: mocks.rpc });
    mocks.rpc.mockResolvedValue({ data: [{ result_code: "SUBMITTED", submission_id: "submission-b" }], error: null });
  });

  it("submits versioned answers to the selected event without the AKKAI billing RPC", async () => {
    const result = await submitGenericRegistration(initialRegistrationState, form({ full_name: "Ayu", email: "ayu@example.com" }));
    expect(result).toMatchObject({ status: "submitted", registrationId: "submission-b" });
    expect(mocks.createAdminClient).toHaveBeenCalledWith({ scope: "public-event", eventId });
    expect(mocks.rpc).toHaveBeenCalledWith("submit_public_registration_form", expect.objectContaining({
      p_event_id: eventId, p_form_version_id: versionId, p_answers: { full_name: "Ayu", email: "ayu@example.com" },
    }));
  });

  it("rejects missing required answers and an unavailable version before using the privileged client", async () => {
    expect((await submitGenericRegistration(initialRegistrationState, form({ full_name: "Ayu" }))).status).toBe("validation-error");
    mocks.loadPublishedEventFormById.mockResolvedValue(null);
    expect((await submitGenericRegistration(initialRegistrationState, form({ full_name: "Ayu", email: "ayu@example.com" }))).status).toBe("general-error");
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });
});
