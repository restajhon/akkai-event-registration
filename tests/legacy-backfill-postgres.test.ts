import { spawnSync } from "node:child_process";
import { randomInt } from "node:crypto";
import { accessSync, mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const correctiveMigration = readFileSync(
  "supabase/migrations/20261023110000_harden_multi_tenant_registration_forms_and_rpcs.sql",
  "utf8",
);
const reconciliationMigration = readFileSync(
  "supabase/migrations/20261023120000_reconcile_legacy_registration_snapshots_and_upload_cleanup.sql",
  "utf8",
);

function postgresBin(name: string) {
  const configured = spawnSync("pg_config", ["--bindir"], { encoding: "utf8" });
  if (configured.status !== 0) return null;
  const path = join(configured.stdout.trim(), name);
  try {
    accessSync(path);
    return path;
  } catch {
    return null;
  }
}

const initdb = postgresBin("initdb");
const pgCtl = postgresBin("pg_ctl");
const psql = postgresBin("psql");
const postgresAvailable = Boolean(initdb && pgCtl && psql);

function extractStatement(source: string, marker: string) {
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`SQL statement marker not found: ${marker}`);
  const end = source.indexOf(";", start);
  if (end < 0) throw new Error(`SQL statement terminator not found: ${marker}`);
  return source.slice(start, end + 1);
}

function extractFunction(source: string, functionName: string) {
  const escapedName = functionName.replaceAll(".", "\\.");
  const definition = source.match(
    new RegExp(`CREATE OR REPLACE FUNCTION ${escapedName}\\([\\s\\S]*?\\n\\$\\$;`),
  )?.[0];
  if (!definition) throw new Error(`SQL function not found: ${functionName}`);
  return definition;
}

function extractDollarBlock(source: string, marker: string) {
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`SQL dollar block marker not found: ${marker}`);
  const end = source.indexOf("\n$$;", start);
  if (end < 0) throw new Error(`SQL dollar block terminator not found: ${marker}`);
  return source.slice(start, end + "\n$$;".length);
}

const legacyFormEvents = extractStatement(
  correctiveMigration,
  "CREATE TEMP TABLE registration_legacy_form_events ON COMMIT DROP AS",
);
const legacyRepairs = extractStatement(
  correctiveMigration,
  "CREATE TEMP TABLE registration_legacy_submission_repairs ON COMMIT DROP AS",
);
const legacyVersionInsert = extractStatement(
  correctiveMigration,
  "INSERT INTO public.registration_form_versions (\n  form_id,\n  event_id,\n  version_number,\n  version_kind,",
);
const normalizeSnapshot = extractFunction(
  correctiveMigration,
  "public.normalize_legacy_registration_submission_snapshot_20261023",
);
const answerValidator = extractFunction(
  correctiveMigration,
  "public.validate_registration_form_answers",
);
const immutableSubmissionGuard = extractFunction(
  reconciliationMigration,
  "public.reject_registration_form_submission_mutation",
);
const historicalMissingSelection = extractStatement(
  reconciliationMigration,
  "CREATE TEMP TABLE registration_legacy_missing_submissions ON COMMIT DROP AS",
);
const historicalMissingInsert = extractStatement(
  reconciliationMigration,
  "INSERT INTO public.registration_form_submissions (\n  event_id,\n  form_version_id,\n  participant_id,\n  idempotency_key,\n  answers,\n  submitted_at\n)",
);
const finalReconciliationChecks = extractDollarBlock(
  reconciliationMigration,
  "DO $$\nBEGIN\n  IF EXISTS (\n    SELECT 1\n    FROM public.registration_form_submissions AS submission\n    LEFT JOIN public.registration_form_versions AS version",
);
const existingSubmissionUpdate = extractStatement(
  correctiveMigration,
  "UPDATE public.registration_form_submissions AS submission",
);

