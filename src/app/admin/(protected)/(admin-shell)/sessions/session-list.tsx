"use client";

import { useActionState, useState } from "react";

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

type SessionActionRequest = {
  sessionId: string;
  sessionName: string;
  targetStatus: Session["status"];
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

function statusLabel(status: Session["status"]) {
  return status === "OPEN" ? "Aktif" : "Ditutup";
}

function operationalCopy(status: Session["status"]) {
  return status === "OPEN"
    ? "Scanner dapat digunakan selama sesi aktif."
    : "Scanner tidak dapat menerima check-in saat sesi ditutup.";
}

function actionLabel(
  targetStatus: Session["status"],
  pending = false,
) {
  if (targetStatus === "OPEN") {
    return pending ? "Membuka sesi..." : "Buka Sesi";
  }

  return pending ? "Menutup sesi..." : "Tutup Sesi";
}

function confirmationTitle(action: SessionActionRequest) {
  return action.targetStatus === "OPEN"
    ? `Buka sesi ${action.sessionName}?`
    : `Yakin ingin menutup sesi ${action.sessionName}?`;
}

function confirmationDescription(targetStatus: Session["status"]) {
  return targetStatus === "OPEN"
    ? "Scanner dapat menerima check-in untuk sesi ini setelah dibuka."
    : "Check-in peserta tidak dapat dilakukan selama sesi ditutup.";
}

export function SessionList({ sessions, role }: SessionListProps) {
  const [state, formAction, pending] = useActionState(
    updateSessionStatus,
    initialState,
  );
  const [confirmation, setConfirmation] =
    useState<SessionActionRequest | null>(null);
  const [submittedAction, setSubmittedAction] =
    useState<SessionActionRequest | null>(null);

  return (
    <main className="min-h-screen bg-[#f7f3ea] px-4 py-6 sm:px-8 sm:py-8">
      <section className="mx-auto max-w-4xl">
        <header className="border-b border-[#dfd3bf] pb-5">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#9a7526]">
            Operasional
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#142842] sm:text-3xl">
            Pengelolaan Sesi
          </h1>
          <p className="mt-1 text-sm text-[#5b6c7c]">
            Atur sesi check-in untuk rangkaian acara AKKAI 2026.
          </p>
        </header>

        {state.message ? (
          <p
            className={`mt-5 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
              state.status === "success"
                ? "bg-[#edf7ef] text-[#267044]"
                : "bg-[#fff5f2] text-[#9b3d31]"
            }`}
            role={state.status === "error" ? "alert" : "status"}
          >
            {state.status === "success" ? (
              <span aria-hidden="true">✓</span>
            ) : null}
            {state.message}
          </p>
        ) : null}

        {sessions.length === 0 ? (
          <p className="mt-6 rounded-xl border border-dashed border-[#d8cbb6] bg-[#fffdf8] p-6 text-center text-sm text-[#5b6c7c]">
            Belum ada sesi tersedia.
          </p>
        ) : (
          <div className="mt-6 divide-y divide-[#eee6d8] overflow-hidden rounded-xl border border-[#e4d8c4] bg-[#fffdf8]">
            {sessions.map((session) => {
              const isOpen = session.status === "OPEN";
              const sessionAction: SessionActionRequest = {
                sessionId: session.id,
                sessionName: session.name,
                targetStatus: isOpen ? "CLOSED" : "OPEN",
              };
              const confirmationForSession =
                confirmation?.sessionId === session.id ? confirmation : null;
              const isPendingForSession =
                pending && submittedAction?.sessionId === session.id;

              return (
                <article
                  className="px-4 py-5 sm:px-6 sm:py-6"
                  key={session.id}
                >
                  <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(230px,auto)] lg:items-center lg:gap-8">
                    <div className="min-w-0">
                      <h2 className="break-words text-xl font-semibold tracking-tight text-[#142842]">
                        {session.name}
                      </h2>
                      <p className="mt-1 text-sm font-medium text-[#897657]">
                        {formatSessionDate(session.event_date)}
                      </p>
                      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                        <span
                          className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${
                            isOpen
                              ? "border-[#b9dec8] bg-[#f3fbf5] text-[#267044]"
                              : "border-[#dedbd3] bg-[#f2f0eb] text-[#6b6a66]"
                          }`}
                        >
                          {isOpen ? (
                            <span aria-hidden="true">●</span>
                          ) : null}
                          {statusLabel(session.status)}
                        </span>
                        <p className="text-sm text-[#5b6c7c]">
                          {operationalCopy(session.status)}
                        </p>
                      </div>
                    </div>

                    <div className="lg:min-w-[230px]">
                      {role === "ADMIN" ? (
                        confirmationForSession ? (
                          <div
                            aria-describedby={`session-confirmation-description-${session.id}`}
                            aria-labelledby={`session-confirmation-title-${session.id}`}
                            className="rounded-lg border border-[#e5cb8c] bg-[#fff9eb] p-3.5"
                            role="alertdialog"
                          >
                            <p
                              className="text-sm font-semibold text-[#142842]"
                              id={`session-confirmation-title-${session.id}`}
                            >
                              {confirmationTitle(confirmationForSession)}
                            </p>
                            <p
                              className="mt-1 text-xs leading-5 text-[#80631e]"
                              id={`session-confirmation-description-${session.id}`}
                            >
                              {confirmationDescription(
                                confirmationForSession.targetStatus,
                              )}
                            </p>
                            <div className="mt-3 flex flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row">
                              <button
                                autoFocus
                                className="min-h-11 rounded-md border border-[#d8cbb6] px-3 py-2 text-sm font-semibold text-[#344d68] outline-none transition hover:bg-[#fffdf8] focus-visible:ring-2 focus-visible:ring-[#9a7526] disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={pending}
                                onClick={() => setConfirmation(null)}
                                type="button"
                              >
                                Batal
                              </button>
                              <form
                                action={formAction}
                                onSubmit={() => {
                                  setSubmittedAction(confirmationForSession);
                                  setConfirmation(null);
                                }}
                              >
                                <input
                                  name="sessionId"
                                  type="hidden"
                                  value={session.id}
                                />
                                <input
                                  name="nextStatus"
                                  type="hidden"
                                  value={confirmationForSession.targetStatus}
                                />
                                <button
                                  className="min-h-11 w-full rounded-md bg-[#142842] px-3 py-2 text-sm font-semibold text-white outline-none transition hover:bg-[#203d5d] focus-visible:ring-2 focus-visible:ring-[#9a7526] disabled:cursor-not-allowed disabled:opacity-50"
                                  disabled={pending}
                                  type="submit"
                                >
                                  {isPendingForSession
                                    ? actionLabel(
                                        confirmationForSession.targetStatus,
                                        true,
                                      )
                                    : confirmationForSession.targetStatus ===
                                        "OPEN"
                                      ? "Ya, Buka Sesi"
                                      : "Ya, Tutup Sesi"}
                                </button>
                              </form>
                            </div>
                          </div>
                        ) : (
                          <button
                            className={`min-h-11 w-full rounded-md px-4 py-2.5 text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-[#9a7526] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto lg:w-full ${
                              isOpen
                                ? "border border-[#b99a5a] bg-transparent text-[#6d531e] hover:bg-[#fbf5e8]"
                                : "bg-[#142842] text-white hover:bg-[#203d5d]"
                            }`}
                            disabled={pending}
                            onClick={() => setConfirmation(sessionAction)}
                            type="button"
                          >
                            {actionLabel(
                              sessionAction.targetStatus,
                              isPendingForSession,
                            )}
                          </button>
                        )
                      ) : (
                        <p className="text-sm text-[#6b6a66] lg:text-right">
                          Hanya dapat melihat status sesi.
                        </p>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
