import Link from "next/link";

import { requirePermission } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";

import {
  StationSetup,
  type SetupSession,
  type SetupStation,
} from "./station-setup";

type SessionRow = SetupSession;

type StationRow = {
  id: string;
  station_name: string;
  session_id: string;
  status: SetupStation["status"];
  pairing_expires_at: string;
  paired_operator_id: string | null;
  paired_at: string | null;
  last_activity_at: string | null;
  created_at: string;
  closed_at: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string;
};

function SetupError() {
  return (
    <main className="min-h-screen bg-[#f7f3ea] px-4 py-6 sm:px-8 sm:py-8">
      <section className="mx-auto max-w-3xl">
        <header className="border-b border-[#dfd3bf] pb-4">
          <p className="text-xs font-bold tracking-[0.16em] text-[#9a7526]">SETUP</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#142842]">
            Scanner Station
          </h1>
        </header>
        <p className="mt-5 rounded-lg border border-[#ead3cc] bg-[#fff5f2] p-4 text-sm text-[#9b3d31]" role="alert">
          Data station belum dapat dimuat. Silakan coba kembali.
        </p>
        <Link
          className="mt-5 inline-flex min-h-11 items-center rounded-lg border border-[#b99a5a] px-4 text-sm font-semibold text-[#6d531e] outline-none hover:bg-[#fbf5e8] focus-visible:ring-2 focus-visible:ring-[#9a7526]"
          href="/admin/display/setup"
        >
          Coba Lagi
        </Link>
      </section>
    </main>
  );
}

async function loadSetupData() {
  try {
    const adminSupabase = createAdminClient();
    const [sessionsResult, stationsResult] = await Promise.all([
      adminSupabase
        .from("sessions")
        .select("id, code, name, event_date, status")
        .order("event_date", { ascending: true })
        .order("code", { ascending: true }),
      adminSupabase
        .from("scanner_stations")
        .select(
          "id, station_name, session_id, status, pairing_expires_at, paired_operator_id, paired_at, last_activity_at, created_at, closed_at",
        )
        .order("created_at", { ascending: false }),
    ]);

    if (sessionsResult.error || stationsResult.error) {
      return null;
    }

    const sessions = (sessionsResult.data ?? []) as SessionRow[];
    const stations = (stationsResult.data ?? []) as StationRow[];
    const operatorIds = Array.from(
      new Set(
        stations
          .map((station) => station.paired_operator_id)
          .filter((id): id is string => Boolean(id)),
      ),
    );

    let profiles: ProfileRow[] = [];

    if (operatorIds.length > 0) {
      const profilesResult = await adminSupabase
        .from("profiles")
        .select("id, full_name")
        .in("id", operatorIds);

      if (profilesResult.error) {
        return null;
      }

      profiles = (profilesResult.data ?? []) as ProfileRow[];
    }

    const sessionById = new Map(sessions.map((session) => [session.id, session]));
    const profileNameById = new Map(
      profiles.map((profile) => [profile.id, profile.full_name]),
    );
    const openSessions = sessions.filter((session) => session.status === "OPEN");
    const stationViews: SetupStation[] = stations.map((station) => {
      const session = sessionById.get(station.session_id);

      return {
        id: station.id,
        stationName: station.station_name,
        sessionId: station.session_id,
        sessionName: session?.name ?? "Session tidak ditemukan",
        sessionCode: session?.code ?? "-",
        eventDate: session?.event_date ?? "-",
        status: station.status,
        pairingExpiresAt: station.pairing_expires_at,
        pairedAt: station.paired_at,
        lastActivityAt: station.last_activity_at,
        createdAt: station.created_at,
        closedAt: station.closed_at,
        pairedOperatorName: station.paired_operator_id
          ? profileNameById.get(station.paired_operator_id) ?? "Operator tidak ditemukan"
          : null,
      };
    });

    return {
      sessions: openSessions,
      stations: stationViews,
    };
  } catch {
    return null;
  }
}

export default async function DisplaySetupPage() {
  await requirePermission("display.manage");

  const setupData = await loadSetupData();

  if (!setupData) {
    return <SetupError />;
  }

  return <StationSetup {...setupData} />;
}
