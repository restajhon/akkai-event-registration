import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20261002100000_fix_collective_registration_travel_conflict.sql",
  ),
  "utf8",
);
const constraintTargetMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20261004100000_fix_collective_registration_travel_constraint_target.sql",
  ),
  "utf8",
);
const schema = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260830100000_add_h3d_participant_and_operational_data.sql",
  ),
  "utf8",
);

describe("collective registration v6 travel conflict fix", () => {
  it("uses untargeted PostgreSQL conflict handling for the participant travel primary key", () => {
    const tableDefinition = schema.match(
      /CREATE TABLE public\.participant_travel \(([\s\S]*?)\n\);/i,
    )?.[1];
    expect(tableDefinition).toBeDefined();
    expect(tableDefinition).toMatch(/participant_id uuid PRIMARY KEY/i);
    expect(tableDefinition).not.toMatch(/\bUNIQUE\b/i);
    expect(migration).toMatch(/ON CONFLICT DO NOTHING/i);
    expect(migration).not.toMatch(/ON CONFLICT\s*\(\s*participant_id\s*\)/i);
  });

  it("replaces only v6 and retains its delegation, return shape, and travel mapping", () => {
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION public.create_participant_with_registration_reservation_v6(",
    );
    expect(migration).toContain("FROM public.create_participant_with_registration_reservation_v5(");
    expect(migration).toContain("result_code text,");
    expect(migration).toContain("participant_id uuid,");
    expect(migration).toContain("billing_created_at timestamptz");
    expect(migration).toContain("outbound_origin, outbound_destination");
    expect(migration).toContain("return_destination, extend_stay");
    expect(migration).toContain("coalesce((p_travel->>'extend_stay')::boolean, false)");
    expect(migration).not.toMatch(/CREATE OR REPLACE FUNCTION public\.(?!create_participant_with_registration_reservation_v6)/);
  });

  it("has no other unqualified participant_id references in the PL/pgSQL body", () => {
    const body = migration.match(/AS \$\$([\s\S]*?)\$\$;/)?.[1];
    expect(body).toBeDefined();

    const unqualifiedReferences = body?.match(/(?<![\w.])participant_id(?![\w])/gi) ?? [];
    // The one remaining unqualified occurrence is the INSERT target column list.
    expect(unqualifiedReferences).toHaveLength(1);
    expect(body).toMatch(/INSERT INTO public\.participant_travel \(\s*participant_id,/i);
  });

  it("targets the verified participant_travel primary-key constraint in the latest v6 replacement", () => {
    const tableDefinition = schema.match(
      /CREATE TABLE public\.participant_travel \(([\s\S]*?)\n\);/i,
    )?.[1];
    expect(tableDefinition).toMatch(/participant_id uuid PRIMARY KEY REFERENCES public\.participants/i);
    // PostgreSQL names an inline primary-key constraint <table>_pkey.
    expect(constraintTargetMigration).toMatch(
      /ON CONFLICT ON CONSTRAINT participant_travel_pkey DO NOTHING/i,
    );
    expect(constraintTargetMigration).not.toMatch(/ON CONFLICT\s*\(\s*participant_id\s*\)/i);
    expect(constraintTargetMigration).toContain(
      "CREATE OR REPLACE FUNCTION public.create_participant_with_registration_reservation_v6(",
    );
    expect(constraintTargetMigration).toMatch(/LANGUAGE plpgsql\s+SECURITY DEFINER\s+SET search_path = public, pg_temp/i);
    expect(constraintTargetMigration).toMatch(/REVOKE EXECUTE ON FUNCTION public\.create_participant_with_registration_reservation_v6\([\s\S]*?FROM PUBLIC, anon, authenticated;/i);
    expect(constraintTargetMigration).toMatch(/GRANT EXECUTE ON FUNCTION public\.create_participant_with_registration_reservation_v6\([\s\S]*?TO service_role;/i);
    expect(constraintTargetMigration).not.toMatch(/CREATE OR REPLACE FUNCTION public\.create_participant_with_registration_reservation_v5/i);
  });
});