const fixtureAndAssertions = `
CREATE TABLE public.companies (id uuid PRIMARY KEY, slug text NOT NULL);
CREATE TABLE public.events (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  slug text NOT NULL
);
CREATE TABLE public.registration_forms (
  id uuid PRIMARY KEY,
  event_id uuid NOT NULL UNIQUE REFERENCES public.events(id),
  published_version_id uuid
);
CREATE TABLE public.registration_form_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.registration_forms(id),
  event_id uuid NOT NULL REFERENCES public.events(id),
  version_number integer NOT NULL,
  version_kind text NOT NULL,
  config jsonb NOT NULL,
  published_by uuid,
  published_at timestamptz NOT NULL,
  UNIQUE (form_id, version_number)
);
CREATE TABLE public.participants (
  id uuid PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.events(id),
  created_at timestamptz NOT NULL,
  full_name text,
  email text,
  phone_number text,
  kka_name text,
  position text,
  polo_size text,
  polo_model text,
  package_type text,
  participation_scope text,
  actuarial_consultant_status text,
  attends_pai_congress boolean,
  privacy_consent_at timestamptz,
  UNIQUE (id, event_id)
);
CREATE TABLE public.registration_legacy_participant_backfill (
  participant_id uuid PRIMARY KEY,
  event_id uuid NOT NULL,
  source_created_at timestamptz NOT NULL,
  full_name text,
  email text,
  phone_number text,
  kka_name text,
  position text,
  polo_size text,
  polo_model text,
  package_type text,
  participation_scope text,
  actuarial_consultant_status text,
  attends_pai_congress boolean,
  privacy_consent_at timestamptz,
  FOREIGN KEY (participant_id, event_id) REFERENCES public.participants(id, event_id)
);
CREATE TABLE public.registration_form_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id),
  form_version_id uuid NOT NULL REFERENCES public.registration_form_versions(id),
  participant_id uuid,
  idempotency_key text NOT NULL,
  answers jsonb NOT NULL,
  submitted_at timestamptz NOT NULL,
  UNIQUE (event_id, idempotency_key)
);
CREATE UNIQUE INDEX registration_form_submissions_participant_unique
  ON public.registration_form_submissions (participant_id) WHERE participant_id IS NOT NULL;

INSERT INTO public.companies VALUES ('00000000-0000-0000-0000-000000000001', 'akkai');
INSERT INTO public.events VALUES (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'akkai-2026'
);
INSERT INTO public.registration_forms VALUES (
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000004'
);
INSERT INTO public.registration_form_versions (
  id, form_id, event_id, version_number, version_kind, config, published_at
) VALUES (
  '00000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000002',
  1,
  'PUBLISHED',
  '{"fields":[{"key":"full_name","type":"text","required":false},{"key":"email","type":"email","required":false},{"key":"participation_scope","type":"select","required":false,"options":[]},{"key":"actuarial_consultant_status","type":"select","required":false,"options":[]},{"key":"attends_pai_congress","type":"select","required":false,"options":["true","false"]},{"key":"privacy_consent","type":"checkbox","required":false},{"key":"optional_answer","type":"text","required":false}]}'::jsonb,
  '2026-10-22 11:00:00+00'
);

INSERT INTO public.participants (
  id, event_id, created_at, full_name, email, attends_pai_congress
) VALUES
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000002', '2026-10-22 11:00:00.001+00', 'Mutable edited name', 'edited@example.test', true),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000002', '2026-10-22 11:00:00.001+00', 'Mutable omitted name', 'edited-missing@example.test', true),
  ('00000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000002', '2026-10-23 12:00:00+00', 'New CMS participant', 'new@example.test', true);

INSERT INTO public.registration_legacy_participant_backfill (
  participant_id, event_id, source_created_at, full_name, email, phone_number,
  attends_pai_congress, privacy_consent_at
) VALUES
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000002', '2026-10-20 08:00:00+00', 'Captured cohort name', 'captured@example.test', NULL, false, NULL),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000002', '2026-10-20 09:00:00+00', 'Captured missing name', 'captured-missing@example.test', NULL, false, NULL);

INSERT INTO public.registration_form_submissions VALUES (
  '00000000-0000-0000-0000-000000000021',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000011',
  'legacy:00000000-0000-0000-0000-000000000011',
  '{"full_name":"Name in saved snapshot","attends_pai_congress":false,"optional_answer":null,"privacy_consent":null}'::jsonb,
  '2026-10-20 08:00:00+00'
);
INSERT INTO public.registration_form_submissions VALUES (
  '00000000-0000-0000-0000-000000000023',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000013',
  'cms-idempotency-key',
  '{"full_name":"New CMS participant","attends_pai_congress":"true"}'::jsonb,
  '2026-10-23 12:00:00+00'
);

${immutableSubmissionGuard}
CREATE TRIGGER registration_form_submissions_immutable
BEFORE UPDATE OR DELETE ON public.registration_form_submissions
FOR EACH ROW EXECUTE FUNCTION public.reject_registration_form_submission_mutation();
${normalizeSnapshot}
${answerValidator}

BEGIN;
${legacyFormEvents}
${legacyRepairs}
${legacyVersionInsert}
SELECT set_config('app.allow_legacy_submission_repair', 'on', true);
${existingSubmissionUpdate}
SELECT set_config('app.allow_legacy_submission_repair', 'off', true);

DO $$
DECLARE
  v_answers jsonb;
  v_submitted_at timestamptz;
BEGIN
  SELECT answers, submitted_at INTO v_answers, v_submitted_at
  FROM public.registration_form_submissions
  WHERE participant_id = '00000000-0000-0000-0000-000000000011';
  IF v_answers->>'full_name' <> 'Name in saved snapshot'
     OR jsonb_typeof(v_answers->'attends_pai_congress') <> 'string'
     OR v_answers->>'attends_pai_congress' <> 'false'
     OR v_answers->'optional_answer' <> 'null'::jsonb
     OR v_answers->'privacy_consent' <> 'null'::jsonb
     OR v_answers ? 'not_present'
     OR v_submitted_at <> '2026-10-20 08:00:00+00'::timestamptz THEN
    RAISE EXCEPTION 'Existing snapshot normalization changed historical content or metadata.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.registration_form_submissions AS submission
    JOIN public.registration_form_versions AS version ON version.id = submission.form_version_id
    WHERE submission.participant_id = '00000000-0000-0000-0000-000000000011'
      AND version.version_number = 0
      AND version.version_kind = 'LEGACY_BACKFILL'
  ) THEN
    RAISE EXCEPTION 'Captured legacy submission was not moved to version zero.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.registration_form_submissions
    WHERE participant_id = '00000000-0000-0000-0000-000000000013'
      AND form_version_id = '00000000-0000-0000-0000-000000000004'
      AND answers = '{"full_name":"New CMS participant","attends_pai_congress":"true"}'::jsonb
  ) THEN
    RAISE EXCEPTION 'A modern CMS submission was modified.';
  END IF;
END;
$$;
COMMIT;

BEGIN;
${historicalMissingSelection}
${historicalMissingInsert}
DO $$
DECLARE
  v_answers jsonb;
  v_submitted_at timestamptz;
BEGIN
  IF (SELECT count(*) FROM registration_legacy_missing_submissions) <> 1 THEN
    RAISE EXCEPTION 'Missing-submission selection included a non-missing or non-cohort participant.';
  END IF;
  SELECT answers, submitted_at INTO v_answers, v_submitted_at
  FROM public.registration_form_submissions
  WHERE participant_id = '00000000-0000-0000-0000-000000000012';
  IF v_answers->>'full_name' <> 'Captured missing name'
     OR v_answers->>'email' <> 'captured-missing@example.test'
     OR v_answers->>'attends_pai_congress' <> 'false'
     OR v_answers ? 'phone_number'
     OR v_answers ? 'privacy_consent'
     OR v_submitted_at <> '2026-10-20 09:00:00+00'::timestamptz THEN
    RAISE EXCEPTION 'Missing submission did not use the frozen source values and null omissions.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.registration_form_submissions
    WHERE participant_id = '00000000-0000-0000-0000-000000000013'
      AND idempotency_key = 'legacy:00000000-0000-0000-0000-000000000013'
  ) THEN
    RAISE EXCEPTION 'A participant outside the historical cohort received a synthesized submission.';
  END IF;
END;
$$;
COMMIT;
`;

