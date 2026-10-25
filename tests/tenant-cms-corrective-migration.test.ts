import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(
  process.cwd(),
  "supabase/migrations/20261023110000_harden_multi_tenant_registration_forms_and_rpcs.sql",
), "utf8");
const tenancyMigration = readFileSync(resolve(
  process.cwd(),
  "supabase/migrations/20261022110000_add_company_event_tenancy_and_registration_forms.sql",
), "utf8");
const collectiveV6Migration = readFileSync(resolve(
  process.cwd(),
  "supabase/migrations/20261004100000_fix_collective_registration_travel_constraint_target.sql",
), "utf8");
const registrationV5Migration = readFileSync(resolve(
  process.cwd(),
  "supabase/migrations/20260921140000_fix_registration_v5_ambiguous_participant_id.sql",
), "utf8");

describe("multi-tenant CMS corrective migration", () => {
  it("locks and verifies the collective certificate intent event before invoking v6", () => {
    const v8 = migration.match(
      /CREATE OR REPLACE FUNCTION public\.create_participant_with_registration_reservation_v8\([\s\S]*?\n\$\$;/,
    )?.[0];

    expect(v8).toBeDefined();
    expect(v8).toContain("SELECT intent.event_id INTO v_upload_event_id");
    expect(v8).toContain("WHERE intent.id = p_certificate_upload_intent_id");
    expect(v8).toContain("FOR UPDATE");
    expect(v8).toContain("v_upload_event_id IS DISTINCT FROM p_event_id");
    expect(v8!.indexOf("v_upload_event_id IS DISTINCT FROM p_event_id"))
      .toBeLessThan(v8!.indexOf("public.create_participant_with_registration_reservation_v6("));
    expect(v8!.indexOf("v_upload_event_id IS DISTINCT FROM p_event_id"))
      .toBeLessThan(v8!.indexOf("PERFORM set_config('app.registration_event_id'"));
  });

  it("uses a legacy version snapshot and preserves nullable historical answers", () => {
    const answerValidator = migration.match(
      /CREATE OR REPLACE FUNCTION public\.validate_registration_form_answers\([\s\S]*?\n\$\$;/,
    )?.[0];
    const normalizer = migration.match(
      /CREATE OR REPLACE FUNCTION public\.normalize_legacy_registration_submission_snapshot_20261023\([\s\S]*?\n\$\$;/,
    )?.[0];
    const existingSubmissionUpdate = migration.match(
      /UPDATE public\.registration_form_submissions AS submission[\s\S]*?WHERE submission\.id = repair\.submission_id;/,
    )?.[0];

    expect(migration).toContain("version_kind IN ('PUBLISHED', 'LEGACY_BACKFILL')");
    expect(migration).toContain("version_number = 0");
    expect(migration).toContain("'LEGACY_BACKFILL'");
    expect(migration).toContain("'{required}',\n          'false'::jsonb");
    expect(migration).toContain("registration_legacy_participant_backfill");
    expect(migration).toContain("'legacy:' || legacy.participant_id::text");
    expect(normalizer).toContain("p_answers jsonb");
    expect(normalizer).toContain("to_jsonb(v_answers->>'attends_pai_congress')");
    expect(normalizer).not.toContain("participant.");
    expect(normalizer).not.toContain("jsonb_strip_nulls");
    expect(existingSubmissionUpdate).toContain("submission.answers");
    expect(existingSubmissionUpdate).not.toContain("participant.full_name");
    expect(existingSubmissionUpdate).not.toContain("participant.email");
    expect(migration).toContain("public.validate_registration_form_answers(version.id, submission.answers)");
    expect(tenancyMigration).toContain("IF v_value IS NULL OR v_value = 'null'::jsonb THEN");
    expect(answerValidator).toContain("field->>'key' = v_key");
    expect(answerValidator).toContain("field->>'type' <> 'file'");
    expect(answerValidator).toContain("option_value = v_value #>> '{}'");
    expect(answerValidator).not.toContain("coalesce((field->>'system')::boolean, false) = false");
    expect(answerValidator!.indexOf("field->>'key' = v_key"))
      .toBeLessThan(answerValidator!.indexOf("FOR v_field IN SELECT value FROM jsonb_array_elements(v_fields)"));
  });

  it("keeps normal submission immutability and limits the repair exception to the migration owner", () => {
    expect(migration).toContain("current_user = 'postgres'");
    expect(migration).toContain("current_setting('app.allow_legacy_submission_repair', true) = 'on'");
    expect(migration).toContain("RAISE EXCEPTION 'Registration form submissions are immutable.'");
    expect(migration).not.toContain("DROP TRIGGER registration_form_submissions_immutable");
  });

  it("revokes service-role execution from obsolete participant reservation RPCs", () => {
    for (const functionName of [
      "create_participant_with_registration_reservation",
      "create_participant_with_registration_reservation_v2",
      "create_participant_with_registration_reservation_v3",
      "create_participant_with_registration_reservation_v4",
    ]) {
      const revokeBlock = migration.match(
        new RegExp(`REVOKE ALL ON FUNCTION public\\.${functionName}\\([\\s\\S]*?FROM PUBLIC, anon, authenticated, service_role;`),
      )?.[0];
      expect(revokeBlock, functionName).toBeDefined();
    }
  });

  it("keeps the intended service-role wrapper and SECURITY DEFINER internal call chain", () => {
    const v8 = migration.match(
      /CREATE OR REPLACE FUNCTION public\.create_participant_with_registration_reservation_v8\([\s\S]*?\n\$\$;/,
    )?.[0];
    expect(v8).toMatch(/SECURITY DEFINER/);
    expect(v8).toContain("FROM public.create_participant_with_registration_reservation_v6(");
    expect(migration).toMatch(/GRANT EXECUTE ON FUNCTION public\.create_participant_with_registration_reservation_v8\([\s\S]*?TO service_role;/);
    expect(collectiveV6Migration).toMatch(/SECURITY DEFINER[\s\S]*?FROM public\.create_participant_with_registration_reservation_v5\(/);
    expect(registrationV5Migration).toMatch(/SECURITY DEFINER[\s\S]*?FROM public\.create_participant_with_registration_reservation_v4\(/);
    expect(tenancyMigration).toMatch(/REVOKE ALL ON FUNCTION public\.create_participant_with_registration_reservation_v6\([\s\S]*?FROM PUBLIC, anon, authenticated, service_role;/);
  });

  it("orders the corrective migration after the immutable CMS and collective V6 prerequisites", () => {
    expect(migration).toContain("20261022110000_add_company_event_tenancy_and_registration_forms.sql");
    expect(migration).toContain("20261004100000_fix_collective_registration_travel_constraint_target.sql");
    expect(tenancyMigration).toContain("CREATE TRIGGER registration_form_submissions_immutable");
    expect("20261022110000" < "20261023110000").toBe(true);
  });
});
