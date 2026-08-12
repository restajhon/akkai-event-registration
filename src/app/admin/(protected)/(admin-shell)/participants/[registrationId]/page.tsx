import Link from "next/link";
import { z } from "zod";

import { requireRole } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";

import {
  ResendQrButton,
  type AttendanceSummary,
} from "../participant-list";

export const dynamic = "force-dynamic";

const registrationIdSchema = z.string().regex(/^AKKAI26-[0-9]{6}$/);

type DatabaseParticipantRow = {
  id: string;
  registration_id: string;
  full_name: string;
  email: string;
  member_number: string | null;
  institution: string;
  participant_category: string;
  registration_status: "REGISTERED" | "CANCELLED";
  email_status: "PENDING" | "SENT" | "FAILED";
  last_email_sent_at: string | null;
  created_at: string;
};

type SessionRow = {
  id: string;
  code: "ARRIVAL" | "SEMINAR";
};

type AttendanceRow = {
  session_id: string;
  check_in_time: string;
};

type DetailData = {
  participant: DatabaseParticipantRow;
  arrival: AttendanceSummary;
  seminar: AttendanceSummary;
};

function formatDateTime(dateValue: string | null) {
  if (!dateValue) {
    return "Belum ada pengiriman berhasil";
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

function emailStatusLabel(status: DatabaseParticipantRow["email_status"]) {
  switch (status) {
    case "SENT":
      return "Terkirim";
    case "FAILED":
      return "Gagal";
    case "PENDING":
      return "Diproses";
  }
}

function statusClassName(status: DatabaseParticipantRow["registration_status"]) {
  return status === "REGISTERED"
    ? "border-[#b9dec8] bg-[#f3fbf5] text-[#267044]"
    : "border-[#dedbd3] bg-[#f2f0eb] text-[#6b6a66]";
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
        "id, registration_id, full_name, email, member_number, institution, participant_category, registration_status, email_status, last_email_sent_at, created_at",
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
      .in("code", ["ARRIVAL", "SEMINAR"]);

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
    }

    return {
      participant: participantRow,
      arrival,
      seminar,
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
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#897657]">
        {label}
      </p>
      <p
        className={`mt-2 text-lg font-semibold ${
          attendance.checkedIn ? "text-[#267044]" : "text-[#897657]"
        }`}
      >
        {attendance.checkedIn ? "Hadir" : "Belum"}
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
    <main className="min-h-screen bg-[#f7f3ea] px-4 py-8 sm:px-8 sm:py-10">
      <section className="mx-auto max-w-3xl rounded-2xl border border-[#e4d8c4] bg-[#fffdf8] p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold tracking-[0.2em] text-[#9a7526]">
          AKKAI 2026
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-[#142842]">{title}</h1>
        <p className="mt-6 rounded-xl border border-[#ead3cc] bg-[#fff5f2] p-4 text-sm text-[#9b3d31]" role="alert">
          {message}
        </p>
        <Link
          className="mt-6 inline-flex text-sm font-semibold text-[#344d68] underline underline-offset-4 hover:text-[#142842]"
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
    <main className="min-h-screen bg-[#f7f3ea] px-4 py-6 sm:px-8 sm:py-8">
      <section className="mx-auto max-w-5xl">
        <header className="rounded-2xl border border-[#e4d8c4] bg-[#fffdf8] p-5 shadow-sm sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold tracking-[0.2em] text-[#9a7526]">
                AKKAI 2026
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#142842]">
                Detail Peserta
              </h1>
              <p className="mt-2 text-sm text-[#5b6c7c]">
                {participant.registration_id}
              </p>
            </div>
            <div className="flex flex-wrap gap-4 text-sm font-semibold">
              <Link
                className="text-[#344d68] underline underline-offset-4 hover:text-[#142842]"
                href="/admin/participants"
              >
                Kembali ke Peserta
              </Link>
              <Link
                className="text-[#344d68] underline underline-offset-4 hover:text-[#142842]"
                href="/admin/dashboard"
              >
                Dashboard
              </Link>
            </div>
          </div>
        </header>

        <section className="mt-5 rounded-2xl border border-[#e4d8c4] bg-[#fffdf8] p-5 shadow-sm sm:p-7">
          <div className="flex flex-col gap-5 border-b border-[#eee6d8] pb-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-[#142842]">
                {participant.full_name}
              </h2>
              <p className="mt-2 text-sm text-[#5b6c7c]">{participant.email}</p>
            </div>
            <span
              className={`inline-flex w-fit rounded-full border px-3 py-1.5 text-xs font-semibold ${statusClassName(
                participant.registration_status,
              )}`}
            >
              {registrationStatusLabel(participant.registration_status)}
            </span>
          </div>

          <dl className="mt-6 grid gap-5 text-sm text-[#5b6c7c] sm:grid-cols-2">
            <DetailField label="Registration ID" value={participant.registration_id} />
            <DetailField label="Nama Lengkap" value={participant.full_name} />
            <DetailField label="Email" value={participant.email} />
            <DetailField
              label="Nomor Anggota"
              value={participant.member_number ?? "Tidak diisi"}
            />
            <DetailField label="Institusi" value={participant.institution} />
            <DetailField
              label="Kategori Peserta"
              value={participant.participant_category}
            />
            <DetailField
              label="Status Email Terakhir"
              value={emailStatusLabel(participant.email_status)}
              valueClassName={emailStatusClassName(participant.email_status)}
            />
            <DetailField
              label="Pengiriman Email Berhasil Terakhir"
              value={formatDateTime(participant.last_email_sent_at)}
            />
            <DetailField
              label="Tanggal Registrasi"
              value={formatDateTime(participant.created_at)}
            />
          </dl>

          <div className="mt-7 border-t border-[#eee6d8] pt-6">
            {isCancelled ? (
              <p className="rounded-xl border border-[#dedbd3] bg-[#f2f0eb] p-4 text-sm text-[#6b6a66]">
                QR tidak dapat dikirim ulang karena registrasi peserta telah dibatalkan.
              </p>
            ) : (
              <ResendQrButton
                email={participant.email}
                registrationId={participant.registration_id}
              />
            )}
          </div>
        </section>

        <section className="mt-5 grid gap-4 sm:grid-cols-2">
          <AttendanceCard attendance={detailData.arrival} label="Registrasi Kedatangan" />
          <AttendanceCard attendance={detailData.seminar} label="Seminar AKKAI 2026" />
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
      <dd className={`mt-2 font-semibold ${valueClassName}`}>{value}</dd>
    </div>
  );
}
