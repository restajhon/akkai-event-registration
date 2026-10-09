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
import { getDashboardAttendanceSummary } from "@/lib/admin/dashboard-kpis";

const operationalProfile = {
  id: "profile-1",
  full_name: "Operational",
  email: "operational@example.com",
  role: "OPERATIONAL" as const,
  is_active: true,
};

function configureDashboardClient(
  sessions = [activeSession],
  participants: Record<string, unknown>[] | null = null,
  attendance: Record<string, unknown>[] = [],
) {
  const queriedTables: string[] = [];

  mocks.createAdminClient.mockReturnValue({
    from(table: string) {
      queriedTables.push(table);
      const response = table === "participants"
        ? { count: participants?.length ?? 1, data: participants, error: null }
        : table === "sessions"
          ? { count: null, data: sessions, error: null }
          : table === "attendance"
            ? { count: null, data: attendance, error: null }
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

const activeSession = {
  id: "session-1",
  code: "ARRIVAL",
  name: "Registrasi Kedatangan",
  event_date: "2026-10-19",
  status: "OPEN",
};

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
      true,
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

  it("does not query member-meeting data without its permission", async () => {
    const queriedTables = configureDashboardClient();

    await loadDashboardData(false, false);

    expect(queriedTables).not.toContain("member_meeting_submissions");
  });

  it("counts Day 1 and Day 2 attendance independently on the dashboard", async () => {
    const sessions = [
      {
        id: "day1-session",
        code: "DAY1_MEMBER_MEETING",
        name: "Day 1 — Rapat Anggota",
        event_date: "2026-10-19",
        status: "OPEN",
      },
      {
        id: "day2-session",
        code: "DAY2_AKKAI_NIGHT",
        name: "Day 2 — Akkai Night",
        event_date: "2026-10-20",
        status: "CLOSED",
      },
    ];
    const participants = [{
      id: "participant-1",
      registration_id: "AKKAI26-000001",
      full_name: "Peserta Uji",
      package_type: "Single",
      participation_scope: "Seluruh acara",
      actuarial_consultant_status: "Peserta Baru",
      polo_model: null,
      polo_size: null,
      created_at: "2026-10-01T00:00:00Z",
      registration_status: "REGISTERED",
    }];
    const attendance = [
      { participant_id: "participant-1", session_id: "day1-session", check_in_time: "2026-10-19T10:00:00Z" },
      { participant_id: "participant-1", session_id: "day2-session", check_in_time: "2026-10-20T19:00:00Z" },
    ];
    configureDashboardClient(sessions, participants, attendance);

    const data = await loadDashboardData(false, false);

    expect(data?.activeSessions.map((session) => session.code)).toEqual([
      "DAY1_MEMBER_MEETING",
    ]);
    expect(data?.kpis.attendanceBySession).toMatchObject({
      DAY1_MEMBER_MEETING: 1,
      DAY2_AKKAI_NIGHT: 1,
    });
    expect(getDashboardAttendanceSummary(data!.kpis.attendanceBySession)).toContainEqual({
      code: "DAY1_MEMBER_MEETING",
      label: "Day 1 — Rapat Anggota",
      count: 1,
    });
    expect(getDashboardAttendanceSummary(data!.kpis.attendanceBySession)).toContainEqual({
      code: "DAY2_AKKAI_NIGHT",
      label: "Day 2 — Akkai Night",
      count: 1,
    });
  });

  it("keeps dashboard realtime available to a role with display.view", () => {
    expect(canSubscribeToDashboardRealtime("ADMIN")).toBe(true);
    expect(canLoadScannerDashboardData("ADMIN")).toBe(true);
  });
});
