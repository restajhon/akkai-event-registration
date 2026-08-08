import Link from "next/link";

import { requireRole } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";

import { PairForm, type PairingStation } from "./pair-form";

type SessionRow = {
  id: string;
  code: string;
  name: string;
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

function PairingError() {
  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-10 sm:px-8">
      <section className="mx-auto max-w-3xl rounded-xl bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-medium text-zinc-500">AKKAI 2026</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
          Pairing Scanner
        </h1>
        <p className="mt-6 rounded-lg bg-red-50 p-4 text-sm text-red-700" role="alert">
          Station belum dapat dimuat. Silakan coba kembali.
        </p>
        <Link
          className="mt-6 inline-flex text-sm font-medium text-zinc-700 underline underline-offset-4 hover:text-zinc-950"
          href="/admin/dashboard"
        >
          Kembali ke Dashboard
        </Link>
      </section>
    </main>
  );
}

async function loadPairingStations() {
  try {
    const adminSupabase = createAdminClient();
    const [sessionsResult, stationsResult] = await Promise.all([
      adminSupabase
        .from("sessions")
        .select("id, code, name, status")
        .eq("status", "OPEN")
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
    ]);

    if (sessionsResult.error || stationsResult.error) {
      return null;
    }

    const sessions = (sessionsResult.data ?? []) as SessionRow[];
    const stations = (stationsResult.data ?? []) as StationRow[];
    const sessionById = new Map(sessions.map((session) => [session.id, session]));
    const pairingStations: PairingStation[] = stations
      .filter((station) => sessionById.has(station.session_id))
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

    return pairingStations;
  } catch {
    return null;
  }
}

export default async function ScannerPairPage() {
  const profile = await requireRole(["ADMIN", "OPERATOR"]);
  const pairingStations = await loadPairingStations();

  if (!pairingStations) {
    return <PairingError />;
  }

  return (
    <PairForm
      isAdmin={profile.role === "ADMIN"}
      stations={pairingStations}
    />
  );
}
