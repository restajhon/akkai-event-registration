"use server";

import { revalidatePath } from "next/cache";

import { getAuthorizedProfile } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type SessionActionState = {
  status: "idle" | "success" | "error";
  message: string | null;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function updateSessionStatus(
  previousState: SessionActionState,
  formData: FormData,
): Promise<SessionActionState> {
  void previousState;

  const profile = await getAuthorizedProfile("sessions.manage");

  if (!profile) {
    return {
      status: "error",
      message: "Anda tidak memiliki akses untuk mengubah sesi.",
    };
  }

  const sessionIdValue = formData.get("sessionId");
  const nextStatusValue = formData.get("nextStatus");

  if (
    typeof sessionIdValue !== "string" ||
    typeof nextStatusValue !== "string"
  ) {
    return {
      status: "error",
      message: "Sesi atau status tidak valid.",
    };
  }

  const sessionId = sessionIdValue.trim();
  const nextStatus = nextStatusValue.trim();

  if (
    !uuidPattern.test(sessionId) ||
    (nextStatus !== "OPEN" && nextStatus !== "CLOSED")
  ) {
    return {
      status: "error",
      message: "Sesi atau status tidak valid.",
    };
  }

  try {
    const supabase = await createClient();
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("id")
      .eq("id", sessionId)
      .maybeSingle();

    if (sessionError) {
      return {
        status: "error",
        message: "Terjadi kendala saat mengubah status sesi. Silakan coba kembali.",
      };
    }

    if (!session) {
      return {
        status: "error",
        message: "Sesi tidak ditemukan.",
      };
    }

    const adminSupabase = createAdminClient();
    const { data: updatedSession, error: updateError } = await adminSupabase
      .from("sessions")
      .update({ status: nextStatus })
      .eq("id", sessionId)
      .select("id")
      .maybeSingle();

    if (updateError) {
      return {
        status: "error",
        message: "Terjadi kendala saat mengubah status sesi. Silakan coba kembali.",
      };
    }

    if (!updatedSession) {
      return {
        status: "error",
        message: "Sesi tidak ditemukan.",
      };
    }
  } catch {
    return {
      status: "error",
      message: "Terjadi kendala saat mengubah status sesi. Silakan coba kembali.",
    };
  }

  revalidatePath("/admin/sessions");

  return {
    status: "success",
    message:
      nextStatus === "OPEN"
        ? "Sesi berhasil dibuka."
        : "Sesi berhasil ditutup.",
  };
}
