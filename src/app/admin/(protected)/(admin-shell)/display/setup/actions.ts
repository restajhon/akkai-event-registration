"use server";

import { revalidatePath } from "next/cache";

import { getAuthorizedProfile } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createPairingCredentials,
} from "@/lib/stations/pairing";
import type { StationActionState } from "@/lib/stations/station-action-state";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function errorState(message: string): StationActionState {
  return {
    status: "error",
    message,
  };
}

function successState(
  action: "create" | "reset" | "close",
  message: string,
  details: {
    stationId?: string;
    stationName?: string;
    pairingCode?: string;
    pairingExpiresAt?: string;
  } = {},
): StationActionState {
  return {
    status: "success",
    message,
    action,
    ...details,
  };
}

function readString(formData: FormData, fieldName: string) {
  const value = formData.get(fieldName);
  return typeof value === "string" ? value.trim() : null;
}

export async function createStation(
  previousState: StationActionState,
  formData: FormData,
): Promise<StationActionState> {
  void previousState;

  const profile = await getAuthorizedProfile("display.manage");

  if (!profile) {
    return errorState("Anda tidak memiliki akses untuk melakukan tindakan ini.");
  }

  const stationName = readString(formData, "stationName");
  const sessionId = readString(formData, "sessionId");

  if (
    !stationName ||
    stationName.length < 3 ||
    stationName.length > 100 ||
    !sessionId ||
    !uuidPattern.test(sessionId)
  ) {
    return errorState("Data station tidak valid.");
  }

  try {
    const adminSupabase = createAdminClient();
    const credentials = await createPairingCredentials();
    const { data: createData, error: createError } = await adminSupabase.rpc(
      "create_scanner_station",
      {
        p_station_name: stationName,
        p_session_id: sessionId,
        p_pairing_code_hash: credentials.pairingCodeHash,
        p_pairing_token_hash: credentials.pairingTokenHash,
        p_pairing_expires_at: credentials.pairingExpiresAt,
        p_created_by: profile.id,
      },
    );

    if (createError) {
      return errorState(
        "Terjadi kendala saat memproses station. Silakan coba kembali.",
      );
    }

    const createResult = Array.isArray(createData)
      ? createData[0]
      : createData;

    if (createResult?.status_code === "SESSION_CLOSED") {
      return errorState("Session harus dibuka sebelum station dapat dibuat.");
    }

    if (createResult?.status_code === "SESSION_NOT_FOUND") {
      return errorState("Session tidak ditemukan.");
    }

    if (
      createResult?.status_code !== "CREATED" ||
      typeof createResult.station_id !== "string"
    ) {
      return errorState(
        "Terjadi kendala saat memproses station. Silakan coba kembali.",
      );
    }

    revalidatePath("/admin/display/setup");
    revalidatePath("/admin/scanner/pair");

    return successState(
      "create",
      "Station berhasil dibuat.",
      {
        stationId: createResult.station_id,
        stationName,
        pairingCode: credentials.pairingCode,
        pairingExpiresAt: credentials.pairingExpiresAt,
      },
    );
  } catch {
    return errorState(
      "Terjadi kendala saat memproses station. Silakan coba kembali.",
    );
  }
}

export async function resetStationPairing(
  previousState: StationActionState,
  formData: FormData,
): Promise<StationActionState> {
  void previousState;

  const profile = await getAuthorizedProfile("display.manage");

  if (!profile) {
    return errorState("Anda tidak memiliki akses untuk melakukan tindakan ini.");
  }

  const stationId = readString(formData, "stationId");

  if (!stationId || !uuidPattern.test(stationId)) {
    return errorState("Data station tidak valid.");
  }

  try {
    const adminSupabase = createAdminClient();
    const { data: station, error: stationError } = await adminSupabase
      .from("scanner_stations")
      .select("id, station_name, status, pairing_code_hash")
      .eq("id", stationId)
      .maybeSingle();

    if (stationError) {
      return errorState(
        "Terjadi kendala saat memproses station. Silakan coba kembali.",
      );
    }

    if (!station) {
      return errorState("Station tidak ditemukan.");
    }

    const credentials = await createPairingCredentials();
    const { data: resetResult, error: resetError } = await adminSupabase.rpc(
      "reset_scanner_station_pairing",
      {
        p_station_id: station.id,
        p_expected_status: station.status,
        p_expected_pairing_code_hash: station.pairing_code_hash,
        p_pairing_code_hash: credentials.pairingCodeHash,
        p_pairing_token_hash: credentials.pairingTokenHash,
        p_pairing_expires_at: credentials.pairingExpiresAt,
      },
    );

    if (resetError) {
      return errorState(
        "Terjadi kendala saat memproses station. Silakan coba kembali.",
      );
    }

    if (resetResult === "STALE_STATE") {
      return errorState("Station berubah saat proses reset. Muat ulang dan coba lagi.");
    }

    if (resetResult === "STATION_CLOSED") {
      return errorState("Station sudah ditutup.");
    }

    if (resetResult === "SESSION_CLOSED") {
      return errorState("Session harus dibuka sebelum station dapat digunakan.");
    }

    if (resetResult !== "RESET") {
      return errorState(
        "Terjadi kendala saat memproses station. Silakan coba kembali.",
      );
    }

    revalidatePath("/admin/display/setup");
    revalidatePath("/admin/scanner/pair");

    return successState(
      "reset",
      "Kode pairing berhasil dibuat.",
      {
        stationId: station.id,
        stationName: station.station_name,
        pairingCode: credentials.pairingCode,
        pairingExpiresAt: credentials.pairingExpiresAt,
      },
    );
  } catch {
    return errorState(
      "Terjadi kendala saat memproses station. Silakan coba kembali.",
    );
  }
}

export async function closeStation(
  previousState: StationActionState,
  formData: FormData,
): Promise<StationActionState> {
  void previousState;

  const profile = await getAuthorizedProfile("display.manage");

  if (!profile) {
    return errorState("Anda tidak memiliki akses untuk melakukan tindakan ini.");
  }

  const stationId = readString(formData, "stationId");

  if (!stationId || !uuidPattern.test(stationId)) {
    return errorState("Data station tidak valid.");
  }

  try {
    const adminSupabase = createAdminClient();
    const { data: closed, error: closeError } = await adminSupabase.rpc(
      "close_scanner_station",
      { p_station_id: stationId },
    );

    if (closeError) {
      if (closeError.message === "Station tidak ditemukan.") {
        return errorState("Station tidak ditemukan.");
      }

      return errorState(
        "Terjadi kendala saat memproses station. Silakan coba kembali.",
      );
    }

    if (closed !== true) {
      return errorState(
        "Terjadi kendala saat memproses station. Silakan coba kembali.",
      );
    }

    revalidatePath("/admin/display/setup");
    revalidatePath("/admin/scanner/pair");

    return successState("close", "Station berhasil ditutup.", {
      stationId,
    });
  } catch {
    return errorState(
      "Terjadi kendala saat memproses station. Silakan coba kembali.",
    );
  }
}
