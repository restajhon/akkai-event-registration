import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260909110000_fix_registration_rpc_ambiguous_column.sql",
  ),
  "utf8",
);

describe("registration RPC ambiguity regression", () => {
  it("qualifies upload intent columns that overlap RPC output names", () => {
    expect(migration).toContain(
      "FROM public.registration_certificate_upload_intents AS certificate_intent",
    );
    expect(migration).toContain("certificate_intent.email = v_email");
    expect(migration).toContain("certificate_intent.status = 'PENDING'");
    expect(migration).toContain("certificate_intent.expires_at > now()");
    expect(migration).toContain("WHERE certificate_intent.id = v_certificate.id");
    expect(migration).not.toContain("WHERE email = v_email");
  });

  it("preserves the v4 signature and atomic billing inserts", () => {
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION public.create_participant_with_registration_reservation_v4(",
    );
    expect(migration).toContain("INSERT INTO public.registration_billings");
    expect(migration).toContain("INSERT INTO public.registration_billing_email_logs");
    expect(migration).toContain(
      "v_amount := CASE v_package_type WHEN 'Twin Share' THEN 6000000 ELSE 7000000 END;",
    );
  });
});
