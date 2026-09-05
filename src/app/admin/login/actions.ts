"use server";

import { redirect } from "next/navigation";

import { getCurrentUserProfile } from "@/lib/auth/server";
import { getDefaultAdminRoute } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

export type LoginState = {
  error: string | null;
};

const genericLoginError = "Email atau password tidak sesuai.";

export async function signIn(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: genericLoginError };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: genericLoginError };
  }

  const profile = await getCurrentUserProfile();
  if (!profile) {
    redirect("/api/auth/cleanup");
  }

  redirect(getDefaultAdminRoute(profile.role));
}
