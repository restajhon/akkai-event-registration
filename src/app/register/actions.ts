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

type RegistrationReservation = {
  result_code: string;
  participant_id: string | null;
  registration_id: string | null;
  full_name: string | null;
  email: string | null;
  qr_token: string | null;
  email_log_id: string | null;
  email_generation: number | null;
};

type FinalizationResult = {
  result_code: string;
};

type ReservedEmailLog = {
  participant_id: string;
  recipient_email: string;
  email_generation: number;
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
    kka_name: getFormValue(formData, "kka_name"),
    polo_size: getFormValue(formData, "polo_size"),
    polo_model: getFormValue(formData, "polo_model"),
    package_type: getFormValue(formData, "package_type"),
    participation_scope: getFormValue(formData, "participation_scope"),
    actuarial_consultant_status: getFormValue(
      formData,
      "actuarial_consultant_status",
    ),
    attends_pai_congress: getFormValue(formData, "attends_pai_congress"),
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

async function finalizeEmailAttempt(
  supabase: ReturnType<typeof createAdminClient>,
  participantId: string,
  emailLogId: string,
  emailGeneration: number,
  finalStatus: "SENT" | "FAILED",
  providerMessageId: string | null,
  errorCategory: RegistrationEmailErrorCategory | null,
): Promise<FinalizationResult | null> {
  const { data, error } = await supabase.rpc(
    "finalize_participant_email_attempt",
    {
      p_participant_id: participantId,
      p_email_log_id: emailLogId,
      p_email_generation: emailGeneration,
      p_final_status: finalStatus,
      p_provider_message_id: providerMessageId,
      p_error_category: errorCategory,
      p_sent_at: finalStatus === "SENT" ? new Date().toISOString() : null,
    },
  );

  if (error) {
    return null;
  }

  return (Array.isArray(data) ? data[0] : data) as FinalizationResult | null;
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

  if (
    error ||
    !data ||
    data.participant_id !== participantId ||
    data.email_generation !== emailGeneration
  ) {
    return null;
  }

  return data as ReservedEmailLog;
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
    const { data: reservationData, error: reservationError } = await supabase.rpc(
      "create_participant_with_registration_reservation_v3",
      {
        p_full_name: parsed.data.full_name,
        p_email: parsed.data.email,
        p_phone_number: parsed.data.phone_number,
        p_kka_name: parsed.data.kka_name,
        p_polo_size: parsed.data.polo_size,
        p_polo_model: parsed.data.polo_model,
        p_package_type: parsed.data.package_type,
        p_participation_scope: parsed.data.participation_scope,
        p_actuarial_consultant_status: parsed.data.actuarial_consultant_status,
        p_attends_pai_congress: parsed.data.attends_pai_congress,
        p_privacy_consent_at: new Date().toISOString(),
      },
    );

    if (reservationError || !reservationData) {
      return stateWithGeneralError(GENERAL_ERROR);
    }

    const reservation = (Array.isArray(reservationData)
      ? reservationData[0]
      : reservationData) as RegistrationReservation | undefined;

    if (!reservation) {
      return stateWithGeneralError(GENERAL_ERROR);
    }

    if (reservation.result_code === "DUPLICATE_EMAIL") {
      return {
        status: "duplicate-email",
        fieldErrors: {},
        emailDelivery: "not-attempted",
        generalError: DUPLICATE_EMAIL_ERROR,
      };
    }

    if (reservation.result_code === "DUPLICATE_MEMBER_NUMBER") {
      return {
        status: "duplicate-member-number",
        fieldErrors: {},
        emailDelivery: "not-attempted",
        generalError: DUPLICATE_MEMBER_NUMBER_ERROR,
      };
    }

    if (reservation.result_code === "INVALID_INPUT") {
      return stateWithGeneralError(
        "Data pendaftaran belum dapat diproses. Silakan periksa kembali.",
      );
    }

    const emailGeneration = reservation.email_generation;

    if (
      reservation.result_code !== "CREATED" ||
      !reservation.participant_id ||
      !reservation.registration_id ||
      !reservation.full_name ||
      !reservation.email ||
      !reservation.qr_token ||
      !reservation.email_log_id ||
      emailGeneration === null ||
      !Number.isSafeInteger(emailGeneration) ||
      emailGeneration < 0
    ) {
      return stateWithGeneralError(GENERAL_ERROR);
    }

    const participantId = reservation.participant_id;
    const registrationId = reservation.registration_id;
    const fullName = reservation.full_name;
    const qrToken = reservation.qr_token;
    const emailLogId = reservation.email_log_id;
    const idempotencyKey = `registration:${participantId}`;
    const reservedEmailLog = await getReservedEmailLog(
      supabase,
      participantId,
      emailLogId,
      emailGeneration,
    );

    if (!reservedEmailLog || reservedEmailLog.status !== "PENDING") {
      return stateWithGeneralError(GENERAL_ERROR);
    }

    let qrPngBuffer: Buffer;
    try {
      qrPngBuffer = await generateParticipantQrPng(qrToken);
    } catch {
      await finalizeEmailAttempt(
        supabase,
        participantId,
        emailLogId,
        reservedEmailLog.email_generation,
        "FAILED",
        null,
        "QR_GENERATION_ERROR",
      );
      return submittedState(registrationId, "failed");
    }

    const emailResult = await sendRegistrationEmail({
      recipientEmail: reservedEmailLog.recipient_email,
      fullName,
      registrationId,
      packageType: parsed.data.package_type,
      participationScope: parsed.data.participation_scope,
      actuarialConsultantStatus: parsed.data.actuarial_consultant_status,
      attendsPaiCongress: parsed.data.attends_pai_congress,
      qrPngBuffer,
      idempotencyKey,
    });

    if (!emailResult.success) {
      await finalizeEmailAttempt(
        supabase,
        participantId,
        emailLogId,
        reservedEmailLog.email_generation,
        "FAILED",
        null,
        emailResult.errorCategory,
      );
      return submittedState(registrationId, "failed");
    }

    const finalization = await finalizeEmailAttempt(
      supabase,
      participantId,
      emailLogId,
      reservedEmailLog.email_generation,
      "SENT",
      emailResult.providerMessageId,
      null,
    );

    return {
      ...submittedState(registrationId, "accepted"),
      emailStatusSyncPending:
        finalization?.result_code !== "CURRENT_GENERATION",
    };
  } catch {
    return stateWithGeneralError(GENERAL_ERROR);
  }
}
