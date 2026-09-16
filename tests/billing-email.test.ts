import { beforeEach, describe, expect, it, vi } from "vitest";

const send = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));

import { sendBillingEmail } from "@/lib/email/billing-email";
import { createBillingEmailTemplate } from "@/lib/email/billing-email-template";

beforeEach(() => {
  vi.stubEnv("RESEND_API_KEY", "test-key");
  vi.stubEnv("RESEND_FROM_EMAIL", "noreply@example.com");
  send.mockReset();
  send.mockResolvedValue({ data: { id: "provider-billing-1" }, error: null });
});

describe("registration billing email", () => {
  const input = {
    recipientEmail: "peserta@example.com",
    fullName: "Peserta AKKAI",
    registrationId: "AKKAI26-000001",
    billingNumber: "INV-AKKAI26-000001",
    kkaName: "KKA Maju",
    packageType: "Twin Share",
    participationScope: "Seluruh acara",
    amount: 6_000_000,
    createdAt: "8 September 2026",
    idempotencyKey: "billing:1",
  };

  it("uses the participant email recipient and idempotency key", async () => {
    await expect(sendBillingEmail(input)).resolves.toEqual({
      success: true,
      providerMessageId: "provider-billing-1",
    });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ to: "peserta@example.com" }),
      { idempotencyKey: "billing:1" },
    );
  });

  it("returns safe metadata for an SDK provider error", async () => {
    send.mockResolvedValue({
      data: null,
      error: {
        name: "validation_error",
        statusCode: 422,
        errorCode: "invalid_from",
        message: "invalid sender for peserta@example.com",
      },
    });

    await expect(sendBillingEmail(input)).resolves.toMatchObject({
      success: false,
      errorMessage: "invalid sender for [redacted-email]",
      diagnostic: {
        provider: "resend",
        statusCode: 422,
        errorType: "validation_error",
        errorCode: "invalid_from",
      },
    });
  });

  it("returns safe metadata when the provider throws a native Error", async () => {
    send.mockRejectedValue(
      Object.assign(new Error("upstream failed at https://api.example.test"), {
        statusCode: 503,
      }),
    );

    await expect(sendBillingEmail(input)).resolves.toMatchObject({
      success: false,
      errorMessage: "upstream failed at [redacted-url]",
      diagnostic: {
        provider: "resend",
        statusCode: 503,
        errorType: "Error",
      },
    });
  });

  it("renders the required invoice card data in the email", () => {
    const template = createBillingEmailTemplate(input);
    expect(template.subject).toContain("INV-AKKAI26-000001");
    expect(template.html).toContain("Tagihan Biaya Pendaftaran");
    expect(template.html).toContain("6.000.000");
    expect(template.html).toContain("Belum Dibayar");
  });
});
