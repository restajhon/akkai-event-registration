"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getAuthorizedProfile } from "@/lib/auth/server";
import {
  type ManualCheckInErrorCode,
  type ManualCheckInState,
  type ManualParticipant,
  type ManualSearchState,
  type ManualSession,
} from "@/lib/manual-check-in/manual-check-in-state";
import { loadAuthorizedManualStationContext } from "@/lib/manual-check-in/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  manualCheckInInputSchema,
  manualRegistrationIdSchema,
  manualSearchInputSchema,
} from "@/lib/validation/manual-check-in";

const databaseParticipantRowSchema = z.object({
  id: z.string().uuid(),
  registration_id: z.string().min(1),
  full_name: z.string().min(1),
  institution: z.string().nullable(),
  participant_category: z.string().min(1).nullable(),
  registration_status: z.enum(["REGISTERED", "CANCELLED"]),
});

const rpcResultSchema = z.object({
  status_code: z.string(),
  result_status: z.enum([
    "SUCCESS",
    "SUCCESS_WITH_WARNING",
    "ALREADY_CHECKED_IN",
    "INVALID_QR",
    "CANCELLED_PARTICIPANT",
    "SESSION_CLOSED",
    "STATION_INACTIVE",
    "ERROR",
  ]),
  registration_id: z.string().nullable(),
  full_name: z.string().nullable(),
  institution: z.string().nullable(),
  participant_category: z.string().nullable(),
  session_code: z.string().nullable(),
  session_name: z.string().nullable(),
  checked_at: z.string().nullable(),
  is_duplicate: z.boolean(),
});

type DatabaseParticipantRow = z.infer<typeof databaseParticipantRowSchema>;
type RpcResult = z.infer<typeof rpcResultSchema>;
type ParticipantRowsResult =
  | { ok: true; rows: DatabaseParticipantRow[] }
  | { ok: false; message: string };

function readFormString(formData: FormData, fieldName: string) {
  const value = formData.get(fieldName);
  return typeof value === "string" ? value.trim() : null;
}

function searchError(message: string): ManualSearchState {
  return {
    status: "error",
    message,
    results: [],
  };
}

function checkInError(
  message: string,
  errorCode: ManualCheckInErrorCode,
): ManualCheckInState {
  return {
    status: "error",
    message,
    errorCode,
    participant: null,
    session: null,
    checkedAt: null,
  };
}

function safeSearchParticipant(
  participant: DatabaseParticipantRow,
  checkedInAt: string | null,
): ManualParticipant {
  return {
    registrationId: participant.registration_id,
    fullName: participant.full_name,
    institution: participant.institution,
    participantCategory: participant.participant_category,
    registrationStatus: participant.registration_status,
    alreadyCheckedIn: checkedInAt !== null,
    checkedInAt,
  };
}

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

async function getParticipantRows(
  query: string,
): Promise<ParticipantRowsResult> {
  const adminSupabase = createAdminClient();
  const selectColumns =
    "id, registration_id, full_name, institution, participant_category, registration_status";

  if (manualRegistrationIdSchema.safeParse(query).success) {
    const { data, error } = await adminSupabase
      .from("participants")
      .select(selectColumns)
      .eq("registration_id", query)
      .limit(1);

    if (error) {
      return {
        ok: false,
        message: "Peserta belum dapat dicari. Silakan coba kembali.",
      };
    }

    return parseParticipantRows(data);
  }

  if (query.length < 3) {
    return {
      ok: false,
      message: "Masukkan minimal 3 karakter untuk mencari peserta.",
    };
  }

  const escapedNameQuery = escapeLikePattern(query);
  const [memberResult, nameResult] = await Promise.all([
    adminSupabase
      .from("participants")
      .select(selectColumns)
      .eq("member_number", query.toUpperCase())
      .limit(1),
    adminSupabase
      .from("participants")
      .select(selectColumns)
      .ilike("full_name", `%${escapedNameQuery}%`)
      .order("full_name", { ascending: true })
      .order("registration_id", { ascending: true })
      .limit(10),
  ]);

  if (memberResult.error || nameResult.error) {
    return {
      ok: false,
      message: "Peserta belum dapat dicari. Silakan coba kembali.",
    };
  }

  const combinedRows = [
    ...(memberResult.data ?? []),
    ...(nameResult.data ?? []),
  ];
  const uniqueRows = new Map<string, unknown>();

  for (const row of combinedRows) {
    if (typeof row === "object" && row !== null && "id" in row) {
      const id = (row as { id?: unknown }).id;

      if (typeof id === "string") {
        uniqueRows.set(id, row);
      }
    }
  }

  return parseParticipantRows(Array.from(uniqueRows.values()).slice(0, 10));
}

