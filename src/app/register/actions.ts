"use server";

import { AKKAI_EVENT } from "@/lib/akkai-event";
import {
  type EmailDeliveryStatus,
  type RegistrationActionState,
} from "@/lib/registration/registration-action-state";
import { sendRegistrationEmail } from "@/lib/email/registration-email";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateParticipantQrPng } from "@/lib/qr/participant-qr";
import {
  getRegistrationFieldErrors,
  registrationSchema,
  type RegistrationFormValues,
} from "@/lib/validation/registration";
import type { RegistrationEmailErrorCategory } from "@/lib/email/registration-email";

const GENERAL_ERROR =
  "Terjadi kendala saat memproses pendaftaran. Silakan coba kembali.";
const DUPLICATE_EMAIL_ERROR =
  "Email ini sudah terdaftar. Silakan cek email konfirmasi sebelumnya atau hubungi panitia.";
const DUPLICATE_MEMBER_NUMBER_ERROR =
  "Nomor anggota ini sudah terdaftar. Silakan cek kembali data Anda atau hubungi panitia.";
const REGISTRATION_CLOSED_ERROR = "Periode registrasi telah ditutup.";
const EMAIL_LOG_IDEMPOTENCY_CONSTRAINT =
  "email_logs_idempotency_key_unique";

type ParticipantEmailData = {
  id: string;
  registration_id: string;
  full_name: string;
  email: string;
  qr_token: string;
};

type ExistingEmailLog = {
  id: string;
  status: "PENDING" | "SENT" | "FAILED";
};

function getFormValue(formData: FormData, field: string) {
  const value = formData.get(field);
  return typeof value === "string" ? value : "";
}

function getFormValues(formData: FormData): RegistrationFormValues {
  const privacyConsent = formData.get("privacy_consent");

  return {
    full_name: getFormValue(formData, "full_name"),
    email: getFormValue(formData, "email"),
    phone_number: getFormValue(formData, "phone_number"),
    institution: getFormValue(formData, "institution"),
    participant_category: getFormValue(formData, "participant_category"),
    member_number: getFormValue(formData, "member_number"),
    privacy_consent: privacyConsent === "on" || privacyConsent === "true",
  };
}

function stateWithGeneralError(generalError: string): RegistrationActionState {
  return {
    status: "general-error",
    fieldErrors: {},
    emailDelivery: "not-attempted",
    generalError,
  };
}

function submittedState(
  registrationId: string,
  emailDelivery: EmailDeliveryStatus,
): RegistrationActionState {
  return {
    status: "submitted",
    fieldErrors: {},
    registrationId,
    emailDelivery,
  };
}

function errorContainsConstraint(error: unknown, constraintName: string) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const databaseError = error as {
    message?: unknown;
    details?: unknown;
    hint?: unknown;
  };

  return [databaseError.message, databaseError.details, databaseError.hint].some(
    (value) =>
      typeof value === "string" && value.includes(constraintName),
  );
}

function isUniqueViolation(error: unknown, constraintName: string) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const databaseError = error as { code?: unknown };

  return (
    databaseError.code === "23505" &&
    errorContainsConstraint(error, constraintName)
  );
}

function getDatabaseErrorState(error: unknown): RegistrationActionState {
  const databaseError =
    error && typeof error === "object"
      ? (error as { code?: unknown })
      : {};

  if (
    databaseError.code === "23505" &&
    errorContainsConstraint(error, "participants_email_lower_unique")
  ) {
    return {
      status: "duplicate-email",
      fieldErrors: {},
      emailDelivery: "not-attempted",
      generalError: DUPLICATE_EMAIL_ERROR,
    };
  }

  if (
    databaseError.code === "23505" &&
    errorContainsConstraint(error, "participants_member_number_upper_unique")
  ) {
    return {
      status: "duplicate-member-number",
      fieldErrors: {},
      emailDelivery: "not-attempted",
      generalError: DUPLICATE_MEMBER_NUMBER_ERROR,
    };
  }

  return stateWithGeneralError(GENERAL_ERROR);
}

function getExistingEmailDelivery(
  status: ExistingEmailLog["status"],
): EmailDeliveryStatus {
  if (status === "SENT") {
    return "sent";
  }

  if (status === "FAILED") {
    return "failed";
  }

  return "not-attempted";
}

async function getExistingEmailLog(
  supabase: ReturnType<typeof createAdminClient>,
  idempotencyKey: string,
): Promise<ExistingEmailLog | null> {
  const { data, error } = await supabase
    .from("email_logs")
    .select("id, status")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    status: data.status as ExistingEmailLog["status"],
  };
}

async function markParticipantEmailFailed(
  supabase: ReturnType<typeof createAdminClient>,
  participantId: string,
) {
  await supabase
    .from("participants")
    .update({ email_status: "FAILED" })
    .eq("id", participantId);
}

