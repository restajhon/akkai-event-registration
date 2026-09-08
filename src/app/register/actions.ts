"use server";

import { AKKAI_EVENT } from "@/lib/akkai-event";
import { sendBillingEmail } from "@/lib/email/billing-email";
import {
  sendRegistrationEmail,
  type RegistrationEmailErrorCategory,
} from "@/lib/email/registration-email";
import {
  getRegistrationCertificateExtension,
  hasExpectedRegistrationCertificateSignature,
  REGISTRATION_CERTIFICATE_BUCKET,
  validateRegistrationCertificateMetadata,
} from "@/lib/registration/certificate";
import {
  type EmailDeliveryStatus,
  initialRegistrationState,
  type RegistrationActionState,
} from "@/lib/registration/registration-action-state";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateParticipantQrPng } from "@/lib/qr/participant-qr";
import {
  getRegistrationFieldErrors,
  registrationSchema,
  type RegistrationFormValues,
} from "@/lib/validation/registration";
import { participantEmailSchema } from "@/lib/validation/email";

const GENERAL_ERROR =
  "Terjadi kendala saat memproses pendaftaran. Silakan coba kembali.";
const UPLOAD_ERROR =
  "Surat Keterangan Kerja belum dapat divalidasi. Silakan pilih file PDF, JPG, JPEG, atau PNG maksimal 2 MiB.";
const DUPLICATE_EMAIL_ERROR =
  "Email ini sudah terdaftar. Silakan cek email konfirmasi sebelumnya atau hubungi panitia.";
const DUPLICATE_MEMBER_NUMBER_ERROR =
  "Nomor anggota ini sudah terdaftar. Silakan cek kembali data Anda atau hubungi panitia.";
const REGISTRATION_CLOSED_ERROR = "Periode registrasi telah ditutup.";

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
  email: string;
  storage_path: string;
  file_name: string;
  file_mime: string;
  file_size: number;
  status: "PENDING" | "CONSUMED";
  expires_at: string;
};

type ReservedEmailLog = {
  participant_id: string;
  recipient_email: string;
  email_generation: number;
  status: "PENDING" | "SENT" | "FAILED";
};

type UploadPreparationState =
  | { status: "ready"; intentId: string; path: string; token: string }
  | { status: "error"; message: string };

function getFormValue(formData: FormData, field: string) {
  const value = formData.get(field);
  return typeof value === "string" ? value : "";
}

function getFormValues(formData: FormData): RegistrationFormValues {
  return {
    full_name: getFormValue(formData, "full_name"),
    email: getFormValue(formData, "email"),
    phone_number: getFormValue(formData, "phone_number"),
    kka_name: getFormValue(formData, "kka_name"),
    position: getFormValue(formData, "position"),
    polo_size: getFormValue(formData, "polo_size"),
    polo_model: getFormValue(formData, "polo_model"),
    package_type: getFormValue(formData, "package_type"),
    participation_scope: getFormValue(formData, "participation_scope"),
    actuarial_consultant_status: getFormValue(
      formData,
      "actuarial_consultant_status",
    ),
    attends_pai_congress: getFormValue(formData, "attends_pai_congress"),
    privacy_consent: formData.get("privacy_consent") === "on" || formData.get("privacy_consent") === "true",
    certificate_file: null,
    certificate_upload_id: getFormValue(formData, "certificate_upload_id"),
  };
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
    .select("id, email, storage_path, file_name, file_mime, file_size, status, expires_at")
    .eq("id", intentId)
    .maybeSingle();

  return error || !data ? null : (data as UploadIntent);
}

async function cleanupUploadIntent(
  supabase: ReturnType<typeof createAdminClient>,
  intentId: string,
) {
  const intent = await loadUploadIntent(supabase, intentId);
  if (!intent || intent.status !== "PENDING") return;

  await supabase.storage.from(REGISTRATION_CERTIFICATE_BUCKET).remove([intent.storage_path]);
  await supabase
    .from("registration_certificate_upload_intents")
    .delete()
    .eq("id", intentId)
    .eq("status", "PENDING");
}

