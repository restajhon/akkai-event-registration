"use client";

import Link from "next/link";
import { useActionState } from "react";

import { updateSessionStatus } from "./actions";

export type Session = {
  id: string;
  code: string;
  name: string;
  event_date: string;
  status: "OPEN" | "CLOSED";
};

type SessionListProps = {
  sessions: Session[];
  role: "ADMIN" | "OPERATOR";
};

const initialState = {
  status: "idle" as const,
  message: null,
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

export function SessionList({ sessions, role }: SessionListProps) {
  const [state, formAction, pending] = useActionState(
    updateSessionStatus,
    initialState,
  );

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-10 sm:px-8">
      <section className="mx-auto max-w-3xl rounded-xl bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-500">AKKAI 2026</p>
            <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
              Sesi Acara
            </h1>
            <p className="mt-2 text-sm text-zinc-600">
              Kelola status sesi operasional acara.
            </p>
          </div>
          <Link
            className="text-sm font-medium text-zinc-700 underline underline-offset-4 hover:text-zinc-950"
            href="/admin/dashboard"
          >
            Kembali ke Dashboard
          </Link>
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

        {sessions.length === 0 ? (
          <p className="mt-8 rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-600">
            Belum ada sesi tersedia.
          </p>
        ) : (
          <div className="mt-8 grid gap-4">
            {sessions.map((session) => {
              const isOpen = session.status === "OPEN";

              return (
                <article
                  className="rounded-lg border border-zinc-200 p-4 sm:p-5"
                  key={session.id}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h2 className="text-lg font-semibold text-zinc-900">
                        {session.name}
                      </h2>
                      <dl className="mt-3 grid gap-2 text-sm text-zinc-600 sm:grid-cols-2 sm:gap-x-6">
                        <div>
                          <dt className="text-xs uppercase tracking-wide text-zinc-400">
                            Kode sesi
                          </dt>
                          <dd className="mt-1 font-medium text-zinc-800">
                            {session.code}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs uppercase tracking-wide text-zinc-400">
                            Tanggal sesi
                          </dt>
                          <dd className="mt-1 font-medium text-zinc-800">
                            {formatSessionDate(session.event_date)}
                          </dd>
                        </div>
                      </dl>
                    </div>

                    <span
                      className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${
                        isOpen
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-zinc-100 text-zinc-700"
                      }`}
                    >
                      {session.status}
                    </span>
                  </div>

                  {role === "ADMIN" ? (
                    <form action={formAction} className="mt-5">
                      <input name="sessionId" type="hidden" value={session.id} />
                      <input
                        name="nextStatus"
                        type="hidden"
                        value={isOpen ? "CLOSED" : "OPEN"}
                      />
                      <button
                        className="w-full rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                        disabled={pending}
                        type="submit"
                      >
                        {isOpen ? "Tutup Sesi" : "Buka Sesi"}
                      </button>
                    </form>
                  ) : (
                    <p className="mt-5 text-sm text-zinc-500">
                      Hanya dapat melihat
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
