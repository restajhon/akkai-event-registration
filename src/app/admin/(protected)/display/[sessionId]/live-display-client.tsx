"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { z } from "zod";

import { createClient } from "@/lib/supabase/client";

const liveDisplayEventSchema = z
  .object({
    status: z.enum([
      "success",
      "success-with-warning",
      "already-checked-in",
    ]),
    participant: z
      .object({
        registrationId: z.string().min(1),
        fullName: z.string().min(1),
        institution: z.string().min(1),
        participantCategory: z.string().min(1),
      })
      .strict(),
    session: z
      .object({
        code: z.string().min(1),
        name: z.string().min(1),
      })
      .strict(),
    station: z
      .object({
        name: z.string().min(1),
      })
      .strict(),
    eventAt: z.string().datetime({ offset: true }),
  })
  .strict();

export type LiveDisplayEvent = z.infer<typeof liveDisplayEventSchema>;

export type LiveDisplaySession = {
  code: string;
  name: string;
  eventDate: string;
  status: "OPEN" | "CLOSED";
};

type LiveDisplayClientProps = {
  sessionId: string;
  session: LiveDisplaySession;
  initialDisplayEvent: LiveDisplayEvent | null;
};

type ConnectionStatus =
  | "connecting"
  | "preparing"
  | "live"
  | "reconnecting"
  | "error";