function parseParticipantRows(rows: unknown[] | null): ParticipantRowsResult {
  const parsedRows = (rows ?? []).map((row) =>
    databaseParticipantRowSchema.safeParse(row),
  );

  if (parsedRows.some((result) => !result.success)) {
    return {
      ok: false,
      message: "Data peserta belum dapat diproses. Silakan coba kembali.",
    };
  }

  const validRows: DatabaseParticipantRow[] = [];

  for (const result of parsedRows) {
    if (!result.success) {
      return {
        ok: false,
        message: "Data peserta belum dapat diproses. Silakan coba kembali.",
      };
    }

    validRows.push(result.data);
  }

  return {
    ok: true,
    rows: validRows,
  };
}

export async function searchManualParticipants(
  previousState: ManualSearchState,
  formData: FormData,
): Promise<ManualSearchState> {
  void previousState;

  const profile = await getAuthorizedProfile("scanner.checkin");
  if (!profile) {
    return searchError("Anda tidak memiliki akses untuk melakukan check-in manual.");
  }
  const parsedInput = manualSearchInputSchema.safeParse({
    stationId: readFormString(formData, "stationId"),
    query: readFormString(formData, "query") ?? "",
  });

  if (!parsedInput.success) {
    return searchError("Pencarian peserta tidak valid.");
  }

  const { stationId, query } = parsedInput.data;
  const contextResult = await loadAuthorizedManualStationContext(
    profile,
    stationId,
  );

  if (contextResult.error) {
    return searchError(contextResult.error.message);
  }

  if (query === "") {
    return searchError("Masukkan nama atau Registration ID peserta.");
  }

  try {
    const participantResult = await getParticipantRows(query);

    if (!participantResult.ok) {
      return searchError(participantResult.message);
    }

    const participantIds = participantResult.rows.map(
      (participant) => participant.id,
    );
    const attendanceByParticipant = new Map<string, string>();

    if (participantIds.length > 0) {
      const adminSupabase = createAdminClient();
      const { data: attendanceRows, error: attendanceError } =
        await adminSupabase
          .from("attendance")
          .select("participant_id, check_in_time")
          .eq("session_id", contextResult.context.sessionId)
          .in("participant_id", participantIds);

      if (attendanceError) {
        return searchError(
          "Status kehadiran peserta belum dapat diperiksa. Silakan coba kembali.",
        );
      }

      for (const row of attendanceRows ?? []) {
        if (
          typeof row.participant_id === "string" &&
          typeof row.check_in_time === "string"
        ) {
          attendanceByParticipant.set(row.participant_id, row.check_in_time);
        }
      }
    }

    return {
      status: "success",
      message: null,
      results: participantResult.rows.map((participant) =>
        safeSearchParticipant(
          participant,
          attendanceByParticipant.get(participant.id) ?? null,
        ),
      ),
    };
  } catch {
    return searchError("Peserta belum dapat dicari. Silakan coba kembali.");
  }
}

function rpcParticipant(
  row: RpcResult,
  status: ManualCheckInState["status"],
): ManualParticipant | null {
  if (
    row.registration_id === null ||
    row.full_name === null
  ) {
    return null;
  }

  return {
    registrationId: row.registration_id,
    fullName: row.full_name,
    institution: row.institution,
    participantCategory: row.participant_category,
    registrationStatus:
      status === "cancelled-participant" ? "CANCELLED" : "REGISTERED",
    alreadyCheckedIn: status === "already-checked-in",
    checkedInAt: row.checked_at,
  };
}

function rpcSession(row: RpcResult): ManualSession | null {
  if (row.session_code === null || row.session_name === null) {
    return null;
  }

  return {
    code: row.session_code,
    name: row.session_name,
  };
}

function completedCheckInState(
  row: RpcResult,
  status: Extract<
    ManualCheckInState["status"],
    "success" | "success-with-warning" | "already-checked-in" | "cancelled-participant"
  >,
  message: string,
): ManualCheckInState {
  const participant = rpcParticipant(row, status);
  const session = rpcSession(row);
  const requiresCheckedAt = status !== "cancelled-participant";

  if (
    !participant ||
    !session ||
    (requiresCheckedAt && row.checked_at === null)
  ) {
    return checkInError(
      "Hasil check-in belum dapat diproses. Silakan coba kembali.",
      "internal-error",
    );
  }

  return {
    status,
    message,
    errorCode: null,
    participant,
    session,
    checkedAt: row.checked_at,
  };
}

