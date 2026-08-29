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
const STALE_PENDING_WINDOW_MS = 15 * 60 * 1000;

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
  created_at: string;
};

type ResendReservation = {
  result_code: string;
  email_log_id: string | null;
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

async function markEmailFailed(
  supabase: ReturnType<typeof createAdminClient>,
  participantId: string,
  emailLogId: string,
  errorCategory: RegistrationEmailErrorCategory,
) {
  try {
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
  } catch {
    // The participant remains authoritative even if failure bookkeeping fails.
  }
}

async function markEmailAccepted(
  supabase: ReturnType<typeof createAdminClient>,
  participantId: string,
  emailLogId: string,
  providerMessageId: string,
) {
  const sentAt = new Date().toISOString();

  try {
    const { error: sentLogError } = await supabase
      .from("email_logs")
      .update({
        status: "SENT",
        provider_message_id: providerMessageId,
        error_message: null,
        sent_at: sentAt,
      })
      .eq("id", emailLogId);
    const { error: participantUpdateError } = await supabase
      .from("participants")
      .update({
        email_status: "SENT",
        last_email_sent_at: sentAt,
      })
      .eq("id", participantId);

    return !sentLogError && !participantUpdateError;
  } catch {
    return false;
  }
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

    let qrPngBuffer: Buffer;

    try {
      qrPngBuffer = await generateParticipantQrPng(participantRow.qr_token);
    } catch {
      await markEmailFailed(
        supabase,
        participantRow.id,
        emailLogId,
        "QR_GENERATION_ERROR",
      );
      revalidateParticipantPaths(registrationId);
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
        emailLogId,
        emailResult.errorCategory,
      );
      revalidateParticipantPaths(registrationId);
      return errorState(
        "Email belum dapat diterima oleh layanan pengiriman. Silakan coba kembali.",
      );
    }

    const persisted = await markEmailAccepted(
      supabase,
      participantRow.id,
      emailLogId,
      emailResult.providerMessageId,
    );

    revalidateParticipantPaths(registrationId);

    if (!persisted) {
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