function formatSessionDate(dateValue: string) {
  const [year, month, day] = dateValue.split("-").map(Number);

  if (!year || !month || !day) {
    return "Tanggal tidak tersedia";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function formatEventTime(dateValue: string) {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "Waktu tidak tersedia";
  }

  return `${new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(date)} WIB`;
}

function connectionLabel(status: ConnectionStatus) {
  switch (status) {
    case "live":
      return "Live";
    case "connecting":
      return "Menghubungkan...";
    case "preparing":
      return "Menyiapkan realtime...";
    case "reconnecting":
      return "Menghubungkan ulang...";
    case "error":
      return "Koneksi realtime bermasalah";
  }
}

function connectionClassName(status: ConnectionStatus) {
  switch (status) {
    case "live":
      return "border-[#b9dec8] bg-[#f3fbf5] text-[#267044]";
    case "connecting":
    case "preparing":
    case "reconnecting":
      return "border-[#e5cb8c] bg-[#fff9eb] text-[#80631e]";
    case "error":
      return "border-[#ead3cc] bg-[#fff5f2] text-[#9b3d31]";
  }
}

function eventTheme(status: LiveDisplayEvent["status"]) {
  switch (status) {
    case "success":
      return {
        panel: "border-[#b9dec8] bg-[#f7fcf8]",
        accent: "bg-[#267044]",
        eyebrow: "text-[#267044]",
        status: "text-[#267044]",
      };
    case "success-with-warning":
      return {
        panel: "border-[#e5cb8c] bg-[#fffdf5]",
        accent: "bg-[#b78524]",
        eyebrow: "text-[#80631e]",
        status: "text-[#80631e]",
      };
    case "already-checked-in":
      return {
        panel: "border-[#e5cb8c] bg-[#fff9eb]",
        accent: "bg-[#b78524]",
        eyebrow: "text-[#80631e]",
        status: "text-[#80631e]",
      };
  }
}

function eventEyebrow(status: LiveDisplayEvent["status"]) {
  return status === "already-checked-in" ? "SUDAH CHECK-IN" : "SELAMAT DATANG";
}

function eventStatus(status: LiveDisplayEvent["status"]) {
  switch (status) {
    case "success":
    case "success-with-warning":
      return "Check-in berhasil";
    case "already-checked-in":
      return "Peserta telah tercatat pada sesi ini";
  }
}

function ConnectionStatus({ status }: { status: ConnectionStatus }) {
  return (
    <span
      aria-live="polite"
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${connectionClassName(
        status,
      )}`}
    >
      <span aria-hidden="true" className="h-2 w-2 rounded-full bg-current" />
      {connectionLabel(status)}
    </span>
  );
}

function EventDetails({ event }: { event: LiveDisplayEvent }) {
  const theme = eventTheme(event.status);

  return (
    <section className={`relative overflow-hidden rounded-3xl border p-6 shadow-sm sm:p-10 lg:p-14 ${theme.panel}`}>
      <div className={`absolute inset-y-0 left-0 w-2 ${theme.accent}`} />
      <div className="relative">
        <p className={`text-sm font-bold tracking-[0.22em] sm:text-base ${theme.eyebrow}`}>
          {eventEyebrow(event.status)}
        </p>
        <h2 className="mt-5 max-w-5xl text-4xl font-semibold leading-[1.05] tracking-tight text-[#142842] sm:text-6xl lg:text-8xl">
          {event.participant.fullName}
        </h2>

        <dl className="mt-8 grid gap-5 text-sm text-[#5b6c7c] sm:grid-cols-3 sm:text-base">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-[#897657]">
              Registration ID
            </dt>
            <dd className="mt-2 text-lg font-semibold text-[#344d68] sm:text-xl">
              {event.participant.registrationId}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-[#897657]">
              Institusi
            </dt>
            <dd className="mt-2 text-lg font-semibold text-[#344d68] sm:text-xl">
              {event.participant.institution}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-[#897657]">
              Kategori
            </dt>
            <dd className="mt-2 text-lg font-semibold text-[#344d68] sm:text-xl">
              {event.participant.participantCategory}
            </dd>
          </div>
        </dl>

        <div className="mt-10 flex flex-col gap-4 border-t border-[#dfd4c1] pt-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className={`text-lg font-bold sm:text-xl ${theme.status}`}>
              {eventStatus(event.status)}
            </p>
            {event.status === "success-with-warning" ? (
              <p className="mt-2 text-sm font-medium text-[#80631e]">
                Perlu verifikasi panitia
              </p>
            ) : null}
          </div>
          <dl className="grid gap-2 text-sm text-[#5b6c7c] sm:text-right">
            <div>
              <dt className="inline text-[#897657]">Station: </dt>
              <dd className="inline font-semibold text-[#344d68]">{event.station.name}</dd>
            </div>
            <div>
              <dt className="inline text-[#897657]">Waktu: </dt>
              <dd className="inline font-semibold text-[#344d68]">{formatEventTime(event.eventAt)}</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}

function WaitingState() {
  return (
    <section className="flex min-h-[28rem] flex-col items-center justify-center rounded-3xl border border-dashed border-[#cfc5b4] bg-[#fffdf8] px-6 py-16 text-center shadow-sm sm:min-h-[36rem]">
      <p className="text-sm font-bold tracking-[0.24em] text-[#9a7526] sm:text-base">
        AKKAI 2026
      </p>
      <h2 className="mt-6 text-4xl font-semibold tracking-tight text-[#142842] sm:text-6xl lg:text-7xl">
        SIAP MENERIMA PESERTA
      </h2>
      <p className="mt-5 text-base text-[#5b6c7c] sm:text-lg">
        Menunggu check-in berikutnya...
      </p>
    </section>
  );
}

export function LiveDisplayClient({
  sessionId,
  session,
  initialDisplayEvent,
}: LiveDisplayClientProps) {
  const [supabase] = useState(createClient);
  const [displayEvent, setDisplayEvent] = useState<LiveDisplayEvent | null>(
    initialDisplayEvent,
  );
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("connecting");

  useEffect(() => {
    let isMounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function subscribeToDisplay() {
      try {
        await supabase.realtime.setAuth();

        if (!isMounted) {
          return;
        }

        channel = supabase.channel(`akkai:display:${sessionId}`, {
          config: {
            private: true,
            broadcast: {
              replication_ready: true,
            },
          },
        });
        console.info("Live Display realtime channel created");

        channel
          .on("broadcast", { event: "participant-check-in" }, (message) => {
            if (!isMounted) {
              return;
            }

            console.info("Live Display broadcast received");

            const candidate = {
              status: message.payload?.status,
              participant: message.payload?.participant,
              session: message.payload?.session,
              station: message.payload?.station,
              eventAt: message.payload?.eventAt,
            };
            const parsedEvent = liveDisplayEventSchema.safeParse(candidate);

            if (parsedEvent.success) {
              setDisplayEvent(parsedEvent.data);
            }
          })
          .on("system", {}, (message) => {
            if (!isMounted) {
              return;
            }

            if (message.extension === "system" && message.status === "ok") {
              setConnectionStatus("live");
            } else if (message.extension === "system" && message.status === "error") {
              setConnectionStatus("error");
            }
          })
          .subscribe((status) => {
            if (!isMounted) {
              return;
            }

            if (status === "SUBSCRIBED") {
              console.info("Live Display realtime subscribed");
              setConnectionStatus("preparing");
            } else if (status === "CHANNEL_ERROR") {
              setConnectionStatus("error");
            } else {
              setConnectionStatus("reconnecting");
            }
          });
      } catch {
        if (isMounted) {
          setConnectionStatus("error");
        }
      }
    }

    void subscribeToDisplay();

    return () => {
      isMounted = false;

      if (channel) {
        console.info("Live Display realtime channel removed");
        void supabase.removeChannel(channel);
      }
    };
  }, [sessionId, supabase]);

  return (
    <main className="min-h-screen overflow-hidden bg-[#f7f3ea] px-4 py-4 sm:px-8 sm:py-6">
      <section className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-[1500px] flex-col">
        <header className="flex flex-col gap-5 border-b border-[#ded2bd] pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-bold tracking-[0.22em] text-[#9a7526]">AKKAI 2026</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight text-[#142842] sm:text-3xl">
                {session.code} — {session.name}
              </h1>
              {session.status === "CLOSED" ? (
                <span className="rounded-full border border-[#dedbd3] bg-[#f2f0eb] px-2.5 py-1 text-xs font-semibold text-[#6b6a66]">
                  Sesi Tidak Aktif
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-sm text-[#5b6c7c]">
              {formatSessionDate(session.eventDate)}
            </p>
          </div>

          <div className="flex flex-col items-start gap-3 sm:items-end">
            <ConnectionStatus status={connectionStatus} />
            <nav className="flex flex-wrap gap-4 text-sm font-semibold text-[#344d68]">
              <Link className="underline underline-offset-4 hover:text-[#142842]" href="/admin/display">
                Kembali
              </Link>
              <Link className="underline underline-offset-4 hover:text-[#142842]" href="/admin/dashboard">
                Dashboard
              </Link>
            </nav>
          </div>
        </header>

        <div className="flex flex-1 flex-col justify-center py-8 sm:py-12">
          {displayEvent ? <EventDetails event={displayEvent} /> : <WaitingState />}
        </div>
      </section>
    </main>
  );
}
