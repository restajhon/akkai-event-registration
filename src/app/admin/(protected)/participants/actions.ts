"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/lib/auth/server";
import {
  sendRegistrationEmail,
  type RegistrationEmailErrorCategory,
} from "@/lib/email/registration-email";
import { generateParticipantQrPng } from "@/lib/qr/participant-qr";
import type { ParticipantActionState } from "@/lib/participants/participant-action-state";
import { createAdminClient } from "@/lib/supabase/admin";

const registrationIdSchema = z.string().regex(/^AKKAI26-[0-9]{6}$/);
const RESEND_RATE_LIMIT = 5;
const RESEND_WINDOW_MS = 24 * 60 * 60 * 1000;
const EMAIL_LOG_IDEMPOTENCY_CONSTRAINT = "email_logs_idempotency_key_unique";

type ParticipantEmailRow = {
  id: string;
  registration_id: string;
  full_name: string;
  email: string;
  qr_token: string;
  registration_status: "REGISTERED" | "CANCELLED";
};

type ExistingResendLog = {
  id: string;
  status: "PENDING" | "SENT" | "FAILED";
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

function isUniqueViolation(error: unknown, constraintName: string) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const databaseError = error as {
    code?: unknown;
    message?: unknown;
    details?: unknown;
    hint?: unknown;
  };

  return (
    databaseError.code === "23505" &&
    [databaseError.message, databaseError.details, databaseError.hint].some(
      (value) =>
        typeof value === "string" && value.includes(constraintName),
    )
  );
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

async function getExistingResendLog(
  supabase: ReturnType<typeof createAdminClient>,
  idempotencyKey: string,
): Promise<ExistingResendLog | null> {
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
    status: data.status as ExistingResendLog["status"],
  };
}

function existingLogState(log: ExistingResendLog): ParticipantActionState {
  switch (log.status) {
    case "SENT":
      return infoState(
        "QR registrasi baru saja dikirim. Silakan cek email peserta.",
      );
    case "PENDING":
      return infoState(
        "Pengiriman QR sedang diproses. Silakan tunggu beberapa saat.",
      );
    case "FAILED":
      return infoState(
        "Pengiriman QR sebelumnya gagal. Silakan coba kembali beberapa saat lagi.",
      );
  }
}

async function markEmailFailed(
  supabase: ReturnType<typeof createAdminClient>,
  participantId: string,
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

  await supabase
    .from("participants")
    .update({ email_status: "FAILED" })
    .eq("id", participantId);
}

export async function resendRegistrationQr(
  previousState: ParticipantActionState,
  formData: FormData,
): Promise<ParticipantActionState> {
  void previousState;

  const profile = await requireRole(["ADMIN"]);
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
      .select("id, registration_id, full_name, email, qr_token, registration_status")
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
    const idempotencyKey = `resend:${participantRow.id}:${minuteBucket(serverNow)}`;
    const existingLog = await getExistingResendLog(supabase, idempotencyKey);

    if (existingLog) {
      return existingLogState(existingLog);
    }

    const cutoff = new Date(
      serverNow.getTime() - RESEND_WINDOW_MS,
    ).toISOString();
    const { count, error: rateLimitError } = await supabase
      .from("email_logs")
      .select("id", { count: "exact", head: true })
      .eq("participant_id", participantRow.id)
      .eq("email_type", "RESEND")
      .gte("created_at", cutoff);

    if (rateLimitError) {
      return errorState(
        "Status pengiriman QR belum dapat diperiksa. Silakan coba kembali.",
      );
    }

    if ((count ?? 0) >= RESEND_RATE_LIMIT) {
      return errorState(
        "Batas pengiriman ulang QR untuk peserta ini telah tercapai. Silakan coba kembali nanti.",
      );
    }

    const { data: emailLog, error: emailLogError } = await supabase
      .from("email_logs")
      .insert({
        participant_id: participantRow.id,
        email_type: "RESEND",
        recipient_email: participantRow.email,
        status: "PENDING",
        sent_by: profile.id,
        provider_message_id: null,
        error_message: null,
        sent_at: null,
        idempotency_key: idempotencyKey,
      })
      .select("id")
      .single();

    if (emailLogError || !emailLog?.id) {
      if (isUniqueViolation(emailLogError, EMAIL_LOG_IDEMPOTENCY_CONSTRAINT)) {
        const racedLog = await getExistingResendLog(supabase, idempotencyKey);
        return racedLog
          ? existingLogState(racedLog)
          : errorState("Pengiriman QR belum dapat dimulai. Silakan coba kembali.");
      }

      return errorState("Pengiriman QR belum dapat dimulai. Silakan coba kembali.");
    }

    let qrPngBuffer: Buffer;

    try {
      qrPngBuffer = await generateParticipantQrPng(participantRow.qr_token);
    } catch {
      await markEmailFailed(
        supabase,
        participantRow.id,
        emailLog.id,
        "QR_GENERATION_ERROR",
      );
      revalidatePath("/admin/participants");
      revalidatePath(`/admin/participants/${registrationId}`);
      return errorState("QR belum dapat dibuat. Silakan coba kembali.");
    }

    const emailResult = await sendRegistrationEmail({
      recipientEmail: participantRow.email,
      fullName: participantRow.full_name,
      registrationId: participantRow.registration_id,
      qrPngBuffer,
      idempotencyKey,
    });

    if (!emailResult.success) {
      await markEmailFailed(
        supabase,
        participantRow.id,
        emailLog.id,
        emailResult.errorCategory,
      );
      revalidatePath("/admin/participants");
      revalidatePath(`/admin/participants/${registrationId}`);
      return errorState("QR belum dapat dikirim. Silakan coba kembali.");
    }

    const sentAt = new Date().toISOString();
    const { error: sentLogError } = await supabase
      .from("email_logs")
      .update({
        status: "SENT",
        provider_message_id: emailResult.providerMessageId,
        error_message: null,
        sent_at: sentAt,
      })
      .eq("id", emailLog.id);
    const { error: participantUpdateError } = await supabase
      .from("participants")
      .update({
        email_status: "SENT",
        last_email_sent_at: sentAt,
      })
      .eq("id", participantRow.id);

    revalidatePath("/admin/participants");
    revalidatePath(`/admin/participants/${registrationId}`);

    if (sentLogError || participantUpdateError) {
      return errorState(
        "QR telah diproses, tetapi status pengiriman belum dapat diperbarui. Silakan periksa kembali.",
      );
    }

    return {
      status: "success",
      message: "QR registrasi berhasil dikirim ulang.",
    };
  } catch {
    return errorState("Terjadi kendala saat mengirim ulang QR. Silakan coba kembali.");
  }
}
