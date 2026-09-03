"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  participantCheckInEventSchema,
  type ParticipantCheckInEvent,
} from "@/lib/realtime/participant-check-in-event";
import { createClient } from "@/lib/supabase/client";
import { getStationDisplayRealtimeTopic } from "@/lib/realtime/topics";

export type LiveDisplayEvent = ParticipantCheckInEvent;

export type LiveDisplaySession = {
  code: string;
  name: string;
  eventDate: string;
  status: "OPEN" | "CLOSED";
};

type LiveDisplayClientProps = {
  stationId: string;
  stationName: string;
  session: LiveDisplaySession;
  initialDisplayEvent: LiveDisplayEvent | null;
};

type ConnectionStatus =
  | "connecting"
  | "preparing"
  | "live"
  | "reconnecting"
  | "error";

function formatEventTime(dateValue: string) {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "Waktu tidak tersedia";
  }

  return `${new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(date)} WIB`;
}

function connectionLabel(status: ConnectionStatus) {
  switch (status) {
    case "live":
      return "Terhubung";
    case "connecting":
      return "Menghubungkan...";
    case "preparing":
      return "Menghubungkan...";
    case "reconnecting":
      return "Menghubungkan...";
    case "error":
      return "Koneksi bermasalah";
  }
}

function connectionClassName(status: ConnectionStatus) {
  switch (status) {
    case "live":
      return "border-white/20 text-[#f7f3ea]";
    case "connecting":
    case "preparing":
    case "reconnecting":
      return "border-[#d9ad45]/60 text-[#ead9ac]";
    case "error":
      return "border-[#e7a298]/70 text-[#f7d8d2]";
  }
}

function eventTheme(status: LiveDisplayEvent["status"]) {
  switch (status) {
    case "success":
      return {
        accent: "border-[#d9ad45] bg-[#d9ad45] text-[#142842]",
        eyebrow: "text-[#ead9ac]",
        confirmation: "text-[#fffdf8]",
      };
    case "success-with-warning":
      return {
        accent: "border-[#d9ad45] bg-[#d9ad45] text-[#142842]",
        eyebrow: "text-[#ead9ac]",
        confirmation: "text-[#fffdf8]",
      };
    case "already-checked-in":
      return {
        accent: "border-[#8ca8c0] bg-[#8ca8c0] text-[#142842]",
        eyebrow: "text-[#c8d8e5]",
        confirmation: "text-[#e5eef5]",
      };
  }
}

function eventEyebrow(status: LiveDisplayEvent["status"]) {
  return status === "already-checked-in" ? "SUDAH CHECK-IN" : "SELAMAT DATANG";
}

