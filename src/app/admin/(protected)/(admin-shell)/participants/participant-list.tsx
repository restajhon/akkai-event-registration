"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { initialParticipantActionState } from "@/lib/participants/participant-action-state";

import { resendRegistrationQr } from "./actions";

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

function formatDateTime(dateValue: string | null, emptyLabel = "Waktu tidak tersedia") {
  if (!dateValue) {
    return emptyLabel;
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

function registrationStatusLabel(status: ParticipantListItem["registrationStatus"]) {
  return status === "REGISTERED" ? "Terdaftar" : "Dibatalkan";
}

function statusClassName(status: ParticipantListItem["registrationStatus"]) {
  return status === "REGISTERED"
    ? "border-[#b9dec8] bg-[#f3fbf5] text-[#267044]"
    : "border-[#dedbd3] bg-[#f2f0eb] text-[#6b6a66]";
}

function attendanceLabel(attendance: AttendanceSummary) {
  return attendance.checkedIn ? "Sudah Check-in" : "Belum Check-in";
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
  const [isConfirming, setIsConfirming] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (previousState: typeof initialParticipantActionState, formData: FormData) => {
      const result = await resendRegistrationQr(previousState, formData);
      setIsConfirming(false);
      return result;
    },
    initialParticipantActionState,
  );

  if (disabled) {
    return (
      <button
        className="inline-flex min-h-11 items-center rounded-lg border border-[#dedbd3] px-3.5 py-2 text-xs font-semibold text-[#96938c]"
        disabled
        type="button"
      >
        Email registrasi tidak tersedia
      </button>
    );
  }

  return (
    <div className="grid justify-items-start gap-2">
      {isConfirming ? (
        <div
          aria-label="Konfirmasi kirim ulang email registrasi"
          className="w-full max-w-md rounded-xl border border-[#e5cb8c] bg-[#fff9eb] p-4"
          role="group"
        >
          <p className="font-semibold text-[#142842]">Kirim ulang email registrasi?</p>
          <p className="mt-2 text-sm text-[#5b6c7c]">
            Email registrasi akan dikirim kembali ke:
          </p>
          <p className="mt-1 break-words text-sm font-semibold text-[#344d68]">{email}</p>
          <p className="mt-2 text-sm text-[#5b6c7c]">QR yang digunakan tetap sama.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className="inline-flex min-h-11 items-center rounded-lg border border-[#b99a5a] px-3.5 py-2 text-xs font-semibold text-[#6d531e] outline-none hover:bg-[#fbf5e8] focus-visible:ring-2 focus-visible:ring-[#9a7526]"
              onClick={() => setIsConfirming(false)}
              type="button"
            >
              Batal
            </button>
            <form action={formAction}>
              <input name="registrationId" type="hidden" value={registrationId} />
              <button
                className="inline-flex min-h-11 items-center rounded-lg bg-[#142842] px-3.5 py-2 text-xs font-semibold text-white outline-none hover:bg-[#203d5d] focus-visible:ring-2 focus-visible:ring-[#9a7526] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={pending}
                type="submit"
              >
                {pending ? "Mengirim email..." : "Ya, Kirim Ulang"}
              </button>
            </form>
          </div>
        </div>
      ) : (
        <button
          className="inline-flex min-h-11 items-center rounded-lg border border-[#b99a5a] px-3.5 py-2 text-xs font-semibold text-[#6d531e] outline-none hover:bg-[#fbf5e8] focus-visible:ring-2 focus-visible:ring-[#9a7526]"
          onClick={() => setIsConfirming(true)}
          type="button"
        >
          Kirim Ulang Email Registrasi
        </button>
      )}
      {state.message ? (
        <p
          aria-live="polite"
          className={`max-w-md text-xs ${
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
      <p className="flex items-center gap-1.5">
        <span aria-hidden="true">{attendance.checkedIn ? "●" : "○"}</span>
        {attendanceLabel(attendance)}
      </p>
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
      className={`inline-flex min-h-7 items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClassName(
        status,
      )}`}
    >
      {registrationStatusLabel(status)}
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
    <main className="min-h-screen bg-[#f7f3ea] px-4 py-5 sm:px-8 sm:py-6">
      <section className="mx-auto max-w-[1380px]">
        <header className="border-b border-[#dfd3bf] pb-4">
          <p className="text-xs font-bold tracking-[0.16em] text-[#9a7526]">DATA OPERASIONAL</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#142842] sm:text-3xl">
            Peserta
          </h1>
          <p className="mt-1 text-sm text-[#5b6c7c]">
            Kelola data dan status kehadiran peserta AKKAI 2026.
          </p>
        </header>

        <section
          aria-labelledby="participant-search-heading"
          className="mt-4 rounded-xl border border-[#e4d8c4] bg-[#fffdf8] p-4 sm:p-5"
        >
          <h2 className="text-lg font-semibold text-[#142842]" id="participant-search-heading">
            Cari Peserta
          </h2>
          <p className="mt-1 text-sm text-[#5b6c7c]">
            Cari berdasarkan nama, nomor registrasi, email, atau nomor anggota.
          </p>
          <form className="mt-3 flex flex-col gap-2.5 sm:flex-row" method="get">
            <label className="sr-only" htmlFor="participant-search">
              Cari berdasarkan nama, nomor registrasi, email, atau nomor anggota
            </label>
            <input
              className="min-h-11 min-w-0 flex-1 rounded-lg border border-[#cfc5b4] bg-white px-3 text-sm text-[#142842] outline-none placeholder:text-[#9a9489] focus:border-[#9a7526] focus:ring-2 focus:ring-[#ead9ac]"
              defaultValue={query}
              id="participant-search"
              maxLength={100}
              name="q"
              placeholder="Cari berdasarkan nama, nomor registrasi, email, atau nomor anggota"
              type="search"
            />
            <button
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#142842] px-5 text-sm font-semibold text-white outline-none hover:bg-[#203d5d] focus-visible:ring-2 focus-visible:ring-[#9a7526]"
              type="submit"
            >
              Cari
            </button>
            {query ? (
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#b99a5a] px-5 text-sm font-semibold text-[#6d531e] outline-none hover:bg-[#fbf5e8] focus-visible:ring-2 focus-visible:ring-[#9a7526]"
                href="/admin/participants"
              >
                Reset
              </Link>
            ) : null}
          </form>
        </section>

        <section aria-label="Ringkasan peserta" className="mt-4 grid gap-2 sm:grid-cols-3">
          <SummaryCard label="Terdaftar" value={summary.registered} />
          <SummaryCard label="Dibatalkan" value={summary.cancelled} />
          <SummaryCard label="Email Gagal Sebelum Diterima" value={summary.emailFailed} />
        </section>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-[#5b6c7c]">
          <p>{query ? `${totalCount} peserta ditemukan` : `${totalCount} peserta terdaftar`}</p>
          <p aria-label={`Halaman ${page} dari ${totalPages}`}>
            Halaman {page} dari {totalPages}
          </p>
        </div>

        {participants.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-[#cfc5b4] bg-[#fffdf8] p-8 text-center">
            <p className="font-semibold text-[#142842]">
              {query ? "Peserta tidak ditemukan." : "Belum ada peserta terdaftar."}
            </p>
            {query ? (
              <p className="mt-1 text-sm text-[#5b6c7c]">
                Periksa kembali nama, nomor registrasi, email, atau nomor anggota.
              </p>
            ) : null}
          </div>
        ) : (
          <>
            <div className="mt-4 grid gap-3 lg:hidden">
              {participants.map((participant) => (
                <ParticipantCard key={participant.registrationId} participant={participant} />
              ))}
            </div>

            <div className="mt-4 hidden overflow-hidden rounded-xl border border-[#e4d8c4] bg-[#fffdf8] lg:block">
              <table aria-label="Daftar peserta" className="w-full table-fixed text-left text-sm">
                <thead className="border-b border-[#e4d8c4] bg-[#f1eadc] text-xs uppercase tracking-wide text-[#897657]">
                  <tr>
                    <th className="w-[23%] px-3 py-3" scope="col">Peserta</th>
                    <th className="w-[19%] px-3 py-3" scope="col">Institusi / Kategori</th>
                    <th className="w-[14%] px-3 py-3" scope="col">Status Registrasi</th>
                    <th className="w-[15%] px-3 py-3" scope="col">Registrasi Kedatangan</th>
                    <th className="w-[13%] px-3 py-3" scope="col">Seminar</th>
                    <th className="w-[16%] px-3 py-3" scope="col">Aksi</th>
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

        <nav aria-label="Pagination peserta" className="mt-5 flex items-center justify-between gap-3">
          {page > 1 ? (
            <Link
              aria-label="Halaman sebelumnya"
              className="inline-flex min-h-11 items-center rounded-lg border border-[#b99a5a] px-4 text-sm font-semibold text-[#6d531e] outline-none hover:bg-[#fbf5e8] focus-visible:ring-2 focus-visible:ring-[#9a7526]"
              href={pageHref(query, page - 1)}
            >
              Sebelumnya
            </Link>
          ) : (
            <span aria-hidden="true" className="min-h-11" />
          )}
          {page < totalPages ? (
            <Link
              aria-label="Halaman berikutnya"
              className="inline-flex min-h-11 items-center rounded-lg border border-[#b99a5a] px-4 text-sm font-semibold text-[#6d531e] outline-none hover:bg-[#fbf5e8] focus-visible:ring-2 focus-visible:ring-[#9a7526]"
              href={pageHref(query, page + 1)}
            >
              Berikutnya
            </Link>
          ) : (
            <span aria-hidden="true" className="min-h-11" />
          )}
        </nav>
      </section>
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-xl border border-[#e4d8c4] bg-[#fffdf8] px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#897657]">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-[#142842]">{value}</p>
    </article>
  );
}

function ParticipantCard({ participant }: { participant: ParticipantListItem }) {
  const cancelled = participant.registrationStatus === "CANCELLED";

  return (
    <article className="rounded-xl border border-[#e4d8c4] bg-[#fffdf8] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="break-words text-xl font-semibold text-[#142842]">{participant.fullName}</h2>
          <p className="mt-1 break-all text-sm font-semibold text-[#9a7526]">{participant.registrationId}</p>
        </div>
        <ParticipantStatus status={participant.registrationStatus} />
      </div>

      <dl className="mt-4 grid gap-3 text-sm text-[#5b6c7c] sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wide text-[#897657]">Institusi</dt>
          <dd className="mt-1 break-words font-medium text-[#344d68]">{participant.institution}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-[#897657]">Kategori</dt>
          <dd className="mt-1 break-words font-medium text-[#344d68]">{participant.participantCategory}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-[#897657]">Registrasi Kedatangan</dt>
          <dd className="mt-1"><AttendanceCell attendance={participant.arrival} /></dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-[#897657]">Seminar</dt>
          <dd className="mt-1"><AttendanceCell attendance={participant.seminar} /></dd>
        </div>
      </dl>

      <div className="mt-4 grid gap-2 border-t border-[#eee6d8] pt-4 sm:flex sm:flex-wrap sm:items-start">
        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#142842] px-3.5 text-xs font-semibold text-white outline-none hover:bg-[#203d5d] focus-visible:ring-2 focus-visible:ring-[#9a7526]"
          href={`/admin/participants/${participant.registrationId}`}
        >
          Lihat Detail
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
      <td className="px-3 py-3.5">
        <p className="break-words font-semibold text-[#142842]">{participant.fullName}</p>
        <p className="mt-1 break-all text-xs font-semibold text-[#9a7526]">{participant.registrationId}</p>
      </td>
      <td className="px-3 py-3.5">
        <p className="break-words font-medium">{participant.institution}</p>
        <p className="mt-1 break-words text-xs text-[#897657]">{participant.participantCategory}</p>
      </td>
      <td className="px-3 py-3.5">
        <ParticipantStatus status={participant.registrationStatus} />
      </td>
      <td className="px-3 py-3.5">
        <AttendanceCell attendance={participant.arrival} />
      </td>
      <td className="px-3 py-3.5">
        <AttendanceCell attendance={participant.seminar} />
      </td>
      <td className="px-3 py-3.5">
        <div className="grid justify-items-start gap-2">
          <Link
            className="inline-flex min-h-11 items-center text-xs font-semibold text-[#344d68] underline underline-offset-4 outline-none hover:text-[#142842] focus-visible:ring-2 focus-visible:ring-[#9a7526]"
            href={`/admin/participants/${participant.registrationId}`}
          >
            Lihat Detail
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
