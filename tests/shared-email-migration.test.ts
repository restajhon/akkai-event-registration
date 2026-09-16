import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260916100000_allow_shared_participant_emails.sql"),
  "utf8",
);

describe("shared participant email migration", () => {
  it("removes only the email uniqueness blocker and retains a lookup index", () => {
    expect(migration).toContain("DROP INDEX IF EXISTS public.participants_email_lower_unique;");
    expect(migration).toContain("CREATE INDEX IF NOT EXISTS participants_email_lower_idx");
    expect(migration).not.toContain("CREATE UNIQUE INDEX participants_email_lower_unique");
    expect(migration).toContain("registration_submission_idempotency_keys");
  });

  it("uses a participant-scoped idempotency key and delegates atomic billing creation", () => {
    expect(migration).toContain("create_participant_with_registration_reservation_v5");
    expect(migration).toContain("p_idempotency_key text");
    expect(migration).toContain("participant_id uuid UNIQUE REFERENCES public.participants(id)");
    expect(migration).toContain("create_participant_with_registration_reservation_v4(");
    expect(migration).toContain("registration_billings");
  });
});
