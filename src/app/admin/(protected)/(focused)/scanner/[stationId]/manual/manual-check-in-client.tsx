"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import {
  initialManualCheckInState,
  initialManualSearchState,
  type ManualCheckInErrorCode,
  type ManualCheckInState,
  type ManualParticipant,
} from "@/lib/manual-check-in/manual-check-in-state";

import { processManualCheckIn, searchManualParticipants } from "./actions";

type ManualCheckInClientProps = {
  stationId: string;
  stationName: string;
  sessionCode: string;
  sessionName: string;
};

export function ManualCheckInClient(props: ManualCheckInClientProps) {
  const [flowKey, setFlowKey] = useState(0);

  return (
    <ManualCheckInFlow
      key={flowKey}
      onNextParticipant={() => setFlowKey((current) => current + 1)}
      {...props}
    />
  );
}

function ManualCheckInFlow({
  stationId,
  stationName,
  sessionName,
  onNextParticipant,
}: ManualCheckInClientProps & { onNextParticipant: () => void }) {
  const [searchState, searchAction, searchPending] = useActionState(
    searchManualParticipants,
    initialManualSearchState,
  );
  const [checkInState, checkInAction, checkInPending] = useActionState(
    processManualCheckIn,
    initialManualCheckInState,
  );
  const [query, setQuery] = useState("");
  const [selectedParticipant, setSelectedParticipant] =
    useState<ManualParticipant | null>(null);

  const isCompleted =
    checkInState.status === "success" ||
    checkInState.status === "success-with-warning" ||
    checkInState.status === "already-checked-in" ||
    checkInState.status === "cancelled-participant";

  return (
    <main className="min-h-screen bg-[#f7f3ea] px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-8 sm:py-6">
      <section className="mx-auto max-w-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-[#dfd3bf] pb-4">
          <div className="min-w-0">
            <p className="text-xs font-bold tracking-[0.2em] text-[#9a7526]">AKKAI 2026</p>
            <h1 className="mt-1 text-xl font-semibold leading-tight tracking-tight text-[#142842] sm:text-2xl">
              Check-in Manual
            </h1>
          </div>
          <Link
            className="inline-flex min-h-11 shrink-0 items-center rounded-md px-1 py-1 text-sm font-semibold text-[#344d68] underline decoration-[#b99a5a] underline-offset-4 outline-none hover:text-[#142842] focus-visible:ring-2 focus-visible:ring-[#9a7526]"
            href={`/admin/scanner/${stationId}`}
          >
            Kembali ke Scanner
          </Link>
        </header>

        <section className="mt-4 rounded-xl border border-[#e4d8c4] bg-[#fffdf8] px-4 py-3" aria-label="Konteks check-in manual">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#897657]">Sesi</p>
              <p className="mt-0.5 text-sm font-semibold text-[#142842]">{sessionName}</p>
            </div>
            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <div className="min-w-0 sm:text-right">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#897657]">Station</p>
                <p className="mt-0.5 truncate text-sm font-semibold text-[#142842]">{stationName}</p>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#edf7ef] px-3 py-1.5 text-xs font-bold text-[#267044]">
                <span aria-hidden="true">●</span>
                Sesi Aktif
              </span>
            </div>
          </div>
        </section>

        {isCompleted ? (
          <ManualResult
            onNextParticipant={onNextParticipant}
            state={checkInState}
            stationId={stationId}
          />
        ) : selectedParticipant ? (
          <SelectedParticipant
            checkInAction={checkInAction}
            checkInPending={checkInPending}
            checkInState={checkInState}
            onChangeParticipant={() => setSelectedParticipant(null)}
            participant={selectedParticipant}
            sessionName={sessionName}
            stationId={stationId}
          />
        ) : (
          <SearchWorkspace
            onQueryChange={setQuery}
            onSelectParticipant={setSelectedParticipant}
            query={query}
            searchAction={searchAction}
            searchPending={searchPending}
            searchState={searchState}
            stationId={stationId}
          />
        )}
      </section>
    </main>
  );
}

