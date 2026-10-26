"use server";

import { sendBillingEmail } from "@/lib/email/billing-email";
import {
  sendRegistrationEmail,
  type RegistrationEmailErrorCategory,
} from "@/lib/email/registration-email";
import {
  getRegistrationCertificateExtension,
  REGISTRATION_CERTIFICATE_BUCKET,
  REGISTRATION_CERTIFICATE_MAX_FILE_SIZE,
  validateRegistrationCertificateBytes,
  validateRegistrationCertificateMetadata,
} from "@/lib/registration/certificate";
import {
  logRegistrationStageDetails,
  logRegistrationStageFailure,
  type RegistrationDiagnosticDetails,
  type RegistrationDiagnosticStage,
} from "@/lib/registration/diagnostics";
import {
  type EmailDeliveryStatus,
  initialCollectiveRegistrationState,
  initialRegistrationState,
  type CollectiveParticipantResult,
  type CollectiveRegistrationActionState,
  type RegistrationActionState,
} from "@/lib/registration/registration-action-state";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateParticipantQrPng } from "@/lib/qr/participant-qr";
import { supportsAkkaiParticipantWorkflow, validateRegistrationFormAnswers } from "@/lib/forms/form-schema";
import {
  loadPublishedEventForm,
  loadPublishedEventFormById,
  type PublishedEventForm,
} from "@/lib/tenant/public-events";
import {
  getRegistrationFieldErrors,
  getCollectiveParticipantFieldErrors,
  collectiveParticipantSchema,
  collectiveRegistrationPayloadSchema,
  type NormalizedCollectiveParticipantData,
  registrationSchema,
  type RegistrationFormValues,
} from "@/lib/validation/registration";
import { participantEmailSchema } from "@/lib/validation/email";

const GENERAL_ERROR =
  "Terjadi kendala saat memproses pendaftaran. Silakan coba kembali.";
const UPLOAD_ERROR =
  "Surat Keterangan Kerja belum dapat divalidasi. Silakan pilih file PDF, JPG, JPEG, atau PNG maksimal 2 MiB.";
const DUPLICATE_MEMBER_NUMBER_ERROR =
  "Nomor anggota ini sudah terdaftar. Silakan cek kembali data Anda atau hubungi panitia.";
const REGISTRATION_CLOSED_ERROR = "Periode registrasi telah ditutup.";
const REGISTRATION_DIAGNOSTIC_STAGES: RegistrationDiagnosticStage[] = [
  "upload-intent",
  "storage-upload",
  "rpc-v5",
  "rpc-v6",
  "rpc-v7",
  "rpc-v8",
  "collective-batch",
  "billing",
  "registration-email",
  "billing-email",
];

type RegistrationReservation = {
  result_code: string;
  participant_id: string | null;
  registration_id: string | null;
  full_name: string | null;
  email: string | null;
  qr_token: string | null;
  email_log_id: string | null;
  email_generation: number | null;
  billing_id: string | null;
  billing_number: string | null;
  billing_amount: number | null;
  billing_created_at: string | null;
};

type UploadIntent = {
  id: string;
  event_id: string;
  email: string;
  storage_path: string;
  file_name: string;
  file_mime: string;
  file_size: number;
  status: "PENDING" | "CLEANING" | "CONSUMED";
  expires_at: string;
};

type ReservedEmailLog = {
  participant_id: string;
  recipient_email: string;
  email_generation: number;
  status: "PENDING" | "SENT" | "FAILED";
};

type BillingEmailLogStatus = "PENDING" | "SENT" | "FAILED";

type UploadPreparationState =
  | { status: "ready"; intentId: string; path: string; token: string }
  | { status: "error"; message: string };

export async function reportRegistrationStageFailure(
  stage: RegistrationDiagnosticStage,
  details: RegistrationDiagnosticDetails,
) {
  if (!REGISTRATION_DIAGNOSTIC_STAGES.includes(stage)) return;
  logRegistrationStageDetails(stage, details);
}

function getFormValue(formData: FormData, field: string) {
  const value = formData.get(field);
  return typeof value === "string" ? value : "";
}

function stateWithGeneralError(generalError: string): RegistrationActionState {
  return {
    ...initialRegistrationState,
    status: "general-error",
    generalError,
  };
}

