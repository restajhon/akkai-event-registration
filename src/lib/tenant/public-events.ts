import "server-only";

import {
  validateRegistrationFormConfig,
  type RegistrationFormConfig,
} from "@/lib/forms/form-schema";
import { createClient } from "@/lib/supabase/server";

export type PublishedEventForm = {
  eventId: string;
  companyId: string;
  eventSlug: string;
  eventCode: string;
  eventName: string;
  startsOn: string | null;
  endsOn: string | null;
  versionId: string;
  versionNumber: number;
  config: RegistrationFormConfig;
};

export async function loadPublishedEventForm(eventSlug: string): Promise<PublishedEventForm | null> {
  const safeSlug = eventSlug.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(safeSlug)) return null;

  try {
    const supabase = await createClient();
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, company_id, slug, event_code, name, starts_on, ends_on, registration_open")
      .eq("slug", safeSlug)
      .maybeSingle();

    if (eventError || !event || event.registration_open !== true) return null;

    const { data: version, error: versionError } = await supabase
      .from("registration_form_versions")
      .select("id, version_number, config")
      .eq("event_id", event.id)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (versionError || !version) return null;
    const { data: isCurrentVersion, error: currentVersionError } = await supabase.rpc(
      "is_current_published_registration_form_version",
      { p_event_id: event.id, p_version_id: version.id },
    );
    if (currentVersionError || isCurrentVersion !== true) return null;

    const config = validateRegistrationFormConfig(version.config);
    if (!config.success) return null;

    return {
      eventId: event.id,
      companyId: event.company_id,
      eventSlug: event.slug,
      eventCode: event.event_code,
      eventName: event.name,
      startsOn: event.starts_on,
      endsOn: event.ends_on,
      versionId: version.id,
      versionNumber: version.version_number,
      config: config.data,
    };
  } catch {
    return null;
  }
}

/** Loads the exact currently published version posted by a public form. */
export async function loadPublishedEventFormById(eventId: string, versionId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(eventId) || !/^[0-9a-f-]{36}$/i.test(versionId)) return null;

  try {
    const supabase = await createClient();
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, company_id, slug, event_code, name, starts_on, ends_on, registration_open")
      .eq("id", eventId)
      .maybeSingle();
    if (eventError || !event || event.registration_open !== true) return null;

    const { data: isCurrentVersion, error: currentVersionError } = await supabase.rpc(
      "is_current_published_registration_form_version",
      { p_event_id: event.id, p_version_id: versionId },
    );
    if (currentVersionError || isCurrentVersion !== true) return null;

    const { data: version, error: versionError } = await supabase
      .from("registration_form_versions")
      .select("id, version_number, config")
      .eq("event_id", event.id)
      .eq("id", versionId)
      .maybeSingle();
    if (versionError || !version) return null;

    const config = validateRegistrationFormConfig(version.config);
    if (!config.success) return null;

    return {
      eventId: event.id,
      companyId: event.company_id,
      eventSlug: event.slug,
      eventCode: event.event_code,
      eventName: event.name,
      startsOn: event.starts_on,
      endsOn: event.ends_on,
      versionId: version.id,
      versionNumber: version.version_number,
      config: config.data,
    } satisfies PublishedEventForm;
  } catch {
    return null;
  }
}

export async function isPublishedRegistrationEvent(eventId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(eventId)) return false;
  const supabase = await createClient();
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, registration_open")
    .eq("id", eventId)
    .maybeSingle();
  if (eventError || !event || event.registration_open !== true) return false;

  const { data: version, error: versionError } = await supabase
    .from("registration_form_versions")
    .select("id")
    .eq("event_id", eventId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  return !versionError && Boolean(version);
}
