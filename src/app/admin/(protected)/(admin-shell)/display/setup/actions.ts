"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth/server";
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
  message: string,
  pairingCode?: string,
  pairingExpiresAt?: string,
): StationActionState {
  return {
    status: "success",
    message,
    pairingCode,
    pairingExpiresAt,
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

  const profile = await requireRole(["ADMIN"]);

  if (profile.is_active !== true || profile.role !== "ADMIN") {
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
    const { data: session, error: sessionError } = await adminSupabase
      .from("sessions")
      .select("id, status")
      .eq("id", sessionId)
      .maybeSingle();

    if (sessionError) {
      return errorState(
        "Terjadi kendala saat memproses station. Silakan coba kembali.",
      );
    }

    if (!session) {
      return errorState("Session tidak ditemukan.");
    }

    if (session.status !== "OPEN") {
      return errorState("Session harus dibuka sebelum station dapat digunakan.");
    }

    const credentials = await createPairingCredentials();
    const { error: insertError } = await adminSupabase
      .from("scanner_stations")
      .insert({
        station_name: stationName,
        session_id: session.id,
        status: "WAITING_PAIRING",
        pairing_code_hash: credentials.pairingCodeHash,
        pairing_token_hash: credentials.pairingTokenHash,
        pairing_expires_at: credentials.pairingExpiresAt,
        paired_operator_id: null,
        paired_at: null,
        last_activity_at: null,
        created_by: profile.id,
        closed_at: null,
      });

    if (insertError) {
      return errorState(
        "Terjadi kendala saat memproses station. Silakan coba kembali.",
      );
    }

    revalidatePath("/admin/display/setup");
    revalidatePath("/admin/scanner/pair");

    return successState(
      "Station berhasil dibuat.",
      credentials.pairingCode,
      credentials.pairingExpiresAt,
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

  const profile = await requireRole(["ADMIN"]);

  if (profile.is_active !== true || profile.role !== "ADMIN") {
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
      .select("id, session_id, status")
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

    if (station.status === "CLOSED") {
      return errorState("Station sudah ditutup.");
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
      return errorState("Session harus dibuka sebelum station dapat digunakan.");
    }

    const credentials = await createPairingCredentials();
    const { data: updatedStation, error: updateError } = await adminSupabase
      .from("scanner_stations")
      .update({
        status: "WAITING_PAIRING",
        pairing_code_hash: credentials.pairingCodeHash,
        pairing_token_hash: credentials.pairingTokenHash,
        pairing_expires_at: credentials.pairingExpiresAt,
        paired_operator_id: null,
        paired_at: null,
        last_activity_at: null,
        closed_at: null,
      })
      .eq("id", station.id)
      .eq("session_id", session.id)
      .neq("status", "CLOSED")
      .select("id")
      .maybeSingle();

    if (updateError) {
      return errorState(
        "Terjadi kendala saat memproses station. Silakan coba kembali.",
      );
    }

    if (!updatedStation) {
      return errorState("Station sudah ditutup.");
    }

    revalidatePath("/admin/display/setup");
    revalidatePath("/admin/scanner/pair");

    return successState(
      "Kode pairing berhasil dibuat.",
      credentials.pairingCode,
      credentials.pairingExpiresAt,
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

  const profile = await requireRole(["ADMIN"]);

  if (profile.is_active !== true || profile.role !== "ADMIN") {
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
      .select("id, status")
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

    if (station.status === "CLOSED") {
      return errorState("Station sudah ditutup.");
    }

    const { data: closedStation, error: closeError } = await adminSupabase
      .from("scanner_stations")
      .update({
        status: "CLOSED",
        closed_at: new Date().toISOString(),
      })
      .eq("id", station.id)
      .neq("status", "CLOSED")
      .select("id")
      .maybeSingle();

    if (closeError) {
      return errorState(
        "Terjadi kendala saat memproses station. Silakan coba kembali.",
      );
    }

    if (!closedStation) {
      return errorState("Station sudah ditutup.");
    }

    revalidatePath("/admin/display/setup");
    revalidatePath("/admin/scanner/pair");

    return successState("Station berhasil ditutup.");
  } catch {
    return errorState(
      "Terjadi kendala saat memproses station. Silakan coba kembali.",
    );
  }
}
