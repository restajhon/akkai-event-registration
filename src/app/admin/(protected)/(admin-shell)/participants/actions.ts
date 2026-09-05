"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getAuthorizedProfile } from "@/lib/auth/server";
import {
  sendRegistrationEmail,
  type RegistrationEmailErrorCategory,
} from "@/lib/email/registration-email";
import { generateParticipantQrPng } from "@/lib/qr/participant-qr";
import type { ParticipantActionState } from "@/lib/participants/participant-action-state";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  emailCorrectionSchema,
  getEmailCorrectionFieldErrors,
} from "@/lib/validation/email";

const registrationIdSchema = z.string().regex(/^AKKAI26-[0-9]{6}$/);
const STALE_PENDING_WINDOW_MS = 15 * 60 * 1000;

type ParticipantEmailRow = {
  id: string;
  registration_id: string;
  full_name: string;
  email: string;
  qr_token: string;
  email_generation: number;
  package_type: string | null;
  participation_scope: string | null;
  actuarial_consultant_status: string | null;
  attends_pai_congress: boolean | null;
  registration_status: "REGISTERED" | "CANCELLED";
};

type ExistingResendLog = {
  id: string;
  status: "PENDING" | "SENT" | "FAILED";
  created_at: string;
};

type ResendReservation = {
  result_code: string;
  email_log_id: string | null;
};

type ReservedEmailLog = {
  id: string;
  participant_id: string;
  recipient_email: string;
  email_generation: number;
  status: "PENDING" | "SENT" | "FAILED";
};

type FinalizationResult = {
  result_code: string;
};

function errorState(message: string): ParticipantActionState {
  return {
    status: "error",
    message,
  };
}

function infoState(message: string): ParticipantActionState {
  return {
    status: "info",
    message,
  };
}

function minuteBucket(date: Date) {
  const pad = (value: number) => value.toString().padStart(2, "0");

  return [
    date.getUTCFullYear().toString().padStart(4, "0"),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
  ].join("");
}

function readRegistrationId(formData: FormData) {
  const value = formData.get("registrationId");
  return typeof value === "string" ? value.trim() : null;
}

function readFormString(formData: FormData, field: string) {
  const value = formData.get(field);
  return typeof value === "string" ? value : "";
}

function revalidateParticipantPaths(registrationId: string) {
  try {
    revalidatePath("/admin/participants");
    revalidatePath(`/admin/participants/${registrationId}`);
  } catch {
    // Cache refresh failure must not change the provider acceptance result.
  }
}

async function getExistingResendLog(
  supabase: ReturnType<typeof createAdminClient>,
  idempotencyKey: string,
): Promise<ExistingResendLog | null> {
  const { data, error } = await supabase
    .from("email_logs")
    .select("id, status, created_at")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    status: data.status as ExistingResendLog["status"],
    created_at: data.created_at,
  };
}

function existingLogState(
  log: ExistingResendLog,
  now = new Date(),
): ParticipantActionState {
  switch (log.status) {
    case "SENT":
      return infoState(
        "Email telah diterima oleh layanan pengiriman. Silakan cek email peserta.",
      );
    case "PENDING":
      if (
        now.getTime() - new Date(log.created_at).getTime() >=
        STALE_PENDING_WINDOW_MS
      ) {
        return infoState(
          "Status permintaan email belum diketahui. Jangan mengirim ulang pada menit yang sama; periksa kembali atau coba kirim ulang setelahnya.",
        );
      }

      return infoState(
        "Permintaan email masih diproses. Silakan tunggu beberapa saat.",
      );
    case "FAILED":
      return infoState(
        "Upaya email sebelumnya gagal sebelum diterima layanan. Silakan coba kembali beberapa saat lagi.",
      );
  }
}

