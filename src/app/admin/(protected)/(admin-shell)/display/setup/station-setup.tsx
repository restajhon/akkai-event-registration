"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import {
  closeStation,
  createStation,
  resetStationPairing,
} from "./actions";
import {
  initialStationActionState,
  type StationAction,
  type StationActionState,
} from "@/lib/stations/station-action-state";

export type SetupSession = {
  id: string;
  code: string;
  name: string;
  event_date: string;
  status: "OPEN" | "CLOSED";
};

export type SetupStation = {
  id: string;
  stationName: string;
  sessionId: string;
  sessionName: string;
  sessionCode: string;
  eventDate: string;
  status: "WAITING_PAIRING" | "PAIRED" | "ACTIVE" | "DISCONNECTED" | "CLOSED";
  pairingExpiresAt: string;
  pairedAt: string | null;
  lastActivityAt: string | null;
  createdAt: string;
  closedAt: string | null;
  pairedOperatorName: string | null;
};

type StationSetupProps = {
  sessions: SetupSession[];
  stations: SetupStation[];
};

function formatSessionDate(dateValue: string) {
  const [year, month, day] = dateValue.split("-").map(Number);

  if (!year || !month || !day) {
    return dateValue;
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function formatDateTime(dateValue: string | null) {
  if (!dateValue) {
    return "-";
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

function statusLabel(status: SetupStation["status"]) {
  switch (status) {
    case "WAITING_PAIRING":
      return "Menunggu Pairing";
    case "PAIRED":
      return "Terpasang";
    case "ACTIVE":
      return "Aktif";
    case "DISCONNECTED":
      return "Tidak Terhubung";
    case "CLOSED":
      return "Ditutup";
  }
}

function statusClassName(status: SetupStation["status"]) {
  switch (status) {
    case "PAIRED":
      return "border-[#b8cce2] bg-[#f3f8fd] text-[#345e88]";
    case "ACTIVE":
      return "border-[#b9dec8] bg-[#f3fbf5] text-[#267044]";
    case "WAITING_PAIRING":
      return "border-[#e5cb8c] bg-[#fff9eb] text-[#80631e]";
    case "DISCONNECTED":
      return "border-[#ead3cc] bg-[#fff5f2] text-[#9b3d31]";
    case "CLOSED":
      return "border-[#dedbd3] bg-[#f2f0eb] text-[#6b6a66]";
  }
}

function ActionMessage({ state }: { state: StationActionState }) {
  if (!state.message) {
    return null;
  }

  const isSuccess = state.status === "success";

  return (
    <p
      className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
        isSuccess
          ? "bg-[#edf7ef] text-[#267044]"
          : "bg-[#fff5f2] text-[#9b3d31]"
      }`}
      role={state.status === "error" ? "alert" : "status"}
    >
      {isSuccess ? <span aria-hidden="true">✓</span> : null}
      {state.message}
    </p>
  );
}

type PairingCredential = {
  stationId: string;
  stationName: string;
  pairingCode: string;
  pairingExpiresAt: string;
};

function isPairingCredentialState(
  state: StationActionState,
): state is StationActionState & PairingCredential {
  return Boolean(
    state.stationId &&
      state.stationName &&
      state.pairingCode &&
      state.pairingExpiresAt,
  );
}

function upsertPairingCredential(
  credentials: PairingCredential[],
  state: StationActionState,
) {
  if (!isPairingCredentialState(state)) {
    return credentials;
  }

  return [
    ...credentials.filter(
      (credential) => credential.stationId !== state.stationId,
    ),
    {
      stationId: state.stationId,
      stationName: state.stationName,
      pairingCode: state.pairingCode,
      pairingExpiresAt: state.pairingExpiresAt,
    },
  ];
}

function PairingCredential({
  credential,
  latest = false,
}: {
  credential: PairingCredential;
  latest?: boolean;
}) {
  return (
    <section
      className={`rounded-lg border border-amber-200 bg-amber-50 p-4 ${
        latest ? "sm:p-5" : "border-dashed bg-amber-50/60"
      }`}
      role="status"
    >
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-800">
        {latest ? "Kode pairing terbaru" : credential.stationName}
      </p>
      <p className="mt-2 font-mono text-3xl font-bold tracking-[0.3em] text-amber-950">
        {credential.pairingCode}
      </p>
      {latest ? (
        <p className="mt-3 text-sm text-amber-900">
          Station: <span className="font-semibold">{credential.stationName}</span>
        </p>
      ) : null}
      {latest ? (
        <p className="mt-3 text-sm text-amber-900">
          Simpan kode ini sekarang. Kode tidak dapat ditampilkan kembali setelah halaman dimuat ulang.
        </p>
      ) : null}
      <p className="mt-2 text-xs text-amber-800">
        Berlaku sampai {formatDateTime(credential.pairingExpiresAt)}.
      </p>
    </section>
  );
}

export function StationSetup({ sessions, stations }: StationSetupProps) {
  const [pairingCredentials, setPairingCredentials] = useState<
    PairingCredential[]
  >([]);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [lastAction, setLastAction] = useState<StationAction | null>(null);

  async function createStationWithPresentation(
    previousState: StationActionState,
    formData: FormData,
  ) {
    const nextState = await createStation(previousState, formData);
    setCurrentTime(Date.now());

    if (isPairingCredentialState(nextState)) {
      setPairingCredentials((credentials) =>
        upsertPairingCredential(credentials, nextState),
      );
    }

    return nextState;
  }

  async function resetStationPairingWithPresentation(
    previousState: StationActionState,
    formData: FormData,
  ) {
    const nextState = await resetStationPairing(previousState, formData);
    setCurrentTime(Date.now());

    if (isPairingCredentialState(nextState)) {
      setPairingCredentials((credentials) =>
        upsertPairingCredential(credentials, nextState),
      );
    }

    return nextState;
  }

  async function closeStationWithPresentation(
    previousState: StationActionState,
    formData: FormData,
  ) {
    const nextState = await closeStation(previousState, formData);
    setCurrentTime(Date.now());

    if (nextState.status === "success" && nextState.stationId) {
      setPairingCredentials((credentials) =>
        credentials.filter(
          (credential) => credential.stationId !== nextState.stationId,
        ),
      );
    }

    return nextState;
  }

  const [createState, createAction, createPending] = useActionState(
    createStationWithPresentation,
    initialStationActionState,
  );
  const [resetState, resetAction, resetPending] = useActionState(
    resetStationPairingWithPresentation,
    initialStationActionState,
  );
  const [closeState, closeAction, closePending] = useActionState(
    closeStationWithPresentation,
    initialStationActionState,
  );
  const pending = createPending || resetPending || closePending;

  const feedbackState =
    lastAction === "create"
      ? createState
      : lastAction === "close"
        ? closeState
        : lastAction === "reset"
          ? resetState
          : null;
  const actionableCredentials = pairingCredentials.filter(
    (credential) =>
      new Date(credential.pairingExpiresAt).getTime() > currentTime,
  );
  const latestCredential = actionableCredentials.length
    ? actionableCredentials[actionableCredentials.length - 1]
    : null;
  const olderCredentials = latestCredential
    ? actionableCredentials.filter(
        (credential) => credential.stationId !== latestCredential.stationId,
      )
    : [];

  return (
    <main className="min-h-screen bg-[#f7f3ea] px-4 py-5 sm:px-8 sm:py-6">
      <section className="mx-auto max-w-[1380px]">
        <header className="border-b border-[#dfd3bf] pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold tracking-[0.16em] text-[#9a7526]">SETUP</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#142842] sm:text-3xl">
                Scanner Station
              </h1>
              <p className="mt-1 text-sm text-[#5b6c7c]">
                Buat station dan siapkan pairing untuk perangkat scanner.
              </p>
            </div>
            <Link
              className="inline-flex min-h-11 items-center text-sm font-semibold text-[#344d68] underline underline-offset-4 outline-none hover:text-[#142842] focus-visible:ring-2 focus-visible:ring-[#9a7526]"
              href="/admin/scanner/pair"
            >
              Pairing Scanner
            </Link>
          </div>
        </header>

        <div className="mt-6 grid gap-3">
          {feedbackState &&
          (feedbackState.status === "error" ||
            feedbackState.action === "close") ? (
            <ActionMessage state={feedbackState} />
          ) : null}
          {latestCredential ? (
            <PairingCredential credential={latestCredential} latest />
          ) : null}
          {olderCredentials.length > 0 ? (
              <details className="rounded-lg border border-[#e5cb8c] bg-[#fff9eb]">
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-[#6d531e] outline-none focus-visible:ring-2 focus-visible:ring-[#9a7526]">
                  Kode pairing lain yang masih berlaku ({olderCredentials.length})
                </summary>
                <div className="grid gap-3 border-t border-[#eadcb9] p-3">
                {olderCredentials.map((credential) => (
                  <PairingCredential
                    credential={credential}
                    key={credential.stationId}
                  />
                ))}
              </div>
            </details>
          ) : null}
        </div>

        <section className="mt-5 rounded-xl border border-[#e4d8c4] bg-[#fffdf8] p-4 sm:p-5">
          <h2 className="text-xl font-semibold text-[#142842]">Buat Station</h2>
          <p className="mt-1 text-sm text-[#5b6c7c]">
            Station hanya dapat dibuat untuk sesi yang sedang aktif.
          </p>
          <form
            action={createAction}
            className="mt-5 grid gap-4 sm:grid-cols-2"
            onSubmit={() => setLastAction("create")}
          >
            <label className="grid gap-2 text-sm font-semibold text-[#344d68] sm:col-span-2" htmlFor="station-name">
              Nama station
              <input
                className="min-h-11 rounded-lg border border-[#cfc5b4] bg-[#fffdf8] px-3 text-sm font-normal text-[#142842] outline-none placeholder:text-[#b8ad9b] focus:border-[#9a7526] focus:ring-2 focus:ring-[#ead9ac] disabled:bg-[#f2f0eb]"
                id="station-name"
                maxLength={100}
                minLength={3}
                name="stationName"
                placeholder="Meja Registrasi 1"
                required
                type="text"
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[#344d68] sm:col-span-2" htmlFor="station-session">
              Sesi
              <select
                className="min-h-11 rounded-lg border border-[#cfc5b4] bg-[#fffdf8] px-3 text-sm font-normal text-[#142842] outline-none focus:border-[#9a7526] focus:ring-2 focus:ring-[#ead9ac] disabled:cursor-not-allowed disabled:bg-[#f2f0eb]"
                defaultValue=""
                disabled={sessions.length === 0 || pending}
                id="station-session"
                name="sessionId"
                required
              >
                <option disabled value="">
                  Pilih sesi aktif
                </option>
                {sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.name} · {formatSessionDate(session.event_date)} ({session.code})
                  </option>
                ))}
              </select>
            </label>
            {sessions.length === 0 ? (
              <p className="text-sm text-[#80631e] sm:col-span-2">
                Belum ada sesi aktif. Buka sesi terlebih dahulu.
              </p>
            ) : null}
            <button
              className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-[#142842] px-4 py-2.5 text-sm font-semibold text-white outline-none transition hover:bg-[#203d5d] focus-visible:ring-2 focus-visible:ring-[#9a7526] disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2 sm:w-fit"
              disabled={sessions.length === 0 || pending}
              type="submit"
            >
              {createPending ? "Membuat station..." : "Buat Station"}
            </button>
          </form>
        </section>

        <section className="mt-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-[#142842]">Daftar Station</h2>
              <p className="mt-1 text-sm text-[#5b6c7c]">
                Pantau status station dan pairing yang tersedia.
              </p>
            </div>
          </div>

          {stations.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-[#d8cbb6] bg-[#fffdf8] p-6 text-center text-sm text-[#5b6c7c]">
              Belum ada station.
            </p>
          ) : (
            <div className="mt-4 divide-y divide-[#eee6d8] overflow-hidden rounded-xl border border-[#e4d8c4] bg-[#fffdf8]">
              {stations.map((station) => (
                <article
                  className="p-4 sm:p-5"
                  key={station.id}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="break-words text-xl font-semibold tracking-tight text-[#142842]">
                        {station.stationName}
                      </h3>
                      <p className="mt-1 break-words text-sm font-medium text-[#344d68]">
                        {station.sessionName}
                      </p>
                      <p className="mt-1 text-sm text-[#897657]">
                        {formatSessionDate(station.eventDate)} · {station.sessionCode}
                      </p>
                    </div>
                    <span
                      className={`inline-flex min-h-8 w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${statusClassName(
                        station.status,
                      )}`}
                    >
                      <span aria-hidden="true">●</span>
                      {statusLabel(station.status)}
                    </span>
                  </div>

                   <dl className="mt-5 grid gap-4 text-sm text-[#5b6c7c] sm:grid-cols-2">
                    <div>
                       <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-[#897657]">
                         Operator
                       </dt>
                       <dd className="mt-1 break-words font-medium text-[#344d68]">
                         {station.pairedOperatorName ?? "Belum ada operator"}
                       </dd>
                     </div>
                     <div>
                       <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-[#897657]">
                         Masa berlaku pairing
                       </dt>
                       <dd className="mt-1 font-medium text-[#344d68]">
                         {station.status === "WAITING_PAIRING"
                           ? formatDateTime(station.pairingExpiresAt)
                           : "Tidak berlaku"}
                      </dd>
                    </div>
                  </dl>

                   {station.status !== "CLOSED" ? (
                     <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                      <form
                        action={resetAction}
                        onSubmit={() => setLastAction("reset")}
                      >
                        <input name="stationId" type="hidden" value={station.id} />
                         <button
                           className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-[#b99a5a] px-4 py-2.5 text-sm font-semibold text-[#6d531e] outline-none transition hover:bg-[#fbf5e8] focus-visible:ring-2 focus-visible:ring-[#9a7526] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                          disabled={pending}
                          type="submit"
                        >
                          {resetPending ? "Membuat kode..." : "Reset Pairing"}
                        </button>
                      </form>
                      <form
                        action={closeAction}
                        onSubmit={() => setLastAction("close")}
                      >
                        <input name="stationId" type="hidden" value={station.id} />
                         <button
                           className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-[#e7b7ad] px-4 py-2.5 text-sm font-semibold text-[#9b3d31] outline-none transition hover:bg-[#fff5f2] focus-visible:ring-2 focus-visible:ring-[#9a7526] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                          disabled={pending}
                          type="submit"
                        >
                          {closePending ? "Menutup station..." : "Tutup Station"}
                        </button>
                      </form>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