function submittedState(
  registrationId: string,
  emailDelivery: EmailDeliveryStatus,
  billing: RegistrationActionState["billing"],
  billingEmailDelivery: EmailDeliveryStatus,
): RegistrationActionState {
  return {
    status: "submitted",
    fieldErrors: {},
    registrationId,
    emailDelivery,
    billing,
    billingEmailDelivery,
  };
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function loadSubmissionForm(formData: FormData): Promise<PublishedEventForm | null> {
  return loadPublishedEventFormById(
    getFormValue(formData, "event_id"),
    getFormValue(formData, "form_version_id"),
  );
}

function readAnswers(formData: FormData) {
  const value = getFormValue(formData, "form_answers");
  if (value.length === 0 || value.length > 100_000) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

export async function submitGenericRegistration(
  previousState: RegistrationActionState,
  formData: FormData,
): Promise<RegistrationActionState> {
  void previousState;
  const publishedForm = await loadSubmissionForm(formData);
  if (!publishedForm) return stateWithGeneralError(REGISTRATION_CLOSED_ERROR);
  if (publishedForm.eventSlug === "akkai-2026" && supportsAkkaiParticipantWorkflow(publishedForm.config)) {
    return stateWithGeneralError(GENERAL_ERROR);
  }

  const validation = validateRegistrationFormAnswers(publishedForm.config, readAnswers(formData));
  if (!validation.success) return { ...initialRegistrationState, status: "validation-error", fieldErrors: validation.errors };
  const idempotencyKey = getFormValue(formData, "registration_idempotency_key").trim();
  if (idempotencyKey.length < 16 || idempotencyKey.length > 200) return stateWithGeneralError(GENERAL_ERROR);

  try {
    const { data, error } = await createAdminClient({ scope: "public-event", eventId: publishedForm.eventId }).rpc(
      "submit_public_registration_form",
      {
        p_event_id: publishedForm.eventId,
        p_form_version_id: publishedForm.versionId,
        p_idempotency_key: idempotencyKey,
        p_answers: validation.data,
      },
    );
    const result = (Array.isArray(data) ? data[0] : data) as { result_code: string; submission_id: string | null } | null;
    if (error || !result || !["SUBMITTED", "ALREADY_SUBMITTED"].includes(result.result_code) || !result.submission_id) {
      return stateWithGeneralError(GENERAL_ERROR);
    }
    return submittedState(result.submission_id, "not-attempted", undefined, "not-attempted");
  } catch {
    return stateWithGeneralError(GENERAL_ERROR);
  }
}

function coreRegistrationValues(
  answers: Record<string, string | number | boolean>,
  formData: FormData,
): RegistrationFormValues {
  return {
    full_name: typeof answers.full_name === "string" ? answers.full_name : "",
    email: typeof answers.email === "string" ? answers.email : "",
    phone_number: typeof answers.phone_number === "string" ? answers.phone_number : "",
    kka_name: typeof answers.kka_name === "string" ? answers.kka_name : "",
    position: typeof answers.position === "string" ? answers.position : "",
    polo_size: typeof answers.polo_size === "string" ? answers.polo_size : "",
    polo_model: typeof answers.polo_model === "string" ? answers.polo_model : "",
    package_type: typeof answers.package_type === "string" ? answers.package_type : "",
    participation_scope: typeof answers.participation_scope === "string" ? answers.participation_scope : "",
    actuarial_consultant_status: typeof answers.actuarial_consultant_status === "string" ? answers.actuarial_consultant_status : "",
    attends_pai_congress: typeof answers.attends_pai_congress === "string" ? answers.attends_pai_congress : "",
    privacy_consent: answers.privacy_consent === true,
    certificate_file: null,
    certificate_upload_id: getFormValue(formData, "certificate_upload_id"),
  };
}

function getSafeFileName(fileName: string) {
  const baseName = fileName.split(/[\\/]/).pop() ?? "surat-keterangan-kerja";
  const cleanName = baseName.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return cleanName.slice(0, 255) || "surat-keterangan-kerja";
}

async function loadUploadIntent(
  supabase: ReturnType<typeof createAdminClient>,
  intentId: string,
): Promise<UploadIntent | null> {
  const { data, error } = await supabase
    .from("registration_certificate_upload_intents")
    .select("id, event_id, email, storage_path, file_name, file_mime, file_size, status, expires_at")
    .eq("id", intentId)
    .maybeSingle();

  return error || !data ? null : (data as UploadIntent);
}

async function cleanupUploadIntent(eventId: string, intentId: string) {
  if (!isUuid(eventId) || !isUuid(intentId)) return;

  try {
    const supabase = createAdminClient({ scope: "public-event-cleanup", eventId });
    const { data: claimData, error: claimError } = await supabase.rpc(
      "claim_registration_certificate_upload_cleanup",
      { p_event_id: eventId, p_intent_id: intentId },
    );
    if (claimError || !claimData) {
      if (claimError) logRegistrationStageFailure("storage-upload", claimError);
      return;
    }

    const claim = (Array.isArray(claimData) ? claimData[0] : claimData) as { storage_path?: unknown } | null;
    if (!claim || typeof claim.storage_path !== "string") return;

    const { error: removeError } = await supabase.storage
      .from(REGISTRATION_CERTIFICATE_BUCKET)
      .remove([claim.storage_path]);
    if (removeError) {
      logRegistrationStageFailure("storage-upload", removeError);
      return;
    }

    const { error: deleteError } = await supabase
      .from("registration_certificate_upload_intents")
      .delete()
      .eq("id", intentId)
      .eq("status", "CLEANING");
    if (deleteError) logRegistrationStageFailure("storage-upload", deleteError);
  } catch (error) {
    // Cleanup is best-effort; a CLEANING intent remains retryable if storage
    // or the database is temporarily unavailable.
    logRegistrationStageFailure("storage-upload", error);
  }
}

function getCollectiveUploadCleanupTarget(payload: unknown) {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return null;
  const record = payload as Record<string, unknown>;
  if (typeof record.event_id !== "string" || !isUuid(record.event_id)) return null;
  const participants = Array.isArray(record.participants) ? record.participants : [];
  const intentIds = Array.from(new Set(participants.flatMap((participant) => {
    if (typeof participant !== "object" || participant === null || Array.isArray(participant)) return [];
    const intentId = (participant as Record<string, unknown>).certificate_upload_id;
    return typeof intentId === "string" && isUuid(intentId) ? [intentId] : [];
  })));
  return { eventId: record.event_id, intentIds };
}

async function cleanupCollectiveUploadIntents(eventId: string, intentIds: string[]) {
  await Promise.allSettled(intentIds.map((intentId) => cleanupUploadIntent(eventId, intentId)));
}

async function cleanupUploadIntentFromForm(formData: FormData) {
  const eventId = getFormValue(formData, "event_id");
  const intentId = getFormValue(formData, "certificate_upload_id");
  await cleanupUploadIntent(eventId, intentId);
}

export async function prepareRegistrationCertificateUpload(
  formData: FormData,
): Promise<UploadPreparationState> {
  const eventId = getFormValue(formData, "event_id");
  const formVersionId = getFormValue(formData, "form_version_id");
  const publishedForm = await loadPublishedEventFormById(eventId, formVersionId);
  if (!publishedForm || !publishedForm.config.fields.some((field) => field.key === "certificate_file" && field.type === "file")) {
    return { status: "error", message: REGISTRATION_CLOSED_ERROR };
  }
  const fileMetadata = {
    file_name: getFormValue(formData, "file_name"),
    file_type: getFormValue(formData, "file_type"),
    file_size: Number(getFormValue(formData, "file_size")),
  };
  const fileError = validateRegistrationCertificateMetadata(fileMetadata);
  if (fileError) {
    logRegistrationStageFailure("upload-intent", new Error(fileError));
    return { status: "error", message: fileError };
  }
  const emailResult = participantEmailSchema.safeParse(getFormValue(formData, "email"));
  if (!emailResult.success) {
    logRegistrationStageFailure("upload-intent", new Error("invalid participant email"));
    return { status: "error", message: UPLOAD_ERROR };
  }

  let stage: RegistrationDiagnosticStage = "upload-intent";
  let createdIntentId: string | null = null;
  try {
    const supabase = createAdminClient({ scope: "public-event", eventId });
    const email = emailResult.data;
    const intentId = crypto.randomUUID();
    createdIntentId = intentId;
    const path = `certificates/${crypto.randomUUID()}.${getRegistrationCertificateExtension(fileMetadata.file_name)}`;
    const { data: intent, error: intentError } = await supabase
      .from("registration_certificate_upload_intents")
      .insert({
        id: intentId,
        email,
        storage_path: path,
        file_name: getSafeFileName(fileMetadata.file_name),
        file_mime: fileMetadata.file_type,
        file_size: fileMetadata.file_size,
      })
      .select("id")
      .single();

    if (intentError || !intent) {
      logRegistrationStageFailure(
        "upload-intent",
        intentError ?? new Error("upload intent was not created"),
      );
      return { status: "error", message: GENERAL_ERROR };
    }
    createdIntentId = intent.id;

    stage = "storage-upload";
    const { data: signedUpload, error: signedUploadError } = await supabase.storage
      .from(REGISTRATION_CERTIFICATE_BUCKET)
      .createSignedUploadUrl(path, { upsert: false });

    if (signedUploadError || !signedUpload) {
      logRegistrationStageFailure(
        "storage-upload",
        signedUploadError ?? new Error("signed upload URL was not created"),
      );
      await cleanupUploadIntent(eventId, intent.id);
      return { status: "error", message: GENERAL_ERROR };
    }

    return {
      status: "ready",
      intentId: intent.id,
      path: signedUpload.path,
      token: signedUpload.token,
    };
  } catch (error) {
    logRegistrationStageFailure(stage, error);
    if (createdIntentId) await cleanupUploadIntent(eventId, createdIntentId);
    return { status: "error", message: GENERAL_ERROR };
  }
}

export async function cancelRegistrationCertificateUpload(intentId: string, eventId?: string, formVersionId?: string) {
  if (!isUuid(intentId)) return;
  void formVersionId;

  try {
    const cleanupEventId = eventId && isUuid(eventId)
      ? eventId
      : (await loadPublishedEventForm("akkai-2026"))?.eventId;
    if (!cleanupEventId) return;
    await cleanupUploadIntent(cleanupEventId, intentId);
  } catch {
    // A CLEANING intent remains retryable if the Storage API is unavailable.
  }
}

async function validateUploadedCertificate(
  supabase: ReturnType<typeof createAdminClient>,
  intent: UploadIntent,
) {
  const { data: downloadedFile, error } = await supabase.storage
    .from(REGISTRATION_CERTIFICATE_BUCKET)
    .download(intent.storage_path);

  if (
    error ||
    !downloadedFile ||
    downloadedFile.size !== intent.file_size ||
    downloadedFile.size > REGISTRATION_CERTIFICATE_MAX_FILE_SIZE
  ) return false;

  const bytes = new Uint8Array(await downloadedFile.arrayBuffer());
  return validateRegistrationCertificateBytes({
    file_name: intent.file_name,
    file_type: intent.file_mime,
    file_size: intent.file_size,
  }, bytes);
}

async function finalizeRegistrationEmail(
  supabase: ReturnType<typeof createAdminClient>,
  participantId: string,
  emailLogId: string,
  emailGeneration: number,
  finalStatus: "SENT" | "FAILED",
  providerMessageId: string | null,
  errorCategory: RegistrationEmailErrorCategory | null,
  errorMessage: string | null = null,
) {
  try {
    await supabase.rpc("finalize_participant_email_attempt", {
      p_participant_id: participantId,
      p_email_log_id: emailLogId,
      p_email_generation: emailGeneration,
      p_final_status: finalStatus,
      p_provider_message_id: providerMessageId,
      p_error_category: errorMessage ?? errorCategory,
      p_sent_at: finalStatus === "SENT" ? new Date().toISOString() : null,
    });
  } catch (error) {
    logRegistrationStageFailure("registration-email", error);
    // Registration and billing remain successful if only the delivery log sync fails.
  }
}

async function finalizeBillingEmail(
  supabase: ReturnType<typeof createAdminClient>,
  billingId: string,
  finalStatus: "SENT" | "FAILED",
  providerMessageId: string | null,
  errorMessage: string | null,
) {
  try {
    await supabase.rpc("finalize_registration_billing_email", {
      p_billing_id: billingId,
      p_final_status: finalStatus,
      p_provider_message_id: providerMessageId,
      p_error_message: errorMessage,
      p_sent_at: finalStatus === "SENT" ? new Date().toISOString() : null,
    });
  } catch (error) {
    logRegistrationStageFailure("billing-email", error);
    // Provider result is still shown; the pending log makes the sync gap visible to admins.
  }
}

async function getReservedEmailLog(
  supabase: ReturnType<typeof createAdminClient>,
  participantId: string,
  emailLogId: string,
  emailGeneration: number,
): Promise<ReservedEmailLog | null> {
  const { data, error } = await supabase
    .from("email_logs")
    .select("participant_id, recipient_email, email_generation, status")
    .eq("id", emailLogId)
    .maybeSingle();

  if (error || !data || data.participant_id !== participantId || data.email_generation !== emailGeneration) {
    return null;
  }

  return data as ReservedEmailLog;
}

async function getBillingEmailLogStatus(
  supabase: ReturnType<typeof createAdminClient>,
  billingId: string,
): Promise<BillingEmailLogStatus | null> {
  const { data, error } = await supabase
    .from("registration_billing_email_logs")
    .select("status")
    .eq("billing_id", billingId)
    .maybeSingle();
  return error || !data ? null : (data.status as BillingEmailLogStatus);
}

function formatBillingDate(dateValue: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long",
    timeZone: "Asia/Jakarta",
  }).format(new Date(dateValue));
}

