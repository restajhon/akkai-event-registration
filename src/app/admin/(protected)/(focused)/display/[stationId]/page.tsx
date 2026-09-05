import Link from "next/link";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";

import {
  LiveDisplayClient,
  type LiveDisplayEvent,
  type LiveDisplaySession,
} from "./live-display-client";

export const dynamic = "force-dynamic";

const stationIdSchema = z.string().uuid();

type StationStatus =
  | "WAITING_PAIRING"
  | "PAIRED"
  | "ACTIVE"
  | "DISCONNECTED"
  | "CLOSED";
type SessionStatus = "OPEN" | "CLOSED";
type DatabaseScanStatus =
  | "SUCCESS"
  | "SUCCESS_WITH_WARNING"
  | "ALREADY_CHECKED_IN";

type StationRow = {
  id: string;
  station_name: string;
  session_id: string;
  status: StationStatus;
  closed_at: string | null;
};

type SessionRow = LiveDisplaySession;

type DatabaseSessionRow = {
  id: string;
  code: string;
  name: string;
  event_date: string;
  status: SessionStatus;
};

type ScanEventRow = {
  participant_id: string;
  result_status: DatabaseScanStatus;
  scanned_at: string;
  event_sequence: string;
};

type ParticipantRow = {
  registration_id: string;
  full_name: string;
  institution: string | null;
  participant_category: string | null;
};

type DisplayData = {
  station: StationRow | null;
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

async function loadDisplayData(stationId: string): Promise<DisplayData | null> {
  try {
    const adminSupabase = createAdminClient();
    const { data: station, error: stationError } = await adminSupabase
      .from("scanner_stations")
      .select("id, station_name, session_id, status, closed_at")
      .eq("id", stationId)
      .maybeSingle();

    if (stationError) {
      return null;
    }

    if (!station) {
      return {
        station: null,
        session: null,
        initialDisplayEvent: null,
      };
    }

    const stationRow = station as StationRow;
    const { data: session, error: sessionError } = await adminSupabase
      .from("sessions")
      .select("id, code, name, event_date, status")
      .eq("id", stationRow.session_id)
      .maybeSingle();

    if (sessionError) {
      return null;
    }

    if (!session) {
      return {
        station: stationRow,
        session: null,
        initialDisplayEvent: null,
      };
    }

    const databaseSession = session as DatabaseSessionRow;
    const sessionRow: SessionRow = {
      code: databaseSession.code,
      name: databaseSession.name,
      eventDate: databaseSession.event_date,
      status: databaseSession.status,
    };
    const { data: scanEvent, error: scanEventError } = await adminSupabase
      .from("scan_events")
      .select("participant_id, result_status, scanned_at, event_sequence::text")
      .eq("station_id", stationRow.id)
      .eq("session_id", stationRow.session_id)
      .in("result_status", eligibleStatuses)
      .not("participant_id", "is", null)
      .order("event_sequence", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (scanEventError) {
      return null;
    }

    if (!scanEvent) {
      return {
        station: stationRow,
        session: sessionRow,
        initialDisplayEvent: null,
      };
    }

    const scanEventRow = scanEvent as ScanEventRow;
    const { data: participant, error: participantError } = await adminSupabase
      .from("participants")
      .select(
        "registration_id, full_name, institution, participant_category",
      )
      .eq("id", scanEventRow.participant_id)
      .maybeSingle();

    if (participantError || !participant) {
      return null;
    }

    const participantRow = participant as ParticipantRow;

    return {
      station: stationRow,
      session: sessionRow,
      initialDisplayEvent: {
        status: mapDisplayStatus(scanEventRow.result_status),
        participant: {
          registrationId: participantRow.registration_id,
          fullName: participantRow.full_name,
          institution: participantRow.institution,
          participantCategory: participantRow.participant_category,
        },
        session: {
          code: sessionRow.code,
          name: sessionRow.name,
        },
        station: {
          name: stationRow.station_name,
        },
        eventAt: scanEventRow.scanned_at,
        eventSequence: scanEventRow.event_sequence,
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
  params: Promise<{ stationId: string }>;
}) {
  await requirePermission("display.view");

  const { stationId: rawStationId } = await params;
  const parsedStationId = stationIdSchema.safeParse(rawStationId);

  if (!parsedStationId.success) {
    return (
      <DisplayUnavailable
        title="Live Display Tidak Tersedia"
        message="Station Live Display tidak ditemukan. Pilih station dari halaman Live Display."
      />
    );
  }

  const displayData = await loadDisplayData(parsedStationId.data);

  if (!displayData) {
    return (
      <DisplayUnavailable
        title="Live Display Belum Dapat Dimuat"
        message="Data station belum dapat dimuat. Silakan coba kembali."
      />
    );
  }

  if (!displayData.station) {
    return (
      <DisplayUnavailable
        title="Station Tidak Ditemukan"
        message="Station Live Display tidak ditemukan. Pilih station lain untuk melanjutkan."
      />
    );
  }

  if (!displayData.session) {
    return (
      <DisplayUnavailable
        title="Session Tidak Tersedia"
        message="Session untuk station ini belum dapat digunakan. Pilih station lain untuk melanjutkan."
      />
    );
  }

  if (
    displayData.station.status === "CLOSED" ||
    displayData.station.closed_at !== null
  ) {
    return (
      <DisplayUnavailable
        title="Station Ditutup"
        message="Station ini sudah ditutup dan tidak dapat digunakan sebagai Live Display."
      />
    );
  }

  return (
    <LiveDisplayClient
      initialDisplayEvent={displayData.initialDisplayEvent}
      stationId={displayData.station.id}
      stationName={displayData.station.station_name}
      session={displayData.session}
    />
  );
}
