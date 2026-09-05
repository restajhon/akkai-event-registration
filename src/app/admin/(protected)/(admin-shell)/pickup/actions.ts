"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getAuthorizedProfile } from "@/lib/auth/server";
import type { AssignmentActionState } from "@/lib/admin/assignment-action-state";
import { createAdminClient } from "@/lib/supabase/admin";

const pickupInputSchema = z
  .object({
    registrationId: z.string().trim().regex(/^AKKAI26-[0-9]{6}$/),
    transferType: z.enum(["ARRIVAL", "DEPARTURE"]),
    status: z.enum(["SCHEDULED", "COMPLETED", "CANCELLED"]),
    pickupPoint: z.string().trim().max(150),
    dropoffPoint: z.string().trim().max(150),
    vehicleLabel: z.string().trim().max(100),
    notes: z.string().trim().max(500),
  })
  .superRefine((data, context) => {
    if (
      data.status !== "CANCELLED" &&
      ((data.transferType === "ARRIVAL" && !data.pickupPoint) ||
        (data.transferType === "DEPARTURE" && !data.dropoffPoint))
    ) {
      context.addIssue({
        code: "custom",
        path: [data.transferType === "DEPARTURE" ? "dropoffPoint" : "pickupPoint"],
        message:
          data.transferType === "DEPARTURE"
            ? "Pickup kepulangan memerlukan titik antar."
            : "Pickup kedatangan memerlukan titik jemput.",
      });
    }
  });

function readString(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function errorState(message: string): AssignmentActionState {
  return { status: "error", message };
}

export async function upsertPickupAssignment(
  previousState: AssignmentActionState,
  formData: FormData,
): Promise<AssignmentActionState> {
  void previousState;

  const profile = await getAuthorizedProfile("pickup.manage");
  if (!profile) {
    return errorState("Anda tidak memiliki akses untuk mengubah assignment pickup.");
  }
  const parsed = pickupInputSchema.safeParse({
    registrationId: readString(formData, "registrationId"),
    transferType: readString(formData, "transferType"),
    status: readString(formData, "status"),
    pickupPoint: readString(formData, "pickupPoint"),
    dropoffPoint: readString(formData, "dropoffPoint"),
    vehicleLabel: readString(formData, "vehicleLabel"),
    notes: readString(formData, "notes"),
  });

  if (!parsed.success) {
    return errorState("Data pickup tidak valid. Periksa kembali isian.");
  }

  const values = parsed.data;
  const isCancelled = values.status === "CANCELLED";

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc(
      "upsert_participant_pickup_assignment",
      {
        p_registration_id: values.registrationId,
        p_transfer_type: values.transferType,
        p_status: values.status,
        p_pickup_at: null,
        p_pickup_point: isCancelled || values.transferType === "DEPARTURE" ? null : values.pickupPoint || null,
        p_dropoff_point: isCancelled || values.transferType === "ARRIVAL" ? null : values.dropoffPoint || null,
        p_vehicle_label: isCancelled ? null : values.vehicleLabel || null,
        p_pic_driver: null,
        p_notes: isCancelled ? null : values.notes || null,
        p_updated_by: profile.id,
      },
    );

    if (error || !data) {
      return errorState("Assignment pickup belum dapat disimpan. Silakan coba kembali.");
    }

    const result = (Array.isArray(data) ? data[0] : data) as
      | { result_code: string }
      | undefined;

    if (result?.result_code === "SAVED") {
      revalidatePath("/admin/pickup");
      revalidatePath(`/admin/pickup/${values.registrationId}`);
      revalidatePath("/admin/participants");

      return {
        status: "success",
        message:
          values.status === "CANCELLED"
            ? "Assignment pickup ditandai dibatalkan."
            : "Assignment pickup berhasil disimpan.",
      };
    }

    if (result?.result_code === "NOT_FOUND") {
      return errorState("Peserta tidak ditemukan.");
    }

    if (result?.result_code === "PARTICIPANT_NOT_ACTIVE") {
      return errorState("Peserta yang dibatalkan tidak dapat diberi assignment.");
    }

    if (result?.result_code === "UNAUTHORIZED") {
      return errorState("Anda tidak memiliki akses untuk mengubah assignment pickup.");
    }

    return errorState("Assignment pickup belum dapat disimpan. Silakan coba kembali.");
  } catch {
    return errorState("Assignment pickup belum dapat disimpan. Silakan coba kembali.");
  }
}
