import Link from "next/link";
import { z } from "zod";

import { requireRole } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";

import { ScannerClient } from "./scanner-client";

export const dynamic = "force-dynamic";

const stationIdSchema = z.string().uuid();

type StationStatus =
  | "WAITING_PAIRING"
  | "PAIRED"
  | "ACTIVE"
  | "DISCONNECTED"
  | "CLOSED";

type SessionStatus = "OPEN" | "CLOSED";

type StationRow = {
  id: string;
  station_name: string;
  session_id: string;
  status: StationStatus;
  paired_operator_id: string | null;
  last_activity_at: string | null;
  closed_at: string | null;
};

type SessionRow = {
  id: string;
  code: string;
  name: string;
  event_date: string;
  status: SessionStatus;
};

function ScannerLinkGroup() {
  return (
    <div className="flex flex-wrap gap-4 text-sm font-medium">
      <Link
        className="text-zinc-700 underline underline-offset-4 hover:text-zinc-950"
        href="/admin/scanner/pair"
      >
        Kembali ke Pairing Scanner
      </Link>
      <Link
        className="text-zinc-700 underline underline-offset-4 hover:text-zinc-950"
        href="/admin/dashboard"
      >
        Kembali ke Dashboard
      </Link>
    </div>
  );
}

function ScannerUnavailable({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <main className="min-h-screen bg-[#f7f3ea] px-4 py-8 sm:px-8 sm:py-10">
      <section className="mx-auto max-w-3xl rounded-2xl border border-[#e4d8c4] bg-[#fffdf8] p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold tracking-[0.2em] text-[#9a7526]">
              AKKAI 2026
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-[#142842]">{title}</h1>
          </div>
          <ScannerLinkGroup />
        </div>
        <p className="mt-8 rounded-xl border border-[#ead3cc] bg-[#fff5f2] p-4 text-sm text-[#9b3d31]" role="alert">
          {message}
        </p>
      </section>
    </main>
  );
}

type StationData = {
  station: StationRow | null;
  session: SessionRow | null;
};

async function loadStationData(stationId: string): Promise<StationData | null> {
  try {
    const adminSupabase = createAdminClient();
    const { data: station, error: stationError } = await adminSupabase
      .from("scanner_stations")
      .select(
        "id, station_name, session_id, status, paired_operator_id, last_activity_at, closed_at",
      )
      .eq("id", stationId)
      .maybeSingle();

    if (stationError || !station) {
      return stationError
        ? null
        : {
            station: null,
            session: null,
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

    return {
      station: stationRow,
      session: session ? (session as SessionRow) : null,
    };
  } catch {
    return null;
  }
}

export default async function ScannerPage({
  params,
}: {
  params: Promise<{ stationId: string }>;
}) {
  const profile = await requireRole(["ADMIN", "OPERATOR"]);
  const { stationId: rawStationId } = await params;
  const stationId = stationIdSchema.safeParse(rawStationId);

  if (!stationId.success) {
    return (
      <ScannerUnavailable
        title="Scanner Tidak Tersedia"
        message="Station scanner tidak ditemukan. Buka kembali halaman pairing scanner."
      />
    );
  }

  const stationData = await loadStationData(stationId.data);

  if (!stationData) {
    return (
      <ScannerUnavailable
        title="Scanner Tidak Tersedia"
        message="Scanner belum dapat dimuat. Silakan coba kembali."
      />
    );
  }

  if (!stationData.station) {
    return (
      <ScannerUnavailable
        title="Station Tidak Ditemukan"
        message="Station scanner tidak ditemukan. Buka kembali halaman pairing scanner."
      />
    );
  }

  if (!stationData.session) {
    return (
      <ScannerUnavailable
        title="Session Tidak Tersedia"
        message="Session untuk station ini belum dapat digunakan. Kembali ke pairing scanner."
      />
    );
  }

  const stationRow = stationData.station;
  const sessionRow = stationData.session;

  if (stationRow.status === "CLOSED" || stationRow.closed_at !== null) {
    return (
      <ScannerUnavailable
        title="Station Ditutup"
        message="Station ini sudah ditutup dan tidak dapat melakukan scan."
      />
    );
  }

  if (stationRow.status === "WAITING_PAIRING") {
    return (
      <ScannerUnavailable
        title="Station Belum Paired"
        message="Hubungkan scanner ke station terlebih dahulu melalui halaman pairing."
      />
    );
  }

  if (stationRow.status === "DISCONNECTED") {
    return (
      <ScannerUnavailable
        title="Scanner Terputus"
        message="Scanner terputus dari station. Kembali ke halaman pairing untuk menghubungkan ulang."
      />
    );
  }

  if (stationRow.paired_operator_id === null) {
    return (
      <ScannerUnavailable
        title="Station Belum Paired"
        message="Hubungkan scanner ke station terlebih dahulu melalui halaman pairing."
      />
    );
  }

  if (stationRow.paired_operator_id !== profile.id) {
    return (
      <ScannerUnavailable
        title="Station Bukan Milik Anda"
        message="Station ini terikat ke operator lain. Gunakan station yang sudah dipasangkan ke akun Anda."
      />
    );
  }

  if (stationRow.status !== "PAIRED" && stationRow.status !== "ACTIVE") {
    return (
      <ScannerUnavailable
        title="Station Tidak Aktif"
        message="Station belum siap melakukan scan. Kembali ke halaman pairing scanner."
      />
    );
  }

  if (sessionRow.status !== "OPEN") {
    return (
      <ScannerUnavailable
        title="Session Ditutup"
        message="Session check-in belum dibuka atau sudah ditutup."
      />
    );
  }

  return (
    <ScannerClient
      stationId={stationRow.id}
      stationName={stationRow.station_name}
      sessionCode={sessionRow.code}
      sessionName={sessionRow.name}
    />
  );
}
