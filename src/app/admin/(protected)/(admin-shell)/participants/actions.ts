"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getAuthorizedProfile } from "@/lib/auth/server";
import {
  sendRegistrationEmail,
  type RegistrationEmailErrorCategory,
} from "@/lib/email/registration-email";
import { generateParticipantQrPng } from "@/lib/qr/participant-qr";
import { logRegistrationStageDetails } from "@/lib/registration/diagnostics";
import type { ParticipantActionState } from "@/lib/participants/participant-action-state";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  emailCorrectionSchema,
  getEmailCorrectionFieldErrors,
} from "@/lib/validation/email";
import { participantEditDataSchema } from "@/lib/validation/participant-edit";

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
    revalidatePath("/admin/dashboard");
    revalidatePath("/admin/participants");
    revalidatePath(`/admin/participants/${registrationId}`);
  } catch {
    // Cache refresh failure must not change the provider acceptance result.
  }
}

function isActiveSuperAdminProfile(
  profile: Awaited<ReturnType<typeof getAuthorizedProfile>>,
): profile is NonNullable<Awaited<ReturnType<typeof getAuthorizedProfile>>> {
  return Boolean(profile?.is_active === true && profile.role === "SUPER_ADMIN");
}

function isActiveCancellationActor(
  profile: Awaited<ReturnType<typeof getAuthorizedProfile>>,
): profile is NonNullable<Awaited<ReturnType<typeof getAuthorizedProfile>>> {
  return Boolean(
    profile?.is_active === true &&
      (profile.role === "SUPER_ADMIN" || profile.role === "ADMIN" || profile.role === "OPERATOR"),
  );
}

async function setParticipantRegistrationStatus(
  registrationId: string,
  targetStatus: "REGISTERED" | "CANCELLED",
  changedBy: string,
  cancellationReason: string | null,
): Promise<ParticipantActionState> {
  const { data, error } = await createAdminClient().rpc(
    "set_participant_registration_status",
    {
      p_registration_id: registrationId,
      p_target_status: targetStatus,
      p_changed_by: changedBy,
      p_cancellation_reason: cancellationReason,
    },
  );

  if (error) {
    return errorState("Status pendaftaran belum dapat diperbarui. Silakan coba kembali.");
  }

  const result = (Array.isArray(data) ? data[0] : data) as { result_code?: string } | null;
  switch (result?.result_code) {
    case "UPDATED":
      revalidateParticipantPaths(registrationId);
      return {
        status: "success",
        message: targetStatus === "CANCELLED"
          ? "Pendaftaran peserta berhasil dibatalkan. Data dan histori tetap disimpan."
          : "Pendaftaran peserta berhasil dipulihkan.",
      };
    case "ALREADY_CANCELLED":
      return infoState("Pendaftaran peserta sudah berstatus Dibatalkan.");
    case "ALREADY_REGISTERED":
      return infoState("Pendaftaran peserta sudah berstatus Terdaftar.");
    case "INVALID_REASON":
      return errorState("Alasan pembatalan wajib diisi maksimal 500 karakter.");
    case "NOT_FOUND":
      return errorState("Peserta tidak ditemukan.");
    case "UNAUTHORIZED_ACTOR":
      return errorState("Anda tidak memiliki izin untuk mengubah status pendaftaran ini.");
    default:
      return errorState("Status pendaftaran belum dapat diperbarui. Silakan coba kembali.");
  }
}

export async function cancelParticipantRegistration(
  previousState: ParticipantActionState,
  formData: FormData,
): Promise<ParticipantActionState> {
  void previousState;

  const profile = await getAuthorizedProfile("participants.cancel");
  if (!isActiveCancellationActor(profile)) {
    return errorState("Hanya Super Admin, Admin, atau Operator aktif yang dapat membatalkan pendaftaran.");
  }

  const registrationId = readRegistrationId(formData);
  const confirmationRegistrationId = readFormString(formData, "registrationIdConfirmation").trim();
  const cancellationReason = readFormString(formData, "cancellationReason").trim();
  const parsedRegistrationId = registrationIdSchema.safeParse(registrationId);

  if (
    !parsedRegistrationId.success ||
    confirmationRegistrationId !== parsedRegistrationId.data
  ) {
    return errorState("Ketik Registration ID yang sama untuk mengonfirmasi pembatalan.");
  }

  if (cancellationReason.length === 0 || cancellationReason.length > 500) {
    return errorState("Alasan pembatalan wajib diisi maksimal 500 karakter.");
  }

  try {
    return await setParticipantRegistrationStatus(
      parsedRegistrationId.data,
      "CANCELLED",
      profile.id,
      cancellationReason,
    );
  } catch {
    return errorState("Status pendaftaran belum dapat diperbarui. Silakan coba kembali.");
  }
}

