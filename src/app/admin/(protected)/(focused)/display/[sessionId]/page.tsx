import Link from "next/link";
import { z } from "zod";

import { requireRole } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";

import {
  LiveDisplayClient,
  type LiveDisplayEvent,
  type LiveDisplaySession,
} from "./live-display-client";

export const dynamic = "force-dynamic";

const sessionIdSchema = z.string().uuid();

type SessionStatus = "OPEN" | "CLOSED";
type DatabaseScanStatus =
  | "SUCCESS"
  | "SUCCESS_WITH_WARNING"
  | "ALREADY_CHECKED_IN";

type SessionRow = LiveDisplaySession & {
  id: string;
};

type DatabaseSessionRow = {
  id: string;
  code: string;
  name: string;
  event_date: string;
  status: SessionStatus;
};

type ScanEventRow = {
  participant_id: string;
  station_id: string;
  result_status: DatabaseScanStatus;
  scanned_at: string;
};

type ParticipantRow = {
  registration_id: string;
  full_name: string;
  institution: string;
  participant_category: string;
};

type StationRow = {
  station_name: string;
};

type DisplayData = {
  session: SessionRow | null;
  initialDisplayEvent: LiveDisplayEvent | null;
};

const eligibleStatuses: DatabaseScanStatus[] = [
  "SUCCESS",
  "SUCCESS_WITH_WARNING",
  "ALREADY_CHECKED_IN",
];

function mapDisplayStatus(status: DatabaseScanStatus): LiveDisplayEvent["status"] {
  switch (status) {
    case "SUCCESS":
      return "success";
    case "SUCCESS_WITH_WARNING":
      return "success-with-warning";
    case "ALREADY_CHECKED_IN":
      return "already-checked-in";
  }
}

async function loadDisplayData(sessionId: string): Promise<DisplayData | null> {
  try {
    const adminSupabase = createAdminClient();
    const { data: session, error: sessionError } = await adminSupabase
      .from("sessions")
      .select("id, code, name, event_date, status")
      .eq("id", sessionId)
      .maybeSingle();

    if (sessionError) {
      return null;
    }

    if (!session) {
      return { session: null, initialDisplayEvent: null };
    }

    const databaseSession = session as DatabaseSessionRow;
    const sessionRow: SessionRow = {
      id: databaseSession.id,
      code: databaseSession.code,
      name: databaseSession.name,
      eventDate: databaseSession.event_date,
      status: databaseSession.status,
    };
    const { data: scanEvent, error: scanEventError } = await adminSupabase
      .from("scan_events")
      .select("participant_id, station_id, result_status, scanned_at")
      .eq("session_id", sessionId)
      .in("result_status", eligibleStatuses)
      .not("participant_id", "is", null)
      .order("scanned_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (scanEventError) {
      return null;
    }

    if (!scanEvent) {
      return { session: sessionRow, initialDisplayEvent: null };
    }

    const scanEventRow = scanEvent as ScanEventRow;
    const [participantResult, stationResult] = await Promise.all([
      adminSupabase
        .from("participants")
        .select(
          "registration_id, full_name, institution, participant_category",
        )
        .eq("id", scanEventRow.participant_id)
        .maybeSingle(),
      adminSupabase
        .from("scanner_stations")
        .select("station_name")
        .eq("id", scanEventRow.station_id)
        .maybeSingle(),
    ]);

    if (
      participantResult.error ||
      stationResult.error ||
      !participantResult.data ||
      !stationResult.data
    ) {
      return null;
    }

    const participant = participantResult.data as ParticipantRow;
    const station = stationResult.data as StationRow;

    return {
      session: sessionRow,
      initialDisplayEvent: {
        status: mapDisplayStatus(scanEventRow.result_status),
        participant: {
          registrationId: participant.registration_id,
          fullName: participant.full_name,
          institution: participant.institution,
          participantCategory: participant.participant_category,
        },
        session: {
          code: sessionRow.code,
          name: sessionRow.name,
        },
        station: {
          name: station.station_name,
        },
        eventAt: scanEventRow.scanned_at,
      },
    };
  } catch {
    return null;
  }
}

function DisplayUnavailable({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <main className="min-h-screen bg-[#f7f3ea] px-4 py-8 sm:px-8 sm:py-10">
      <section className="mx-auto max-w-3xl rounded-2xl border border-[#e4d8c4] bg-[#fffdf8] p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold tracking-[0.2em] text-[#9a7526]">
          AKKAI 2026
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-[#142842]">{title}</h1>
        <p className="mt-6 rounded-xl border border-[#ead3cc] bg-[#fff5f2] p-4 text-sm text-[#9b3d31]" role="alert">
          {message}
        </p>
        <div className="mt-6 flex flex-wrap gap-4 text-sm font-semibold">
          <Link
            className="text-[#344d68] underline underline-offset-4 hover:text-[#142842]"
            href="/admin/display"
          >
            Kembali ke Live Display
          </Link>
          <Link
            className="text-[#344d68] underline underline-offset-4 hover:text-[#142842]"
            href="/admin/dashboard"
          >
            Dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}

export default async function LiveDisplayPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  await requireRole(["ADMIN", "OPERATOR"]);

  const { sessionId: rawSessionId } = await params;
  const parsedSessionId = sessionIdSchema.safeParse(rawSessionId);

  if (!parsedSessionId.success) {
    return (
      <DisplayUnavailable
        title="Live Display Tidak Tersedia"
        message="Sesi Live Display tidak ditemukan. Pilih sesi dari halaman Live Display."
      />
    );
  }

  const displayData = await loadDisplayData(parsedSessionId.data);

  if (!displayData) {
    return (
      <DisplayUnavailable
        title="Live Display Belum Dapat Dimuat"
        message="Data sesi belum dapat dimuat. Silakan coba kembali."
      />
    );
  }

  if (!displayData.session) {
    return (
      <DisplayUnavailable
        title="Sesi Tidak Ditemukan"
        message="Sesi yang dipilih tidak tersedia. Pilih sesi lain untuk melanjutkan."
      />
    );
  }

  return (
    <LiveDisplayClient
      initialDisplayEvent={displayData.initialDisplayEvent}
      sessionId={parsedSessionId.data}
      session={displayData.session}
    />
  );
}
