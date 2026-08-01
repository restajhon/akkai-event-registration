import "server-only";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type UserRole = "ADMIN" | "OPERATOR";

export type UserProfile = {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
};

const profileColumns = "id, full_name, email, role, is_active";

function isUserRole(value: unknown): value is UserRole {
  return value === "ADMIN" || value === "OPERATOR";
}

/**
 * Verifies the current identity and reads its profile through normal SSR RLS.
 * It deliberately does not use the privileged admin client.
 */
export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();

  const userId = claimsData?.claims?.sub;
  if (claimsError || typeof userId !== "string") {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(profileColumns)
    .eq("id", userId)
    .maybeSingle();

  if (
    profileError ||
    !profile ||
    profile.is_active !== true ||
    !isUserRole(profile.role)
  ) {
    return null;
  }

  return {
    id: profile.id,
    full_name: profile.full_name,
    email: profile.email,
    role: profile.role,
    is_active: profile.is_active,
  };
}

/**
 * Requires an active admin-area profile. Cleanup runs in a Route Handler so
 * the invalid session cookies can be removed reliably.
 */
export async function requireAuthenticatedUser(): Promise<UserProfile> {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/api/auth/cleanup");
  }

  return profile;
}

export async function requireRole(
  roles: UserRole | readonly UserRole[],
): Promise<UserProfile> {
  const profile = await requireAuthenticatedUser();
  const allowedRoles = Array.isArray(roles) ? roles : [roles];

  if (!allowedRoles.includes(profile.role)) {
    redirect("/admin/dashboard");
  }

  return profile;
}
