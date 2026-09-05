import Link from "next/link";
import { z } from "zod";

import { requireRole } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";

import {
  ResendQrButton,
  type AttendanceSummary,
} from "../participant-list";
import { EmailCorrectionForm } from "../email-correction-form";

export const dynamic = "force-dynamic";

const registrationIdSchema = z.string().regex(/^AKKAI26-[0-9]{6}$/);

type DatabaseParticipantRow = {
  id: string;
  registration_id: string;
  full_name: string;
  email: string;
  phone_number: string;
  member_number: string | null;
  kka_name: string | null;
  polo_size: string | null;
  polo_model: string | null;
  package_type: string | null;
  participation_scope: string | null;
  actuarial_consultant_status: string | null;
  attends_pai_congress: boolean | null;
  registration_status: "REGISTERED" | "CANCELLED";
  email_status: "PENDING" | "SENT" | "FAILED";
  email_generation: number;
  last_email_sent_at: string | null;
  created_at: string;
};

type SessionRow = {
  id: string;
  code: "ARRIVAL" | "SEMINAR" | "DAY3";
};

type AttendanceRow = {
  session_id: string;
  check_in_time: string;
};

type DetailData = {
  participant: DatabaseParticipantRow;
  arrival: AttendanceSummary;
  seminar: AttendanceSummary;
  day3: AttendanceSummary;
};

