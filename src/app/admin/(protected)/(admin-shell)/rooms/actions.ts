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
    roomType: z.string().trim().max(100),
    checkInDate: z.string().trim(),
    checkOutDate: z.string().trim(),
    notes: z.string().trim().max(500),
    clear: z.boolean(),
  })
  .superRefine((data, context) => {
    for (const [field, value] of [
      ["checkInDate", data.checkInDate],
      ["checkOutDate", data.checkOutDate],
    ] as const) {
      if (value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !isValidDate(value))) {
        context.addIssue({ code: "custom", path: [field], message: "Tanggal tidak valid." });
      }
    }

    if (
      data.checkInDate &&
      data.checkOutDate &&
      data.checkOutDate < data.checkInDate
    ) {
      context.addIssue({
        code: "custom",
        path: ["checkOutDate"],
        message: "Tanggal check-out tidak boleh sebelum check-in.",
      });
    }
  });

function isValidDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

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
    roomType: readString(formData, "roomType"),
    checkInDate: readString(formData, "checkInDate"),
    checkOutDate: readString(formData, "checkOutDate"),
    notes: readString(formData, "notes"),
    clear: readString(formData, "clear") === "true",
  });

  if (!parsed.success) {
    return errorState("Data kamar tidak valid. Periksa kembali isian.");
  }

  const values = parsed.data;
  const roomNumber = values.clear ? null : values.roomNumber || null;
  const roomType = values.clear ? null : values.roomType || null;
  const checkInDate = values.clear ? null : values.checkInDate || null;
  const checkOutDate = values.clear ? null : values.checkOutDate || null;
  const notes = values.clear ? null : values.notes || null;

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc(
      "upsert_participant_room_assignment",
      {
        p_registration_id: values.registrationId,
        p_room_number: roomNumber,
        p_room_type: roomType,
        p_check_in_date: checkInDate,
        p_check_out_date: checkOutDate,
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
