"use server";

import { revalidatePath } from "next/cache";

import { getAuthorizedProfile } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPairingCode } from "@/lib/stations/pairing";
import type { StationActionState } from "@/lib/stations/station-action-state";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const invalidCredentialMessage =
  "Kode pairing tidak valid atau telah kedaluwarsa.";
const pairingRejectedMessage =
  "Kode pairing tidak valid, telah kedaluwarsa, atau station sudah dipasangkan.";

function errorState(message: string): StationActionState {
  return {
    status: "error",
    message,
  };
}

function readString(formData: FormData, fieldName: string) {
  const value = formData.get(fieldName);
  return typeof value === "string" ? value.trim() : null;
}

export async function pairStation(
  previousState: StationActionState,
  formData: FormData,
): Promise<StationActionState> {
  void previousState;

  const profile = await getAuthorizedProfile("scanner.pair");

  if (!profile) {
    return errorState("Anda tidak memiliki akses untuk melakukan tindakan ini.");
  }

  const stationId = readString(formData, "stationId");
  const pairingCode = readString(formData, "pairingCode");

  if (
    !stationId ||
    !uuidPattern.test(stationId) ||
    !pairingCode ||
    !/^\d{6}$/.test(pairingCode)
  ) {
    return errorState(invalidCredentialMessage);
  }

  try {
    const adminSupabase = createAdminClient();
    const { data: station, error: stationError } = await adminSupabase
      .from("scanner_stations")
      .select(
        "id, status, session_id, pairing_code_hash, pairing_expires_at, paired_operator_id",
      )
      .eq("id", stationId)
      .maybeSingle();

    if (stationError) {
      return errorState(
        "Terjadi kendala saat memproses station. Silakan coba kembali.",
      );
    }

    if (!station) {
      return errorState(invalidCredentialMessage);
    }

    if (
      station.status !== "WAITING_PAIRING" ||
      station.paired_operator_id !== null
    ) {
      return errorState(pairingRejectedMessage);
    }

    const pairingExpiresAt = new Date(station.pairing_expires_at).getTime();

    if (!Number.isFinite(pairingExpiresAt) || pairingExpiresAt <= Date.now()) {
      return errorState(invalidCredentialMessage);
    }

    const { data: session, error: sessionError } = await adminSupabase
      .from("sessions")
      .select("id, status")
      .eq("id", station.session_id)
      .maybeSingle();

    if (sessionError) {
      return errorState(
        "Terjadi kendala saat memproses station. Silakan coba kembali.",
      );
    }

    if (!session || session.status !== "OPEN") {
      return errorState("Session belum dibuka atau telah ditutup.");
    }

    const isValidCode = await verifyPairingCode(
      pairingCode,
      station.pairing_code_hash,
    );

    if (!isValidCode) {
      return errorState(invalidCredentialMessage);
    }

    const { data: paired, error: pairingError } = await adminSupabase.rpc(
      "pair_scanner_station",
      {
        p_station_id: station.id,
        p_operator_profile_id: profile.id,
        p_expected_pairing_code_hash: station.pairing_code_hash,
      },
    );

    if (pairingError || paired !== true) {
      return errorState(pairingRejectedMessage);
    }

    revalidatePath("/admin/scanner/pair");
    revalidatePath("/admin/display/setup");

    return {
      status: "success",
      message: "Station berhasil dipasangkan.",
    };
  } catch {
    return errorState(
      "Terjadi kendala saat memproses station. Silakan coba kembali.",
    );
  }
}
