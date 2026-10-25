"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getAuthorizedProfile } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";

const slugPattern = /^[a-z0-9][a-z0-9-]{1,62}$/;
const eventCodePattern = /^[A-Z0-9]{2,16}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const membershipRoles = ["ADMIN", "OPERATIONAL", "REGISTRATION", "OPERATOR", "SCANNER"] as const;

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readDate(formData: FormData, key: string) {
  const value = readString(formData, key);
  return value === "" ? null : /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

async function requireSuperAdmin() {
  const profile = await getAuthorizedProfile("access.manage");
  if (!profile?.is_active || profile.role !== "SUPER_ADMIN") redirect("/admin/unauthorized");
  return profile;
}

function redirectWithMessage(kind: "success" | "error", message: string): never {
  redirect(`/admin/tenants?${kind}=${encodeURIComponent(message)}`);
}

export async function createCompanyWithEvent(formData: FormData) {
  const actor = await requireSuperAdmin();
  const companySlug = readString(formData, "companySlug").toLowerCase();
  const companyName = readString(formData, "companyName");
  const eventSlug = readString(formData, "eventSlug").toLowerCase();
  const eventCode = readString(formData, "eventCode").toUpperCase();
  const eventName = readString(formData, "eventName");
  const startsOn = readDate(formData, "startsOn");
  const endsOn = readDate(formData, "endsOn");

  if (!slugPattern.test(companySlug) || !slugPattern.test(eventSlug) || !eventCodePattern.test(eventCode)
    || companyName.length < 2 || companyName.length > 150 || eventName.length < 2 || eventName.length > 200
    || startsOn === undefined || endsOn === undefined || (startsOn && endsOn && endsOn < startsOn)) {
    redirectWithMessage("error", "Periksa kembali data perusahaan dan event.");
  }

  let failed = false;
  try {
    const { error } = await createAdminClient({ scope: "global" }).rpc("create_company_with_event", {
      p_actor_id: actor.id,
      p_company_slug: companySlug,
      p_company_name: companyName,
      p_event_slug: eventSlug,
      p_event_code: eventCode,
      p_event_name: eventName,
      p_starts_on: startsOn,
      p_ends_on: endsOn,
    });
    failed = Boolean(error);
  } catch {
    failed = true;
  }
  if (failed) redirectWithMessage("error", "Perusahaan/event belum dapat dibuat. Periksa slug, kode, dan duplikasi data.");

  revalidatePath("/admin/tenants");
  redirectWithMessage("success", "Perusahaan dan event berhasil dibuat.");
}

export async function createEventForCompany(formData: FormData) {
  const actor = await requireSuperAdmin();
  const companyId = readString(formData, "companyId");
  const eventSlug = readString(formData, "eventSlug").toLowerCase();
  const eventCode = readString(formData, "eventCode").toUpperCase();
  const eventName = readString(formData, "eventName");
  const startsOn = readDate(formData, "startsOn");
  const endsOn = readDate(formData, "endsOn");

  if (!uuidPattern.test(companyId) || !slugPattern.test(eventSlug) || !eventCodePattern.test(eventCode)
    || eventName.length < 2 || eventName.length > 200 || startsOn === undefined || endsOn === undefined
    || (startsOn && endsOn && endsOn < startsOn)) {
    redirectWithMessage("error", "Periksa kembali data event.");
  }

  let failed = false;
  try {
    const { error } = await createAdminClient({ scope: "global" }).rpc("create_event_for_company", {
      p_actor_id: actor.id,
      p_company_id: companyId,
      p_event_slug: eventSlug,
      p_event_code: eventCode,
      p_event_name: eventName,
      p_starts_on: startsOn,
      p_ends_on: endsOn,
    });
    failed = Boolean(error);
  } catch {
    failed = true;
  }
  if (failed) redirectWithMessage("error", "Event belum dapat dibuat. Periksa slug, kode, dan duplikasi data.");

  revalidatePath("/admin/tenants");
  redirectWithMessage("success", "Event berhasil ditambahkan ke perusahaan.");
}

export async function upsertCompanyMembership(formData: FormData) {
  const actor = await requireSuperAdmin();
  const profileId = readString(formData, "profileId");
  const companyId = readString(formData, "companyId");
  const role = readString(formData, "role");
  const isActive = readString(formData, "isActive") === "true";

  if (!uuidPattern.test(profileId) || !uuidPattern.test(companyId)
    || !membershipRoles.includes(role as (typeof membershipRoles)[number])) {
    redirectWithMessage("error", "Pengguna, perusahaan, atau role membership tidak valid.");
  }

  let failed = false;
  try {
    const { error } = await createAdminClient({ scope: "global" }).rpc("upsert_company_membership", {
      p_actor_id: actor.id,
      p_profile_id: profileId,
      p_company_id: companyId,
      p_role: role,
      p_is_active: isActive,
    });
    failed = Boolean(error);
  } catch {
    failed = true;
  }
  if (failed) redirectWithMessage("error", "Membership belum dapat disimpan.");

  revalidatePath("/admin/tenants");
  redirectWithMessage("success", "Membership perusahaan berhasil disimpan.");
}
