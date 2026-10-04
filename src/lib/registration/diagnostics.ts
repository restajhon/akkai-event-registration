import "server-only";

export type RegistrationDiagnosticStage =
  | "upload-intent"
  | "storage-upload"
  | "rpc-v5"
  | "rpc-v6"
  | "collective-batch"
  | "billing"
  | "registration-email"
  | "billing-email";

type ErrorRecord = Record<string, unknown>;

export type RegistrationDiagnosticDetails = {
  provider?: unknown;
  statusCode?: unknown;
  errorType?: unknown;
  errorCode?: unknown;
  sqlState?: unknown;
  functionName?: unknown;
  details?: unknown;
  message?: unknown;
};

function getErrorRecord(error: unknown): ErrorRecord | null {
  return typeof error === "object" && error !== null
    ? (error as ErrorRecord)
    : null;
}

function sanitizeMessage(message: string) {
  return message
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/\b(?:\+?\d[\d\s().-]{7,}\d)\b/g, "[redacted-phone]")
    .replace(/(?:https?:\/\/|s3:\/\/)[^\s]+/gi, "[redacted-url]")
    .replace(
      /\b(?:authorization|x-api-key|api-key|secret|password|token)\s*[:=]\s*(?:bearer\s+)?[^\s,;]+/gi,
      "[redacted-credential]",
    )
    .replace(/\bbearer\s+[^\s,;]+/gi, "Bearer [redacted-credential]")
    .replace(/\bcertificates[\\/][^\s,)'"`]+/gi, "[redacted-storage-path]")
    .replace(/\b(?:eyJ|sb_|re_)[A-Za-z0-9._-]+/g, "[redacted-secret]")
    .replace(/\bKey \(([^)]*)\)=\(([^)]*)\)/gi, "Key ($1)=([redacted-value])")
    .replace(/'[^']*'/g, "'[redacted-value]'")
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi, "[redacted-uuid]")
    .replace(/\/[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)+/g, "[redacted-path]")
    .slice(0, 500);
}

function getSqlState(value: unknown) {
  return typeof value === "string" && /^[0-9A-Z]{5}$/.test(value)
    ? value
    : null;
}

function getRegistrationFunctionName(...values: unknown[]) {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const match = value.match(
      /\b(create_participant_with_registration_reservation_v[456])\b/i,
    );
    if (match) return match[1].toLowerCase();
  }
  return null;
}

function getSafeDetails(value: unknown) {
  if (typeof value !== "string") return null;

  const safeKnownDetails = [
    "It could refer to either a PL/pgSQL variable or a table column.",
  ];
  const normalized = value.trim();
  if (safeKnownDetails.includes(normalized)) return normalized;
  return sanitizeMessage(normalized);
}

function getSafeStatusCode(value: unknown) {
  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^\d{3}$/.test(value)
        ? Number(value)
        : null;

  return numericValue !== null && Number.isInteger(numericValue) && numericValue >= 100 && numericValue <= 599
    ? numericValue
    : null;
}

function getStatusCode(record: ErrorRecord | null) {
  if (!record) return null;

  const directStatus = getSafeStatusCode(
    record.statusCode ?? record.status ?? record.httpStatus,
  );
  if (directStatus !== null) return directStatus;

  const response = getErrorRecord(record.response);
  return getSafeStatusCode(response?.status);
}

function isSdkResponse(record: ErrorRecord | null) {
  return record !== null && "data" in record && "error" in record;
}

export function getRegistrationDiagnosticError(
  error: unknown,
  provider: string | null = null,
) {
  const responseRecord = getErrorRecord(error);
  const sdkResponse = isSdkResponse(responseRecord) ? responseRecord : null;
  const providerError = sdkResponse ? sdkResponse.error : error;
  const record = getErrorRecord(providerError);
  const message =
    providerError instanceof Error
      ? providerError.message
      : typeof record?.message === "string"
        ? record.message
        : sdkResponse
          ? "provider response did not include an error message"
          : typeof providerError === "string" || typeof providerError === "number"
            ? String(providerError)
            : "unknown error";
  const code = record?.errorCode ?? record?.code;
  const sqlState = getSqlState(record?.code ?? record?.sqlState);
  const details = record?.details ?? record?.detail;
  const hint = record?.hint;
  const errorType =
    providerError instanceof Error
      ? providerError.name
      : typeof record?.name === "string"
        ? record.name
        : typeof providerError;

  return {
    provider,
    statusCode: getStatusCode(record),
    errorType,
    errorCode: typeof code === "string" ? sanitizeMessage(code) : null,
    sqlState,
    functionName: getRegistrationFunctionName(
      record?.message,
      details,
      hint,
      record?.context,
    ),
    details: getSafeDetails(details),
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
  const functionName =
    getRegistrationFunctionName(details.functionName) ??
    (stage === "rpc-v6"
      ? "create_participant_with_registration_reservation_v6"
      : null);

  console.error("Registration stage failed", {
    stage,
    provider:
      details.provider == null ? null : sanitizeMessage(String(details.provider)),
    statusCode: getSafeStatusCode(details.statusCode),
    errorType: sanitizeMessage(String(details.errorType ?? "unknown")),
    errorCode:
      details.errorCode == null
        ? null
        : sanitizeMessage(String(details.errorCode)),
    sqlState: getSqlState(details.sqlState),
    functionName,
    details:
      details.details == null ? null : getSafeDetails(String(details.details)),
    message: sanitizeMessage(String(details.message ?? "unknown error")),
  });
}