function SearchWorkspace({
  onQueryChange,
  onSelectParticipant,
  query,
  searchAction,
  searchPending,
  searchState,
  stationId,
}: {
  onQueryChange: (value: string) => void;
  onSelectParticipant: (participant: ManualParticipant) => void;
  query: string;
  searchAction: (payload: FormData) => void;
  searchPending: boolean;
  searchState: {
    status: "idle" | "success" | "error";
    message: string | null;
    results: ManualParticipant[];
  };
  stationId: string;
}) {
  const hasSearched = searchState.status === "success";
  const hasResults = hasSearched && searchState.results.length > 0;

  return (
    <>
      <section className="mt-4 rounded-2xl border border-[#e4d8c4] bg-[#fffdf8] p-4 shadow-[0_6px_20px_rgba(20,40,66,0.06)] sm:p-5">
        <form
          action={searchAction}
          aria-busy={searchPending}
          className="grid gap-3"
        >
          <input name="stationId" type="hidden" value={stationId} />
          <label className="grid gap-2 text-sm font-semibold text-[#344d68]" htmlFor="manual-participant-search">
            Cari Peserta
            <input
              autoComplete="off"
              className="min-h-12 w-full rounded-lg border border-[#cfc5b4] bg-white px-3 text-base text-[#142842] outline-none placeholder:text-[#9a9489] focus:border-[#9a7526] focus:ring-2 focus:ring-[#ead9ac]"
              id="manual-participant-search"
              maxLength={100}
              name="query"
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Nama, Registration ID, atau nomor anggota"
              type="search"
              value={query}
            />
          </label>
          <button
            className="min-h-12 w-full rounded-lg bg-[#142842] px-5 py-3 text-sm font-semibold text-white outline-none transition hover:bg-[#203d5d] focus-visible:ring-2 focus-visible:ring-[#9a7526] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={searchPending}
            type="submit"
          >
            {searchPending ? "Mencari peserta..." : "Cari Peserta"}
          </button>
        </form>

        <div className="mt-3 min-h-5" aria-live="polite" role="status">
          {searchPending ? (
            <p className="text-sm font-medium text-[#5b6c7c]">Mencari peserta...</p>
          ) : searchState.status === "error" && searchState.message ? (
            <p className="rounded-lg border border-[#ead3cc] bg-[#fff5f2] p-3 text-sm leading-5 text-[#9b3d31]" role="alert">
              {searchState.message}
            </p>
          ) : null}
        </div>
      </section>

      {!hasSearched && searchState.status !== "error" ? (
        <section className="mt-4 px-1 py-2" aria-label="Petunjuk pencarian">
          <p className="text-base font-semibold text-[#142842]">
            Cari peserta untuk melakukan check-in manual.
          </p>
          <p className="mt-1 text-sm leading-5 text-[#5b6c7c]">
            Gunakan nama, Registration ID, atau nomor anggota.
          </p>
        </section>
      ) : null}

      {hasSearched ? (
        <section className="mt-4" aria-live="polite" aria-label="Hasil pencarian peserta">
          {hasResults ? (
            <div className="grid gap-3">
              {searchState.results.map((participant) => (
                <ParticipantResultCard
                  key={participant.registrationId}
                  onSelect={onSelectParticipant}
                  participant={participant}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[#cfc5b4] bg-[#fffdf8] px-4 py-5">
              <p className="text-base font-semibold text-[#142842]">Peserta tidak ditemukan</p>
              <p className="mt-1 text-sm leading-5 text-[#5b6c7c]">
                Coba periksa nama atau Registration ID peserta.
              </p>
            </div>
          )}
        </section>
      ) : null}
    </>
  );
}

function ParticipantResultCard({
  participant,
  onSelect,
}: {
  participant: ManualParticipant;
  onSelect: (participant: ManualParticipant) => void;
}) {
  const isCancelled = participant.registrationStatus === "CANCELLED";
  const isUnavailable = isCancelled || participant.alreadyCheckedIn;

  return (
    <article
      className={`rounded-xl border bg-[#fffdf8] p-4 sm:p-5 ${
        isCancelled
          ? "border-[#dedbd3] bg-[#f2f0eb]"
          : participant.alreadyCheckedIn
            ? "border-[#b8cce2] bg-[#f3f8fd]"
            : "border-[#e4d8c4]"
      }`}
    >
      <div className="min-w-0">
        <h2 className="break-words text-xl font-bold leading-tight text-[#142842] sm:text-2xl">
          {participant.fullName}
        </h2>
        <p className="mt-1 break-words text-sm font-bold tracking-[0.08em] text-[#9a7526]">
          {participant.registrationId}
        </p>
      </div>

      <dl className="mt-4 grid gap-3 text-sm text-[#5b6c7c] sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-[#897657]">Institusi</dt>
          <dd className="mt-1 break-words font-medium text-[#344d68]">{participant.institution}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-[#897657]">Kategori</dt>
          <dd className="mt-1 break-words font-medium text-[#344d68]">{participant.participantCategory}</dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-2" aria-label="Status sesi peserta">
        {isCancelled ? (
          <span className="inline-flex min-h-8 items-center rounded-full bg-[#e5e2dc] px-3 py-1 text-xs font-bold text-[#6b6a66]">
            Pendaftaran dibatalkan
          </span>
        ) : participant.alreadyCheckedIn ? (
          <span className="inline-flex min-h-8 items-center rounded-full bg-[#dfeefa] px-3 py-1 text-xs font-bold text-[#345d80]">
            SUDAH CHECK-IN
          </span>
        ) : (
          <span className="inline-flex min-h-8 items-center rounded-full bg-[#edf7ef] px-3 py-1 text-xs font-bold text-[#267044]">
            Belum Check-in
          </span>
        )}
        {participant.alreadyCheckedIn && participant.checkedInAt ? (
          <span className="text-sm font-medium text-[#5b6c7c]">
            Waktu: {formatDateTime(participant.checkedInAt)}
          </span>
        ) : null}
      </div>

      {!isUnavailable ? (
        <div className="mt-4 border-t border-[#eee6d8] pt-4">
          <button
            className="min-h-12 w-full rounded-lg bg-[#142842] px-4 py-3 text-sm font-semibold text-white outline-none transition hover:bg-[#203d5d] focus-visible:ring-2 focus-visible:ring-[#9a7526]"
            onClick={() => onSelect(participant)}
            type="button"
          >
            Pilih Peserta
          </button>
        </div>
      ) : null}
    </article>
  );
}

function SelectedParticipant({
  checkInAction,
  checkInPending,
  checkInState,
  onChangeParticipant,
  participant,
  sessionName,
  stationId,
}: {
  checkInAction: (payload: FormData) => void;
  checkInPending: boolean;
  checkInState: ManualCheckInState;
  onChangeParticipant: () => void;
  participant: ManualParticipant;
  sessionName: string;
  stationId: string;
}) {
  const errorCopy = checkInState.errorCode
    ? manualErrorCopy(checkInState.errorCode)
    : null;

  return (
    <section className="mt-4 rounded-2xl border border-[#b8cce2] bg-[#f3f8fd] p-5 shadow-[0_6px_20px_rgba(20,40,66,0.06)] sm:p-6" aria-label="Peserta yang dipilih">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#47739b] text-lg font-bold text-white">
          ✓
        </span>
        <p className="text-sm font-bold uppercase tracking-[0.14em] text-[#345d80]">Peserta Dipilih</p>
      </div>

      <h2 className="mt-5 break-words text-3xl font-bold leading-tight tracking-tight text-[#142842] sm:text-4xl">
        {participant.fullName}
      </h2>

      <dl className="mt-6 grid gap-4 text-sm text-[#5b6c7c] sm:grid-cols-2">
        <Detail label="Registration ID" value={participant.registrationId} strong />
        <Detail label="Institusi" value={participant.institution} />
        <Detail label="Kategori" value={participant.participantCategory} />
        <Detail label="Sesi" value={sessionName} />
      </dl>

      {errorCopy ? (
        <div className="mt-5 rounded-lg border border-[#ead3cc] bg-[#fff5f2] p-4" role="alert">
          <p className="text-sm font-bold uppercase tracking-[0.1em] text-[#9b3d31]">{errorCopy.title}</p>
          <p className="mt-1 text-sm leading-5 text-[#5f302b]">{errorCopy.message}</p>
        </div>
      ) : null}

      <form action={checkInAction} className="mt-6 grid gap-3" aria-busy={checkInPending}>
        <input name="stationId" type="hidden" value={stationId} />
        <input name="registrationId" type="hidden" value={participant.registrationId} />
        <button
          className="order-1 min-h-12 w-full rounded-lg bg-[#142842] px-4 py-3 text-sm font-semibold text-white outline-none transition hover:bg-[#203d5d] focus-visible:ring-2 focus-visible:ring-[#9a7526] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={checkInPending}
          type="submit"
        >
          {checkInPending ? "Memproses check-in..." : checkInState.status === "error" ? "Coba Lagi" : "Check-in Peserta"}
        </button>
        <button
          className="order-2 min-h-12 w-full rounded-lg border border-[#b99a5a] px-4 py-3 text-sm font-semibold text-[#6d531e] outline-none transition hover:bg-[#fbf5e8] focus-visible:ring-2 focus-visible:ring-[#9a7526] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={checkInPending}
          onClick={onChangeParticipant}
          type="button"
        >
          Ganti Peserta
        </button>
      </form>
    </section>
  );
}

function ManualResult({
  state,
  stationId,
  onNextParticipant,
}: {
  state: ManualCheckInState;
  stationId: string;
  onNextParticipant: () => void;
}) {
  const participant = state.participant;
  const session = state.session;
  const isWarning = state.status === "success-with-warning";
  const isAlreadyCheckedIn = state.status === "already-checked-in";
  const isCancelled = state.status === "cancelled-participant";
  const isPositive = state.status === "success" || isWarning;
  const title = isWarning
    ? "CHECK-IN SEMINAR BERHASIL DENGAN CATATAN"
    : isAlreadyCheckedIn
      ? "SUDAH CHECK-IN"
      : isCancelled
        ? "CHECK-IN TIDAK DAPAT DILAKUKAN"
        : "CHECK-IN BERHASIL";
  const message = isWarning
    ? "Peserta berhasil check-in untuk sesi seminar, tetapi belum tercatat pada sesi kedatangan (ARRIVAL)."
    : isAlreadyCheckedIn
      ? "Peserta sudah tercatat pada sesi ini."
      : isCancelled
        ? "Pendaftaran peserta telah dibatalkan."
        : null;
  const stateClass = isWarning
    ? "border-[#e5cb8c] bg-[#fff9eb]"
    : isAlreadyCheckedIn
      ? "border-[#b8cce2] bg-[#f3f8fd]"
      : isCancelled
        ? "border-[#ead3cc] bg-[#fff5f2]"
        : "border-[#b9dec8] bg-[#f3fbf5]";
  const markClass = isWarning
    ? "bg-[#b78a2b]"
    : isAlreadyCheckedIn
      ? "bg-[#47739b]"
      : isCancelled
        ? "bg-[#b94b3e]"
        : "bg-[#267044]";

  return (
    <section
      className={`mt-4 rounded-2xl border p-5 shadow-[0_6px_20px_rgba(20,40,66,0.06)] sm:p-6 ${stateClass}`}
      role={isCancelled ? "alert" : "status"}
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl font-bold text-white ${markClass}`}>
          {isAlreadyCheckedIn ? "i" : isCancelled || isWarning ? "!" : "✓"}
        </span>
        <p className={`text-sm font-bold uppercase tracking-[0.12em] ${isCancelled ? "text-[#9b3d31]" : isAlreadyCheckedIn ? "text-[#345d80]" : "text-[#6d531e]"}`}>
          {title}
        </p>
      </div>

      {participant ? (
        <>
          <h2 className="mt-5 break-words text-3xl font-bold leading-tight tracking-tight text-[#142842] sm:text-4xl">
            {participant.fullName}
          </h2>
          <dl className="mt-6 grid gap-4 text-sm text-[#344d68] sm:grid-cols-2">
            <Detail label="Registration ID" value={participant.registrationId} strong />
            <Detail label="Institusi" value={participant.institution} />
            <Detail label="Kategori" value={participant.participantCategory} />
            {session ? <Detail label="Sesi" value={session.name} /> : null}
            {state.checkedAt ? <Detail label="Waktu Check-in" value={formatDateTime(state.checkedAt)} /> : null}
          </dl>
        </>
      ) : null}

      {message ? (
        <p className={`mt-5 rounded-lg p-4 text-sm font-medium leading-5 ${isCancelled ? "bg-white/70 text-[#5f302b]" : "bg-white/70 text-[#6d531e]"}`}>
          {message}
        </p>
      ) : null}

      {isPositive ? (
        <p className="mt-4 text-xs font-bold uppercase tracking-[0.12em] text-[#897657]">Check-in Manual</p>
      ) : null}

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <button
          className="min-h-12 w-full rounded-lg bg-[#142842] px-4 py-3 text-sm font-semibold text-white outline-none transition hover:bg-[#203d5d] focus-visible:ring-2 focus-visible:ring-[#9a7526]"
          onClick={onNextParticipant}
          type="button"
        >
          {isAlreadyCheckedIn || isCancelled ? "Cari Peserta Lain" : "Check-in Peserta Berikutnya"}
        </button>
        <Link
          className="inline-flex min-h-12 w-full items-center justify-center rounded-lg border border-[#b99a5a] px-4 py-3 text-center text-sm font-semibold text-[#6d531e] outline-none transition hover:bg-[#fbf5e8] focus-visible:ring-2 focus-visible:ring-[#9a7526]"
          href={`/admin/scanner/${stationId}`}
        >
          Kembali ke Scanner
        </Link>
      </div>
    </section>
  );
}

function Detail({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-[#897657]">{label}</dt>
      <dd className={`mt-1 break-words ${strong ? "font-bold text-[#142842]" : "font-semibold text-[#344d68]"}`}>
        {value}
      </dd>
    </div>
  );
}

function manualErrorCopy(errorCode: ManualCheckInErrorCode) {
  switch (errorCode) {
    case "participant-not-found":
      return {
        title: "Peserta tidak ditemukan",
        message: "Coba periksa nama atau Registration ID peserta.",
      };
    case "closed-session":
      return {
        title: "Sesi belum aktif",
        message: "Check-in belum dapat dilakukan pada sesi ini.",
      };
    case "invalid-station":
    case "station-not-paired":
    case "station-owned-by-other-operator":
      return {
        title: "Scanner tidak siap",
        message: "Gunakan scanner yang sudah dipasangkan dengan akun operator ini.",
      };
    case "unauthorized-operator":
      return {
        title: "Akses check-in diperlukan",
        message: "Akun operator ini tidak dapat melakukan check-in.",
      };
    case "invalid-request":
      return {
        title: "Data check-in tidak sesuai",
        message: "Periksa peserta yang dipilih lalu coba kembali.",
      };
    case "internal-error":
      return {
        title: "Check-in belum tersimpan",
        message: "Terjadi kendala saat memproses check-in. Silakan coba kembali.",
      };
  }
}

function formatDateTime(dateValue: string) {
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
