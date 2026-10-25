import { spawnSync } from "node:child_process";
import { randomInt } from "node:crypto";
import { accessSync, mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20261022110000_add_company_event_tenancy_and_registration_forms.sql",
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

function extractStatement(marker: string) {
  const start = migration.indexOf(marker);
  if (start < 0) throw new Error(`SQL statement marker not found: ${marker}`);
  const end = migration.indexOf(";", start);
  if (end < 0) throw new Error(`SQL statement terminator not found: ${marker}`);
  return migration.slice(start, end + 1);
}

function extractDollarBlock(marker: string) {
  const start = migration.indexOf(marker);
  if (start < 0) throw new Error(`SQL dollar block marker not found: ${marker}`);
  const end = migration.indexOf("\n$$;", start);
  if (end < 0) throw new Error(`SQL dollar block terminator not found: ${marker}`);
  return migration.slice(start, end + "\n$$;".length);
}

const eventScopeConstraints = extractDollarBlock(
  "DO $$\nDECLARE\n  v_table text;\nBEGIN\n  FOREACH v_table IN ARRAY ARRAY[",
);
const operationalCompositeForeignKeys = migration.slice(
  migration.indexOf("ALTER TABLE public.participants\n  ADD CONSTRAINT participants_batch_event_fkey"),
  migration.indexOf("\n\nCREATE OR REPLACE FUNCTION public.set_event_scoped_registration_id"),
);
const registrationFormsPublishedVersionForeignKey = extractStatement(
  "ALTER TABLE public.registration_forms\n  ADD CONSTRAINT registration_forms_published_version_event_fkey",
);
const registrationFormSubmissionsTable = extractStatement(
  "CREATE TABLE public.registration_form_submissions (",
);
const legacyParticipantBackfillTable = extractStatement(
  "CREATE TABLE public.registration_legacy_participant_backfill (",
);

const compositeForeignKeys = Array.from(
  migration.matchAll(
    /FOREIGN KEY\s*\(([^)]+)\)\s*REFERENCES\s+public\.([a-z_]+)\s*\(([^)]+)\)/g,
  ),
)
  .map(([, , table, columns]) => ({
    table,
    columns: columns.split(",").map((column) => column.trim()),
  }))
  .filter(({ columns }) => columns.length > 1);

const declaredUniqueTargets = new Set<string>();
for (const [, table, columns] of migration.matchAll(
  /ALTER TABLE public\.([a-z_]+)\s+ADD CONSTRAINT\s+[a-z_]+\s+UNIQUE\s*\(([^)]+)\)/g,
)) {
  declaredUniqueTargets.add(`${table}(${columns.split(",").map((column) => column.trim()).join(",")})`);
}
const formVersionsDefinition = migration.match(
  /CREATE TABLE public\.registration_form_versions \(([\s\S]*?)\n\);/,
)?.[1];
if (!formVersionsDefinition) throw new Error("Registration form versions table was not found.");
for (const [, columns] of formVersionsDefinition.matchAll(/UNIQUE\s*\(([^)]+)\)/g)) {
  declaredUniqueTargets.add(
    `registration_form_versions(${columns.split(",").map((column) => column.trim()).join(",")})`,
  );
}

