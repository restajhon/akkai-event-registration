"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import {
  initialManualCheckInState,
  initialManualSearchState,
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
  sessionCode,
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
    <main className="min-h-screen bg-[#f7f3ea] px-4 py-6 sm:px-8 sm:py-8">
      <section className="mx-auto max-w-3xl">
        <header className="rounded-2xl border border-[#e4d8c4] bg-[#fffdf8] p-5 shadow-sm sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold tracking-[0.2em] text-[#9a7526]">
                AKKAI 2026
              </p>
              <h1 className="mt-2 text-2xl font-semibold text-[#142842]">
                Check-in Manual
              </h1>
            </div>
            <Link
              className="text-sm font-semibold text-[#344d68] underline underline-offset-4 hover:text-[#142842]"
              href={`/admin/scanner/${stationId}`}
            >
              Kembali ke Scanner
            </Link>
          </div>

          <dl className="mt-6 grid gap-3 rounded-xl bg-[#f1eadc] p-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-[#897657]">
                Station
              </dt>
              <dd className="mt-1 font-semibold text-[#142842]">{stationName}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-[#897657]">
                Sesi
              </dt>
              <dd className="mt-1 font-semibold text-[#142842]">
                {sessionCode} — {sessionName}
              </dd>
            </div>
          </dl>
        </header>

        {isCompleted ? (
          <ManualResult
            onNextParticipant={onNextParticipant}
            state={checkInState}
            stationId={stationId}
          />
        ) : (
          <>
            <section className="mt-5 rounded-2xl border border-[#e4d8c4] bg-[#fffdf8] p-4 shadow-sm sm:p-6">
              <form
                action={searchAction}
                className="grid gap-3 sm:grid-cols-[1fr_auto]"
                onSubmit={() => setSelectedParticipant(null)}
              >
                <input name="stationId" type="hidden" value={stationId} />
                <label className="grid gap-2 text-sm font-medium text-[#344d68] sm:col-span-2">
                  Cari peserta
                  <input
                    autoComplete="off"
                    className="rounded-lg border border-[#cfc5b4] bg-white px-3 py-3 text-base text-[#142842] outline-none placeholder:text-[#9a9489] focus:border-[#9a7526] focus:ring-2 focus:ring-[#ead9ac]"
                    maxLength={100}
                    name="query"
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Cari nama atau Registration ID"
                    type="search"
                    value={query}
                  />
                </label>
                <button
                  className="rounded-lg bg-[#142842] px-5 py-3 text-sm font-semibold text-white hover:bg-[#203d5d] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={searchPending}
                  type="submit"
                >
                  {searchPending ? "Mencari..." : "Cari Peserta"}
                </button>
              </form>

              {searchState.message ? (
                <p
                  className={`mt-4 rounded-lg p-3 text-sm ${
                    searchState.status === "error"
                      ? "border border-[#ead3cc] bg-[#fff5f2] text-[#9b3d31]"
                      : "bg-[#f1eadc] text-[#5b6c7c]"
                  }`}
                  role={searchState.status === "error" ? "alert" : "status"}
                >
                  {searchState.message}
                </p>
              ) : null}
            </section>

            {searchState.status === "success" ? (
              <section className="mt-5 grid gap-3" aria-live="polite">
                {searchState.results.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-[#cfc5b4] bg-[#fffdf8] p-6 text-center text-sm text-[#5b6c7c]">
                    Belum ada peserta yang sesuai dengan pencarian.
                  </p>
                ) : (
                  searchState.results.map((participant) => (
                    <ParticipantResultCard
                      key={participant.registrationId}
                      onSelect={setSelectedParticipant}
                      participant={participant}
                    />
                  ))
                )}
              </section>
            ) : null}

            {selectedParticipant ? (
              <section className="mt-5 rounded-2xl border border-[#b8cce2] bg-[#f3f8fd] p-5 shadow-sm sm:p-6">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#344d68]">
                  Konfirmasi
                </p>
                <h2 className="mt-2 text-xl font-semibold text-[#142842]">
                  Check-in peserta ini secara manual?
                </h2>
                <dl className="mt-5 grid gap-3 text-sm text-[#5b6c7c]">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-[#897657]">
                      Peserta
                    </dt>
                    <dd className="mt-1 font-semibold text-[#142842]">
                      {selectedParticipant.fullName}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-[#897657]">
                      Registration ID
                    </dt>
                    <dd className="mt-1 font-semibold text-[#142842]">
                      {selectedParticipant.registrationId}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-[#897657]">
                      Sesi
                    </dt>
                    <dd className="mt-1 font-semibold text-[#142842]">{sessionName}</dd>
                  </div>
                </dl>

                {checkInState.status === "error" && checkInState.message ? (
                  <p
                    className="mt-5 rounded-lg border border-[#ead3cc] bg-[#fff5f2] p-3 text-sm text-[#9b3d31]"
                    role="alert"
                  >
                    {checkInState.message}
                  </p>
                ) : null}

                <form action={checkInAction} className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <input name="stationId" type="hidden" value={stationId} />
                  <input
                    name="registrationId"
                    type="hidden"
                    value={selectedParticipant.registrationId}
                  />
                  <button
                    className="order-1 rounded-lg bg-[#142842] px-4 py-3 text-sm font-semibold text-white hover:bg-[#203d5d] disabled:cursor-not-allowed disabled:opacity-50 sm:order-2"
                    disabled={checkInPending}
                    type="submit"
                  >
                    {checkInPending ? "Memproses..." : "Check-in Manual"}
                  </button>
                  <button
                    className="order-2 rounded-lg border border-[#b99a5a] px-4 py-3 text-sm font-semibold text-[#6d531e] hover:bg-[#fbf5e8] disabled:cursor-not-allowed disabled:opacity-50 sm:order-1"
                    disabled={checkInPending}
                    onClick={() => setSelectedParticipant(null)}
                    type="button"
                  >
                    Batal
                  </button>
                </form>
              </section>
            ) : null}
          </>
        )}
      </section>
    </main>
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
        </div>
        <div className="flex flex-wrap gap-2">
          {participant.alreadyCheckedIn ? (
            <span className="inline-flex rounded-full border border-[#b8cce2] bg-[#f3f8fd] px-2.5 py-1 text-xs font-semibold text-[#344d68]">
              Sudah Hadir
            </span>
          ) : null}
          {isCancelled ? (
            <span className="inline-flex rounded-full border border-[#dedbd3] bg-[#f2f0eb] px-2.5 py-1 text-xs font-semibold text-[#6b6a66]">
              Pendaftaran Dibatalkan
            </span>
          ) : null}
        </div>
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
        {participant.alreadyCheckedIn && participant.checkedInAt ? (
          <div>
            <dt className="text-xs uppercase tracking-wide text-[#897657]">
              Waktu Check-in
            </dt>
            <dd className="mt-1 font-medium text-[#344d68]">
              {formatDateTime(participant.checkedInAt)}
            </dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-5 border-t border-[#eee6d8] pt-4">
        <button
          className="w-full rounded-lg bg-[#142842] px-4 py-3 text-sm font-semibold text-white hover:bg-[#203d5d] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          disabled={isCancelled}
          onClick={() => onSelect(participant)}
          type="button"
        >
          {isCancelled ? "Check-in Tidak Tersedia" : "Pilih Peserta"}
        </button>
      </div>
    </article>
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

  return (
    <section
      className={`mt-5 rounded-2xl border p-5 shadow-sm sm:p-6 ${
        isWarning
          ? "border-[#e5cb8c] bg-[#fff9eb]"
          : isAlreadyCheckedIn
            ? "border-[#b8cce2] bg-[#f3f8fd]"
            : isCancelled
              ? "border-[#dedbd3] bg-[#f2f0eb]"
              : "border-[#b9dec8] bg-[#f3fbf5]"
      }`}
      role="status"
    >
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#267044]">
        {isWarning
          ? "✓ Check-in Berhasil dengan Catatan"
          : isAlreadyCheckedIn
            ? "Sudah Check-in"
            : isCancelled
              ? "Pendaftaran Dibatalkan"
              : "✓ Check-in Berhasil"}
      </p>

      {participant ? (
        <>
          <h2 className="mt-3 text-2xl font-bold text-[#142842]">
            {participant.fullName}
          </h2>
          <dl className="mt-5 grid gap-3 text-sm text-[#344d68] sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-[#897657]">
                Registration ID
              </dt>
              <dd className="mt-1 font-semibold text-[#142842]">
                {participant.registrationId}
              </dd>
            </div>
            {session ? (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-[#897657]">
                  Sesi
                </dt>
                <dd className="mt-1 font-semibold text-[#142842]">{session.name}</dd>
              </div>
            ) : null}
            {state.checkedAt ? (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-[#897657]">
                  Waktu Check-in
                </dt>
                <dd className="mt-1 font-semibold text-[#142842]">
                  {formatDateTime(state.checkedAt)}
                </dd>
              </div>
            ) : null}
          </dl>
        </>
      ) : null}

      {isWarning ? (
        <p className="mt-5 rounded-lg bg-white/70 p-3 text-sm font-medium text-[#6d531e]">
          Peserta belum tercatat pada sesi kedatangan.
        </p>
      ) : null}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button
          className="rounded-lg bg-[#142842] px-4 py-3 text-sm font-semibold text-white hover:bg-[#203d5d]"
          onClick={onNextParticipant}
          type="button"
        >
          Check-in Peserta Berikutnya
        </button>
        <Link
          className="rounded-lg border border-[#b99a5a] px-4 py-3 text-center text-sm font-semibold text-[#6d531e] hover:bg-[#fbf5e8]"
          href={`/admin/scanner/${stationId}`}
        >
          Kembali ke Scanner
        </Link>
      </div>
    </section>
  );
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