function formatEventDateRange(event: PublishedEventForm) {
  if (event.eventCode === "AKKAI26") return null;
  if (!event.startsOn) return null;
  const formatDate = (value: string) => new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
  const start = formatDate(event.startsOn);
  return event.endsOn && event.endsOn !== event.startsOn
    ? `${start} – ${formatDate(event.endsOn)}`
    : start;
}

function emailEventName(event: PublishedEventForm) {
  return event.eventCode === "AKKAI26" ? undefined : event.eventName;
}

export async function submitRegistration(
  previousState: RegistrationActionState,
  formData: FormData,
): Promise<RegistrationActionState> {
  void previousState;

  const directFile = formData.get("certificate_file");
  if (typeof File !== "undefined" && directFile instanceof File && directFile.size > 0) {
    await cleanupUploadIntentFromForm(formData);
    return stateWithGeneralError(UPLOAD_ERROR);
  }

  const publishedForm = await loadSubmissionForm(formData);
  if (!publishedForm) {
    await cleanupUploadIntentFromForm(formData);
    return stateWithGeneralError(REGISTRATION_CLOSED_ERROR);
  }

  const submittedAnswers = readAnswers(formData);
  if (submittedAnswers === null) {
    await cleanupUploadIntentFromForm(formData);
    return stateWithGeneralError(GENERAL_ERROR);
  }
  const dynamicValidation = validateRegistrationFormAnswers(publishedForm.config, submittedAnswers);
  if (!dynamicValidation.success) {
    await cleanupUploadIntent(publishedForm.eventId, getFormValue(formData, "certificate_upload_id"));
    return {
      status: "validation-error",
      fieldErrors: dynamicValidation.errors,
      emailDelivery: "not-attempted",
      billingEmailDelivery: "not-attempted",
    };
  }

  const parsed = registrationSchema.safeParse(coreRegistrationValues(dynamicValidation.data, formData));
  if (!parsed.success) {
    await cleanupUploadIntent(publishedForm.eventId, getFormValue(formData, "certificate_upload_id"));
    return {
      status: "validation-error",
      fieldErrors: getRegistrationFieldErrors(parsed.error),
      emailDelivery: "not-attempted",
      billingEmailDelivery: "not-attempted",
    };
  }

  const idempotencyKey = getFormValue(formData, "registration_idempotency_key").trim();
  if (idempotencyKey.length < 16 || idempotencyKey.length > 200) {
    await cleanupUploadIntent(publishedForm.eventId, getFormValue(formData, "certificate_upload_id"));
    return stateWithGeneralError(GENERAL_ERROR);
  }

  let supabase: ReturnType<typeof createAdminClient>;
  let uploadIntent: UploadIntent | null = null;
  let stage: RegistrationDiagnosticStage = "upload-intent";

  try {
    supabase = createAdminClient({ scope: "public-event", eventId: publishedForm.eventId });

    if (parsed.data.actuarial_consultant_status === "Peserta Baru") {
      if (!isUuid(parsed.data.certificate_upload_id)) return stateWithGeneralError(UPLOAD_ERROR);
      uploadIntent = await loadUploadIntent(supabase, parsed.data.certificate_upload_id);
      stage = "storage-upload";
      if (
        !uploadIntent ||
        uploadIntent.event_id !== publishedForm.eventId ||
        uploadIntent.status !== "PENDING" ||
        uploadIntent.email !== parsed.data.email ||
        new Date(uploadIntent.expires_at).getTime() <= Date.now() ||
        !(await validateUploadedCertificate(supabase, uploadIntent))
      ) {
        logRegistrationStageFailure(
          "storage-upload",
          new Error("uploaded certificate validation failed"),
        );
        if (
          uploadIntent?.event_id === publishedForm.eventId
          && (uploadIntent.status === "PENDING" || uploadIntent.status === "CLEANING")
        ) await cleanupUploadIntent(publishedForm.eventId, uploadIntent.id);
        return stateWithGeneralError(UPLOAD_ERROR);
      }
    }

    stage = "rpc-v7";
    const { data: reservationData, error: reservationError } = await supabase.rpc(
      "create_participant_with_registration_reservation_v7",
      {
        p_full_name: parsed.data.full_name,
        p_email: parsed.data.email,
        p_phone_number: parsed.data.phone_number,
        p_kka_name: parsed.data.kka_name,
        p_position: parsed.data.position,
        p_polo_size: parsed.data.polo_size,
        p_polo_model: parsed.data.polo_model,
        p_package_type: parsed.data.package_type,
        p_participation_scope: parsed.data.participation_scope,
        p_actuarial_consultant_status: parsed.data.actuarial_consultant_status,
        p_attends_pai_congress: parsed.data.attends_pai_congress,
        p_privacy_consent_at: new Date().toISOString(),
        p_certificate_upload_intent_id: uploadIntent?.id ?? null,
        p_idempotency_key: idempotencyKey,
        p_event_id: publishedForm.eventId,
        p_form_version_id: publishedForm.versionId,
        p_answers: dynamicValidation.data,
      },
    );

    if (reservationError || !reservationData) {
      logRegistrationStageFailure(
        "rpc-v7",
        reservationError ?? new Error("reservation RPC returned no data"),
      );
      if (uploadIntent) await cleanupUploadIntent(publishedForm.eventId, uploadIntent.id);
      return stateWithGeneralError(GENERAL_ERROR);
    }

    const reservation = (Array.isArray(reservationData) ? reservationData[0] : reservationData) as RegistrationReservation | undefined;
    if (!reservation) {
      logRegistrationStageFailure("rpc-v7", new Error("reservation RPC returned no row"));
      if (uploadIntent) await cleanupUploadIntent(publishedForm.eventId, uploadIntent.id);
      return stateWithGeneralError(GENERAL_ERROR);
    }

    if (reservation.result_code === "DUPLICATE_MEMBER_NUMBER") {
      if (uploadIntent) await cleanupUploadIntent(publishedForm.eventId, uploadIntent.id);
      return {
        status: "duplicate-member-number",
        fieldErrors: {},
        emailDelivery: "not-attempted",
        billingEmailDelivery: "not-attempted",
        generalError: DUPLICATE_MEMBER_NUMBER_ERROR,
      };
    }

    stage = "billing";
    if (
      !["CREATED", "ALREADY_CREATED"].includes(reservation.result_code) ||
      !reservation.participant_id ||
      !reservation.registration_id ||
      !reservation.full_name ||
      !reservation.email ||
      !reservation.qr_token ||
      !reservation.email_log_id ||
      !Number.isSafeInteger(reservation.email_generation) ||
      reservation.email_generation === null ||
      !reservation.billing_id ||
      !reservation.billing_number ||
      !reservation.billing_amount ||
      !reservation.billing_created_at
    ) {
      logRegistrationStageFailure("billing", new Error("reservation billing data was incomplete"));
      if (uploadIntent) await cleanupUploadIntent(publishedForm.eventId, uploadIntent.id);
      return stateWithGeneralError(GENERAL_ERROR);
    }

    const reservedEmailLog = await getReservedEmailLog(
      supabase,
      reservation.participant_id,
      reservation.email_log_id,
      reservation.email_generation,
    );
    if (
      !reservedEmailLog ||
      (reservedEmailLog.status !== "PENDING" && reservation.result_code !== "ALREADY_CREATED")
    ) {
      logRegistrationStageFailure("billing", new Error("reserved registration email log was not pending"));
      return stateWithGeneralError(GENERAL_ERROR);
    }

    const billing = {
      billingNumber: reservation.billing_number,
      registrationId: reservation.registration_id,
      fullName: reservation.full_name,
      kkaName: parsed.data.kka_name,
      packageType: parsed.data.package_type,
      participationScope: parsed.data.participation_scope,
      amount: reservation.billing_amount,
      createdAt: reservation.billing_created_at,
    };

    let emailDelivery: EmailDeliveryStatus = reservedEmailLog.status === "SENT" ? "accepted" : "failed";
    if (reservedEmailLog.status === "PENDING") {
      stage = "registration-email";
      try {
        const qrPngBuffer = await generateParticipantQrPng(reservation.qr_token);
        const emailResult = await sendRegistrationEmail({
          recipientEmail: reservedEmailLog.recipient_email,
          fullName: reservation.full_name,
          registrationId: reservation.registration_id,
          packageType: parsed.data.package_type,
          participationScope: parsed.data.participation_scope,
          actuarialConsultantStatus: parsed.data.actuarial_consultant_status,
          attendsPaiCongress: parsed.data.attends_pai_congress,
          qrPngBuffer,
          idempotencyKey: `registration:${reservation.participant_id}`,
          eventName: emailEventName(publishedForm),
          eventDateRange: formatEventDateRange(publishedForm),
        });

        if (emailResult.success) {
          emailDelivery = "accepted";
          await finalizeRegistrationEmail(
            supabase,
            reservation.participant_id,
            reservation.email_log_id,
            reservation.email_generation,
            "SENT",
            emailResult.providerMessageId,
            null,
          );
        } else {
          logRegistrationStageDetails("registration-email", emailResult.diagnostic);
          await finalizeRegistrationEmail(
            supabase,
            reservation.participant_id,
            reservation.email_log_id,
            reservation.email_generation,
            "FAILED",
            null,
            emailResult.errorCategory,
            emailResult.errorMessage,
          );
        }
      } catch (error) {
        logRegistrationStageFailure("registration-email", error);
        await finalizeRegistrationEmail(
          supabase,
          reservation.participant_id,
          reservation.email_log_id,
          reservation.email_generation,
          "FAILED",
          null,
          "QR_GENERATION_ERROR",
        );
      }
    }

    let billingEmailDelivery: EmailDeliveryStatus = "failed";
    let shouldSendBillingEmail = true;
    if (reservation.result_code === "ALREADY_CREATED") {
      const existingBillingStatus = await getBillingEmailLogStatus(supabase, reservation.billing_id);
      shouldSendBillingEmail = existingBillingStatus === "PENDING" || existingBillingStatus === null;
      billingEmailDelivery = existingBillingStatus === "SENT" ? "accepted" : "failed";
    }
    if (shouldSendBillingEmail) {
      stage = "billing-email";
      const billingEmailResult = await sendBillingEmail({
        recipientEmail: reservation.email,
        ...billing,
        createdAt: formatBillingDate(reservation.billing_created_at),
        idempotencyKey: `billing:${reservation.billing_id}`,
        eventName: emailEventName(publishedForm),
      });

      if (billingEmailResult.success) {
        billingEmailDelivery = "accepted";
        await finalizeBillingEmail(
          supabase,
          reservation.billing_id,
          "SENT",
          billingEmailResult.providerMessageId,
          null,
        );
      } else {
        logRegistrationStageDetails("billing-email", billingEmailResult.diagnostic);
        await finalizeBillingEmail(
          supabase,
          reservation.billing_id,
          "FAILED",
          null,
          billingEmailResult.errorMessage,
        );
      }
    }

    return submittedState(
      reservation.registration_id,
      emailDelivery,
      billing,
      billingEmailDelivery,
    );
  } catch (error) {
    logRegistrationStageFailure(stage, error);
    if (uploadIntent) {
      try {
        await cleanupUploadIntent(publishedForm.eventId, uploadIntent.id);
      } catch {
        // Preserve the generic response when orphan cleanup is unavailable.
      }
    }
    return stateWithGeneralError(GENERAL_ERROR);
  }
}

