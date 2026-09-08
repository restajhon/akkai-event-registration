import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260908100000_add_registration_certificate_billing.sql"),
  "utf8",
);

describe("registration billing database contract", () => {
  it("creates one billing row per participant and one email log per billing", () => {
    expect(migration).toContain("participant_id uuid NOT NULL UNIQUE REFERENCES public.participants");
    expect(migration).toContain("billing_number text NOT NULL UNIQUE");
    expect(migration).toContain("registration_billing_email_one_per_billing");
    expect(migration).toContain("'billing:' || v_billing.id");
  });

  it("creates billing in the registration reservation transaction", () => {
    expect(migration).toContain("create_participant_with_registration_reservation_v4");
    expect(migration.indexOf("INSERT INTO public.registration_billings")).toBeGreaterThan(
      migration.indexOf("INSERT INTO public.participants"),
    );
    expect(migration).toContain("CASE v_package_type WHEN 'Twin Share' THEN 6000000 ELSE 7000000 END");
  });
});
