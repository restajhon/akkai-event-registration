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
      return "Menunggu pairing";
    case "PAIRED":
      return "Terpasang";
    case "ACTIVE":
      return "Aktif";
    case "DISCONNECTED":
      return "Terputus";
    case "CLOSED":
      return "Ditutup";
  }
}

function statusClassName(status: SetupStation["status"]) {
  switch (status) {
    case "PAIRED":
    case "ACTIVE":
      return "bg-emerald-100 text-emerald-800";
    case "WAITING_PAIRING":
      return "bg-amber-100 text-amber-800";
    case "DISCONNECTED":
      return "bg-orange-100 text-orange-800";
    case "CLOSED":
      return "bg-zinc-200 text-zinc-700";
  }
}

function ActionMessage({ state }: { state: StationActionState }) {
  if (!state.message) {
    return null;
  }

  const isSuccess = state.status === "success";

  return (
    <p
      className={`rounded-lg text-sm ${
        isSuccess
          ? "inline-flex items-center gap-2 bg-emerald-50 px-3 py-2 text-emerald-700"
          : "bg-red-50 p-4 text-red-700"
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
      <p className="mt-3 text-sm text-amber-900">
        Simpan kode ini sekarang. Kode tidak akan ditampilkan kembali setelah
        halaman dimuat ulang.
      </p>
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
    <main className="min-h-screen bg-zinc-100 px-4 py-8 sm:px-8 sm:py-10">
      <section className="mx-auto max-w-5xl rounded-xl bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-500">AKKAI 2026</p>
            <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
              Pengelolaan Scanner Station
            </h1>
            <p className="mt-2 text-sm text-zinc-600">
              Buat station dan siapkan kode pairing untuk operator.
            </p>
          </div>
          <div className="flex flex-wrap gap-4 text-sm font-medium">
            <Link
              className="text-zinc-700 underline underline-offset-4 hover:text-zinc-950"
              href="/admin/dashboard"
            >
              Kembali ke Dashboard
            </Link>
            <Link
              className="text-zinc-700 underline underline-offset-4 hover:text-zinc-950"
              href="/admin/scanner/pair"
            >
              Pairing Scanner
            </Link>
          </div>
        </div>

        <div className="mt-6 grid gap-3">
          {feedbackState &&
          (feedbackState.status === "error" ||
            feedbackState.action === "create" ||
            feedbackState.action === "close") ? (
            <ActionMessage state={feedbackState} />
          ) : null}
          {latestCredential ? (
            <PairingCredential credential={latestCredential} latest />
          ) : null}
          {olderCredentials.length > 0 ? (
            <details className="rounded-lg border border-zinc-200 bg-white">
              <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-zinc-800">
                Kode pairing lain yang masih berlaku ({olderCredentials.length})
              </summary>
              <div className="grid gap-3 border-t border-zinc-200 p-3">
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

        <section className="mt-8 rounded-lg border border-zinc-200 p-4 sm:p-5">
          <h2 className="text-lg font-semibold text-zinc-900">Buat station</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Station hanya dapat dibuat untuk session yang sedang OPEN.
          </p>
          <form
            action={createAction}
            className="mt-5 grid gap-4 sm:grid-cols-2"
            onSubmit={() => setLastAction("create")}
          >
            <label className="grid gap-2 text-sm font-medium text-zinc-800 sm:col-span-2">
              Nama station
              <input
                className="rounded-md border border-zinc-300 px-3 py-2.5 font-normal outline-none focus:border-zinc-700 focus:ring-2 focus:ring-zinc-200"
                maxLength={100}
                minLength={3}
                name="stationName"
                placeholder="Meja Registrasi 1"
                required
                type="text"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-zinc-800 sm:col-span-2">
              Session
              <select
                className="rounded-md border border-zinc-300 px-3 py-2.5 font-normal outline-none focus:border-zinc-700 focus:ring-2 focus:ring-zinc-200 disabled:bg-zinc-100"
                defaultValue=""
                disabled={sessions.length === 0 || pending}
                name="sessionId"
                required
              >
                <option disabled value="">
                  Pilih session OPEN
                </option>
                {sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.code} - {session.name} ({formatSessionDate(session.event_date)})
                  </option>
                ))}
              </select>
            </label>
            {sessions.length === 0 ? (
              <p className="text-sm text-amber-700 sm:col-span-2">
                Belum ada session OPEN. Buka session terlebih dahulu.
              </p>
            ) : null}
            <button
              className="w-full rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-fit sm:col-span-2"
              disabled={sessions.length === 0 || pending}
              type="submit"
            >
              {createPending ? "Membuat station..." : "Buat Station"}
            </button>
          </form>
        </section>

        <section className="mt-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">Daftar station</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Status dan pairing station yang tersimpan di database.
              </p>
            </div>
          </div>

          {stations.length === 0 ? (
            <p className="mt-5 rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-600">
              Belum ada station.
            </p>
          ) : (
            <div className="mt-5 grid gap-4">
              {stations.map((station) => (
                <article
                  className="rounded-lg border border-zinc-200 p-4 sm:p-5"
                  key={station.id}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="text-lg font-semibold text-zinc-900">
                        {station.stationName}
                      </h3>
                      <p className="mt-1 text-sm text-zinc-600">
                        {station.sessionCode} - {station.sessionName}
                      </p>
                      <p className="mt-1 text-sm text-zinc-500">
                        {formatSessionDate(station.eventDate)}
                      </p>
                    </div>
                    <span
                      className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${statusClassName(
                        station.status,
                      )}`}
                    >
                      {statusLabel(station.status)}
                    </span>
                  </div>

                  <dl className="mt-5 grid gap-3 text-sm text-zinc-600 sm:grid-cols-2">
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-zinc-400">
                        Operator
                      </dt>
                      <dd className="mt-1 font-medium text-zinc-800">
                        {station.pairedOperatorName ?? "Belum ada operator"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-zinc-400">
                        Masa berlaku pairing
                      </dt>
                      <dd className="mt-1 font-medium text-zinc-800">
                        {station.status === "WAITING_PAIRING"
                          ? formatDateTime(station.pairingExpiresAt)
                          : "Tidak berlaku"}
                      </dd>
                    </div>
                  </dl>

                  {station.status !== "CLOSED" ? (
                    <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                      <form
                        action={resetAction}
                        onSubmit={() => setLastAction("reset")}
                      >
                        <input name="stationId" type="hidden" value={station.id} />
                        <button
                          className="w-full rounded-md border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
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
                          className="w-full rounded-md border border-red-200 px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
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
