import "server-only";

import type { UserProfile } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
  closed_at: string | null;
};

type SessionRow = {
  id: string;
  code: string;
  name: string;
  status: SessionStatus;
};

export type ManualStationContext = {
  stationId: string;
  stationName: string;
  sessionId: string;
  sessionCode: string;
  sessionName: string;
};

export type ManualContextErrorCode =
  | "invalid-profile"
  | "invalid-station"
  | "station-closed"
  | "station-not-paired"
  | "station-owned-by-other-operator"
  | "closed-session"
  | "internal-error";

export type ManualStationContextResult =
  | {
      context: ManualStationContext;
      error: null;
    }
  | {
      context: null;
      error: {
        code: ManualContextErrorCode;
        message: string;
      };
    };

function contextError(
  code: ManualContextErrorCode,
  message: string,
): ManualStationContextResult {
  return {
    context: null,
    error: { code, message },
  };
}

export async function loadAuthorizedManualStationContext(
  profile: UserProfile,
  stationId: string,
): Promise<ManualStationContextResult> {
  if (
    profile.is_active !== true ||
    (profile.role !== "ADMIN" && profile.role !== "OPERATOR")
  ) {
    return contextError(
      "invalid-profile",
      "Anda tidak memiliki akses untuk melakukan check-in manual.",
    );
  }

  try {
    const adminSupabase = createAdminClient();
    const { data: station, error: stationError } = await adminSupabase
      .from("scanner_stations")
      .select("id, station_name, session_id, status, paired_operator_id, closed_at")
      .eq("id", stationId)
      .maybeSingle();

    if (stationError) {
      return contextError(
        "internal-error",
        "Station belum dapat dimuat. Silakan coba kembali.",
      );
    }

    if (!station) {
      return contextError(
        "invalid-station",
        "Station scanner tidak ditemukan.",
      );
    }

    const stationRow = station as StationRow;

    if (stationRow.status === "CLOSED" || stationRow.closed_at !== null) {
      return contextError(
        "station-closed",
        "Station ini sudah ditutup dan tidak dapat digunakan.",
      );
    }

    if (
      stationRow.status !== "PAIRED" &&
      stationRow.status !== "ACTIVE"
    ) {
      return contextError(
        "station-not-paired",
        "Station belum siap digunakan. Hubungkan scanner terlebih dahulu.",
      );
    }

    if (stationRow.paired_operator_id === null) {
      return contextError(
        "station-not-paired",
        "Station belum terikat ke operator.",
      );
    }

    if (stationRow.paired_operator_id !== profile.id) {
      return contextError(
        "station-owned-by-other-operator",
        "Station terikat ke operator lain.",
      );
    }

    const { data: session, error: sessionError } = await adminSupabase
      .from("sessions")
      .select("id, code, name, status")
      .eq("id", stationRow.session_id)
      .maybeSingle();

    if (sessionError) {
      return contextError(
        "internal-error",
        "Sesi station belum dapat dimuat. Silakan coba kembali.",
      );
    }

    if (!session) {
      return contextError(
        "invalid-station",
        "Sesi untuk station ini tidak ditemukan.",
      );
    }

    const sessionRow = session as SessionRow;

    if (sessionRow.status !== "OPEN") {
      return contextError(
        "closed-session",
        "Sesi check-in belum dibuka atau telah ditutup.",
      );
    }

    return {
      context: {
        stationId: stationRow.id,
        stationName: stationRow.station_name,
        sessionId: sessionRow.id,
        sessionCode: sessionRow.code,
        sessionName: sessionRow.name,
      },
      error: null,
    };
  } catch {
    return contextError(
      "internal-error",
      "Station belum dapat dimuat. Silakan coba kembali.",
    );
  }
}
