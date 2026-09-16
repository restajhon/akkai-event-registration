import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  getRegistrationDiagnosticError,
  logRegistrationStageDetails,
  logRegistrationStageFailure,
} from "@/lib/registration/diagnostics";

describe("registration diagnostics", () => {
  it("redacts sensitive values from database and provider errors", () => {
    const diagnostic = getRegistrationDiagnosticError(
      Object.assign(
        new Error(
           "failed for person@example.test, phone 0812-3456-7890 at certificates/123e4567-e89b-12d3-a456-426614174000.pdf with secret: test-credential",
        ),
        { code: "PGRST202" },
      ),
    );

    expect(diagnostic).toEqual({
      provider: null,
      statusCode: null,
      errorType: "Error",
      errorCode: "PGRST202",
      message:
         "failed for [redacted-email], phone [redacted-phone] at [redacted-storage-path] with [redacted-credential]",
    });
  });

  it("logs only the stage and sanitized error details", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    logRegistrationStageFailure("rpc-v5", new Error("database request failed"));

    expect(errorSpy).toHaveBeenCalledWith("Registration stage failed", {
      stage: "rpc-v5",
      provider: null,
      statusCode: null,
      errorType: "Error",
      errorCode: null,
      message: "database request failed",
    });

    errorSpy.mockRestore();
  });

  it("keeps code and message from plain provider error objects", () => {
    expect(
      getRegistrationDiagnosticError({
        code: "42702",
        message: 'column reference "email" is ambiguous',
      }),
    ).toEqual({
      provider: null,
      statusCode: null,
      errorType: "object",
      errorCode: "42702",
      message: 'column reference "email" is ambiguous',
    });
  });

  it("sanitizes details received from a client-side stage", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    logRegistrationStageDetails("storage-upload", {
      errorType: "StorageError",
      errorCode: "STORAGE_UPLOAD_FAILED",
      message: "upload failed for certificates/123e4567-e89b-12d3-a456-426614174000.pdf",
    });

    expect(errorSpy).toHaveBeenCalledWith("Registration stage failed", {
      stage: "storage-upload",
      provider: null,
      statusCode: null,
      errorType: "StorageError",
      errorCode: "STORAGE_UPLOAD_FAILED",
      message: "upload failed for [redacted-storage-path]",
    });

    errorSpy.mockRestore();
  });

  it("extracts safe metadata from a Resend SDK response envelope", () => {
    const diagnostic = getRegistrationDiagnosticError(
      {
        data: null,
        error: {
          name: "validation_error",
          statusCode: 422,
          errorCode: "invalid_from",
          message:
            "send failed for person@example.test: https://api.example.test/v1/emails Authorization: Bearer test-credential",
        },
      },
      "resend",
    );

    expect(diagnostic).toEqual({
      provider: "resend",
      statusCode: 422,
      errorType: "validation_error",
      errorCode: "invalid_from",
      message:
        "send failed for [redacted-email]: [redacted-url] [redacted-credential]",
    });
    expect(diagnostic).not.toHaveProperty("data");
    expect(diagnostic).not.toHaveProperty("error");
  });

  it("extracts status from a native Error without serializing the error", () => {
    const error = Object.assign(
      new Error("provider failed for person@example.test"),
      { statusCode: 503, code: "temporarily_unavailable" },
    );

    expect(getRegistrationDiagnosticError(error, "resend")).toEqual({
      provider: "resend",
      statusCode: 503,
      errorType: "Error",
      errorCode: "temporarily_unavailable",
      message: "provider failed for [redacted-email]",
    });
  });

  it("supports plain provider errors and bounds their messages", () => {
    const diagnostic = getRegistrationDiagnosticError(
      {
        name: "rate_limit_error",
        status: "429",
        code: "rate_limited",
        message: `${"x".repeat(600)} https://sensitive.example.test/token`,
      },
      "resend",
    );

    expect(diagnostic.provider).toBe("resend");
    expect(diagnostic.statusCode).toBe(429);
    expect(diagnostic.errorType).toBe("rate_limit_error");
    expect(diagnostic.errorCode).toBe("rate_limited");
    expect(diagnostic.message).toHaveLength(500);
    expect(diagnostic.message).not.toContain("https://");
  });
});
