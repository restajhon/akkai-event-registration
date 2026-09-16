import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const actions = readFileSync(resolve(process.cwd(), "src/app/admin/(protected)/(admin-shell)/participants/actions.ts"), "utf8");
const ticketRoute = readFileSync(resolve(process.cwd(), "src/app/api/admin/participants/[registrationId]/ticket/route.ts"), "utf8");

describe("participant identity workflow contract", () => {
  it("resends by Registration ID and participant ID, never by shared email", () => {
    expect(actions).toContain('.eq("registration_id", registrationId)');
    expect(actions).toContain("p_participant_id: participantRow.id");
    expect(actions).not.toContain('.eq("email", registrationId)');
  });

  it("keeps QR token server-side for ticket downloads", () => {
    expect(ticketRoute).toContain("loadParticipantTicketData(registrationId)");
    expect(ticketRoute).not.toContain("searchParams.get(\"qr_token\")");
    expect(ticketRoute).not.toContain("qr_token:");
  });
});