export async function prepareRegistrationCertificateUpload(
  formData: FormData,
): Promise<UploadPreparationState> {
  const fileMetadata = {
    file_name: getFormValue(formData, "file_name"),
    file_type: getFormValue(formData, "file_type"),
    file_size: Number(getFormValue(formData, "file_size")),
  };
  const fileError = validateRegistrationCertificateMetadata(fileMetadata);
  if (fileError) return { status: "error", message: fileError };
  const emailResult = participantEmailSchema.safeParse(getFormValue(formData, "email"));
  if (!emailResult.success) return { status: "error", message: UPLOAD_ERROR };

  try {
    const supabase = createAdminClient();
    const email = emailResult.data;
    const path = `certificates/${crypto.randomUUID()}.${getRegistrationCertificateExtension(fileMetadata.file_name)}`;
    const { data: intent, error: intentError } = await supabase
      .from("registration_certificate_upload_intents")
      .insert({
        email,
        storage_path: path,
        file_name: getSafeFileName(fileMetadata.file_name),
        file_mime: fileMetadata.file_type,
        file_size: fileMetadata.file_size,
      })
      .select("id")
      .single();

    if (intentError || !intent) return { status: "error", message: GENERAL_ERROR };

    const { data: signedUpload, error: signedUploadError } = await supabase.storage
      .from(REGISTRATION_CERTIFICATE_BUCKET)
      .createSignedUploadUrl(path, { upsert: false });

    if (signedUploadError || !signedUpload) {
      await cleanupUploadIntent(supabase, intent.id);
      return { status: "error", message: GENERAL_ERROR };
    }

    return {
      status: "ready",
      intentId: intent.id,
      path: signedUpload.path,
      token: signedUpload.token,
    };
  } catch {
    return { status: "error", message: GENERAL_ERROR };
  }
}

export async function cancelRegistrationCertificateUpload(intentId: string) {
  if (!isUuid(intentId)) return;

  try {
    await cleanupUploadIntent(createAdminClient(), intentId);
  } catch {
    // Expiring intents and private paths limit the impact of best-effort cleanup.
  }
}

async function validateUploadedCertificate(
  supabase: ReturnType<typeof createAdminClient>,
  intent: UploadIntent,
) {
  const { data: downloadedFile, error } = await supabase.storage
    .from(REGISTRATION_CERTIFICATE_BUCKET)
    .download(intent.storage_path);

  if (error || !downloadedFile || downloadedFile.type !== intent.file_mime) return false;

  const bytes = new Uint8Array(await downloadedFile.arrayBuffer());
  const metadataError = validateRegistrationCertificateMetadata({
    file_name: intent.file_name,
    file_type: downloadedFile.type,
    file_size: bytes.byteLength,
  });

  return (
    downloadedFile.size === bytes.byteLength &&
    bytes.byteLength === intent.file_size &&
    !metadataError &&
    hasExpectedRegistrationCertificateSignature(
      getRegistrationCertificateExtension(intent.file_name),
      bytes,
    )
  );
}

async function finalizeRegistrationEmail(
  supabase: ReturnType<typeof createAdminClient>,
  participantId: string,
  emailLogId: string,
  emailGeneration: number,
  finalStatus: "SENT" | "FAILED",
  providerMessageId: string | null,
  errorCategory: RegistrationEmailErrorCategory | null,
) {
  try {
    await supabase.rpc("finalize_participant_email_attempt", {
      p_participant_id: participantId,
      p_email_log_id: emailLogId,
      p_email_generation: emailGeneration,
      p_final_status: finalStatus,
      p_provider_message_id: providerMessageId,
      p_error_category: errorCategory,
      p_sent_at: finalStatus === "SENT" ? new Date().toISOString() : null,
    });
  } catch {
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
  } catch {
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

function formatBillingDate(dateValue: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long",
    timeZone: "Asia/Jakarta",
  }).format(new Date(dateValue));
}