async function getReservedEmailLog(
  supabase: ReturnType<typeof createAdminClient>,
  emailLogId: string,
): Promise<ReservedEmailLog | null> {
  const { data, error } = await supabase
    .from("email_logs")
    .select("id, participant_id, recipient_email, email_generation, status")
    .eq("id", emailLogId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as ReservedEmailLog;
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

export async function correctParticipantEmail(
  previousState: ParticipantActionState,
  formData: FormData,
): Promise<ParticipantActionState> {
  void previousState;

  const profile = await getAuthorizedProfile("participants.email");
  if (!profile) {
    return errorState("Anda tidak memiliki akses untuk mengubah email peserta.");
  }
  const rawRegistrationId = readRegistrationId(formData);
  const parsedRegistrationId = registrationIdSchema.safeParse(rawRegistrationId);
  const parsedEmail = emailCorrectionSchema.safeParse({
    new_email: readFormString(formData, "newEmail"),
    confirm_new_email: readFormString(formData, "confirmNewEmail"),
  });
  const rawGeneration = readFormString(formData, "emailGeneration");
  const expectedEmailGeneration = Number(rawGeneration);

  if (
    !parsedRegistrationId.success ||
    !parsedEmail.success ||
    !Number.isSafeInteger(expectedEmailGeneration) ||
    expectedEmailGeneration < 0
  ) {
    const fieldErrors = parsedEmail.success
      ? {}
      : getEmailCorrectionFieldErrors(parsedEmail.error);
    const firstError = Object.values(fieldErrors)[0];

    return errorState(firstError ?? "Data email tidak valid.");
  }

  const registrationId = parsedRegistrationId.data;
  const newEmail = parsedEmail.data.new_email;
  const allowStalePending =
    readFormString(formData, "stalePendingConfirmed") === "true";

  try {
    const supabase = createAdminClient();
    const { data: participant, error: participantError } = await supabase
      .from("participants")
      .select("id")
      .eq("registration_id", registrationId)
      .maybeSingle();

    if (participantError || !participant) {
      return errorState("Peserta belum dapat dimuat. Silakan coba kembali.");
    }

    const { data: resultData, error: correctionError } = await supabase.rpc(
      "correct_participant_email",
      {
        p_participant_id: participant.id,
        p_new_email: newEmail,
        p_changed_by: profile.id,
        p_expected_email_generation: expectedEmailGeneration,
        p_allow_stale_pending: allowStalePending,
      },
    );

    if (correctionError) {
      return errorState("Email peserta belum dapat diperbarui. Silakan coba kembali.");
    }

    const result = (Array.isArray(resultData) ? resultData[0] : resultData) as
      | { result_code: string }
      | undefined;

    switch (result?.result_code) {
      case "UPDATED":
        revalidateParticipantPaths(registrationId);
        return {
          status: "success",
          message:
            "Email peserta berhasil diperbarui. Nomor registrasi dan QR tidak berubah. Silakan kirim ulang email registrasi ke alamat baru.",
        };
      case "NO_CHANGE":
        return infoState("Email peserta tidak berubah.");
      case "DUPLICATE_EMAIL":
        return errorState("Email tersebut sudah digunakan oleh peserta lain.");
      case "EMAIL_SEND_PENDING":
        return infoState(
          "Masih ada proses pengiriman email yang baru saja dimulai. Tunggu hingga proses tersebut selesai sebelum mengubah alamat email.",
        );
      case "STALE_PENDING_REQUIRES_CONFIRMATION":
        return {
          status: "info",
          message:
            "Status pengiriman sebelumnya tidak diketahui. Konfirmasi bahwa alamat lama mungkin masih menerima email sebelumnya sebelum melanjutkan.",
          requiresStalePendingConfirmation: true,
        };
      case "STALE_FORM":
        return infoState("Data peserta telah berubah. Muat ulang halaman sebelum mencoba lagi.");
      default:
        return errorState("Email peserta belum dapat diperbarui. Silakan coba kembali.");
    }
  } catch {
    return errorState("Email peserta belum dapat diperbarui. Silakan coba kembali.");
  }
}

export async function resendRegistrationQr(
  previousState: ParticipantActionState,
  formData: FormData,
): Promise<ParticipantActionState> {
  void previousState;

  const profile = await getAuthorizedProfile("participants.email");
  if (!profile) {
    return errorState("Anda tidak memiliki akses untuk mengirim ulang QR.");
  }
  const rawRegistrationId = readRegistrationId(formData);
  const parsedRegistrationId = registrationIdSchema.safeParse(rawRegistrationId);

  if (!parsedRegistrationId.success) {
    return errorState("Data peserta tidak valid.");
  }

  const registrationId = parsedRegistrationId.data;

  try {
    const supabase = createAdminClient();
    const { data: participant, error: participantError } = await supabase
      .from("participants")
      .select(
        "id, registration_id, full_name, email, qr_token, email_generation, package_type, participation_scope, actuarial_consultant_status, attends_pai_congress, registration_status",
      )
      .eq("registration_id", registrationId)
      .maybeSingle();

    if (participantError) {
      return errorState(
        "Peserta belum dapat dimuat. Silakan coba kembali.",
      );
    }

    if (!participant) {
      return errorState("Peserta tidak ditemukan.");
    }

    const participantRow = participant as ParticipantEmailRow;

    if (participantRow.registration_status === "CANCELLED") {
      return errorState(
        "QR tidak dapat dikirim ulang karena registrasi peserta telah dibatalkan.",
      );
    }

    // The bucket is generated on the server and never supplied by the browser.
    const serverNow = new Date();
    const idempotencyKey = `resend:${participantRow.id}:g${participantRow.email_generation}:${minuteBucket(serverNow)}`;
    const { data: reservationData, error: reservationError } = await supabase.rpc(
      "reserve_participant_email_resend",
      {
        p_participant_id: participantRow.id,
        p_recipient_email: participantRow.email,
        p_sent_by: profile.id,
        p_idempotency_key: idempotencyKey,
      },
    );

    if (reservationError) {
      return errorState("Pengiriman QR belum dapat dimulai. Silakan coba kembali.");
    }

    const reservation = (Array.isArray(reservationData)
      ? reservationData[0]
      : reservationData) as ResendReservation | undefined;

    if (!reservation) {
      return errorState("Pengiriman QR belum dapat dimulai. Silakan coba kembali.");
    }

    if (reservation.result_code === "LIMIT_REACHED") {
      return errorState(
        "Batas pengiriman ulang QR untuk peserta ini telah tercapai. Silakan coba kembali nanti.",
      );
    }

    if (reservation.result_code === "CANCELLED") {
      return errorState(
        "QR tidak dapat dikirim ulang karena registrasi peserta telah dibatalkan.",
      );
    }

    if (reservation.result_code === "NOT_FOUND") {
      return errorState("Peserta tidak ditemukan.");
    }

    if (reservation.result_code === "RECIPIENT_MISMATCH") {
      return infoState(
        "Data peserta telah berubah. Muat ulang halaman sebelum mencoba lagi.",
      );
    }

    if (reservation.result_code === "ALREADY_RESERVED") {
      const existingLog = await getExistingResendLog(supabase, idempotencyKey);
      return existingLog
        ? existingLogState(existingLog, serverNow)
        : infoState(
            "Permintaan email dengan kunci yang sama sudah dicatat dan tidak akan dikirim ulang.",
          );
    }

    if (reservation.result_code === "RECENTLY_RESERVED") {
      return infoState(
        "Permintaan pengiriman ulang baru saja diproses. Email tidak dikirim ulang untuk mencegah pengiriman ganda.",
      );
    }

    if (reservation.result_code !== "RESERVED" || !reservation.email_log_id) {
      return errorState("Pengiriman QR belum dapat dimulai. Silakan coba kembali.");
    }

    const emailLogId = reservation.email_log_id;
    const reservedEmailLog = await getReservedEmailLog(supabase, emailLogId);

    if (
      !reservedEmailLog ||
      reservedEmailLog.participant_id !== participantRow.id ||
      reservedEmailLog.status !== "PENDING"
    ) {
      return errorState("Pengiriman QR belum dapat dimulai. Silakan coba kembali.");
    }

    let qrPngBuffer: Buffer;

    try {
      qrPngBuffer = await generateParticipantQrPng(participantRow.qr_token);
    } catch {
      await finalizeEmailAttempt(
        supabase,
        participantRow.id,
        emailLogId,
        reservedEmailLog.email_generation,
        "FAILED",
        null,
        "QR_GENERATION_ERROR",
      );
      revalidateParticipantPaths(registrationId);
      return errorState("QR belum dapat dibuat. Silakan coba kembali.");
    }

    const emailResult = await sendRegistrationEmail({
      recipientEmail: reservedEmailLog.recipient_email,
      fullName: participantRow.full_name,
      registrationId: participantRow.registration_id,
      packageType: participantRow.package_type ?? "-",
      participationScope: participantRow.participation_scope ?? "-",
      actuarialConsultantStatus: participantRow.actuarial_consultant_status ?? "-",
      attendsPaiCongress: participantRow.attends_pai_congress,
      qrPngBuffer,
      idempotencyKey,
    });

    if (!emailResult.success) {
      await finalizeEmailAttempt(
        supabase,
        participantRow.id,
        emailLogId,
        reservedEmailLog.email_generation,
        "FAILED",
        null,
        emailResult.errorCategory,
      );
      revalidateParticipantPaths(registrationId);
      return errorState(
        "Email belum dapat diterima oleh layanan pengiriman. Silakan coba kembali.",
      );
    }

    const finalization = await finalizeEmailAttempt(
      supabase,
      participantRow.id,
      emailLogId,
      reservedEmailLog.email_generation,
      "SENT",
      emailResult.providerMessageId,
      null,
    );

    revalidateParticipantPaths(registrationId);

    if (!finalization) {
      return infoState(
        "Email telah diterima oleh layanan pengiriman, tetapi status internal belum dapat diperbarui. Jangan kirim ulang otomatis; silakan periksa kembali.",
      );
    }

    if (finalization.result_code === "STALE_GENERATION") {
      return infoState(
        "Email telah diterima oleh layanan pengiriman untuk alamat sebelumnya. Alamat saat ini masih memerlukan pengiriman ulang terpisah.",
      );
    }

    if (finalization.result_code !== "CURRENT_GENERATION") {
      return infoState(
        "Email telah diterima oleh layanan pengiriman, tetapi status internal belum dapat diperbarui. Jangan kirim ulang otomatis; silakan periksa kembali.",
      );
    }

    return {
      status: "success",
      message: "Email telah diterima oleh layanan pengiriman.",
    };
  } catch {
    return errorState("Terjadi kendala saat mengirim ulang QR. Silakan coba kembali.");
  }
}
