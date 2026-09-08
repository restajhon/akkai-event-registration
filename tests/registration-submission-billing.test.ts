import { beforeEach, describe, expect, it, vi } from "vitest";

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

import { submitRegistration } from "@/app/register/actions";

function validForm() {
  const form = new FormData();
  form.set("full_name", "Peserta AKKAI");
  form.set("email", "peserta@example.com");
  form.set("phone_number", "081234567890");
  form.set("kka_name", "KKA Maju");
  form.set("position", "Konsultan");
  form.set("polo_size", "L");
  form.set("polo_model", "Lengan Panjang");
  form.set("package_type", "Twin Share");
  form.set("participation_scope", "Seluruh acara");
  form.set("actuarial_consultant_status", "Penerima Grandfathering CIAC");
  form.set("attends_pai_congress", "true");
  form.set("privacy_consent", "on");
  form.set("certificate_upload_id", "");
  return form;
}

describe("registration submission billing", () => {
  beforeEach(() => {
    mocks.createAdminClient.mockReset();
    mocks.generateParticipantQrPng.mockResolvedValue(Buffer.from("qr"));
    mocks.sendRegistrationEmail.mockResolvedValue({ success: true, providerMessageId: "ticket-1" });
    mocks.sendBillingEmail.mockResolvedValue({ success: true, providerMessageId: "billing-1" });

    const emailLogQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          participant_id: "participant-1",
          recipient_email: "peserta@example.com",
          email_generation: 0,
          status: "PENDING",
        },
        error: null,
      }),
    };
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({
        data: {
          result_code: "CREATED",
          participant_id: "participant-1",
          registration_id: "AKKAI26-000001",
          full_name: "Peserta AKKAI",
          email: "peserta@example.com",
          qr_token: "a".repeat(64),
          email_log_id: "email-log-1",
          email_generation: 0,
          billing_id: "billing-1",
          billing_number: "INV-AKKAI26-000001",
          billing_amount: 6_000_000,
          billing_created_at: "2026-09-08T00:00:00.000Z",
        },
        error: null,
      })
      .mockResolvedValueOnce({ data: [{ result_code: "CURRENT_GENERATION" }], error: null })
      .mockResolvedValueOnce({ data: [{ result_code: "UPDATED" }], error: null })
      .mockResolvedValueOnce({
        data: { result_code: "DUPLICATE_EMAIL" },
        error: null,
      });

    mocks.createAdminClient.mockReturnValue({
      rpc,
      from: vi.fn().mockReturnValue(emailLogQuery),
    });
  });

  it("creates billing after registration and does not email a duplicate billing", async () => {
    const first = await submitRegistration(
      { status: "idle", fieldErrors: {} },
      validForm(),
    );
    const second = await submitRegistration(
      { status: "idle", fieldErrors: {} },
      validForm(),
    );

    expect(first).toMatchObject({
      status: "submitted",
      billing: {
        billingNumber: "INV-AKKAI26-000001",
        amount: 6_000_000,
      },
      billingEmailDelivery: "accepted",
    });
    expect(second.status).toBe("duplicate-email");
    expect(mocks.sendBillingEmail).toHaveBeenCalledTimes(1);
    expect(mocks.sendBillingEmail).toHaveBeenCalledWith(
      expect.objectContaining({ recipientEmail: "peserta@example.com", amount: 6_000_000 }),
    );
  });
});
