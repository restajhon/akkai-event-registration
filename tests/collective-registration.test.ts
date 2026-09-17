import { beforeEach, describe, expect, it, vi } from "vitest";

import { getRegistrationPackagePrice } from "@/lib/billing/pricing";
import {
  collectiveRegistrationPayloadSchema,
  collectiveParticipantSchema,
} from "@/lib/validation/registration";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  generateParticipantQrPng: vi.fn(),
  sendRegistrationEmail: vi.fn(),
  sendBillingEmail: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/qr/participant-qr", () => ({ generateParticipantQrPng: mocks.generateParticipantQrPng }));
vi.mock("@/lib/email/registration-email", () => ({ sendRegistrationEmail: mocks.sendRegistrationEmail }));
vi.mock("@/lib/email/billing-email", () => ({ sendBillingEmail: mocks.sendBillingEmail }));

import { submitCollectiveRegistration } from "@/app/register/actions";

function participant(index: number, packageType = index % 2 === 0 ? "Twin Share" : "Single") {
  return {
    full_name: `Peserta Kolektif ${index}`,
    email: `peserta-${index}@example.com`,
    phone_number: `0812345678${String(index).padStart(2, "0")}`,
    kka_name: "KKA Maju",
    position: "Konsultan",
    polo_size: "L",
    polo_model: "Lengan Panjang",
    package_type: packageType,
    participation_scope: "Seluruh acara",
    actuarial_consultant_status: "Penerima Grandfathering CIAC",
    attends_pai_congress: "true",
    privacy_consent: true,
    certificate_upload_id: "",
    member_number: "",
    institution: "",
    include_travel: false,
    travel: null,
  };
}

describe("collective registration contract", () => {
  it("validates five independent cards, allows duplicate emails, and preserves package pricing", () => {
    const cards = Array.from({ length: 5 }, (_, index) => participant(index + 1));
    cards[1].email = cards[0].email;
    const parsed = collectiveRegistrationPayloadSchema.safeParse({
      idempotency_key: "00000000-0000-4000-8000-000000000001",
      participants: cards,
    });

    expect(parsed.success).toBe(true);
    expect(getRegistrationPackagePrice("Twin Share")).toBe(6_000_000);
    expect(getRegistrationPackagePrice("Single")).toBe(7_000_000);
    expect(collectiveParticipantSchema.safeParse(cards[0]).success).toBe(true);
  });

  it("rejects a card with missing required data before submission", () => {
    const result = collectiveParticipantSchema.safeParse({ ...participant(1), full_name: "" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.some((issue) => issue.path[0] === "full_name")).toBe(true);
  });
});

describe("collective registration delivery isolation", () => {
  beforeEach(() => {
    mocks.createAdminClient.mockReset();
    mocks.generateParticipantQrPng.mockResolvedValue(Buffer.from("qr"));
    mocks.sendRegistrationEmail.mockImplementation(async ({ recipientEmail }: { recipientEmail: string }) =>
      recipientEmail === "peserta-1@example.com"
        ? { success: false, errorCategory: "PROVIDER_ERROR", errorMessage: "provider failed", diagnostic: { message: "provider failed" } }
        : { success: true, providerMessageId: `registration-${recipientEmail}` },
    );
    mocks.sendBillingEmail.mockResolvedValue({ success: true, providerMessageId: "billing" });

    const reservations = Array.from({ length: 5 }, (_, index) => {
      const item = participant(index + 1);
      return {
        result_code: "CREATED",
        participant_id: `participant-${index + 1}`,
        registration_id: `AKKAI26-00000${index + 1}`,
        full_name: item.full_name,
        email: item.email,
        qr_token: String.fromCharCode(97 + index).repeat(64),
        email_log_id: `email-log-${index + 1}`,
        email_generation: 0,
        billing_id: `billing-${index + 1}`,
        billing_number: `INV-AKKAI26-00000${index + 1}`,
        billing_amount: index % 2 === 0 ? 6_000_000 : 7_000_000,
        billing_created_at: "2026-09-08T00:00:00.000Z",
      };
    });
    let reservationIndex = 0;
    const rpc = vi.fn().mockImplementation(async (name: string) => {
      if (name === "create_participant_with_registration_reservation_v6") {
        return { data: reservations[reservationIndex++], error: null };
      }
      return { data: [{ result_code: "CURRENT_GENERATION" }], error: null };
    });
    const from = vi.fn().mockImplementation((table: string) => {
      let selectedId = "";
      const query = {
        upsert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockImplementation((_column: string, value: string) => {
          selectedId = value;
          return query;
        }),
        single: vi.fn().mockResolvedValue(table === "registration_batches" ? { data: { id: "batch-1", batch_code: "BATCH-ABCDEFGHIJ" }, error: null } : { data: null, error: null }),
        maybeSingle: vi.fn().mockImplementation(async () => {
          if (table === "email_logs") {
            const index = Number(selectedId.split("-").pop()) - 1;
            return { data: { participant_id: `participant-${index + 1}`, recipient_email: `peserta-${index + 1}@example.com`, email_generation: 0, status: "PENDING" }, error: null };
          }
          return { data: { status: "PENDING" }, error: null };
        }),
      };
      return query;
    });
    mocks.createAdminClient.mockReturnValue({ rpc, from });
  });

  it("keeps all five participants independent when one registration email fails", async () => {
    const formData = new FormData();
    formData.set("payload", JSON.stringify({
      idempotency_key: "00000000-0000-4000-8000-000000000002",
      participants: Array.from({ length: 5 }, (_, index) => participant(index + 1)),
    }));

    const result = await submitCollectiveRegistration({ status: "idle", fieldErrors: [], participants: [] }, formData);
    expect(result.status).toBe("submitted");
    expect(result.batchCode).toBe("BATCH-ABCDEFGHIJ");
    expect(result.participants).toHaveLength(5);
    expect(result.participants[0].status).toBe("created-email-failed");
    expect(result.participants.slice(1).every((item) => item.status === "created-email-sent")).toBe(true);
    expect(new Set(result.participants.map((item) => item.registrationId)).size).toBe(5);
    expect(new Set(result.participants.map((item) => item.billingNumber)).size).toBe(5);
    expect(mocks.sendRegistrationEmail).toHaveBeenCalledTimes(5);
    expect(mocks.sendBillingEmail).toHaveBeenCalledTimes(5);
    expect(mocks.sendRegistrationEmail.mock.calls.map(([input]) => input.recipientEmail).sort()).toEqual(
      Array.from({ length: 5 }, (_, index) => `peserta-${index + 1}@example.com`).sort(),
    );
  });
});