function collectiveResultFailure(
  index: number,
  participant: Partial<NormalizedCollectiveParticipantData>,
  message: string,
): CollectiveParticipantResult {
  return {
    index,
    status: "failed",
    fullName: participant.full_name ?? `Peserta ${index + 1}`,
    email: participant.email ?? "",
    emailDelivery: "not-attempted",
    billingEmailDelivery: "not-attempted",
    message,
  };
}

async function processCollectiveParticipant(
  supabase: ReturnType<typeof createAdminClient>,
  batchId: string,
  batchKey: string,
  index: number,
  participant: NormalizedCollectiveParticipantData,
  eventId: string,
  formVersionId: string,
  eventName: string | undefined,
  eventDateRange: string | null,
): Promise<CollectiveParticipantResult> {
  let stage: RegistrationDiagnosticStage = "rpc-v8";
  try {
    const idempotencyKey = `collective:${batchKey}:${index + 1}`;
    if (participant.actuarial_consultant_status === "Peserta Baru") {
      const uploadIntentId = participant.certificate_upload_id;
      if (!isUuid(uploadIntentId)) {
        return collectiveResultFailure(index, participant, UPLOAD_ERROR);
      }

      const uploadIntent = await loadUploadIntent(supabase, uploadIntentId);
      if (
        !uploadIntent ||
        uploadIntent.event_id !== eventId ||
        uploadIntent.email !== participant.email ||
        (uploadIntent.status !== "PENDING" && uploadIntent.status !== "CLEANING" && uploadIntent.status !== "CONSUMED")
      ) {
        return collectiveResultFailure(index, participant, UPLOAD_ERROR);
      }

      if (uploadIntent.status === "CLEANING") {
        await cleanupUploadIntent(eventId, uploadIntent.id);
        return collectiveResultFailure(index, participant, UPLOAD_ERROR);
      }

      // A consumed intent is allowed through only for an idempotent retry; the
      // reservation RPC returns the existing participant before using it.
      if (uploadIntent.status === "PENDING") {
        if (new Date(uploadIntent.expires_at).getTime() <= Date.now()) {
          await cleanupUploadIntent(eventId, uploadIntent.id);
          return collectiveResultFailure(index, participant, UPLOAD_ERROR);
        }

        stage = "storage-upload";
        if (!(await validateUploadedCertificate(supabase, uploadIntent))) {
          await cleanupUploadIntent(eventId, uploadIntent.id);
          return collectiveResultFailure(index, participant, UPLOAD_ERROR);
        }
        stage = "rpc-v8";
      }
    }

    const { data: reservationData, error: reservationError } = await supabase.rpc(
      "create_participant_with_registration_reservation_v8",
      {
        p_full_name: participant.full_name,
        p_email: participant.email,
        p_phone_number: participant.phone_number,
        p_kka_name: participant.kka_name,
        p_position: participant.position,
        p_polo_size: participant.polo_size,
        p_polo_model: participant.polo_model,
        p_package_type: participant.package_type,
        p_participation_scope: participant.participation_scope,
        p_actuarial_consultant_status: participant.actuarial_consultant_status,
        p_attends_pai_congress: participant.attends_pai_congress,
        p_privacy_consent_at: new Date().toISOString(),
        p_certificate_upload_intent_id: participant.certificate_upload_id || null,
        p_idempotency_key: idempotencyKey,
        p_batch_id: batchId,
        p_member_number: participant.member_number || null,
        p_institution: participant.institution || null,
        p_travel: participant.include_travel ? participant.travel : null,
        p_event_id: eventId,
        p_form_version_id: formVersionId,
        p_answers: participant.form_answers,
      },
    );

    if (reservationError || !reservationData) {
      logRegistrationStageFailure("rpc-v8", reservationError ?? new Error("collective reservation failed"));
      if (participant.certificate_upload_id) await cleanupUploadIntent(eventId, participant.certificate_upload_id);
      return collectiveResultFailure(index, participant, "Peserta gagal dibuat karena error sistem.");
    }

    const reservation = (Array.isArray(reservationData) ? reservationData[0] : reservationData) as RegistrationReservation | undefined;
    if (!reservation) {
      if (participant.certificate_upload_id) await cleanupUploadIntent(eventId, participant.certificate_upload_id);
      return collectiveResultFailure(index, participant, "Peserta gagal dibuat karena error sistem.");
    }
    if (reservation.result_code === "DUPLICATE_MEMBER_NUMBER") {
      if (participant.certificate_upload_id) await cleanupUploadIntent(eventId, participant.certificate_upload_id);
      return collectiveResultFailure(index, participant, "Nomor anggota sudah digunakan peserta lain.");
    }
    if (reservation.result_code === "BATCH_MISMATCH") {
      if (participant.certificate_upload_id) await cleanupUploadIntent(eventId, participant.certificate_upload_id);
      return collectiveResultFailure(index, participant, "Data batch tidak konsisten. Silakan kirim ulang formulir.");
    }
    if (
      !["CREATED", "ALREADY_CREATED"].includes(reservation.result_code) ||
      !reservation.participant_id ||
      !reservation.registration_id ||
      !reservation.full_name ||
      !reservation.email ||
      !reservation.qr_token ||
      !reservation.email_log_id ||
      !Number.isSafeInteger(reservation.email_generation) ||
      reservation.email_generation === null ||
      !reservation.billing_id ||
      !reservation.billing_number ||
      !reservation.billing_amount ||
      !reservation.billing_created_at
    ) {
      if (participant.certificate_upload_id) await cleanupUploadIntent(eventId, participant.certificate_upload_id);
      return collectiveResultFailure(index, participant, "Peserta gagal dibuat karena data billing tidak lengkap.");
    }

    stage = "registration-email";
    const reservedEmailLog = await getReservedEmailLog(
      supabase,
      reservation.participant_id,
      reservation.email_log_id,
      reservation.email_generation,
    );
    if (!reservedEmailLog) {
      return collectiveResultFailure(index, participant, "Peserta berhasil diproses, tetapi status email tidak tersedia.");
    }

    let emailDelivery: EmailDeliveryStatus = reservedEmailLog.status === "SENT" ? "accepted" : "failed";
    if (reservedEmailLog.status === "PENDING") {
      try {
        const emailResult = await sendRegistrationEmail({
          recipientEmail: reservedEmailLog.recipient_email,
          fullName: reservation.full_name,
          registrationId: reservation.registration_id,
          packageType: participant.package_type,
          participationScope: participant.participation_scope,
          actuarialConsultantStatus: participant.actuarial_consultant_status,
          attendsPaiCongress: participant.attends_pai_congress,
          qrPngBuffer: await generateParticipantQrPng(reservation.qr_token),
          idempotencyKey: `registration:${reservation.participant_id}`,
          eventName,
          eventDateRange,
        });
        if (emailResult.success) {
          emailDelivery = "accepted";
          await finalizeRegistrationEmail(
            supabase,
            reservation.participant_id,
            reservation.email_log_id,
            reservation.email_generation,
            "SENT",
            emailResult.providerMessageId,
            null,
          );
        } else {
          logRegistrationStageDetails("registration-email", emailResult.diagnostic);
          await finalizeRegistrationEmail(
            supabase,
            reservation.participant_id,
            reservation.email_log_id,
            reservation.email_generation,
            "FAILED",
            null,
            emailResult.errorCategory,
            emailResult.errorMessage,
          );
        }
      } catch (error) {
        logRegistrationStageFailure("registration-email", error);
        await finalizeRegistrationEmail(
          supabase,
          reservation.participant_id,
          reservation.email_log_id,
          reservation.email_generation,
          "FAILED",
          null,
          "QR_GENERATION_ERROR",
        );
      }
    }

    stage = "billing-email";
    let billingEmailDelivery: EmailDeliveryStatus = "failed";
    const existingBillingStatus = await getBillingEmailLogStatus(supabase, reservation.billing_id);
    if (existingBillingStatus === "SENT") billingEmailDelivery = "accepted";
    if (existingBillingStatus === "PENDING" || existingBillingStatus === null) {
      try {
        const billingEmailResult = await sendBillingEmail({
          recipientEmail: reservation.email,
          billingNumber: reservation.billing_number,
          registrationId: reservation.registration_id,
          fullName: reservation.full_name,
          kkaName: participant.kka_name,
          packageType: participant.package_type,
          participationScope: participant.participation_scope,
          amount: reservation.billing_amount,
          createdAt: formatBillingDate(reservation.billing_created_at),
          idempotencyKey: `billing:${reservation.billing_id}`,
          eventName,
        });
        if (billingEmailResult.success) {
          billingEmailDelivery = "accepted";
          await finalizeBillingEmail(supabase, reservation.billing_id, "SENT", billingEmailResult.providerMessageId, null);
        } else {
          logRegistrationStageDetails("billing-email", billingEmailResult.diagnostic);
          await finalizeBillingEmail(supabase, reservation.billing_id, "FAILED", null, billingEmailResult.errorMessage);
        }
      } catch (error) {
        logRegistrationStageFailure("billing-email", error);
        await finalizeBillingEmail(supabase, reservation.billing_id, "FAILED", null, "Billing email failed");
      }
    }

    const allEmailsAccepted = emailDelivery === "accepted" && billingEmailDelivery === "accepted";
    return {
      index,
      status: allEmailsAccepted ? "created-email-sent" : "created-email-failed",
      registrationId: reservation.registration_id,
      billingNumber: reservation.billing_number,
      amount: reservation.billing_amount,
      fullName: reservation.full_name,
      email: reservation.email,
      emailDelivery,
      billingEmailDelivery,
      message: allEmailsAccepted
        ? "Peserta berhasil dibuat dan email QR serta tagihan terkirim."
        : "Peserta berhasil dibuat, tetapi satu atau lebih email gagal dikirim.",
    };
  } catch (error) {
    logRegistrationStageFailure(stage, error);
    if (participant.certificate_upload_id) await cleanupUploadIntent(eventId, participant.certificate_upload_id);
    return collectiveResultFailure(index, participant, "Peserta gagal dibuat karena error sistem.");
  }
}

