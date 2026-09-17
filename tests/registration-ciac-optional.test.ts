import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260917120000_make_actuarial_status_optional.sql",
  ),
  "utf8",
);

describe("optional CIAC status database contract", () => {
  it("normalizes blank RPC input to NULL before validation and insert", () => {
    expect(migration).toContain(
      "v_actuarial_status text := NULLIF(btrim(coalesce(p_actuarial_consultant_status, '')), '');",
    );
    expect(migration).toContain(
      "(v_actuarial_status IS NOT NULL AND v_actuarial_status NOT IN ('Peserta Baru', 'Penerima Grandfathering CIAC'))",
    );
    expect(migration).toContain("v_actuarial_status, p_attends_pai_congress");
  });

  it("keeps the existing v4 RPC signature and service-role boundary", () => {
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION public.create_participant_with_registration_reservation_v4(",
    );
    expect(migration).toContain(
      "REVOKE EXECUTE ON FUNCTION public.create_participant_with_registration_reservation_v4(",
    );
    expect(migration).toContain("TO service_role;");
  });
});
