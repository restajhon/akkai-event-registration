import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  liveDisplayClient: vi.fn(() => null),
  requirePermission: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/link", () => ({ default: "a" }));
vi.mock("@/lib/auth/server", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/app/admin/(protected)/(focused)/display/[stationId]/live-display-client", () => ({
  LiveDisplayClient: mocks.liveDisplayClient,
}));

import LiveDisplayPage from "@/app/admin/(protected)/(focused)/display/[stationId]/page";

const stationId = "00000000-0000-4000-8000-000000000001";
const sessionId = "00000000-0000-4000-8000-000000000002";
const participantId = "00000000-0000-4000-8000-000000000003";

function configureClient(sessionCode: string) {
  const selectedColumns: Array<{ table: string; columns: string }> = [];
  const tables: Record<string, object[]> = {
    scanner_stations: [{
      id: stationId,
      station_name: "Station Uji",
      session_id: sessionId,
      status: "ACTIVE",
      closed_at: null,
    }],
    sessions: [{
      id: sessionId,
      code: sessionCode,
      name: sessionCode === "ARRIVAL" ? "Registrasi Kedatangan" : "Seminar AKKAI 2026",
      event_date: "2026-10-18",
      status: "OPEN",
    }],
    scan_events: [{
      station_id: stationId,
      session_id: sessionId,
      participant_id: participantId,
      result_status: "SUCCESS",
      scanned_at: "2026-10-18T01:00:00.000Z",
      event_sequence: "1",
    }],
    participants: [{
      id: participantId,
      registration_id: "AKKAI26-000001",
      full_name: "Peserta Uji",
      institution: "AKKAI",
      participant_category: "Anggota",
      polo_model: "Lengan Pendek",
      polo_size: "L",
    }],
  };

  mocks.createAdminClient.mockReturnValue({
    from(table: string) {
      let filteredRows = tables[table] ?? [];
      const query = {
        select(columns: string) {
          selectedColumns.push({ table, columns });
          return query;
        },
        eq(column: string, value: unknown) {
          filteredRows = filteredRows.filter(
            (row) => (row as Record<string, unknown>)[column] === value,
          );
          return query;
        },
        in: () => query,
        not: () => query,
        order: () => query,
        limit: () => query,
        async maybeSingle() {
          return { data: filteredRows[0] ?? null, error: null };
        },
      };
      return query;
    },
  });

  return selectedColumns;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requirePermission.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
});

describe("Arrival Live Display initial event", () => {
  it("loads the registration's saved polo fields for Arrival", async () => {
    const selectedColumns = configureClient("ARRIVAL");

    renderToStaticMarkup(
      await LiveDisplayPage({ params: Promise.resolve({ stationId }) }),
    );

    expect(mocks.liveDisplayClient).toHaveBeenCalledWith(
      expect.objectContaining({
        initialDisplayEvent: expect.objectContaining({
          session: expect.objectContaining({ code: "ARRIVAL" }),
          participant: expect.objectContaining({
            poloModel: "Lengan Pendek",
            poloSize: "L",
          }),
        }),
      }),
      undefined,
    );
    expect(selectedColumns).toContainEqual({
      table: "participants",
      columns: "registration_id, full_name, institution, participant_category, polo_model, polo_size",
    });
  });

  it("does not select or forward polo fields for another session", async () => {
    const selectedColumns = configureClient("SEMINAR");

    renderToStaticMarkup(
      await LiveDisplayPage({ params: Promise.resolve({ stationId }) }),
    );

    expect(mocks.liveDisplayClient).toHaveBeenCalledWith(
      expect.objectContaining({
        initialDisplayEvent: expect.objectContaining({
          session: expect.objectContaining({ code: "SEMINAR" }),
          participant: expect.not.objectContaining({
            poloModel: expect.anything(),
            poloSize: expect.anything(),
          }),
        }),
      }),
      undefined,
    );
    expect(selectedColumns).toContainEqual({
      table: "participants",
      columns: "registration_id, full_name, institution, participant_category",
    });
  });
});