const fixtureSchema = `
CREATE SCHEMA extensions;
CREATE FUNCTION extensions.gen_random_uuid() RETURNS uuid
LANGUAGE sql VOLATILE AS $$ SELECT gen_random_uuid() $$;
CREATE TABLE public.events (id uuid PRIMARY KEY);
CREATE TABLE public.profiles (id uuid PRIMARY KEY);
CREATE TABLE public.sessions (
  id uuid PRIMARY KEY,
  event_id uuid NOT NULL
);
CREATE TABLE public.participants (
  id uuid PRIMARY KEY,
  registration_id text NOT NULL,
  event_id uuid NOT NULL,
  batch_id uuid
);
CREATE TABLE public.registration_batches (id uuid PRIMARY KEY, event_id uuid NOT NULL);
CREATE TABLE public.scanner_stations (
  id uuid PRIMARY KEY,
  station_name text NOT NULL,
  session_id uuid NOT NULL REFERENCES public.sessions(id),
  event_id uuid
);
CREATE TABLE public.attendance (
  id uuid PRIMARY KEY,
  participant_id uuid NOT NULL,
  session_id uuid NOT NULL,
  event_id uuid NOT NULL
);
CREATE TABLE public.scan_events (
  id uuid PRIMARY KEY,
  station_id uuid NOT NULL,
  participant_id uuid,
  session_id uuid NOT NULL,
  event_id uuid NOT NULL
);
CREATE TABLE public.email_logs (participant_id uuid NOT NULL, event_id uuid NOT NULL);
CREATE TABLE public.participant_travel (participant_id uuid NOT NULL, event_id uuid NOT NULL);
CREATE TABLE public.participant_room_assignments (participant_id uuid NOT NULL, event_id uuid NOT NULL);
CREATE TABLE public.participant_pickup_assignments (participant_id uuid NOT NULL, event_id uuid NOT NULL);
CREATE TABLE public.registration_documents (participant_id uuid NOT NULL, event_id uuid NOT NULL);
CREATE TABLE public.registration_billings (
  id uuid PRIMARY KEY,
  participant_id uuid NOT NULL,
  registration_id text NOT NULL,
  event_id uuid NOT NULL
);
CREATE TABLE public.registration_billing_email_logs (billing_id uuid NOT NULL, event_id uuid NOT NULL);
CREATE TABLE public.registration_submission_idempotency_keys (participant_id uuid NOT NULL, event_id uuid NOT NULL);
CREATE TABLE public.participant_email_changes (participant_id uuid NOT NULL, event_id uuid NOT NULL);
CREATE TABLE public.participant_registration_status_changes (participant_id uuid NOT NULL, event_id uuid NOT NULL);
CREATE TABLE public.member_meeting_participants (participant_id uuid NOT NULL, event_id uuid NOT NULL);
CREATE TABLE public.member_meeting_upload_intents (id uuid PRIMARY KEY, event_id uuid NOT NULL);
CREATE TABLE public.registration_certificate_upload_intents (id uuid PRIMARY KEY, event_id uuid NOT NULL);
CREATE TABLE public.member_meeting_submissions (registration_id text NOT NULL, event_id uuid NOT NULL);
CREATE TABLE public.registration_forms (
  id uuid PRIMARY KEY,
  event_id uuid NOT NULL,
  published_version_id uuid
);

INSERT INTO public.events (id) VALUES
  ('00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000002');
INSERT INTO public.sessions (id, event_id) VALUES
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000002');
INSERT INTO public.participants (id, registration_id, event_id) VALUES
  ('00000000-0000-0000-0000-000000000021', 'EVTA-000001', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000022', 'EVTB-000001', '00000000-0000-0000-0000-000000000002');
INSERT INTO public.scanner_stations (id, station_name, session_id) VALUES
  ('00000000-0000-0000-0000-000000000031', 'Event A scanner', '00000000-0000-0000-0000-000000000011'),
  ('00000000-0000-0000-0000-000000000032', 'Event B scanner', '00000000-0000-0000-0000-000000000012');
`;

const scannerBackfill = extractStatement("UPDATE public.scanner_stations AS station");
const scannerEventNotNull = extractStatement(
  "ALTER TABLE public.scanner_stations ALTER COLUMN event_id SET NOT NULL",
);
const requiredUniqueConstraints = [
  extractStatement("ALTER TABLE public.participants ADD CONSTRAINT participants_id_event_unique"),
  extractStatement("ALTER TABLE public.participants ADD CONSTRAINT participants_registration_event_unique"),
  extractStatement("ALTER TABLE public.sessions ADD CONSTRAINT sessions_id_event_unique"),
  extractStatement("ALTER TABLE public.registration_batches ADD CONSTRAINT registration_batches_id_event_unique"),
  extractStatement("ALTER TABLE public.registration_billings ADD CONSTRAINT registration_billings_id_event_unique"),
  extractStatement("ALTER TABLE public.scanner_stations ADD CONSTRAINT scanner_stations_id_event_unique"),
];
const registrationFormVersionsTable = extractStatement(
  "CREATE TABLE public.registration_form_versions (",
);