function formatDateTime(
  dateValue: string | null,
  emptyLabel = "Waktu tidak tersedia",
) {
  if (!dateValue) {
    return emptyLabel;
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "Waktu tidak tersedia";
  }

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

function registrationStatusLabel(status: DatabaseParticipantRow["registration_status"]) {
  return status === "REGISTERED" ? "Terdaftar" : "Dibatalkan";
}

function statusClassName(status: DatabaseParticipantRow["registration_status"]) {
  return status === "REGISTERED"
    ? "border-[#b9dec8] bg-[#f3fbf5] text-[#267044]"
    : "border-[#dedbd3] bg-[#f2f0eb] text-[#6b6a66]";
}

function emailStatusLabel(status: DatabaseParticipantRow["email_status"]) {
  switch (status) {
    case "SENT":
      return "Diterima layanan pengiriman";
    case "FAILED":
      return "Gagal sebelum diterima layanan";
    case "PENDING":
      return "Belum terkonfirmasi / perlu dicek";
  }
}

function emailStatusClassName(status: DatabaseParticipantRow["email_status"]) {
  switch (status) {
    case "SENT":
      return "text-[#267044]";
    case "FAILED":
      return "text-[#9b3d31]";
    case "PENDING":
      return "text-[#80631e]";
  }
}

async function loadDetailData(
  registrationId: string,
): Promise<DetailData | null> {
  try {
    const adminSupabase = createAdminClient();
    const { data: participant, error: participantError } = await adminSupabase
      .from("participants")
      .select(
        "id, registration_id, full_name, email, phone_number, member_number, kka_name, polo_size, polo_model, package_type, participation_scope, actuarial_consultant_status, attends_pai_congress, registration_status, email_status, email_generation, last_email_sent_at, created_at",
      )
      .eq("registration_id", registrationId)
      .maybeSingle();

    if (participantError || !participant) {
      return participantError ? null : null;
    }

    const participantRow = participant as DatabaseParticipantRow;
    const { data: sessions, error: sessionsError } = await adminSupabase
      .from("sessions")
      .select("id, code")
      .in("code", ["ARRIVAL", "SEMINAR", "DAY3"]);

    if (sessionsError) {
      return null;
    }

    const sessionRows = (sessions ?? []) as SessionRow[];
    const sessionIds = sessionRows.map((session) => session.id);
    let attendanceRows: AttendanceRow[] = [];

    if (sessionIds.length > 0) {
      const attendanceResult = await adminSupabase
        .from("attendance")
        .select("session_id, check_in_time")
        .eq("participant_id", participantRow.id)
        .in("session_id", sessionIds);

      if (attendanceResult.error) {
        return null;
      }

      attendanceRows = (attendanceResult.data ?? []) as AttendanceRow[];
    }

    const sessionCodeById = new Map(
      sessionRows.map((session) => [session.id, session.code]),
    );
    const arrival: AttendanceSummary = {
      checkedIn: false,
      checkedInAt: null,
    };
    const seminar: AttendanceSummary = {
      checkedIn: false,
      checkedInAt: null,
    };
    const day3: AttendanceSummary = {
      checkedIn: false,
      checkedInAt: null,
    };

    for (const attendance of attendanceRows) {
      const code = sessionCodeById.get(attendance.session_id);

      if (code === "ARRIVAL") {
        arrival.checkedIn = true;
        arrival.checkedInAt = attendance.check_in_time;
      }

      if (code === "SEMINAR") {
        seminar.checkedIn = true;
        seminar.checkedInAt = attendance.check_in_time;
      }

      if (code === "DAY3") {
        day3.checkedIn = true;
        day3.checkedInAt = attendance.check_in_time;
      }
    }

    return {
      participant: participantRow,
      arrival,
      seminar,
      day3,
    };
  } catch {
    return null;
  }
}

function AttendanceCard({
  label,
  attendance,
}: {
  label: string;
  attendance: AttendanceSummary;
}) {
  return (
    <article className="rounded-xl border border-[#e4d8c4] bg-[#fffdf8] p-4">
      <h3 className="text-sm font-semibold text-[#142842]">{label}</h3>
      <p
        className={`mt-3 flex items-center gap-2 text-lg font-semibold ${
          attendance.checkedIn ? "text-[#267044]" : "text-[#897657]"
        }`}
      >
        <span aria-hidden="true">{attendance.checkedIn ? "●" : "○"}</span>
        {attendance.checkedIn ? "Sudah Check-in" : "Belum Check-in"}
      </p>
      <p className="mt-1 text-sm text-[#5b6c7c]">
        {attendance.checkedIn
          ? formatDateTime(attendance.checkedInAt)
          : "Belum ada check-in"}
      </p>
    </article>
  );
}

function ParticipantDetailError({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <main className="min-h-screen bg-[#f7f3ea] px-4 py-6 sm:px-8 sm:py-8">
      <section className="mx-auto max-w-3xl">
        <header className="border-b border-[#dfd3bf] pb-4">
          <h1 className="text-2xl font-semibold tracking-tight text-[#142842]">{title}</h1>
        </header>
        <p className="mt-6 rounded-xl border border-[#ead3cc] bg-[#fff5f2] p-4 text-sm text-[#9b3d31]" role="alert">
          {message}
        </p>
        <Link
          className="mt-5 inline-flex min-h-11 items-center rounded-lg border border-[#b99a5a] px-4 text-sm font-semibold text-[#6d531e] outline-none hover:bg-[#fbf5e8] focus-visible:ring-2 focus-visible:ring-[#9a7526]"
          href="/admin/participants"
        >
          Kembali ke Peserta
        </Link>
      </section>
    </main>
  );
}

export default async function ParticipantDetailPage({
  params,
}: {
  params: Promise<{ registrationId: string }>;
}) {
  await requireRole(["ADMIN"]);

  const { registrationId: rawRegistrationId } = await params;
  const parsedRegistrationId = registrationIdSchema.safeParse(rawRegistrationId);

  if (!parsedRegistrationId.success) {
    return (
      <ParticipantDetailError
        title="Peserta Tidak Ditemukan"
        message="Registration ID peserta tidak valid. Kembali ke daftar peserta."
      />
    );
  }

  const detailData = await loadDetailData(parsedRegistrationId.data);

  if (!detailData) {
    return (
      <ParticipantDetailError
        title="Peserta Belum Dapat Dimuat"
        message="Data peserta belum dapat dimuat. Silakan coba kembali."
      />
    );
  }

  const participant = detailData.participant;
  const isCancelled = participant.registration_status === "CANCELLED";

  return (
    <main className="min-h-screen bg-[#f7f3ea] px-4 py-5 sm:px-8 sm:py-6">
      <section className="mx-auto max-w-[1100px]">
        <header className="border-b border-[#dfd3bf] pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-bold tracking-[0.16em] text-[#9a7526]">DETAIL PESERTA</p>
              <h1 className="mt-1 break-words text-2xl font-semibold tracking-tight text-[#142842] sm:text-3xl">
                {participant.full_name}
              </h1>
              <p className="mt-1 break-all text-sm font-semibold text-[#9a7526]">
                {participant.registration_id}
              </p>
               <p className="mt-3 break-words text-sm text-[#5b6c7c]">
                 Konsultan Aktuaria: {participant.actuarial_consultant_status ?? "-"}
               </p>
            </div>
            <div className="flex shrink-0 flex-col items-start gap-3 sm:items-end">
              <span
                className={`inline-flex min-h-8 items-center rounded-full border px-3 py-1.5 text-xs font-semibold ${statusClassName(
                  participant.registration_status,
                )}`}
              >
                {registrationStatusLabel(participant.registration_status)}
              </span>
              <Link
                className="inline-flex min-h-11 items-center text-sm font-semibold text-[#344d68] underline underline-offset-4 outline-none hover:text-[#142842] focus-visible:ring-2 focus-visible:ring-[#9a7526]"
                href="/admin/participants"
              >
                Kembali ke Peserta
              </Link>
            </div>
          </div>
        </header>

        <section
          aria-labelledby="registration-information-heading"
          className="mt-5 rounded-xl border border-[#e4d8c4] bg-[#fffdf8] p-4 sm:p-5"
        >
          <h2 className="text-xl font-semibold text-[#142842]" id="registration-information-heading">
            Informasi Registrasi
          </h2>
          <dl className="mt-5 grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
            <DetailField label="Email" value={participant.email} />
            <DetailField label="WhatsApp / Kontak" value={participant.phone_number} />
            <DetailField
              label="Nomor Anggota"
              value={participant.member_number ?? "Tidak diisi"}
            />
            <DetailField label="Nama KKA" value={participant.kka_name ?? "Tidak diisi"} />
            <DetailField label="Ukuran Poloshirt" value={participant.polo_size ?? "Tidak diisi"} />
            <DetailField label="Model Poloshirt" value={participant.polo_model ?? "Tidak diisi"} />
            <DetailField label="Paket yang diambil" value={participant.package_type ?? "-"} />
            <DetailField label="Mengikuti" value={participant.participation_scope ?? "-"} />
            <DetailField
              label="Konsultan Aktuaria"
              value={participant.actuarial_consultant_status ?? "-"}
            />
            <DetailField
              label="Hadir Kongres PAI"
              value={
                participant.attends_pai_congress === null
                  ? "-"
                  : participant.attends_pai_congress
                    ? "Ya"
                    : "Tidak"
              }
            />
            <DetailField
              label="Status Email ke Alamat Saat Ini"
              value={emailStatusLabel(participant.email_status)}
              valueClassName={emailStatusClassName(participant.email_status)}
            />
            <DetailField
              label="Penerimaan Layanan untuk Alamat Saat Ini"
              value={formatDateTime(
                participant.last_email_sent_at,
                "Belum ada penerimaan layanan",
              )}
            />
            <DetailField
              label="Tanggal Registrasi"
              value={formatDateTime(participant.created_at)}
            />
          </dl>
          <div className="mt-5 border-t border-[#eee6d8] pt-4">
            <EmailCorrectionForm
              currentEmail={participant.email}
              emailGeneration={participant.email_generation}
              registrationId={participant.registration_id}
            />
          </div>
        </section>

        <section
          aria-labelledby="registration-email-heading"
          className="mt-4 rounded-xl border border-[#e4d8c4] bg-[#fffdf8] p-4 sm:p-5"
        >
          <h2 className="text-xl font-semibold text-[#142842]" id="registration-email-heading">
            Email Registrasi
          </h2>
          <p className="mt-1 text-sm text-[#5b6c7c]">
            Email registrasi dengan QR yang sama akan dikirim kembali ke alamat peserta.
          </p>
          <div className="mt-4">
            {isCancelled ? (
              <p className="rounded-lg border border-[#dedbd3] bg-[#f2f0eb] p-3 text-sm text-[#6b6a66]">
                Email registrasi tidak dapat dikirim ulang karena peserta berstatus Dibatalkan.
              </p>
            ) : (
              <ResendQrButton
                email={participant.email}
                registrationId={participant.registration_id}
              />
            )}
          </div>
        </section>

        <section aria-labelledby="attendance-heading" className="mt-4">
          <h2 className="text-xl font-semibold text-[#142842]" id="attendance-heading">
            Kehadiran
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <AttendanceCard
              attendance={detailData.arrival}
              label="Registrasi Kedatangan"
            />
            <AttendanceCard
              attendance={detailData.seminar}
              label="Seminar AKKAI 2026"
            />
            <AttendanceCard
              attendance={detailData.day3}
              label="Registrasi Kepulangan"
            />
          </div>
        </section>
      </section>
    </main>
  );
}

function DetailField({
  label,
  value,
  valueClassName = "text-[#344d68]",
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-[#897657]">
        {label}
      </dt>
      <dd className={`mt-1 break-words font-semibold ${valueClassName}`}>{value}</dd>
    </div>
  );
}
