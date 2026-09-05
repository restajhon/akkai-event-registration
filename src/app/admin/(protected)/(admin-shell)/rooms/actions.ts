"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/lib/auth/server";
import type { AssignmentActionState } from "@/lib/admin/assignment-action-state";
import { createAdminClient } from "@/lib/supabase/admin";

const roomInputSchema = z
  .object({
    registrationId: z.string().trim().regex(/^AKKAI26-[0-9]{6}$/),
    roomNumber: z.string().trim().max(50),
    notes: z.string().trim().max(500),
    clear: z.boolean(),
  });

function readString(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function errorState(message: string): AssignmentActionState {
  return { status: "error", message };
}

export async function upsertRoomAssignment(
  previousState: AssignmentActionState,
  formData: FormData,
): Promise<AssignmentActionState> {
  void previousState;

  const profile = await requireRole(["ADMIN"]);
  const parsed = roomInputSchema.safeParse({
    registrationId: readString(formData, "registrationId"),
    roomNumber: readString(formData, "roomNumber"),
    notes: readString(formData, "notes"),
    clear: readString(formData, "clear") === "true",
  });

  if (!parsed.success) {
    return errorState("Data kamar tidak valid. Periksa kembali isian.");
  }

  const values = parsed.data;
  const roomNumber = values.clear ? null : values.roomNumber || null;
  const notes = values.clear ? null : values.notes || null;

  try {
    const supabase = createAdminClient();
    const { data: participant } = await supabase
      .from("participants")
      .select("id, package_type")
      .eq("registration_id", values.registrationId)
      .maybeSingle();

    if (!participant) {
      return errorState("Peserta tidak ditemukan.");
    }

    const { data: currentAssignment } = await supabase
      .from("participant_room_assignments")
      .select("check_in_date, check_out_date")
      .eq("participant_id", participant.id)
      .maybeSingle();

    const existing = currentAssignment as {
      check_in_date: string | null;
      check_out_date: string | null;
    } | null;
    const { data, error } = await supabase.rpc(
      "upsert_participant_room_assignment",
      {
        p_registration_id: values.registrationId,
        p_room_number: roomNumber,
        p_room_type: values.clear ? null : participant.package_type,
        p_check_in_date: values.clear ? null : existing?.check_in_date ?? null,
        p_check_out_date: values.clear ? null : existing?.check_out_date ?? null,
        p_notes: notes,
        p_updated_by: profile.id,
      },
    );

    if (error || !data) {
      return errorState("Assignment kamar belum dapat disimpan. Silakan coba kembali.");
    }

    const result = (Array.isArray(data) ? data[0] : data) as
      | { result_code: string }
      | undefined;

    if (result?.result_code === "SAVED") {
      revalidatePath("/admin/rooms");
      revalidatePath(`/admin/rooms/${values.registrationId}`);
      revalidatePath("/admin/participants");

      return {
        status: "success",
        message: values.clear
          ? "Assignment kamar dikosongkan."
          : "Assignment kamar berhasil disimpan.",
      };
    }

    if (result?.result_code === "NOT_FOUND") {
      return errorState("Peserta tidak ditemukan.");
    }

    if (result?.result_code === "PARTICIPANT_NOT_ACTIVE") {
      return errorState("Peserta yang dibatalkan tidak dapat diberi assignment.");
    }

    if (result?.result_code === "UNAUTHORIZED") {
      return errorState("Anda tidak memiliki akses untuk mengubah assignment kamar.");
    }

    return errorState("Assignment kamar belum dapat disimpan. Silakan coba kembali.");
  } catch {
    return errorState("Assignment kamar belum dapat disimpan. Silakan coba kembali.");
  }
}
