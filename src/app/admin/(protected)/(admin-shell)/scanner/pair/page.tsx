import Link from "next/link";

import { requireRole } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";

import {
  PairForm,
  type MyScannerStation,
  type PairingStation,
} from "./pair-form";

type SessionRow = {
  id: string;
  code: string;
  name: string;
  event_date: string;
  status: "OPEN" | "CLOSED";
};

type StationRow = {
  id: string;
  station_name: string;
  session_id: string;
  status: "WAITING_PAIRING" | "PAIRED" | "ACTIVE" | "DISCONNECTED" | "CLOSED";
  pairing_expires_at: string;
  paired_operator_id: string | null;
};

type OwnedStationRow = {
  id: string;
  station_name: string;
  session_id: string;
  status: "PAIRED" | "ACTIVE";
};

function PairingError() {
  return (
    <main className="min-h-screen bg-[#f7f3ea] px-4 py-6 sm:px-8 sm:py-8">
      <section className="mx-auto max-w-3xl">
        <header className="border-b border-[#dfd3bf] pb-4">
          <p className="text-xs font-bold tracking-[0.16em] text-[#9a7526]">OPERASIONAL</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#142842]">
            Pairing Scanner
          </h1>
        </header>
        <p className="mt-5 rounded-lg border border-[#ead3cc] bg-[#fff5f2] p-4 text-sm text-[#9b3d31]" role="alert">
          Station belum dapat dimuat. Silakan coba kembali.
        </p>
        <Link
          className="mt-5 inline-flex min-h-11 items-center rounded-lg border border-[#b99a5a] px-4 text-sm font-semibold text-[#6d531e] outline-none hover:bg-[#fbf5e8] focus-visible:ring-2 focus-visible:ring-[#9a7526]"
          href="/admin/scanner/pair"
        >
          Coba Lagi
        </Link>
      </section>
    </main>
  );
}

async function loadPairingStations(profileId: string) {
  try {
    const adminSupabase = createAdminClient();
    const [sessionsResult, stationsResult, ownedStationsResult] = await Promise.all([
      adminSupabase
        .from("sessions")
        .select("id, code, name, event_date, status")
        .order("event_date", { ascending: true })
        .order("code", { ascending: true }),
      adminSupabase
        .from("scanner_stations")
        .select(
          "id, station_name, session_id, status, pairing_expires_at, paired_operator_id",
        )
        .eq("status", "WAITING_PAIRING")
        .is("paired_operator_id", null)
        .gt("pairing_expires_at", new Date().toISOString())
        .order("pairing_expires_at", { ascending: true }),
      adminSupabase
        .from("scanner_stations")
        .select("id, station_name, session_id, status")
        .eq("paired_operator_id", profileId)
        .in("status", ["PAIRED", "ACTIVE"])
        .is("closed_at", null)
        .order("station_name", { ascending: true }),
    ]);

    if (
      sessionsResult.error ||
      stationsResult.error ||
      ownedStationsResult.error
    ) {
      return null;
    }

    const sessions = (sessionsResult.data ?? []) as SessionRow[];
    const stations = (stationsResult.data ?? []) as StationRow[];
    const ownedStations = (ownedStationsResult.data ?? []) as OwnedStationRow[];
    const sessionById = new Map(sessions.map((session) => [session.id, session]));
    const pairingStations: PairingStation[] = stations
      .filter((station) => sessionById.get(station.session_id)?.status === "OPEN")
      .map((station) => {
        const session = sessionById.get(station.session_id);

        return {
          id: station.id,
          stationName: station.station_name,
          sessionName: session?.name ?? "Session tidak ditemukan",
          sessionCode: session?.code ?? "-",
          pairingExpiresAt: station.pairing_expires_at,
        };
      });

    const myStations: MyScannerStation[] = ownedStations.map((station) => {
      const session = sessionById.get(station.session_id);

      return {
        id: station.id,
        stationName: station.station_name,
        status: station.status,
        sessionCode: session?.code ?? "-",
        sessionName: session?.name ?? "Session tidak ditemukan",
        sessionStatus: session?.status ?? "CLOSED",
      };
    });

    return {
      pairingStations,
      myStations,
    };
  } catch {
    return null;
  }
}

export default async function ScannerPairPage() {
  const profile = await requireRole(["ADMIN", "OPERATOR"]);
  const pairingData = await loadPairingStations(profile.id);

  if (!pairingData) {
    return <PairingError />;
  }

  return (
    <PairForm
      isAdmin={profile.role === "ADMIN"}
      myStations={pairingData.myStations}
      stations={pairingData.pairingStations}
    />
  );
}
