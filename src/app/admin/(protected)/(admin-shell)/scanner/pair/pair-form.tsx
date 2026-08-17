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

export type MyScannerStation = {
  id: string;
  stationName: string;
  status: "PAIRED" | "ACTIVE";
  sessionCode: string;
  sessionName: string;
  sessionStatus: "OPEN" | "CLOSED";
};

type PairFormProps = {
  isAdmin: boolean;
  myStations: MyScannerStation[];
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

function stationStatusLabel(status: MyScannerStation["status"]) {
  return status === "ACTIVE" ? "Aktif" : "Terpasang";
}

function sessionStatusLabel(status: MyScannerStation["sessionStatus"]) {
  return status === "OPEN" ? "Aktif" : "Ditutup";
}

function statusClassName(status: MyScannerStation["status"]) {
  return status === "ACTIVE"
    ? "border-[#b9dec8] bg-[#f3fbf5] text-[#267044]"
    : "border-[#b8cce2] bg-[#f3f8fd] text-[#345e88]";
}

export function PairForm({ isAdmin, myStations, stations }: PairFormProps) {
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
    <main className="min-h-screen bg-[#f7f3ea] px-4 py-5 sm:px-8 sm:py-6">
      <section className="mx-auto max-w-[1100px]">
        <header className="border-b border-[#dfd3bf] pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold tracking-[0.16em] text-[#9a7526]">OPERASIONAL</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#142842] sm:text-3xl">
                Pairing Scanner
              </h1>
              <p className="mt-1 text-sm text-[#5b6c7c]">
                Hubungkan scanner dengan station yang akan digunakan operator.
              </p>
            </div>
            {isAdmin ? (
              <Link
                className="inline-flex min-h-11 items-center text-sm font-semibold text-[#344d68] underline underline-offset-4 outline-none hover:text-[#142842] focus-visible:ring-2 focus-visible:ring-[#9a7526]"
                href="/admin/display/setup"
              >
                Kelola Station
              </Link>
            ) : null}
          </div>
        </header>

        <section
          aria-labelledby="my-scanner-heading"
          className="mt-5 rounded-xl border border-[#e4d8c4] bg-[#fffdf8] p-4 sm:p-5"
        >
          <h2 className="text-xl font-semibold text-[#142842]" id="my-scanner-heading">
            Scanner Saya
          </h2>
          <p className="mt-1 text-sm text-[#5b6c7c]">
            Station yang sedang terpasang pada operator ini.
          </p>

          {myStations.length === 0 ? (
            <p className="mt-4 rounded-lg border border-dashed border-[#d8cbb6] bg-[#fbf7ef] p-5 text-center text-sm text-[#5b6c7c]">
              Belum ada station yang terpasang pada akun ini.
            </p>
          ) : (
            <div className="mt-4 grid gap-3">
              {myStations.map((station) => (
                <article
                  className="rounded-lg border border-[#e4d8c4] bg-[#fbf7ef] p-4 sm:flex sm:items-center sm:justify-between sm:gap-5"
                  key={station.id}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="break-words text-lg font-semibold text-[#142842]">
                        {station.stationName}
                      </h3>
                      <span
                        className={`inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClassName(
                          station.status,
                        )}`}
                      >
                        <span aria-hidden="true">●</span>
                        {stationStatusLabel(station.status)}
                      </span>
                    </div>
                    <p className="mt-1 break-words text-sm font-medium text-[#344d68]">
                      {station.sessionName}
                    </p>
                    <p className="mt-1 text-xs text-[#897657]">
                      {station.sessionCode} · Sesi {sessionStatusLabel(station.sessionStatus)}
                    </p>
                  </div>
                  <Link
                    className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg bg-[#142842] px-4 py-2.5 text-sm font-semibold text-white outline-none transition hover:bg-[#203d5d] focus-visible:ring-2 focus-visible:ring-[#9a7526] sm:mt-0 sm:shrink-0"
                    href={`/admin/scanner/${station.id}`}
                  >
                    Buka Scanner
                  </Link>
                </article>
              ))}
            </div>
          )}
        </section>

        {state.message ? (
          <p
            className={`mt-4 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
              state.status === "success"
                ? "bg-[#edf7ef] text-[#267044]"
                : "bg-[#fff5f2] text-[#9b3d31]"
            }`}
            role={state.status === "error" ? "alert" : "status"}
          >
            {state.status === "success" ? <span aria-hidden="true">✓</span> : null}
            {state.message}
          </p>
        ) : null}

        <section
          aria-labelledby="pairing-station-heading"
          className="mt-5 rounded-xl border border-[#e4d8c4] bg-[#fffdf8] p-4 sm:p-5"
        >
          <h2 className="text-xl font-semibold text-[#142842]" id="pairing-station-heading">
            Station yang Menunggu Pairing
          </h2>
          <p className="mt-1 text-sm text-[#5b6c7c]">
            Pilih station dan masukkan kode pairing enam digit dari admin.
          </p>

          {stations.length === 0 ? (
            <div className="mt-4 rounded-lg border border-dashed border-[#d8cbb6] bg-[#fbf7ef] p-5">
              <p className="font-semibold text-[#142842]">Belum ada station yang menunggu pairing.</p>
              <p className="mt-1 text-sm text-[#5b6c7c]">
                Buat atau reset kode pairing dari menu Scanner Station, lalu kembali ke halaman ini untuk menghubungkan scanner.
              </p>
            </div>
          ) : (
            <form action={formAction} className="mt-5 grid gap-5">
              <label className="grid gap-2 text-sm font-semibold text-[#344d68]" htmlFor="pairing-station">
                Station
                <select
                  className="min-h-11 rounded-lg border border-[#cfc5b4] bg-[#fffdf8] px-3 text-sm font-normal text-[#142842] outline-none transition focus:border-[#9a7526] focus:ring-2 focus:ring-[#ead9ac] disabled:cursor-not-allowed disabled:bg-[#f2f0eb]"
                  disabled={pending}
                  id="pairing-station"
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
                      {station.stationName} · {station.sessionName}
                    </option>
                  ))}
                </select>
              </label>

              {selectedStation ? (
                <div className="rounded-lg border border-[#eee6d8] bg-[#fbf7ef] p-4 text-sm text-[#5b6c7c]">
                  <p className="font-semibold text-[#142842]">{selectedStation.stationName}</p>
                  <p className="mt-1 break-words font-medium text-[#344d68]">
                    {selectedStation.sessionName}
                  </p>
                  <p className="mt-1 text-xs text-[#897657]">
                    {selectedStation.sessionCode} · Kode berlaku sampai {formatDateTime(selectedStation.pairingExpiresAt)}.
                  </p>
                </div>
              ) : null}

              <label className="grid gap-2 text-sm font-semibold text-[#344d68]" htmlFor="pairing-code">
                Kode pairing
                <span className="text-xs font-normal text-[#897657]">Masukkan enam digit kode yang tampil di Scanner Station.</span>
                <input
                  autoComplete="one-time-code"
                  className="min-h-14 rounded-lg border border-[#cfc5b4] bg-[#fffdf8] px-3 text-center font-mono text-2xl font-bold tracking-[0.3em] text-[#142842] caret-[#142842] outline-none transition placeholder:text-[#b8ad9b] focus:border-[#9a7526] focus:ring-2 focus:ring-[#ead9ac] disabled:cursor-not-allowed disabled:bg-[#f2f0eb]"
                  disabled={pending}
                  id="pairing-code"
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
                className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-[#142842] px-4 py-2.5 text-sm font-semibold text-white outline-none transition hover:bg-[#203d5d] focus-visible:ring-2 focus-visible:ring-[#9a7526] disabled:cursor-not-allowed disabled:opacity-50 sm:w-fit"
                disabled={pending || !stationId}
                type="submit"
              >
                {pending ? "Memasangkan..." : "Hubungkan Scanner"}
              </button>
            </form>
          )}
        </section>
      </section>
    </main>
  );
}