export async function restoreParticipantRegistration(
  previousState: ParticipantActionState,
  formData: FormData,
): Promise<ParticipantActionState> {
  void previousState;

  const profile = await getAuthorizedProfile("participants.restore");
  if (!isActiveSuperAdminProfile(profile)) {
    return errorState("Hanya Super Admin aktif yang dapat memulihkan pendaftaran.");
  }

  const parsedRegistrationId = registrationIdSchema.safeParse(readRegistrationId(formData));
  if (!parsedRegistrationId.success) {
    return errorState("Data peserta tidak valid.");
  }

  try {
    return await setParticipantRegistrationStatus(
      parsedRegistrationId.data,
      "REGISTERED",
      profile.id,
      null,
    );
  } catch {
    return errorState("Status pendaftaran belum dapat diperbarui. Silakan coba kembali.");
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
  errorMessage: string | null = null,
): Promise<FinalizationResult | null> {
  const { data, error } = await supabase.rpc(
    "finalize_participant_email_attempt",
    {
      p_participant_id: participantId,
      p_email_log_id: emailLogId,
      p_email_generation: emailGeneration,
      p_final_status: finalStatus,
      p_provider_message_id: providerMessageId,
        p_error_category: errorMessage ?? errorCategory,
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
      logRegistrationStageDetails("registration-email", emailResult.diagnostic);
      await finalizeEmailAttempt(
        supabase,
        participantRow.id,
        emailLogId,
        reservedEmailLog.email_generation,
        "FAILED",
        null,
        emailResult.errorCategory,
        emailResult.errorMessage,
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

export async function updateRegistrationBillingPaymentStatus(
  previousState: ParticipantActionState,
  formData: FormData,
): Promise<ParticipantActionState> {
  void previousState;

  const profile = await getAuthorizedProfile("participants.manage");
  if (!profile) {
    return errorState("Anda tidak memiliki akses untuk mengubah status pembayaran.");
  }

  const billingId = readFormString(formData, "billingId");
  const paymentStatus = readFormString(formData, "paymentStatus");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(billingId)) {
    return errorState("Data tagihan tidak valid.");
  }
  if (paymentStatus !== "PAID" && paymentStatus !== "UNPAID") {
    return errorState("Status pembayaran tidak valid.");
  }

  try {
    const { data, error } = await createAdminClient().rpc(
      "set_registration_billing_payment_status",
      {
        p_billing_id: billingId,
        p_payment_status: paymentStatus,
        p_paid_by: profile.id,
      },
    );
    const result = (Array.isArray(data) ? data[0] : data) as { result_code?: string } | null;

    if (error || result?.result_code !== "UPDATED") {
      return errorState("Status pembayaran belum dapat diperbarui. Silakan coba kembali.");
    }

    const registrationId = readRegistrationId(formData);
    if (registrationId) revalidateParticipantPaths(registrationId);
    return {
      status: "success",
      message: paymentStatus === "PAID" ? "Status pembayaran diubah menjadi Lunas." : "Status pembayaran diubah menjadi Belum Dibayar.",
    };
  } catch {
    return errorState("Status pembayaran belum dapat diperbarui. Silakan coba kembali.");
  }
}

function readOptionalFormString(formData: FormData, field: string) {
  return readFormString(formData, field).trim();
}

function readParticipantTravel(formData: FormData) {
  const values = {
    outbound_date: readOptionalFormString(formData, "outbound_date"),
    outbound_time: readOptionalFormString(formData, "outbound_time"),
    outbound_transport_mode: readOptionalFormString(formData, "outbound_transport_mode"),
    outbound_transport_number: readOptionalFormString(formData, "outbound_transport_number"),
    outbound_origin: readOptionalFormString(formData, "outbound_origin"),
    outbound_destination: readOptionalFormString(formData, "outbound_destination"),
    return_date: readOptionalFormString(formData, "return_date"),
    return_time: readOptionalFormString(formData, "return_time"),
    return_transport_mode: readOptionalFormString(formData, "return_transport_mode"),
    return_transport_number: readOptionalFormString(formData, "return_transport_number"),
    return_destination: readOptionalFormString(formData, "return_destination"),
  };
  const hasTravel = Object.values(values).some(Boolean);
  return hasTravel ? { ...values, extend_stay: readFormString(formData, "extend_stay") === "true" } : null;
}

export async function updateParticipantData(
  previousState: ParticipantActionState,
  formData: FormData,
): Promise<ParticipantActionState> {
  void previousState;
  const profile = await getAuthorizedProfile("participants.manage");
  if (!profile) return errorState("Anda tidak memiliki akses untuk mengubah data peserta.");

  const parsed = participantEditDataSchema.safeParse({
    registrationId: readFormString(formData, "registrationId"),
    emailGeneration: readFormString(formData, "emailGeneration"),
    full_name: readFormString(formData, "full_name"),
    email: readFormString(formData, "email"),
    phone_number: readFormString(formData, "phone_number"),
    member_number: readFormString(formData, "member_number"),
    institution: readFormString(formData, "institution"),
    position: readFormString(formData, "position"),
    kka_name: readFormString(formData, "kka_name"),
    package_type: readFormString(formData, "package_type"),
    participation_scope: readFormString(formData, "participation_scope"),
    polo_size: readFormString(formData, "polo_size"),
    polo_model: readFormString(formData, "polo_model"),
    actuarial_consultant_status: readFormString(formData, "actuarial_consultant_status"),
    attends_pai_congress: readFormString(formData, "attends_pai_congress"),
    outbound_date: readOptionalFormString(formData, "outbound_date"),
    outbound_time: readOptionalFormString(formData, "outbound_time"),
    outbound_transport_mode: readOptionalFormString(formData, "outbound_transport_mode"),
    outbound_transport_number: readOptionalFormString(formData, "outbound_transport_number"),
    outbound_origin: readOptionalFormString(formData, "outbound_origin"),
    outbound_destination: readOptionalFormString(formData, "outbound_destination"),
    return_date: readOptionalFormString(formData, "return_date"),
    return_time: readOptionalFormString(formData, "return_time"),
    return_transport_mode: readOptionalFormString(formData, "return_transport_mode"),
    return_transport_number: readOptionalFormString(formData, "return_transport_number"),
    return_destination: readOptionalFormString(formData, "return_destination"),
    extend_stay: readFormString(formData, "extend_stay") === "true" ? "true" : "false",
  });
  if (!parsed.success) return errorState(parsed.error.issues[0]?.message ?? "Data peserta tidak valid.");

  const travel = readParticipantTravel(formData);

  try {
    const supabase = createAdminClient();
    const { data: current, error: currentError } = await supabase
      .from("participants")
      .select("id, email, email_generation")
      .eq("registration_id", parsed.data.registrationId)
      .maybeSingle();
    if (currentError || !current) return errorState("Peserta tidak ditemukan.");

    if (parsed.data.email !== current.email) {
      if (!(await getAuthorizedProfile("participants.email"))) return errorState("Anda tidak memiliki akses untuk mengubah email peserta.");
      const { data: emailResult, error: emailError } = await supabase.rpc("correct_participant_email", {
        p_participant_id: current.id,
        p_new_email: parsed.data.email,
        p_changed_by: profile.id,
        p_expected_email_generation: parsed.data.emailGeneration,
        p_allow_stale_pending: false,
      });
      const resultCode = (Array.isArray(emailResult) ? emailResult[0] : emailResult) as { result_code?: string } | null;
      if (emailError || !["UPDATED", "NO_CHANGE"].includes(resultCode?.result_code ?? "")) {
        return errorState("Email peserta belum dapat diperbarui. Pastikan form masih terbaru.");
      }
    }

    const { data: updateResult, error: updateError } = await supabase.rpc("update_participant_data", {
      p_participant_id: current.id,
      p_actor_id: profile.id,
      p_full_name: parsed.data.full_name,
      p_phone_number: parsed.data.phone_number,
      p_member_number: parsed.data.member_number || null,
      p_institution: parsed.data.institution || null,
      p_position: parsed.data.position || null,
      p_kka_name: parsed.data.kka_name || null,
      p_package_type: parsed.data.package_type,
      p_participation_scope: parsed.data.participation_scope,
      p_polo_size: parsed.data.polo_size,
      p_polo_model: parsed.data.polo_model,
      p_actuarial_consultant_status: parsed.data.actuarial_consultant_status,
      p_attends_pai_congress: parsed.data.attends_pai_congress,
      p_travel: travel,
    });
    const result = (Array.isArray(updateResult) ? updateResult[0] : updateResult) as { result_code?: string } | null;
    if (updateError || result?.result_code !== "UPDATED") {
      return errorState(result?.result_code === "DUPLICATE_MEMBER_NUMBER" ? "Nomor anggota sudah digunakan peserta lain." : "Data peserta belum dapat diperbarui.");
    }

    revalidateParticipantPaths(parsed.data.registrationId);
    return { status: "success", message: "Data peserta berhasil diperbarui. Nomor registrasi dan QR tetap sama." };
  } catch {
    return errorState("Data peserta belum dapat diperbarui. Silakan coba kembali.");
  }
}
