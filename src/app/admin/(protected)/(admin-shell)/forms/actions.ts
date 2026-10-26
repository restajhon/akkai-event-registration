"use server";

import { revalidatePath } from "next/cache";

import { getAuthorizedProfile } from "@/lib/auth/server";
import { validateRegistrationFormConfig } from "@/lib/forms/form-schema";
import { createAdminClient } from "@/lib/supabase/admin";

export type FormBuilderActionResult = { success: boolean; message: string };

export async function saveRegistrationFormDraft(configJson: string): Promise<FormBuilderActionResult> {
  const profile = await getAuthorizedProfile("forms.manage");
  if (!profile?.activeEventId) return { success: false, message: "Akses pengelolaan formulir tidak tersedia." };
  if (typeof configJson !== "string" || configJson.length > 100_000) {
    return { success: false, message: "Konfigurasi formulir terlalu besar." };
  }

  let input: unknown;
  try {
    input = JSON.parse(configJson) as unknown;
  } catch {
    return { success: false, message: "Konfigurasi formulir tidak valid." };
  }
  const config = validateRegistrationFormConfig(input);
  if (!config.success) {
    return { success: false, message: config.error.issues[0]?.message ?? "Konfigurasi formulir tidak valid." };
  }

  try {
    const { error } = await createAdminClient().rpc("save_registration_form_draft", {
      p_event_id: profile.activeEventId,
      p_config: config.data,
      p_updated_by: profile.id,
    });
    if (error) return { success: false, message: "Draft belum dapat disimpan. Silakan coba kembali." };
    revalidatePath("/admin/forms");
    return { success: true, message: "Draft formulir berhasil disimpan." };
  } catch {
    return { success: false, message: "Draft belum dapat disimpan. Silakan coba kembali." };
  }
}

export async function publishRegistrationFormDraft(): Promise<FormBuilderActionResult> {
  const profile = await getAuthorizedProfile("forms.manage");
  if (!profile?.activeEventId) return { success: false, message: "Akses pengelolaan formulir tidak tersedia." };

  try {
    const { data, error } = await createAdminClient().rpc("publish_registration_form_draft", {
      p_event_id: profile.activeEventId,
      p_published_by: profile.id,
    });
    if (error || !data) return { success: false, message: "Draft belum dapat diterbitkan. Periksa validasi formulir." };
    revalidatePath("/admin/forms");
    revalidatePath("/register");
    revalidatePath("/events/[eventSlug]/register", "page");
    return { success: true, message: "Versi formulir baru berhasil diterbitkan." };
  } catch {
    return { success: false, message: "Draft belum dapat diterbitkan. Periksa akses dan validasi formulir." };
  }
}

export async function setEventRegistrationOpen(open: boolean): Promise<FormBuilderActionResult> {
  const profile = await getAuthorizedProfile("forms.manage");
  if (!profile?.activeEventId) return { success: false, message: "Akses pengelolaan event tidak tersedia." };
  if (typeof open !== "boolean") return { success: false, message: "Status registrasi tidak valid." };

  try {
    const { data, error } = await createAdminClient().rpc("set_event_registration_open", {
      p_event_id: profile.activeEventId,
      p_open: open,
      p_updated_by: profile.id,
    });
    if (error || data !== true) return { success: false, message: "Status registrasi belum dapat diperbarui." };
    revalidatePath("/admin/forms");
    revalidatePath("/register");
    revalidatePath("/events/[eventSlug]/register", "page");
    return { success: true, message: open ? "Registrasi event dibuka." : "Registrasi event ditutup." };
  } catch {
    return { success: false, message: "Status registrasi belum dapat diperbarui." };
  }
}