function eventStatus(status: LiveDisplayEvent["status"]) {
  switch (status) {
    case "success":
      return "Check-in berhasil";
    case "success-with-warning":
      return "Check-in seminar berhasil";
    case "already-checked-in":
      return "Peserta sudah tercatat pada sesi ini.";
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
  const isAlreadyCheckedIn = event.status === "already-checked-in";

  return (
    <section
      aria-live="polite"
      className="relative flex w-full max-w-[1400px] flex-col items-center text-center"
    >
      <div
        aria-hidden="true"
        className={`flex h-16 w-16 items-center justify-center rounded-full border-2 text-3xl font-bold shadow-[0_0_0_10px_rgba(217,173,69,0.08)] sm:h-20 sm:w-20 sm:text-4xl ${theme.accent}`}
      >
        {isAlreadyCheckedIn ? "i" : "✓"}
      </div>
      <p className={`mt-7 text-[clamp(1.4rem,2.4vw,3rem)] font-bold uppercase tracking-[0.16em] ${theme.eyebrow}`}>
        {eventEyebrow(event.status)}
      </p>
      <h2 className="mt-5 max-w-[min(90vw,1250px)] break-words text-[clamp(3rem,7vw,8rem)] font-semibold leading-[0.98] tracking-[-0.04em] text-[#fffdf8]">
        {event.participant.fullName}
      </h2>
      <div className="mt-7 flex max-w-[min(90vw,1100px)] flex-wrap justify-center gap-x-5 gap-y-2 text-[clamp(1.2rem,2vw,2rem)] leading-tight text-[#ead9ac]">
        {event.participant.institution ? (
          <>
            <span className="break-words">{event.participant.institution}</span>
            <span aria-hidden="true" className="text-[#d9ad45]">·</span>
          </>
        ) : null}
         <span className="break-words">{event.participant.participantCategory ?? "-"}</span>
      </div>

      <div className="mt-12 w-full max-w-[min(90vw,1100px)] border-t border-white/15 pt-6 sm:mt-16 sm:pt-8">
        <p className={`text-[clamp(1rem,1.5vw,1.6rem)] font-semibold ${theme.confirmation}`}>
          {eventStatus(event.status)}
        </p>
        {event.status === "success-with-warning" ? (
          <p className="mx-auto mt-3 max-w-3xl text-[clamp(0.95rem,1.2vw,1.3rem)] font-medium leading-relaxed text-[#ead9ac]">
            Peserta belum tercatat pada sesi kedatangan (ARRIVAL).
          </p>
        ) : null}
        <p className="mt-4 text-[clamp(0.8rem,1vw,1.1rem)] font-medium text-white/55">
          {event.participant.registrationId} · {formatEventTime(event.eventAt)}
        </p>
      </div>
    </section>
  );
}

function WaitingState({ sessionStatus, sessionName }: { sessionStatus: LiveDisplaySession["status"]; sessionName: string }) {
  const isOpen = sessionStatus === "OPEN";

  return (
    <section className="flex w-full max-w-[1100px] flex-col items-center text-center">
      <div aria-hidden="true" className="h-px w-24 bg-[#d9ad45]" />
      <p className="mt-8 text-[clamp(1.4rem,2.4vw,3rem)] font-bold uppercase tracking-[0.16em] text-[#ead9ac]">
        {isOpen ? "SIAP MENERIMA PESERTA" : "SESI TIDAK AKTIF"}
      </p>
      <h2 className="mt-6 max-w-4xl text-[clamp(1.1rem,1.5vw,1.75rem)] font-medium text-white/75">
        {isOpen ? "Silakan tunjukkan QR registrasi kepada panitia." : `Tampilan ${sessionName} tersedia untuk ditinjau.`}
      </h2>
    </section>
  );
}

function isNewerEvent(
  incoming: LiveDisplayEvent,
  current: LiveDisplayEvent | null,
) {
  if (!current) {
    return true;
  }

  try {
    return BigInt(incoming.eventSequence) > BigInt(current.eventSequence);
  } catch {
    return false;
  }
}

function latestEvent(
  left: LiveDisplayEvent | null,
  right: LiveDisplayEvent | null,
) {
  if (!left) {
    return right;
  }

  if (!right) {
    return left;
  }

  return isNewerEvent(left, right) ? left : right;
}

export function LiveDisplayClient({
  stationId,
  stationName,
  session,
  initialDisplayEvent,
}: LiveDisplayClientProps) {
  const router = useRouter();
  const [supabase] = useState(createClient);
  const [realtimeEvent, setRealtimeEvent] =
    useState<LiveDisplayEvent | null>(null);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("connecting");
  const displayEvent = latestEvent(initialDisplayEvent, realtimeEvent);

  useEffect(() => {
    let isMounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function subscribeToDisplay() {
      try {
        await supabase.realtime.setAuth();

        if (!isMounted) {
          return;
        }

        channel = supabase.channel(getStationDisplayRealtimeTopic(stationId), {
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
              eventSequence: message.payload?.eventSequence,
            };
            const parsedEvent = participantCheckInEventSchema.safeParse(candidate);

            if (parsedEvent.success) {
              setRealtimeEvent((current) =>
                isNewerEvent(parsedEvent.data, current)
                  ? parsedEvent.data
                  : current,
              );
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
              router.refresh();
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
  }, [router, stationId, supabase]);

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#142842] text-[#fffdf8]">
      <style>{`
        @keyframes live-display-reveal {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .live-display-motion { animation: none !important; }
        }
      `}</style>
      <div aria-hidden="true" className="pointer-events-none absolute left-0 top-0 h-px w-[22vw] bg-[#d9ad45]" />
      <div aria-hidden="true" className="pointer-events-none absolute bottom-0 right-0 h-[18vw] w-[18vw] rounded-full border border-[#d9ad45]/10" />
      <div aria-hidden="true" className="pointer-events-none absolute bottom-[8vh] right-[8vw] h-16 w-16 rounded-full border border-[#d9ad45]/20" />

      <section className="relative mx-auto flex min-h-screen w-full max-w-[2200px] flex-col px-[clamp(1.5rem,5vw,6rem)] py-[clamp(1.5rem,4vw,4rem)]">
        <header className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <p className="text-[clamp(0.9rem,1vw,1.25rem)] font-bold tracking-[0.24em] text-[#d9ad45]">AKKAI 2026</p>
            <h1 className="mt-3 max-w-3xl break-words text-[clamp(1rem,1.5vw,1.75rem)] font-medium leading-tight text-white/75">
              {session.name}
            </h1>
            <p className="mt-2 text-sm font-semibold text-[#ead9ac]">
              {stationName}
            </p>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-3">
            <ConnectionStatus status={connectionStatus} />
            <Link
              className="rounded-md px-2 py-1 text-xs font-medium text-white/45 underline decoration-white/20 underline-offset-4 outline-none transition hover:text-white/85 focus-visible:ring-2 focus-visible:ring-[#d9ad45]"
              href="/admin/display"
            >
              Kembali
            </Link>
          </div>
        </header>

        <div className="flex flex-1 items-center justify-center py-[clamp(2rem,5vh,5rem)]">
          {displayEvent ? (
            <div
              className="live-display-motion w-full motion-safe:animate-[live-display-reveal_240ms_ease-out]"
              key={`${displayEvent.eventSequence}-${displayEvent.participant.registrationId}-${displayEvent.status}`}
            >
              <EventDetails event={displayEvent} />
            </div>
          ) : (
            <WaitingState sessionName={session.name} sessionStatus={session.status} />
          )}
        </div>

        <footer className="flex items-end justify-between gap-4 text-[clamp(0.7rem,0.8vw,0.95rem)] text-white/35">
          <span>Seminar Profesi Konsultan Aktuaria Indonesia, Sertifikasi CIAC dan Rapat Anggota AKKAI 2026</span>
          <span className="hidden sm:inline">{stationName} · {session.name}</span>
        </footer>
      </section>
    </main>
  );
}
