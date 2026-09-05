import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

import type { ParticipantExportRow } from "./revision-exports";

export async function loadParticipantExportRows() {
  const { data, error } = await createAdminClient()
    .from("participants")
    .select("registration_id, full_name, email, phone_number, package_type, participation_scope, actuarial_consultant_status, attends_pai_congress, polo_size, registration_status")
    .order("created_at", { ascending: false });

  if (error) {
    return null;
  }

  return (data ?? []) as ParticipantExportRow[];
}
