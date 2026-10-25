import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(
  process.cwd(),
  "supabase/migrations/20261023120000_reconcile_legacy_registration_snapshots_and_upload_cleanup.sql",
), "utf8");
const mainMigration = readFileSync(resolve(
  process.cwd(),
  "supabase/migrations/20261022110000_add_company_event_tenancy_and_registration_forms.sql",
), "utf8");
const correctiveMigration = readFileSync(resolve(
  process.cwd(),
  "supabase/migrations/20261023110000_harden_multi_tenant_registration_forms_and_rpcs.sql",
), "utf8");

describe("legacy snapshot corrective migration contract", () => {
  it("uses the captured cohort ledger and never relies on a created_at cutoff", () => {
    const repairSelection = migration.match(
      /CREATE TEMP TABLE registration_legacy_submission_repairs[\s\S]*?;\n\nCREATE TEMP TABLE registration_legacy_missing_submissions/,
    )?.[0];

    expect(mainMigration).toContain("CREATE TABLE public.registration_legacy_participant_backfill");
    expect(repairSelection).toContain("public.registration_legacy_participant_backfill");
    expect(repairSelection).toContain("submission.idempotency_key = 'legacy:' || legacy.participant_id::text");
    expect(correctiveMigration).toContain("legacy.event_id");
    expect(repairSelection).not.toContain("participant.created_at < original_version.published_at");
    expect(migration).not.toContain("created_at <");
  });

  it("normalizes existing answers from the immutable snapshot and retains metadata", () => {
    const existingSubmissionUpdate = migration.match(
      /UPDATE public\.registration_form_submissions AS submission[\s\S]*?WHERE submission\.id = repair\.submission_id;/,
    )?.[0];

    expect(existingSubmissionUpdate).toContain("submission.answers");
    expect(existingSubmissionUpdate).toContain("form_version_id = legacy_version.id");
    expect(existingSubmissionUpdate).not.toContain("participant.");
    expect(existingSubmissionUpdate).not.toContain("submitted_at =");
    expect(existingSubmissionUpdate).not.toContain("idempotency_key =");
    expect(correctiveMigration).toContain("jsonb_set(");
    expect(correctiveMigration).toContain("to_jsonb(v_answers->>'attends_pai_congress')");
    expect(correctiveMigration).toContain("RETURN v_answers;");
    expect(correctiveMigration).not.toContain("v_answers := v_answers - 'privacy_consent'");
  });

  it("creates snapshots only for captured historical participants with no prior submission", () => {
    const missingSubmissionInsert = migration.match(
      /INSERT INTO public\.registration_form_submissions \([\s\S]*?FROM registration_legacy_missing_submissions AS missing[\s\S]*?ON CONFLICT \(event_id, idempotency_key\) DO NOTHING;/,
    )?.[0];

    expect(migration).toContain("AND NOT EXISTS (");
    expect(migration).toContain("submission.participant_id = legacy.participant_id");
    expect(migration).toContain("company.slug = 'akkai'");
    expect(migration).toContain("event.slug = 'akkai-2026'");
    expect(missingSubmissionInsert).toContain("missing.source_created_at");
    expect(missingSubmissionInsert).toContain("missing.full_name");
    expect(missingSubmissionInsert).toContain("missing.privacy_consent_at IS NOT NULL");
    expect(missingSubmissionInsert).not.toContain("participant.");
    expect(migration).toContain("An AKKAI participant without a submission is outside the captured historical cohort");
    expect(migration).toContain("RAISE EXCEPTION 'A historical AKKAI participant has no registration form submission after reconciliation.'");
  });

  it("fails closed on invalid submissions and serializes cleanup against certificate consumption", () => {
    expect(migration).toContain("A registration form submission remains invalid after legacy reconciliation.");
    expect(migration).toContain("A marked historical submission was not normalized to LEGACY_BACKFILL.");
    expect(migration).toContain("A boolean-select legacy snapshot remains unclassified; refusing to infer its historical provenance.");
    expect(migration).toContain("status IN ('PENDING', 'CLEANING', 'CONSUMED')");
    expect(migration).toContain("WHERE intent.id = p_intent_id");
    expect(migration).toContain("AND intent.event_id = p_event_id");
    expect(migration).toContain("FOR UPDATE");
    expect(migration).toContain("status = 'CONSUMED'");
    expect(migration).toContain("FROM public.registration_documents AS document");
    expect(migration).toContain("SET status = 'CLEANING'");
  });
});
