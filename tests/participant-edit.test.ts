import { describe, expect, it } from "vitest";

import { participantEditDataSchema } from "@/lib/validation/participant-edit";

function validEdit() {
  return {
    registrationId: "AKKAI26-000001",
    emailGeneration: "0",
    full_name: "Peserta AKKAI",
    email: "peserta@example.com",
    phone_number: "081234567890",
    member_number: "",
    institution: "",
    position: "Konsultan",
    kka_name: "KKA Maju",
    package_type: "Twin Share",
    participation_scope: "Seluruh acara",
    polo_size: "L",
    polo_model: "Lengan Panjang",
    actuarial_consultant_status: "Penerima Grandfathering CIAC",
    attends_pai_congress: "true",
    outbound_date: "",
    outbound_time: "",
    outbound_transport_mode: "",
    outbound_transport_number: "",
    outbound_origin: "",
    outbound_destination: "",
    return_date: "",
    return_time: "",
    return_transport_mode: "",
    return_transport_number: "",
    return_destination: "",
    extend_stay: "false",
  };
}

describe("participant edit validation", () => {
  it("allows optional participant and travel fields to remain empty", () => {
    expect(participantEditDataSchema.safeParse(validEdit()).success).toBe(true);
  });

  it("requires a complete travel record when any travel field is supplied", () => {
    const result = participantEditDataSchema.safeParse({ ...validEdit(), outbound_date: "2026-10-19" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.some((issue) => issue.path[0] === "return_date")).toBe(true);
  });

  it("keeps the system identifier fields out of the editable contract", () => {
    expect(Object.keys(validEdit())).not.toContain("qr_token");
    expect(Object.keys(validEdit())).not.toContain("billing_number");
    expect(Object.keys(validEdit())).not.toContain("participant_id");
  });
});