describe("multi-tenant composite foreign keys on isolated PostgreSQL", () => {
  it("declares a matching unique target for every composite foreign key", () => {
    expect(compositeForeignKeys).toHaveLength(24);
    expect(operationalCompositeForeignKeys.match(/FOREIGN KEY/g)).toHaveLength(20);
    expect(registrationFormsPublishedVersionForeignKey.match(/FOREIGN KEY/g)).toHaveLength(1);
    expect(registrationFormSubmissionsTable.match(/FOREIGN KEY/g)).toHaveLength(2);
    expect(legacyParticipantBackfillTable.match(/FOREIGN KEY/g)).toHaveLength(1);
    for (const { table, columns } of compositeForeignKeys) {
      expect(declaredUniqueTargets.has(`${table}(${columns.join(",")})`), `${table}(${columns.join(",")})`).toBe(true);
    }

    expect(migration.indexOf("UPDATE public.scanner_stations AS station")).toBeLessThan(
      migration.indexOf("ALTER TABLE public.scanner_stations ALTER COLUMN event_id SET NOT NULL"),
    );
    expect(migration.indexOf("ALTER TABLE public.scanner_stations ALTER COLUMN event_id SET NOT NULL")).toBeLessThan(
      migration.indexOf("scanner_stations_id_event_unique"),
    );
    expect(migration.indexOf("scanner_stations_id_event_unique")).toBeLessThan(
      migration.indexOf("scan_events_station_event_fkey"),
    );
  });

  it.skipIf(!postgresAvailable)(
    "applies every migration composite foreign key and rejects cross-event scanner relations",
    { timeout: 60_000 },
    () => {
      const temporaryRoot = mkdtempSync(join(tmpdir(), "akkai-tenant-fk-pg-"));
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
        "-X", "-v", "ON_ERROR_STOP=1", "-t", "-A", "-h", socketDirectory,
        "-p", String(port), "-U", "postgres", "-d", "postgres",
      ];
      const expectSqlFailure = (sql: string, constraintName: string) => {
        const result = spawnSync(psql!, psqlArgs, {
          encoding: "utf8",
          input: sql,
          timeout: 45_000,
          maxBuffer: 2 * 1024 * 1024,
        });
        expect(result.error).toBeUndefined();
        expect(result.status).not.toBe(0);
        expect(`${result.stdout}\n${result.stderr}`).toContain(constraintName);
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

        const sql = [
          fixtureSchema,
          scannerBackfill,
          scannerEventNotNull,
          eventScopeConstraints,
          ...requiredUniqueConstraints,
          registrationFormVersionsTable,
          operationalCompositeForeignKeys,
          registrationFormsPublishedVersionForeignKey,
          registrationFormSubmissionsTable,
          legacyParticipantBackfillTable,
          `INSERT INTO public.scan_events (id, station_id, participant_id, session_id, event_id)
           VALUES ('00000000-0000-0000-0000-000000000041', '00000000-0000-0000-0000-000000000031',
                   '00000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000011',
                   '00000000-0000-0000-0000-000000000001');
           SELECT event_id FROM public.scanner_stations
           WHERE id = '00000000-0000-0000-0000-000000000031';`,
        ].join("\n");
        const output = run(psql!, psqlArgs, sql);
        expect(output).toContain("00000000-0000-0000-0000-000000000001");

        expectSqlFailure(
          `INSERT INTO public.scanner_stations (id, station_name, session_id, event_id)
           VALUES ('00000000-0000-0000-0000-000000000033', 'Cross-event station',
                   '00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000002');`,
          "scanner_stations_session_event_fkey",
        );
        expectSqlFailure(
          `INSERT INTO public.scan_events (id, station_id, participant_id, session_id, event_id)
           VALUES ('00000000-0000-0000-0000-000000000042', '00000000-0000-0000-0000-000000000032',
                   '00000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000011',
                   '00000000-0000-0000-0000-000000000001');`,
          "scan_events_station_event_fkey",
        );
        expectSqlFailure(
          `INSERT INTO public.scan_events (id, station_id, participant_id, session_id, event_id)
           VALUES ('00000000-0000-0000-0000-000000000043', '00000000-0000-0000-0000-000000000031',
                   '00000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000011',
                   '00000000-0000-0000-0000-000000000001');`,
          "scan_events_participant_event_fkey",
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
    },
  );
});
