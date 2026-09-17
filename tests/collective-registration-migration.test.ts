import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260917100000_add_registration_batches.sql"),
  "utf8",
);
const billingEditMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260917110000_harden_billing_edit_email_status.sql"),
  "utf8",
);
const registrationAction = readFileSync(
  resolve(process.cwd(), "src/app/register/actions.ts"),
  "utf8",
);

describe("collective registration migration", () => {
  it("keeps batch membership nullable and participant identifiers independent", () => {
    expect(migration).toContain("CREATE TABLE public.registration_batches");
    expect(migration).toContain("ADD COLUMN batch_id uuid REFERENCES public.registration_batches(id) ON DELETE SET NULL");
    expect(migration).toContain("CREATE INDEX participants_batch_id_idx");
    expect(migration).toContain("create_participant_with_registration_reservation_v6");
    expect(migration).toContain("registration_billings");
    expect(migration).toContain("p_batch_id uuid");
  });

  it("updates billing price without replacing registration or QR identifiers", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.update_participant_data");
    expect(migration).toContain("UPDATE public.registration_billings");
    expect(migration).toContain("amount = v_amount");
    expect(migration).not.toContain("SET registration_id");
    expect(migration).not.toContain("SET qr_token");
  });

  it("processes delivery per participant and isolates email failures", () => {
    expect(registrationAction).toContain("Promise.allSettled");
    expect(registrationAction).toContain("sendRegistrationEmail");
    expect(registrationAction).toContain("sendBillingEmail");
    expect(registrationAction).toContain("created-email-failed");
  });

  it("does not leave an old billing email marked as sent after edits", () => {
    expect(billingEditMigration).toContain("billing_email_status = 'PENDING'");
    expect(billingEditMigration).toContain("recipient_email = NEW.email");
    expect(billingEditMigration).toContain("CREATE OR REPLACE TRIGGER registration_billings_reset_email_after_change");
    expect(billingEditMigration).toContain("Sending remains an explicit operation");
  });
});