describe("legacy registration SQL on isolated PostgreSQL", () => {
  it.skipIf(!postgresAvailable)("executes snapshot normalization and missing-only backfill SQL", { timeout: 60_000 }, () => {
    const temporaryRoot = mkdtempSync(join(tmpdir(), "akkai-legacy-pg-"));
    const dataDirectory = join(temporaryRoot, "data");
    const socketDirectory = join(temporaryRoot, "socket");
    const logFile = join(temporaryRoot, "postgres.log");
    mkdirSync(socketDirectory);
    const port = randomInt(20_000, 60_000);
    let serverStarted = false;

    const run = (binary: string, args: string[], input?: string) => {
      const result = spawnSync(binary, args, {
        encoding: "utf8",
        input,
        timeout: 45_000,
        maxBuffer: 2 * 1024 * 1024,
      });
      if (result.error) throw result.error;
      if (result.status !== 0) {
        throw new Error(`${binary} failed (${result.status}):\n${result.stdout}\n${result.stderr}`);
      }
      return result.stdout;
    };
    const psqlArgs = [
      "-X", "-v", "ON_ERROR_STOP=1", "-h", socketDirectory,
      "-p", String(port), "-U", "postgres", "-d", "postgres",
    ];
    const expectSqlFailure = (sql: string, message: string) => {
      const result = spawnSync(psql!, psqlArgs, {
        encoding: "utf8",
        input: sql,
        timeout: 45_000,
        maxBuffer: 2 * 1024 * 1024,
      });
      expect(result.error).toBeUndefined();
      expect(result.status).not.toBe(0);
      expect(`${result.stdout}\n${result.stderr}`).toContain(message);
    };

    try {
      run(initdb!, ["-D", dataDirectory, "-A", "trust", "-U", "postgres", "--no-locale"]);
      run(pgCtl!, [
        "-D", dataDirectory,
        "-l", logFile,
        "-o", `-F -k ${socketDirectory} -p ${port} -h ''`,
        "-w", "start",
      ]);
      serverStarted = true;
      run(psql!, psqlArgs, fixtureAndAssertions);
      expectSqlFailure(
        `BEGIN;\nINSERT INTO public.participants (id, event_id, created_at, full_name, email)\nVALUES ('00000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000002', now(), 'Unclassified missing participant', 'unclassified@example.test');\n${finalReconciliationChecks}\nCOMMIT;`,
        "An AKKAI participant without a submission is outside the captured historical cohort; refusing to synthesize answers.",
      );
      expectSqlFailure(
        `BEGIN;\nINSERT INTO public.registration_form_submissions (event_id, form_version_id, participant_id, idempotency_key, answers, submitted_at)\nVALUES ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000004', NULL, 'invalid-snapshot-test', '{\"unknown_answer\":\"not-valid\"}'::jsonb, now());\n${finalReconciliationChecks}\nCOMMIT;`,
        "A registration form submission remains invalid after legacy reconciliation.",
      );
    } finally {
      if (serverStarted) {
        const stop = spawnSync(pgCtl!, ["-D", dataDirectory, "-m", "immediate", "-w", "stop"], {
          encoding: "utf8",
          timeout: 15_000,
        });
        if (stop.status !== 0) {
          throw new Error(`Could not stop isolated PostgreSQL: ${stop.stdout}\n${stop.stderr}`);
        }
      }
      rmSync(temporaryRoot, { recursive: true, force: true });
    }
  });
});
