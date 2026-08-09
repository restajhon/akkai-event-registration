"use client";

import Link from "next/link";
import { useActionState } from "react";

import { resendRegistrationQr } from "./actions";
import { initialParticipantActionState } from "@/lib/participants/participant-action-state";

export type AttendanceSummary = {
  checkedIn: boolean;
  checkedInAt: string | null;
};

export type ParticipantListItem = {
  registrationId: string;
  fullName: string;
  email: string;
  institution: string;
  participantCategory: string;
  registrationStatus: "REGISTERED" | "CANCELLED";
  emailStatus: "PENDING" | "SENT" | "FAILED";
  createdAt: string;
  arrival: AttendanceSummary;
  seminar: AttendanceSummary;
};

export type ParticipantSummary = {
  registered: number;
  cancelled: number;
  emailFailed: number;
};

type ParticipantListProps = {
  participants: ParticipantListItem[];
  summary: ParticipantSummary;
  query: string;
  page: number;
  totalPages: number;
  totalCount: number;
};

function formatDate(dateValue: string) {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "Tanggal tidak tersedia";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

function formatDateTime(dateValue: string | null) {
  if (!dateValue) {
    return "Belum hadir";
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "Waktu tidak tersedia";
  }

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

function maskEmail(email: string) {
  const [localPart, domain] = email.split("@");

  if (!localPart || !domain) {
    return "email peserta";
  }

  const visibleCharacters =
    localPart.length >= 8 ? localPart.slice(0, 3) : localPart.length >= 5 ? localPart.slice(0, 2) : "";
  const maskedLength = Math.max(4, localPart.length - visibleCharacters.length);

  return `${visibleCharacters}${"*".repeat(maskedLength)}@${domain}`;
}

function registrationStatusLabel(status: ParticipantListItem["registrationStatus"]) {
  return status === "REGISTERED" ? "Terdaftar" : "Dibatalkan";
}

function emailStatusLabel(status: ParticipantListItem["emailStatus"]) {
  switch (status) {
    case "SENT":
      return "Terkirim";
    case "FAILED":
      return "Gagal";
    case "PENDING":
      return "Diproses";
  }
}

function statusClassName(status: ParticipantListItem["registrationStatus"]) {
  return status === "REGISTERED"
    ? "border-[#b9dec8] bg-[#f3fbf5] text-[#267044]"
    : "border-[#dedbd3] bg-[#f2f0eb] text-[#6b6a66]";
}

function emailStatusClassName(status: ParticipantListItem["emailStatus"]) {
  switch (status) {
    case "SENT":
      return "text-[#267044]";
    case "FAILED":
      return "text-[#9b3d31]";
    case "PENDING":
      return "text-[#80631e]";
  }
}

function attendanceLabel(attendance: AttendanceSummary) {
  return attendance.checkedIn ? "Hadir" : "Belum";
}

function attendanceClassName(attendance: AttendanceSummary) {
  return attendance.checkedIn ? "text-[#267044]" : "text-[#897657]";
}

function pageHref(query: string, page: number) {
  const params = new URLSearchParams();

  if (query) {
    params.set("q", query);
  }

  params.set("page", page.toString());
  return `/admin/participants?${params.toString()}`;
}

export function ResendQrButton({
  registrationId,
  email,
  disabled = false,
}: {
  registrationId: string;
  email: string;
  disabled?: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    resendRegistrationQr,
    initialParticipantActionState,
  );

  if (disabled) {
    return (
      <button
        className="rounded-lg border border-[#dedbd3] px-3 py-2 text-xs font-semibold text-[#96938c]"
        disabled
        type="button"
      >
        QR tidak tersedia
      </button>
    );
  }

  return (
    <div className="grid justify-items-start gap-2">
      <form
        action={formAction}
        onSubmit={(event) => {
          if (
            !window.confirm(
              `Kirim ulang QR registrasi ke ${maskEmail(email)}?`,
            )
          ) {
            event.preventDefault();
          }
        }}
      >
        <input name="registrationId" type="hidden" value={registrationId} />
        <button
          className="rounded-lg border border-[#b99a5a] px-3 py-2 text-xs font-semibold text-[#6d531e] hover:bg-[#fbf5e8] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={pending}
          type="submit"
        >
          {pending ? "Mengirim..." : "Kirim Ulang QR"}
        </button>
      </form>
      {state.message ? (
        <p
          className={`max-w-xs text-xs ${
            state.status === "success"
              ? "text-[#267044]"
              : state.status === "info"
                ? "text-[#80631e]"
                : "text-[#9b3d31]"
          }`}
          role={state.status === "error" ? "alert" : "status"}
        >
          {state.message}
        </p>
      ) : null}
    </div>
  );
}

function AttendanceCell({ attendance }: { attendance: AttendanceSummary }) {
  return (
    <div className={`font-semibold ${attendanceClassName(attendance)}`}>
      <p>{attendanceLabel(attendance)}</p>
      {attendance.checkedInAt ? (
        <p className="mt-1 text-xs font-normal text-[#897657]">
          {formatDateTime(attendance.checkedInAt)}
        </p>
      ) : null}
    </div>
  );
}

function ParticipantStatus({
  status,
}: {
  status: ParticipantListItem["registrationStatus"];
}) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClassName(
        status,
      )}`}
    >
      {registrationStatusLabel(status)}
    </span>
  );
}

function ParticipantEmailStatus({
  status,
}: {
  status: ParticipantListItem["emailStatus"];
}) {
  return (
    <span className={`font-semibold ${emailStatusClassName(status)}`}>
      {emailStatusLabel(status)}
    </span>
  );
}

export function ParticipantList({
  participants,
  summary,
  query,
  page,
  totalPages,
  totalCount,
}: ParticipantListProps) {
  return (
    <main className="min-h-screen bg-[#f7f3ea] px-4 py-6 sm:px-8 sm:py-8">
      <section className="mx-auto max-w-7xl">
        <header className="rounded-2xl border border-[#e4d8c4] bg-[#fffdf8] p-5 shadow-sm sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold tracking-[0.2em] text-[#9a7526]">
                AKKAI 2026
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#142842]">
                Peserta
              </h1>
              <p className="mt-2 text-sm text-[#5b6c7c]">
                Kelola data peserta dan pengiriman ulang QR registrasi.
              </p>
            </div>
            <Link
              className="text-sm font-semibold text-[#344d68] underline underline-offset-4 hover:text-[#142842]"
              href="/admin/dashboard"
            >
              Kembali ke Dashboard
            </Link>
          </div>
        </header>

        <section className="mt-5 grid gap-3 sm:grid-cols-3">
          <SummaryCard label="Terdaftar" value={summary.registered} />
          <SummaryCard label="Dibatalkan" value={summary.cancelled} />
          <SummaryCard label="Email Gagal" value={summary.emailFailed} />
        </section>

        <section className="mt-5 rounded-2xl border border-[#e4d8c4] bg-[#fffdf8] p-4 shadow-sm sm:p-5">
          <form className="flex flex-col gap-3 sm:flex-row" method="get">
            <label className="sr-only" htmlFor="participant-search">
              Cari peserta
            </label>
            <input
              className="min-w-0 flex-1 rounded-lg border border-[#cfc5b4] bg-white px-3 py-2.5 text-sm text-[#142842] outline-none placeholder:text-[#9a9489] focus:border-[#9a7526] focus:ring-2 focus:ring-[#ead9ac]"
              defaultValue={query}
              id="participant-search"
              maxLength={100}
              name="q"
              placeholder="Cari Registration ID, nama, email, atau nomor anggota"
              type="search"
            />
            <button
              className="rounded-lg bg-[#142842] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#203d5d]"
              type="submit"
            >
              Cari
            </button>
            {query ? (
              <Link
                className="rounded-lg border border-[#b99a5a] px-5 py-2.5 text-center text-sm font-semibold text-[#6d531e] hover:bg-[#fbf5e8]"
                href="/admin/participants"
              >
                Reset
              </Link>
            ) : null}
          </form>
        </section>

        <div className="mt-5 flex items-center justify-between gap-3 text-sm text-[#5b6c7c]">
          <p>{totalCount} peserta ditemukan</p>
          <p>
            Halaman {page} dari {totalPages}
          </p>
        </div>

        {participants.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-[#cfc5b4] bg-[#fffdf8] p-8 text-center text-sm text-[#5b6c7c]">
            Belum ada peserta yang sesuai dengan pencarian.
          </p>
        ) : (
          <>
            <div className="mt-4 grid gap-4 lg:hidden">
              {participants.map((participant) => (
                <ParticipantCard key={participant.registrationId} participant={participant} />
              ))}
            </div>

            <div className="mt-4 hidden overflow-hidden rounded-2xl border border-[#e4d8c4] bg-[#fffdf8] shadow-sm lg:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[#e4d8c4] bg-[#f1eadc] text-xs uppercase tracking-wide text-[#897657]">
                  <tr>
                    <th className="px-4 py-3">Peserta</th>
                    <th className="px-4 py-3">Kontak</th>
                    <th className="px-4 py-3">Status Registrasi</th>
                    <th className="px-4 py-3">Kedatangan</th>
                    <th className="px-4 py-3">Seminar</th>
                    <th className="px-4 py-3">Status Email Terakhir</th>
                    <th className="px-4 py-3">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eee6d8]">
                  {participants.map((participant) => (
                    <ParticipantTableRow
                      key={participant.registrationId}
                      participant={participant}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <nav aria-label="Pagination peserta" className="mt-6 flex justify-between gap-3">
          {page > 1 ? (
            <Link
              className="rounded-lg border border-[#b99a5a] px-4 py-2.5 text-sm font-semibold text-[#6d531e] hover:bg-[#fbf5e8]"
              href={pageHref(query, page - 1)}
            >
              Sebelumnya
            </Link>
          ) : (
            <span />
          )}
          {page < totalPages ? (
            <Link
              className="rounded-lg border border-[#b99a5a] px-4 py-2.5 text-sm font-semibold text-[#6d531e] hover:bg-[#fbf5e8]"
              href={pageHref(query, page + 1)}
            >
              Berikutnya
            </Link>
          ) : null}
        </nav>
      </section>
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="relative overflow-hidden rounded-2xl border border-[#e4d8c4] bg-[#fffdf8] p-4 shadow-sm">
      <div className="absolute inset-y-0 left-0 w-1 bg-[#d9ad45]" />
      <p className="text-sm font-semibold text-[#5b6c7c]">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-[#142842]">{value}</p>
    </article>
  );
}

function ParticipantCard({ participant }: { participant: ParticipantListItem }) {
  const cancelled = participant.registrationStatus === "CANCELLED";

  return (
    <article className="rounded-2xl border border-[#e4d8c4] bg-[#fffdf8] p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold tracking-[0.14em] text-[#9a7526]">
            {participant.registrationId}
          </p>
          <h2 className="mt-2 text-xl font-semibold text-[#142842]">
            {participant.fullName}
          </h2>
          <p className="mt-1 text-sm text-[#5b6c7c]">{participant.email}</p>
        </div>
        <ParticipantStatus status={participant.registrationStatus} />
      </div>

      <dl className="mt-5 grid gap-3 text-sm text-[#5b6c7c] sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wide text-[#897657]">Institusi</dt>
          <dd className="mt-1 font-medium text-[#344d68]">{participant.institution}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-[#897657]">Kategori</dt>
          <dd className="mt-1 font-medium text-[#344d68]">
            {participant.participantCategory}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-[#897657]">Kedatangan</dt>
          <dd className="mt-1">
            <AttendanceCell attendance={participant.arrival} />
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-[#897657]">Seminar</dt>
          <dd className="mt-1">
            <AttendanceCell attendance={participant.seminar} />
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-[#897657]">
            Status Email Terakhir
          </dt>
          <dd className="mt-1">
            <ParticipantEmailStatus status={participant.emailStatus} />
          </dd>
        </div>
      </dl>

      <div className="mt-5 flex flex-wrap items-start gap-3 border-t border-[#eee6d8] pt-4">
        <Link
          className="rounded-lg bg-[#142842] px-3 py-2 text-xs font-semibold text-white hover:bg-[#203d5d]"
          href={`/admin/participants/${participant.registrationId}`}
        >
          Lihat
        </Link>
        <ResendQrButton
          disabled={cancelled}
          email={participant.email}
          registrationId={participant.registrationId}
        />
      </div>
    </article>
  );
}

function ParticipantTableRow({
  participant,
}: {
  participant: ParticipantListItem;
}) {
  const cancelled = participant.registrationStatus === "CANCELLED";

  return (
    <tr className="align-top text-[#344d68]">
      <td className="px-4 py-4">
        <p className="font-semibold text-[#142842]">{participant.fullName}</p>
        <p className="mt-1 text-xs text-[#9a7526]">{participant.registrationId}</p>
        <p className="mt-2 text-xs text-[#5b6c7c]">
          {participant.institution} · {participant.participantCategory}
        </p>
      </td>
      <td className="px-4 py-4">
        <p>{participant.email}</p>
        <p className="mt-1 text-xs text-[#897657]">{formatDate(participant.createdAt)}</p>
      </td>
      <td className="px-4 py-4">
        <ParticipantStatus status={participant.registrationStatus} />
      </td>
      <td className="px-4 py-4">
        <AttendanceCell attendance={participant.arrival} />
      </td>
      <td className="px-4 py-4">
        <AttendanceCell attendance={participant.seminar} />
      </td>
      <td className="px-4 py-4">
        <ParticipantEmailStatus status={participant.emailStatus} />
      </td>
      <td className="px-4 py-4">
        <div className="grid justify-items-start gap-2">
          <Link
            className="text-xs font-semibold text-[#344d68] underline underline-offset-4 hover:text-[#142842]"
            href={`/admin/participants/${participant.registrationId}`}
          >
            Lihat
          </Link>
          <ResendQrButton
            disabled={cancelled}
            email={participant.email}
            registrationId={participant.registrationId}
          />
        </div>
      </td>
    </tr>
  );
}