function collectiveValidationErrors(error: { issues: Array<{ path: PropertyKey[]; message: string }> }) {
  const fieldErrors: Array<Partial<Record<string, string>>> = [];
  for (const issue of error.issues) {
    const index = issue.path[1];
    if (issue.path[0] !== "participants" || typeof index !== "number") continue;
    fieldErrors[index] ??= {};
    const field = issue.path.slice(2).join(".") || "form";
    fieldErrors[index][field] ??= issue.message;
  }
  return fieldErrors;
}

export async function submitCollectiveRegistration(
  previousState: CollectiveRegistrationActionState,
  formData: FormData,
): Promise<CollectiveRegistrationActionState> {
  void previousState;

  let payload: unknown;
  try {
    payload = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return { ...initialCollectiveRegistrationState, status: "general-error", generalError: GENERAL_ERROR };
  }

  const parsed = collectiveRegistrationPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    const cleanupTarget = getCollectiveUploadCleanupTarget(payload);
    if (cleanupTarget) await cleanupCollectiveUploadIntents(cleanupTarget.eventId, cleanupTarget.intentIds);
    return {
      ...initialCollectiveRegistrationState,
      status: "validation-error",
      fieldErrors: collectiveValidationErrors(parsed.error),
    };
  }

  const cleanupTarget = getCollectiveUploadCleanupTarget(parsed.data);
  const publishedForm = await loadPublishedEventFormById(parsed.data.event_id, parsed.data.form_version_id);
  if (!publishedForm) {
    if (cleanupTarget) await cleanupCollectiveUploadIntents(cleanupTarget.eventId, cleanupTarget.intentIds);
    return { ...initialCollectiveRegistrationState, status: "general-error", generalError: REGISTRATION_CLOSED_ERROR };
  }

  const normalizedParticipants: NormalizedCollectiveParticipantData[] = [];
  const formErrors: Array<Partial<Record<string, string>>> = [];
  parsed.data.participants.forEach((participant, index) => {
    const answerValidation = validateRegistrationFormAnswers(publishedForm.config, participant.form_answers);
    if (!answerValidation.success) {
      formErrors[index] = answerValidation.errors;
      return;
    }
    const valuesData = new FormData();
    valuesData.set("certificate_upload_id", participant.certificate_upload_id ?? "");
    const coreValues = coreRegistrationValues(answerValidation.data, valuesData);
    const normalized = collectiveParticipantSchema.safeParse({
      ...participant,
      ...coreValues,
      form_answers: answerValidation.data,
    });
    if (!normalized.success) {
      formErrors[index] = getCollectiveParticipantFieldErrors(normalized.error);
      return;
    }
    normalizedParticipants[index] = normalized.data;
  });
  if (formErrors.some(Boolean) || normalizedParticipants.some((participant) => !participant)) {
    if (cleanupTarget) await cleanupCollectiveUploadIntents(cleanupTarget.eventId, cleanupTarget.intentIds);
    return {
      ...initialCollectiveRegistrationState,
      status: "validation-error",
      fieldErrors: formErrors,
    };
  }

  try {
    const supabase = createAdminClient({ scope: "public-event", eventId: publishedForm.eventId });
    const { data: batch, error: batchError } = await supabase
      .from("registration_batches")
      .upsert(
        { idempotency_key: parsed.data.idempotency_key, mode: "COLLECTIVE" },
        { onConflict: "idempotency_key" },
      )
      .select("id, batch_code")
      .single();

    if (batchError || !batch) {
      await Promise.all(
        normalizedParticipants
          .map((participant) => participant.certificate_upload_id)
          .filter(Boolean)
          .map((intentId) => cleanupUploadIntent(publishedForm.eventId, intentId)),
      );
      return { ...initialCollectiveRegistrationState, status: "general-error", generalError: GENERAL_ERROR };
    }

    const settled = await Promise.allSettled(
      normalizedParticipants.map((participant, index) =>
        processCollectiveParticipant(
          supabase,
          batch.id,
          parsed.data.idempotency_key,
          index,
          participant,
          publishedForm.eventId,
          publishedForm.versionId,
          emailEventName(publishedForm),
          formatEventDateRange(publishedForm),
        ),
      ),
    );
    const participants = settled.map((result, index) =>
      result.status === "fulfilled"
        ? result.value
        : collectiveResultFailure(index, normalizedParticipants[index], "Peserta gagal dibuat karena error sistem."),
    );

    return {
      status: "submitted",
      fieldErrors: [],
      batchCode: batch.batch_code,
      participants,
    };
  } catch (error) {
    logRegistrationStageFailure("collective-batch", error);
    if (cleanupTarget) await cleanupCollectiveUploadIntents(cleanupTarget.eventId, cleanupTarget.intentIds);
    return { ...initialCollectiveRegistrationState, status: "general-error", generalError: GENERAL_ERROR };
  }
}
