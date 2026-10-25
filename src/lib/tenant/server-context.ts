import "server-only";

import { cookies } from "next/headers";

import { createClient } from "@/lib/supabase/server";

export const ACTIVE_EVENT_COOKIE = "akkai-active-event";

export type TenantRole =
  | "ADMIN"
  | "OPERATOR"
  | "REGISTRATION"
  | "OPERATIONAL"
  | "SCANNER"
  | "SUPER_ADMIN";

export type AccessibleEvent = {
  id: string;
  companyId: string;
  companyName: string;
  companySlug: string;
  eventName: string;
  eventSlug: string;
  eventCode: string;
  registrationOpen: boolean;
  role: TenantRole;
};

export type ActiveTenantContext = AccessibleEvent & {
  profileId: string;
};

type TenantSession = {
  profileId: string;
  isSuperAdmin: boolean;
  events: AccessibleEvent[];
};

function isTenantRole(value: unknown): value is TenantRole {
  return (
    value === "ADMIN" ||
    value === "OPERATOR" ||
    value === "REGISTRATION" ||
    value === "OPERATIONAL" ||
    value === "SCANNER" ||
    value === "SUPER_ADMIN"
  );
}

async function loadTenantSession(): Promise<TenantSession | null> {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const profileId = claimsData?.claims?.sub;

  if (claimsError || typeof profileId !== "string") {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", profileId)
    .maybeSingle();

  if (profileError || !profile || profile.is_active !== true || !isTenantRole(profile.role)) {
    return null;
  }

  const isSuperAdmin = profile.role === "SUPER_ADMIN";
  const { data: memberships, error: membershipsError } = isSuperAdmin
    ? { data: [], error: null }
    : await supabase
        .from("company_memberships")
        .select("company_id, role")
        .eq("profile_id", profileId)
        .eq("is_active", true);

  if (membershipsError) {
    return null;
  }

  const companyIds = Array.from(
    new Set((memberships ?? []).map((membership) => membership.company_id as string)),
  );
  const eventQuery = supabase
    .from("events")
    .select("id, company_id, slug, event_code, name, registration_open, companies!inner(slug, name)")
    .order("starts_on", { ascending: false, nullsFirst: false });
  const { data: events, error: eventsError } = isSuperAdmin
    ? await eventQuery
    : companyIds.length > 0
      ? await eventQuery.in("company_id", companyIds)
      : { data: [], error: null };

  if (eventsError) {
    return null;
  }

  const membershipRoleByCompany = new Map(
    (memberships ?? []).map((membership) => [membership.company_id as string, membership.role]),
  );
  const accessibleEvents: AccessibleEvent[] = [];

  for (const event of events ?? []) {
    const company = event.companies as unknown as { slug: string; name: string } | null;
    const role = isSuperAdmin
      ? "SUPER_ADMIN"
      : membershipRoleByCompany.get(event.company_id);

    if (!company || !isTenantRole(role)) {
      continue;
    }

    accessibleEvents.push({
      id: event.id,
      companyId: event.company_id,
      companyName: company.name,
      companySlug: company.slug,
      eventName: event.name,
      eventSlug: event.slug,
      eventCode: event.event_code,
      registrationOpen: event.registration_open,
      role,
    });
  }

  return { profileId, isSuperAdmin, events: accessibleEvents };
}

export async function listAccessibleEvents() {
  const session = await loadTenantSession();
  return session?.events ?? [];
}

export async function resolveActiveTenantContext(): Promise<ActiveTenantContext | null> {
  const session = await loadTenantSession();
  if (!session || session.events.length === 0) {
    return null;
  }

  const selectedEventId = (await cookies()).get(ACTIVE_EVENT_COOKIE)?.value;
  const selectedEvent = selectedEventId
    ? session.events.find((event) => event.id === selectedEventId)
    : undefined;
  const event = selectedEvent ?? session.events[0];

  return { ...event, profileId: session.profileId };
}

export async function resolveGlobalAdminProfileId() {
  const session = await loadTenantSession();
  return session?.isSuperAdmin ? session.profileId : null;
}

export async function setActiveEventForCurrentUser(eventId: string) {
  const session = await loadTenantSession();
  if (!session?.events.some((event) => event.id === eventId)) {
    return false;
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_EVENT_COOKIE, eventId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  return true;
}
