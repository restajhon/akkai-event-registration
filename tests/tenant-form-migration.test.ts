import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(
  process.cwd(),
  "supabase/migrations/20261022110000_add_company_event_tenancy_and_registration_forms.sql",
), "utf8");

const eventScopedTables = [
  "sessions",
  "participants",
  "scanner_stations",
  "attendance",
  "scan_events",
  "email_logs",
  "participant_travel",
  "participant_room_assignments",
  "participant_pickup_assignments",
  "registration_batches",
  "member_meeting_participants",
  "participant_email_changes",
  "member_meeting_upload_intents",
  "registration_submission_idempotency_keys",
  "participant_registration_status_changes",
  "registration_certificate_upload_intents",
  "registration_documents",
  "registration_billings",
  "registration_billing_email_logs",
  "member_meeting_submissions",
];

describe("company/event tenancy migration", () => {
  it("backfills the existing AKKAI records without replacing participant IDs or records", () => {
    expect(migration).toContain("VALUES ('akkai', 'Asosiasi Konsultan Aktuaria Indonesia')");
    expect(migration).toContain("'akkai-2026', 'AKKAI26'");
    expect(migration).toContain("UPDATE public.participants SET event_id = public.current_registration_event_id()");
    expect(migration).toContain("INSERT INTO public.company_memberships");
    expect(migration).toContain("profile.role::text <> 'SUPER_ADMIN'");
    expect(migration).not.toMatch(/\b(?:TRUNCATE|DELETE FROM|DROP TABLE)\s+(?:public\.)?participants\b/i);
  });

  it.each(eventScopedTables)("adds ownership and RLS to %s", (table) => {
    expect(migration).toContain(`ALTER TABLE public.${table} ADD COLUMN event_id uuid`);
    expect(migration).toContain(`'${table}'`);
    expect(migration).toContain("v_table || '_event_id_fkey'");
    expect(migration).toContain("v_table || '_tenant_select'");
  });

  it("keeps form versions and submission answers immutable and event-linked", () => {
    expect(migration).toContain("registration_forms_published_version_event_fkey");
    expect(migration).toContain("registration_form_submissions_form_version_event_fkey");
    expect(migration).toContain("registration_form_submissions_participant_event_fkey");
    expect(migration).toContain("registration_form_versions_immutable");
    expect(migration).toContain("registration_form_submissions_immutable");
    expect(migration).toContain("registration_form_submissions_answers_object");
    expect(migration).toContain("CREATE TABLE public.registration_legacy_participant_backfill");
    expect(migration).toContain("'legacy:' || legacy.participant_id::text");
    expect(migration).toContain("legacy.privacy_consent_at IS NOT NULL");
    expect(migration).not.toMatch(/'privacy_consent',\s*true/);
  });

  it("only exposes published versions to public clients and guards publication by event membership", () => {
    expect(migration).toContain("registration_form_versions_public_published_select");
    expect(migration).toContain("public.is_current_published_registration_form_version(event_id, id)");
    expect(migration).toContain("public.has_event_permission(p_updated_by, p_event_id, 'forms.manage')");
    expect(migration).toContain("public.has_event_permission(p_published_by, p_event_id, 'forms.manage')");
    expect(migration).not.toContain("set_event_registration_open(uuid, boolean) FROM");
  });

  it("supports global Super Admin tenant management and event-scoped participant IDs", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.create_company_with_event(");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.create_event_for_company(");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.upsert_company_membership(");
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.create_participant_with_registration_reservation_v5\([\s\S]*?FROM PUBLIC, anon, authenticated, service_role;/);
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.create_participant_with_registration_reservation_v6\([\s\S]*?FROM PUBLIC, anon, authenticated, service_role;/);
    expect(migration).toContain("profile.role::text = 'SUPER_ADMIN'");
    expect(migration).toContain("'^[A-Z0-9]{2,16}-[0-9]{6}$'");
    expect(migration).toContain("public.has_event_permission(p_changed_by, v_participant.event_id, v_permission)");
    expect(migration).toContain("v_registration_id !~ ''^[A-Z0-9]{2,16}-[0-9]{6}$''");
  });

  it("scopes scanner and dashboard realtime topics through their event-owned rows", () => {
    expect(migration).toContain("DROP POLICY IF EXISTS live_display_broadcast_select ON realtime.messages");
    expect(migration).toContain("session.id::text = substring(realtime.topic() FROM '^akkai:dashboard:");
    expect(migration).toContain("station.id::text = substring(realtime.topic() FROM '^akkai:display:station:");
    expect(migration).toContain("public.has_event_permission((SELECT auth.uid()), station.event_id, 'display.view')");
  });
});
