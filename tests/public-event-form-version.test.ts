import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

import {
  loadPublishedEventForm,
  loadPublishedEventFormById,
} from "@/lib/tenant/public-events";
import { AKKAI_DEFAULT_REGISTRATION_FORM } from "@/lib/forms/akkai-default-form";

const EVENT_ID = "00000000-0000-4000-8000-00000000000a";
const VERSION_ID = "00000000-0000-4000-8000-00000000000b";

function queryReturning(data: unknown) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
  };
  return query;
}

describe("published event form version lookup", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
    mocks.rpc.mockReset();
    mocks.from.mockReset();
    const eventQuery = queryReturning({
      id: EVENT_ID,
      company_id: "00000000-0000-4000-8000-00000000000c",
      slug: "event-a",
      event_code: "EVTA",
      name: "Event A",
      starts_on: null,
      ends_on: null,
      registration_open: true,
    });
    const versionQuery = queryReturning({
      id: VERSION_ID,
      version_number: 1,
      config: AKKAI_DEFAULT_REGISTRATION_FORM,
    });
    mocks.from.mockImplementation((table: string) => table === "events" ? eventQuery : versionQuery);
    mocks.createClient.mockResolvedValue({ from: mocks.from, rpc: mocks.rpc });
  });

  it("rejects an older form version before reading its config", async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });

    await expect(loadPublishedEventFormById(EVENT_ID, VERSION_ID)).resolves.toBeNull();

    expect(mocks.rpc).toHaveBeenCalledWith(
      "is_current_published_registration_form_version",
      { p_event_id: EVENT_ID, p_version_id: VERSION_ID },
    );
    expect(mocks.from).toHaveBeenCalledTimes(1);
  });

  it("loads the config only after the database confirms the version is current", async () => {
    mocks.rpc.mockResolvedValue({ data: true, error: null });

    const result = await loadPublishedEventFormById(EVENT_ID, VERSION_ID);

    expect(result?.versionId).toBe(VERSION_ID);
    expect(mocks.from).toHaveBeenCalledTimes(2);
  });

  it("rejects the latest queried version unless it matches the event's published pointer", async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });

    await expect(loadPublishedEventForm("event-a")).resolves.toBeNull();

    expect(mocks.rpc).toHaveBeenCalledWith(
      "is_current_published_registration_form_version",
      { p_event_id: EVENT_ID, p_version_id: VERSION_ID },
    );
  });
});
