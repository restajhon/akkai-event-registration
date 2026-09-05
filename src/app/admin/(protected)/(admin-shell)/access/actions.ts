"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getAuthorizedProfile } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type AccessActionState = {
  status: "idle" | "success" | "error";
  message: string | null;
};

const roleSchema = z.enum([
  "ADMIN",
  "OPERATOR",
  "SUPER_ADMIN",
  "REGISTRATION",
  "OPERATIONAL",
  "SCANNER",
]);

export async function updateProfileAccess(
  _previousState: AccessActionState,
  formData: FormData,
): Promise<AccessActionState> {
  const actor = await getAuthorizedProfile("access.manage");
  if (!actor) {
    return {
      status: "error",
      message: "Anda tidak memiliki akses untuk mengelola akun.",
    };
  }

  const profileId = formData.get("profileId");
  const role = roleSchema.safeParse(formData.get("role"));
  const isActive = formData.get("isActive") === "true";

  if (typeof profileId !== "string" || !z.string().uuid().safeParse(profileId).success || !role.success) {
    return {
      status: "error",
      message: "Data akses tidak valid.",
    };
  }

  try {
    const { data, error } = await createAdminClient().rpc("update_profile_access", {
      p_actor_id: actor.id,
      p_target_id: profileId,
      p_role: role.data,
      p_is_active: isActive,
    });

    if (error) {
      return {
        status: "error",
        message: "Akses akun belum dapat diperbarui. Silakan coba kembali.",
      };
    }

    const result = Array.isArray(data) ? data[0] : data;

    switch (result) {
      case "UPDATED":
        revalidatePath("/admin/access");
        return { status: "success", message: "Akses akun berhasil diperbarui." };
      case "SELF_DEACTIVATE":
        return { status: "error", message: "Akun Anda sendiri tidak dapat dinonaktifkan." };
      case "SELF_LOCKOUT":
        return { status: "error", message: "Akun Anda sendiri harus tetap memiliki akses pengelolaan." };
      case "LAST_ACCESS_ADMIN":
        return { status: "error", message: "Setidaknya satu akun pengelola akses harus tetap aktif." };
      case "NOT_FOUND":
        return { status: "error", message: "Akun tidak ditemukan." };
      default:
        return {
          status: "error",
          message: "Akses akun belum dapat diperbarui. Silakan coba kembali.",
        };
    }
  } catch {
    return {
      status: "error",
      message: "Akses akun belum dapat diperbarui. Silakan coba kembali.",
    };
  }
}