async function markEmailLogFailed(
  supabase: ReturnType<typeof createAdminClient>,
  emailLogId: string,
  errorCategory: RegistrationEmailErrorCategory,
) {
  await supabase
    .from("email_logs")
    .update({
      status: "FAILED",
      provider_message_id: null,
      error_message: errorCategory,
      sent_at: null,
    })
    .eq("id", emailLogId);
}

async function markEmailDeliveryFailed(
  supabase: ReturnType<typeof createAdminClient>,
  participantId: string,
  emailLogId: string,
  errorCategory: RegistrationEmailErrorCategory,
) {
  await markEmailLogFailed(supabase, emailLogId, errorCategory);
  await markParticipantEmailFailed(supabase, participantId);
}

async function markEmailDeliverySent(
  supabase: ReturnType<typeof createAdminClient>,
  participantId: string,
  emailLogId: string,
  providerMessageId: string,
) {
  const sentAt = new Date().toISOString();
  const { error: emailLogError } = await supabase
    .from("email_logs")
    .update({
      status: "SENT",
      provider_message_id: providerMessageId,
      error_message: null,
      sent_at: sentAt,
    })
    .eq("id", emailLogId);
  const { error: participantError } = await supabase
    .from("participants")
    .update({
      email_status: "SENT",
      last_email_sent_at: sentAt,
    })
    .eq("id", participantId);

  return !emailLogError && !participantError;
}

export async function submitRegistration(
  previousState: RegistrationActionState,
  formData: FormData,
): Promise<RegistrationActionState> {
  void previousState;

  if (!AKKAI_EVENT.registrationOpen) {
    return stateWithGeneralError(REGISTRATION_CLOSED_ERROR);
  }

  const parsed = registrationSchema.safeParse(getFormValues(formData));

  if (!parsed.success) {
    return {
      status: "validation-error",
      fieldErrors: getRegistrationFieldErrors(parsed.error),
      emailDelivery: "not-attempted",
    };
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("participants")
      .insert({
        full_name: parsed.data.full_name,
        email: parsed.data.email,
        phone_number: parsed.data.phone_number,
        institution: parsed.data.institution,
        participant_category: parsed.data.participant_category,
        member_number: parsed.data.member_number,
        privacy_consent_at: new Date().toISOString(),
      })
      .select("id, registration_id, full_name, email, qr_token")
      .single();

    if (error || !data?.registration_id) {
      return getDatabaseErrorState(error);
    }

    const participant = data as ParticipantEmailData;
    const idempotencyKey = `registration:${participant.id}`;
    const { data: emailLog, error: emailLogError } = await supabase
      .from("email_logs")
      .insert({
        participant_id: participant.id,
        email_type: "REGISTRATION",
        recipient_email: participant.email,
        status: "PENDING",
        idempotency_key: idempotencyKey,
        sent_by: null,
        provider_message_id: null,
        error_message: null,
        sent_at: null,
      })
      .select("id")
      .single();

    if (emailLogError || !emailLog?.id) {
      if (isUniqueViolation(emailLogError, EMAIL_LOG_IDEMPOTENCY_CONSTRAINT)) {
        const existingEmailLog = await getExistingEmailLog(
          supabase,
          idempotencyKey,
        );

        return submittedState(
          participant.registration_id,
          existingEmailLog
            ? getExistingEmailDelivery(existingEmailLog.status)
            : "not-attempted",
        );
      }

      await markParticipantEmailFailed(supabase, participant.id);
      return submittedState(participant.registration_id, "failed");
    }

    let qrPngBuffer: Buffer;
    try {
      qrPngBuffer = await generateParticipantQrPng(participant.qr_token);
    } catch {
      await markEmailDeliveryFailed(
        supabase,
        participant.id,
        emailLog.id,
        "QR_GENERATION_ERROR",
      );
      return submittedState(participant.registration_id, "failed");
    }

    const emailResult = await sendRegistrationEmail({
      recipientEmail: participant.email,
      fullName: participant.full_name,
      registrationId: participant.registration_id,
      qrPngBuffer,
      idempotencyKey,
    });

    if (!emailResult.success) {
      await markEmailDeliveryFailed(
        supabase,
        participant.id,
        emailLog.id,
        emailResult.errorCategory,
      );
      return submittedState(participant.registration_id, "failed");
    }

    const persisted = await markEmailDeliverySent(
      supabase,
      participant.id,
      emailLog.id,
      emailResult.providerMessageId,
    );

    return submittedState(
      participant.registration_id,
      persisted ? "sent" : "failed",
    );
  } catch {
    return stateWithGeneralError(GENERAL_ERROR);
  }
}
