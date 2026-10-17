import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorizePermission: vi.fn(),
  createAdminClient: vi.fn(),
  liveDisplayClient: vi.fn(() => null),
  requirePermission: vi.fn(),
  scannerClient: vi.fn(() => null),
  stationSetup: vi.fn(() => null),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/link", () => ({ default: "a" }));
vi.mock("@/lib/auth/server", () => ({
  authorizePermission: mocks.authorizePermission,
  requirePermission: mocks.requirePermission,
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/app/admin/(protected)/(admin-shell)/display/setup/station-setup", () => ({
  StationSetup: mocks.stationSetup,
}));
vi.mock("@/app/admin/(protected)/(focused)/scanner/[stationId]/scanner-client", () => ({
  ScannerClient: mocks.scannerClient,
}));
vi.mock("@/app/admin/(protected)/(focused)/display/[stationId]/live-display-client", () => ({
  LiveDisplayClient: mocks.liveDisplayClient,
}));

import DisplaySetupPage from "@/app/admin/(protected)/(admin-shell)/display/setup/page";
import ScannerPage from "@/app/admin/(protected)/(focused)/scanner/[stationId]/page";
import LiveDisplayPage from "@/app/admin/(protected)/(focused)/display/[stationId]/page";
import { POST as scan } from "@/app/admin/(protected)/(focused)/scanner/check-in/route";

const sessions = [
  { id: "00000000-0000-4000-8000-000000000001", code: "DAY1_MEMBER_MEETING", name: "Rapat Anggota", event_date: "2026-10-19", status: "OPEN" },
  { id: "00000000-0000-4000-8000-000000000002", code: "DAY2_AKKAI_NIGHT", name: "Akkai Night", event_date: "2026-10-20", status: "OPEN" },
];
const stations = sessions.map((session, index) => ({
  id: `00000000-0000-4000-8000-00000000001${index + 1}`,
  station_name: `Station ${index + 1}`,
  session_id: session.id,
  status: "ACTIVE",
  paired_operator_id: "operator-1",
  pairing_expires_at: "2026-10-20T12:00:00Z",
  paired_at: "2026-10-17T01:00:00Z",
  last_activity_at: null,
  created_at: "2026-10-17T01:00:00Z",
  closed_at: null,
}));
const events = stations.map((station, index) => ({
  station_id: station.id,
  session_id: station.session_id,
  participant_id: `participant-${index + 1}`,
  result_status: "SUCCESS",
  scanned_at: "2026-10-17T02:00:00Z",
  event_sequence: String(index + 1),
}));
const participants = events.map((event, index) => ({
  id: event.participant_id,
  registration_id: `AKKAI26-00000${index + 1}`,
  full_name: `Peserta ${index + 1}`,
  institution: null,
  participant_category: null,
}));

function configureClient() {
  const filters: Array<{ table: string; column: string; value: unknown }> = [];
  const tables: Record<string, object[]> = {
    sessions,
    scanner_stations: stations,
    scan_events: events,
    participants,
    profiles: [{ id: "operator-1", full_name: "Operator" }],
  };
  const rpc = vi.fn(async (_name: string, args: { p_station_id: string }) => {
    const station = stations.find((item) => item.id === args.p_station_id);
    const session = sessions.find((item) => item.id === station?.session_id);
    return {
      data: [{
        status_code: "success", result_status: "SUCCESS",
        registration_id: "AKKAI26-000001", full_name: "Peserta",
        institution: null, participant_category: null,
        session_code: session?.code, session_name: session?.name,
        checked_at: "2026-10-17T02:00:00Z", is_duplicate: false,
      }],
      error: null,
    };
  });

  mocks.createAdminClient.mockReturnValue({
    rpc,
    from(table: string) {
      let filtered = tables[table] ?? [];
      const query = {
        select: () => query,
        order: () => query,
        limit: () => query,
        eq(column: string, value: unknown) {
          filters.push({ table, column, value });
          filtered = filtered.filter((row) => (row as Record<string, unknown>)[column] === value);
          return query;
        },
        in: () => query,
        not: () => query,
        then(onFulfilled: (value: { data: object[]; error: null }) => unknown) {
          return Promise.resolve({ data: filtered, error: null }).then(onFulfilled);
        },
        async maybeSingle() {
          return { data: filtered[0] ?? null, error: null };
        },
      };
      return query;
    },
  });
  return { rpc, filters };
}

beforeEach(() => {
  vi.clearAllMocks();
  sessions.forEach((session) => { session.status = "OPEN"; });
  mocks.requirePermission.mockResolvedValue({ id: "operator-1", role: "ADMIN" });
  mocks.authorizePermission.mockResolvedValue({
    authorized: true, status: 200, profile: { id: "operator-1", role: "ADMIN" },
  });
});

describe("two sessions OPEN concurrently", () => {
  it("offers both sessions for station setup and binds each scanner and display to its own session", async () => {
    const { filters } = configureClient();
    renderToStaticMarkup(await DisplaySetupPage());
    expect(mocks.stationSetup).toHaveBeenCalledWith(
      expect.objectContaining({ sessions: expect.arrayContaining(sessions) }),
      undefined,
    );

    for (const [index, station] of stations.entries()) {
      renderToStaticMarkup(await ScannerPage({ params: Promise.resolve({ stationId: station.id }) }));
      expect(mocks.scannerClient).toHaveBeenLastCalledWith(
        expect.objectContaining({ stationId: station.id, sessionCode: sessions[index].code }),
        undefined,
      );

      renderToStaticMarkup(await LiveDisplayPage({ params: Promise.resolve({ stationId: station.id }) }));
      expect(mocks.liveDisplayClient).toHaveBeenLastCalledWith(
        expect.objectContaining({
          stationId: station.id,
          session: expect.objectContaining({ code: sessions[index].code }),
          initialDisplayEvent: expect.objectContaining({
            participant: expect.objectContaining({ fullName: `Peserta ${index + 1}` }),
            session: expect.objectContaining({ code: sessions[index].code }),
          }),
        }),
        undefined,
      );
      expect(filters).toContainEqual({ table: "scan_events", column: "station_id", value: station.id });
      expect(filters).toContainEqual({ table: "scan_events", column: "session_id", value: station.session_id });
    }
  });

  it("sends the selected station for each scan even when both sessions are OPEN", async () => {
    const { rpc } = configureClient();
    for (const [index, station] of stations.entries()) {
      const response = await scan(new Request("http://localhost/admin/scanner/check-in", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stationId: station.id, qrValue: "same-participant-qr" }),
      }));
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        status: "success",
        session: { code: sessions[index].code },
      });
      expect(rpc).toHaveBeenNthCalledWith(index + 1, "process_qr_scan", {
        p_station_id: station.id,
        p_qr_token: "same-participant-qr",
        p_operator_profile_id: "operator-1",
      });
    }
  });

  it("closing one session blocks only its scanner", async () => {
    configureClient();
    sessions[0].status = "CLOSED";

    const closed = renderToStaticMarkup(await ScannerPage({ params: Promise.resolve({ stationId: stations[0].id }) }));
    expect(closed).toContain("Session Ditutup");
    expect(mocks.scannerClient).not.toHaveBeenCalled();

    renderToStaticMarkup(await ScannerPage({ params: Promise.resolve({ stationId: stations[1].id }) }));
    expect(mocks.scannerClient).toHaveBeenCalledWith(
      expect.objectContaining({ stationId: stations[1].id, sessionCode: sessions[1].code }),
      undefined,
    );
  });
});
