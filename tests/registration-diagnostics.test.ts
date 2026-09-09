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
          "failed for person@example.test, phone 0812-3456-7890 at certificates/123e4567-e89b-12d3-a456-426614174000.pdf with re_secret-value",
        ),
        { code: "PGRST202" },
      ),
    );

    expect(diagnostic).toEqual({
      errorType: "Error",
      errorCode: "PGRST202",
      message:
        "failed for [redacted-email], phone [redacted-phone] at [redacted-storage-path] with [redacted-secret]",
    });
  });

  it("logs only the stage and sanitized error details", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    logRegistrationStageFailure("rpc-v4", new Error("database request failed"));

    expect(errorSpy).toHaveBeenCalledWith("Registration stage failed", {
      stage: "rpc-v4",
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
      errorType: "StorageError",
      errorCode: "STORAGE_UPLOAD_FAILED",
      message: "upload failed for [redacted-storage-path]",
    });

    errorSpy.mockRestore();
  });
});
