import { beforeEach, describe, expect, it, vi } from "vitest";

const send = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));

import { sendRegistrationEmail } from "@/lib/email/registration-email";

beforeEach(() => {
  vi.stubEnv("RESEND_API_KEY", "test-key");
  vi.stubEnv("RESEND_FROM_EMAIL", "noreply@example.com");
  send.mockReset();
  send.mockResolvedValue({ data: { id: "provider-registration-1" }, error: null });
});

describe("registration email", () => {
  const input = {
    recipientEmail: "peserta@example.com",
    fullName: "Peserta AKKAI",
    registrationId: "AKKAI26-000001",
    packageType: "Twin Share",
    participationScope: "Seluruh acara",
    actuarialConsultantStatus: "Penerima Grandfathering CIAC",
    attendsPaiCongress: true,
    qrPngBuffer: Buffer.from("qr"),
    idempotencyKey: "registration:1",
  };

  it("returns the provider message id on success", async () => {
    await expect(sendRegistrationEmail(input)).resolves.toEqual({
      success: true,
      providerMessageId: "provider-registration-1",
    });
  });

  it("renders a blank CIAC status without failing email preparation", async () => {
    await expect(sendRegistrationEmail({
      ...input,
      actuarialConsultantStatus: null,
    })).resolves.toMatchObject({ success: true });

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining("Konsultan Aktuaria: -"),
      }),
      expect.anything(),
    );
  });

  it("handles the Resend SDK response envelope without exposing it", async () => {
    send.mockResolvedValue({
      data: { requestId: "not logged" },
      error: {
        name: "forbidden",
        statusCode: 403,
        errorCode: "forbidden",
        message: "rejected for peserta@example.com with secret: test-credential",
      },
    });

    const result = await sendRegistrationEmail(input);

    expect(result).toMatchObject({
      success: false,
      errorCategory: "PROVIDER_ERROR",
      errorMessage: "rejected for [redacted-email] with [redacted-credential]",
      diagnostic: {
        provider: "resend",
        statusCode: 403,
        errorType: "forbidden",
        errorCode: "forbidden",
      },
    });
    expect(result).not.toHaveProperty("data");
    expect(result).not.toHaveProperty("requestId");
  });

  it("handles native Error and plain object provider failures", async () => {
    send.mockRejectedValueOnce(
      Object.assign(new Error("failed for https://api.example.test"), {
        statusCode: 502,
      }),
    );
    await expect(sendRegistrationEmail(input)).resolves.toMatchObject({
      success: false,
      errorMessage: "failed for [redacted-url]",
      diagnostic: { statusCode: 502, errorType: "Error" },
    });

    send.mockRejectedValueOnce({
      name: "rate_limit_error",
      status: 429,
      code: "rate_limited",
      message: "too many requests for peserta@example.com",
    });
    await expect(sendRegistrationEmail(input)).resolves.toMatchObject({
      success: false,
      errorMessage: "too many requests for [redacted-email]",
      diagnostic: {
        provider: "resend",
        statusCode: 429,
        errorType: "rate_limit_error",
        errorCode: "rate_limited",
      },
    });
  });
});
