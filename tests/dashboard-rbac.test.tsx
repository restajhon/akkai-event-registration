import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  dashboardRealtimeClient: vi.fn(() => null),
  requirePermission: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/server", () => ({
  requirePermission: mocks.requirePermission,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

vi.mock("@/app/admin/(protected)/(admin-shell)/dashboard/dashboard-realtime-client", () => ({
  DashboardRealtimeClient: mocks.dashboardRealtimeClient,
}));

vi.mock("next/link", () => ({ default: "a" }));

import AdminDashboardPage, {
  canLoadScannerDashboardData,
  canSubscribeToDashboardRealtime,
  loadDashboardData,
} from "@/app/admin/(protected)/(admin-shell)/dashboard/page";

const operationalProfile = {
  id: "profile-1",
  full_name: "Operational",
  email: "operational@example.com",
  role: "OPERATIONAL" as const,
  is_active: true,
};

function configureDashboardClient() {
  const queriedTables: string[] = [];
  const activeSession = {
    id: "session-1",
    code: "ARRIVAL",
    name: "Registrasi Kedatangan",
    event_date: "2026-10-19",
    status: "OPEN",
  };

  mocks.createAdminClient.mockReturnValue({
    from(table: string) {
      queriedTables.push(table);
      const response = table === "participants"
        ? { count: 1, data: null, error: null }
        : table === "sessions"
          ? { count: null, data: [activeSession], error: null }
          : { count: null, data: [], error: null };
      const query = {
        select: () => query,
        eq: () => query,
        in: () => query,
        order: () => query,
        then: (
          onFulfilled: (value: typeof response) => unknown,
          onRejected?: (reason: unknown) => unknown,
        ) => Promise.resolve(response).then(onFulfilled, onRejected),
      };

      return query;
    },
  });

  return queriedTables;
}

beforeEach(() => {
  mocks.createAdminClient.mockReset();
  mocks.dashboardRealtimeClient.mockClear();
  mocks.requirePermission.mockReset();
});

describe("dashboard RBAC isolation", () => {
  it("does not query scanner stations for OPERATIONAL", async () => {
    const queriedTables = configureDashboardClient();

    const dashboardData = await loadDashboardData(
      canLoadScannerDashboardData(operationalProfile.role),
    );

    expect(dashboardData?.stations).toEqual([]);
    expect(queriedTables).toEqual([
      "participants",
      "sessions",
      "registration_billings",
      "participant_travel",
      "registration_documents",
      "attendance",
      "member_meeting_submissions",
    ]);
    expect(queriedTables).not.toContain("scanner_stations");
  });

  it("does not mount dashboard realtime for OPERATIONAL", async () => {
    configureDashboardClient();
    mocks.requirePermission.mockResolvedValue(operationalProfile);

    const page = await AdminDashboardPage();
    renderToStaticMarkup(page);

    expect(canSubscribeToDashboardRealtime(operationalProfile.role)).toBe(false);
    expect(mocks.dashboardRealtimeClient).not.toHaveBeenCalled();
  });

  it("keeps dashboard realtime available to a role with display.view", () => {
    expect(canSubscribeToDashboardRealtime("ADMIN")).toBe(true);
    expect(canLoadScannerDashboardData("ADMIN")).toBe(true);
  });
});
