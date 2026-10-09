import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const newSessionMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20261009230000_add_day1_meeting_and_day2_akkai_night_sessions.sql",
  ),
  "utf8",
);
const schemaMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260801092444_create_initial_schema.sql"),
  "utf8",
);
const qrScanMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260808130000_add_process_qr_scan_function.sql"),
  "utf8",
);
const manualCheckInMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260810151314_add_process_manual_check_in_function.sql"),
  "utf8",
);
const pairStationMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260804120000_add_pair_scanner_station_function.sql"),
  "utf8",
);
const liveDisplayMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260823100000_add_station_specific_live_display_realtime.sql"),
  "utf8",
);

describe("additive AKKAI attendance sessions", () => {
  it("adds both requested sessions closed and idempotently", () => {
    expect(newSessionMigration).toContain("'DAY1_MEMBER_MEETING'");
    expect(newSessionMigration).toContain("'Day 1 — Rapat Anggota'");
    expect(newSessionMigration).toContain("DATE '2026-10-19'");
    expect(newSessionMigration).toContain("'DAY2_AKKAI_NIGHT'");
    expect(newSessionMigration).toContain("'Day 2 — Akkai Night'");
    expect(newSessionMigration).toContain("DATE '2026-10-20'");
    expect(newSessionMigration.match(/'CLOSED'/g)).toHaveLength(2);
    expect(newSessionMigration).toContain("ON CONFLICT (code) DO NOTHING");
    expect(newSessionMigration).not.toMatch(/UPDATE\s+public\.sessions|DELETE\s+FROM\s+public\.sessions/i);
    expect(schemaMigration).toContain("code text NOT NULL UNIQUE");
    expect(schemaMigration).toContain("UNIQUE (participant_id, session_id)");
  });

  it("records QR/manual attendance against the station session with per-session duplicate protection", () => {
    for (const scanMigration of [qrScanMigration, manualCheckInMigration]) {
      expect(scanMigration).toContain("WHERE session.id = v_station.session_id");
      expect(scanMigration).toContain("session_code := v_session.code;");
      expect(scanMigration).toContain("ON CONFLICT (participant_id, session_id) DO NOTHING");
      expect(scanMigration).toContain("AND attendance.session_id = v_session.id");
    }

    expect(pairStationMigration).toContain("station.session_id");
    expect(pairStationMigration).toContain("session.status = 'OPEN'::public.session_status");
    expect(liveDisplayMigration).toContain("WHERE s.id = NEW.session_id");
    expect(liveDisplayMigration).toContain("'name', v_session_name");
  });
});