function mapRpcResult(row: RpcResult): ManualCheckInState {
  switch (row.status_code) {
    case "success":
      return completedCheckInState(row, "success", "Check-in berhasil.");
    case "success-with-warning":
      return completedCheckInState(
        row,
        "success-with-warning",
        "Peserta belum tercatat pada sesi kedatangan.",
      );
    case "already-checked-in":
      return completedCheckInState(
        row,
        "already-checked-in",
        "Peserta sudah check-in pada sesi ini.",
      );
    case "cancelled-participant":
      return completedCheckInState(
        row,
        "cancelled-participant",
        "Pendaftaran peserta telah dibatalkan.",
      );
    case "unauthorized-operator":
      return checkInError("Akses tidak diizinkan.", "unauthorized-operator");
    case "invalid-station":
      return checkInError("Station tidak siap digunakan.", "invalid-station");
    case "station-not-paired":
      return checkInError("Station tidak siap digunakan.", "station-not-paired");
    case "station-owned-by-other-operator":
      return checkInError(
        "Station tidak siap digunakan.",
        "station-owned-by-other-operator",
      );
    case "closed-session":
      return checkInError(
        "Sesi belum dibuka atau telah ditutup.",
        "closed-session",
      );
    case "participant-not-found":
      return checkInError("Peserta tidak ditemukan.", "participant-not-found");
    case "invalid-request":
      return checkInError("Data check-in tidak valid.", "invalid-request");
    default:
      return checkInError(
        "Terjadi kendala saat memproses check-in. Silakan coba kembali.",
        "internal-error",
      );
  }
}

function contextErrorCode(
  code:
    | "invalid-profile"
    | "invalid-station"
    | "station-closed"
    | "station-not-paired"
    | "station-owned-by-other-operator"
    | "closed-session"
    | "internal-error",
): ManualCheckInErrorCode {
  switch (code) {
    case "invalid-profile":
      return "unauthorized-operator";
    case "station-closed":
      return "invalid-station";
    case "station-not-paired":
      return "station-not-paired";
    case "station-owned-by-other-operator":
      return "station-owned-by-other-operator";
    case "closed-session":
      return "closed-session";
    case "invalid-station":
      return "invalid-station";
    case "internal-error":
      return "internal-error";
  }
}

export async function processManualCheckIn(
  previousState: ManualCheckInState,
  formData: FormData,
): Promise<ManualCheckInState> {
  void previousState;

  const profile = await getAuthorizedProfile("scanner.checkin");
  if (!profile) {
    return checkInError("Anda tidak memiliki akses untuk melakukan check-in manual.", "unauthorized-operator");
  }
  const parsedInput = manualCheckInInputSchema.safeParse({
    stationId: readFormString(formData, "stationId"),
    registrationId: readFormString(formData, "registrationId"),
  });

  if (!parsedInput.success) {
    return checkInError("Data check-in tidak valid.", "invalid-request");
  }

  const { stationId, registrationId } = parsedInput.data;
  const contextResult = await loadAuthorizedManualStationContext(
    profile,
    stationId,
  );

  if (contextResult.error) {
    return checkInError(
      contextResult.error.message,
      contextErrorCode(contextResult.error.code),
    );
  }

  try {
    const adminSupabase = createAdminClient();
    const { data, error } = await adminSupabase.rpc(
      "process_manual_check_in",
      {
        p_registration_id: registrationId,
        p_station_id: stationId,
        p_operator_profile_id: profile.id,
      },
    );

    if (error) {
      console.error("Manual check-in processing failed");
      return checkInError(
        "Terjadi kendala saat memproses check-in. Silakan coba kembali.",
        "internal-error",
      );
    }

    const rpcRow = Array.isArray(data) ? data[0] : data;
    const parsedResult = rpcResultSchema.safeParse(rpcRow);

    if (!parsedResult.success) {
      console.error("Manual check-in returned an invalid result");
      return checkInError(
        "Hasil check-in belum dapat diproses. Silakan coba kembali.",
        "internal-error",
      );
    }

    const result = mapRpcResult(parsedResult.data);

    if (
      result.status === "success" ||
      result.status === "success-with-warning"
    ) {
      revalidatePath("/admin/dashboard");
      revalidatePath(`/admin/scanner/${stationId}/manual`);
    }

    return result;
  } catch {
    console.error("Manual check-in processing failed");
    return checkInError(
      "Terjadi kendala saat memproses check-in. Silakan coba kembali.",
      "internal-error",
    );
  }
}
