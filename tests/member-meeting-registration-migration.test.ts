import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20261002110000_add_member_meeting_participants.sql",
  "utf8",
);

const triggerFunction = migration.match(
  /CREATE OR REPLACE FUNCTION public\.sync_member_meeting_participation_scope\(\)([\s\S]*?)\n\$\$;/,
)?.[1] ?? "";

describe("member meeting participation registration migration", () => {
  it("creates meeting membership atomically when a single-registration participant is inserted", () => {
    expect(migration).toContain(
      "AFTER INSERT OR UPDATE OF participation_scope ON public.participants",
    );
    expect(triggerFunction).toContain(
      "INSERT INTO public.member_meeting_participants (participant_id)",
    );
    expect(triggerFunction).toContain("VALUES (NEW.id)");
    expect(triggerFunction).toContain("ON CONFLICT (participant_id, meeting_code) DO NOTHING");
    expect(triggerFunction).toContain("'Rapat Anggota AKKAI 2026'");
    expect(triggerFunction).toContain("'Seluruh acara'");
  });

  it("uses each collective participant's scope independently and excludes other scopes", () => {
    const eligibleScopes = triggerFunction.match(
      /NEW\.participation_scope IN \(([^)]*)\)/,
    )?.[1];

    expect(eligibleScopes).toContain("'Rapat Anggota AKKAI 2026'");
    expect(eligibleScopes).toContain("'Seluruh acara'");
    expect(eligibleScopes).not.toContain("Seminar Profesi Konsultan Aktuaria");
  });

  it("does not revive a cancelled membership on ordinary edits or global status changes", () => {
    expect(migration).toContain("AFTER INSERT OR UPDATE OF participation_scope");
    expect(triggerFunction).toContain(
      "NEW.participation_scope IS NOT DISTINCT FROM OLD.participation_scope",
    );
    expect(triggerFunction).not.toContain("registration_status");
    expect(migration).toContain(
      "into a meeting scope joins; changing out removes that meeting relation.",
    );
  });

  it("makes an explicit scope change leave or join only the Rapat Anggota relation", () => {
    expect(triggerFunction).toContain("INSERT INTO public.member_meeting_participants");
    expect(triggerFunction).toContain("DELETE FROM public.member_meeting_participants AS membership");
    expect(triggerFunction).toContain("membership.meeting_code = 'RAPAT_ANGGOTA_AKKAI_2026'");
    expect(triggerFunction).not.toContain("DELETE FROM public.participants");
  });
});
