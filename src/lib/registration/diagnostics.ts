import "server-only";

export type RegistrationDiagnosticStage =
  | "upload-intent"
  | "storage-upload"
  | "rpc-v4"
  | "billing"
  | "registration-email"
  | "billing-email";

type ErrorRecord = Record<string, unknown>;

export type RegistrationDiagnosticDetails = {
  errorType?: unknown;
  errorCode?: unknown;
  message?: unknown;
};

function getErrorRecord(error: unknown): ErrorRecord | null {
  return typeof error === "object" && error !== null
    ? (error as ErrorRecord)
    : null;
}

function sanitizeMessage(message: string) {
  return message
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/\b(?:\+?\d[\d\s().-]{7,}\d)\b/g, "[redacted-phone]")
    .replace(/(?:https?:\/\/|s3:\/\/)[^\s]+/gi, "[redacted-url]")
    .replace(/\bcertificates[\\/][^\s,)'"`]+/gi, "[redacted-storage-path]")
    .replace(/\b(?:eyJ|sb_|re_)[A-Za-z0-9._-]+/g, "[redacted-secret]")
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi, "[redacted-uuid]")
    .replace(/\/[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)+/g, "[redacted-path]")
    .slice(0, 500);
}

export function getRegistrationDiagnosticError(error: unknown) {
  const record = getErrorRecord(error);
  const message = error instanceof Error ? error.message : String(error);
  const code = record?.code;

  return {
    errorType: error instanceof Error ? error.name : typeof error,
    errorCode: typeof code === "string" ? sanitizeMessage(code) : null,
    message: sanitizeMessage(message),
  };
}

export function logRegistrationStageFailure(
  stage: RegistrationDiagnosticStage,
  error: unknown,
) {
  const diagnostic = getRegistrationDiagnosticError(error);
  logRegistrationStageDetails(stage, diagnostic);
}

export function logRegistrationStageDetails(
  stage: RegistrationDiagnosticStage,
  details: RegistrationDiagnosticDetails,
) {
  console.error("Registration stage failed", {
    stage,
    errorType: sanitizeMessage(String(details.errorType ?? "unknown")),
    errorCode:
      details.errorCode == null
        ? null
        : sanitizeMessage(String(details.errorCode)),
    message: sanitizeMessage(String(details.message ?? "unknown error")),
  });
}
