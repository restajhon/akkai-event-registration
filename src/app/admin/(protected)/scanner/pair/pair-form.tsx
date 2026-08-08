"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { initialStationActionState } from "@/lib/stations/station-action-state";

import { pairStation } from "./actions";

export type PairingStation = {
  id: string;
  stationName: string;
  sessionName: string;
  sessionCode: string;
  pairingExpiresAt: string;
};

type PairFormProps = {
  isAdmin: boolean;
  stations: PairingStation[];
};

function formatDateTime(dateValue: string) {
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

export function PairForm({ isAdmin, stations }: PairFormProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    pairStation,
    initialStationActionState,
  );
  const [stationId, setStationId] = useState("");
  const pairingCodeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.status === "success") {
      if (pairingCodeInputRef.current) {
        pairingCodeInputRef.current.value = "";
      }

      router.refresh();
    }
  }, [router, state.status]);

  const selectedStation = stations.find((station) => station.id === stationId);

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-8 sm:px-8 sm:py-10">
      <section className="mx-auto max-w-2xl rounded-xl bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-500">AKKAI 2026</p>
            <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
              Pairing Scanner
            </h1>
            <p className="mt-2 text-sm text-zinc-600">
              Hubungkan station ke profile operator yang sedang login.
            </p>
          </div>
          <div className="flex flex-wrap gap-4 text-sm font-medium">
            <Link
              className="text-zinc-700 underline underline-offset-4 hover:text-zinc-950"
              href="/admin/dashboard"
            >
              Kembali ke Dashboard
            </Link>
            {isAdmin ? (
              <Link
                className="text-zinc-700 underline underline-offset-4 hover:text-zinc-950"
                href="/admin/display/setup"
              >
                Kelola Station
              </Link>
            ) : null}
          </div>
        </div>

        {state.message ? (
          <p
            className={`mt-6 rounded-lg p-4 text-sm ${
              state.status === "success"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-red-50 text-red-700"
            }`}
            role={state.status === "error" ? "alert" : "status"}
          >
            {state.message}
          </p>
        ) : null}

        {stations.length === 0 ? (
          <p className="mt-8 rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-600">
            Belum ada station yang menunggu pairing pada session OPEN.
          </p>
        ) : (
          <form action={formAction} className="mt-8 grid gap-5">
            <label className="grid gap-2 text-sm font-medium text-zinc-800">
              Station
              <select
                className="rounded-md border border-zinc-300 px-3 py-2.5 font-normal outline-none focus:border-zinc-700 focus:ring-2 focus:ring-zinc-200 disabled:bg-zinc-100"
                disabled={pending}
                name="stationId"
                onChange={(event) => setStationId(event.target.value)}
                required
                value={stationId}
              >
                <option disabled value="">
                  Pilih station
                </option>
                {stations.map((station) => (
                  <option key={station.id} value={station.id}>
                    {station.stationName} - {station.sessionCode}
                  </option>
                ))}
              </select>
            </label>

            {selectedStation ? (
              <div className="rounded-lg bg-zinc-50 p-4 text-sm text-zinc-700">
                <p className="font-medium text-zinc-900">
                  {selectedStation.stationName}
                </p>
                <p className="mt-1">
                  {selectedStation.sessionCode} - {selectedStation.sessionName}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Kode berlaku sampai {formatDateTime(selectedStation.pairingExpiresAt)}.
                </p>
              </div>
            ) : null}

            <label className="grid gap-2 text-sm font-medium text-zinc-800">
              Kode pairing
              <input
                autoComplete="one-time-code"
                className="rounded-md border border-zinc-300 px-3 py-2.5 font-mono tracking-[0.25em] outline-none focus:border-zinc-700 focus:ring-2 focus:ring-zinc-200 disabled:bg-zinc-100"
                disabled={pending}
                inputMode="numeric"
                maxLength={6}
                minLength={6}
                name="pairingCode"
                onChange={(event) => {
                  event.currentTarget.value = event.currentTarget.value
                    .replace(/\D/g, "")
                    .slice(0, 6);
                }}
                pattern="[0-9]{6}"
                ref={pairingCodeInputRef}
                required
              />
            </label>

            <button
              className="w-full rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-fit"
              disabled={pending || !stationId}
              type="submit"
            >
              {pending ? "Memasangkan..." : "Hubungkan Scanner"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