export async function submitRegistration(
  previousState: RegistrationActionState,
  formData: FormData,
): Promise<RegistrationActionState> {
  void previousState;

  if (!AKKAI_EVENT.registrationOpen) return stateWithGeneralError(REGISTRATION_CLOSED_ERROR);

  const directFile = formData.get("certificate_file");
  if (typeof File !== "undefined" && directFile instanceof File && directFile.size > 0) {
    return stateWithGeneralError(UPLOAD_ERROR);
  }

  const parsed = registrationSchema.safeParse(getFormValues(formData));
  if (!parsed.success) {
    return {
      status: "validation-error",
      fieldErrors: getRegistrationFieldErrors(parsed.error),
      emailDelivery: "not-attempted",
      billingEmailDelivery: "not-attempted",
    };
  }

  let supabase: ReturnType<typeof createAdminClient>;
  let uploadIntent: UploadIntent | null = null;

  try {
    supabase = createAdminClient();

    if (parsed.data.actuarial_consultant_status === "Peserta Baru") {
      if (!isUuid(parsed.data.certificate_upload_id)) return stateWithGeneralError(UPLOAD_ERROR);
      uploadIntent = await loadUploadIntent(supabase, parsed.data.certificate_upload_id);
      if (
        !uploadIntent ||
        uploadIntent.status !== "PENDING" ||
        uploadIntent.email !== parsed.data.email ||
        new Date(uploadIntent.expires_at).getTime() <= Date.now() ||
        !(await validateUploadedCertificate(supabase, uploadIntent))
      ) {
        if (uploadIntent?.status === "PENDING") await cleanupUploadIntent(supabase, uploadIntent.id);
        return stateWithGeneralError(UPLOAD_ERROR);
      }
    }

    const { data: reservationData, error: reservationError } = await supabase.rpc(
      "create_participant_with_registration_reservation_v4",
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
      },
    );

    if (reservationError || !reservationData) {
      if (uploadIntent) await cleanupUploadIntent(supabase, uploadIntent.id);
      return stateWithGeneralError(GENERAL_ERROR);
    }

    const reservation = (Array.isArray(reservationData) ? reservationData[0] : reservationData) as RegistrationReservation | undefined;
    if (!reservation) return stateWithGeneralError(GENERAL_ERROR);

    if (reservation.result_code === "DUPLICATE_EMAIL") {
      if (uploadIntent) await cleanupUploadIntent(supabase, uploadIntent.id);
      return {
        status: "duplicate-email",
        fieldErrors: {},
        emailDelivery: "not-attempted",
        billingEmailDelivery: "not-attempted",
        generalError: DUPLICATE_EMAIL_ERROR,
      };
    }

    if (reservation.result_code === "DUPLICATE_MEMBER_NUMBER") {
      if (uploadIntent) await cleanupUploadIntent(supabase, uploadIntent.id);
      return {
        status: "duplicate-member-number",
        fieldErrors: {},
        emailDelivery: "not-attempted",
        billingEmailDelivery: "not-attempted",
        generalError: DUPLICATE_MEMBER_NUMBER_ERROR,
      };
    }

    if (
      reservation.result_code !== "CREATED" ||
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
      if (uploadIntent) await cleanupUploadIntent(supabase, uploadIntent.id);
      return stateWithGeneralError(GENERAL_ERROR);
    }

    const reservedEmailLog = await getReservedEmailLog(
      supabase,
      reservation.participant_id,
      reservation.email_log_id,
      reservation.email_generation,
    );
    if (!reservedEmailLog || reservedEmailLog.status !== "PENDING") return stateWithGeneralError(GENERAL_ERROR);

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

    let emailDelivery: EmailDeliveryStatus = "failed";
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
        await finalizeRegistrationEmail(
          supabase,
          reservation.participant_id,
          reservation.email_log_id,
          reservation.email_generation,
          "FAILED",
          null,
          emailResult.errorCategory,
        );
      }
    } catch {
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

    let billingEmailDelivery: EmailDeliveryStatus = "failed";
    const billingEmailResult = await sendBillingEmail({
      recipientEmail: reservation.email,
      ...billing,
      createdAt: formatBillingDate(reservation.billing_created_at),
      idempotencyKey: `billing:${reservation.billing_id}`,
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
      await finalizeBillingEmail(
        supabase,
        reservation.billing_id,
        "FAILED",
        null,
        billingEmailResult.errorMessage,
      );
    }

    return submittedState(
      reservation.registration_id,
      emailDelivery,
      billing,
      billingEmailDelivery,
    );
  } catch {
    if (uploadIntent) {
      try {
        await cleanupUploadIntent(createAdminClient(), uploadIntent.id);
      } catch {
        // Preserve the generic response when orphan cleanup is unavailable.
      }
    }
    return stateWithGeneralError(GENERAL_ERROR);
  }
}
