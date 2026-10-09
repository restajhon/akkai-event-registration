import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));

import { loadOperationalData } from "@/lib/admin/operational-data";

type MockRow = Record<string, unknown>;
type FilterCall = { table: string; column: string; values: unknown[] };

function configureSupabase() {
  const filters: FilterCall[] = [];
  const rowsByTable: Record<string, MockRow[]> = {
    participants: [
      {
        id: "participant-1",
        registration_id: "AKKAI26-000001",
        full_name: "Peserta Uji",
        package_type: "Single",
        registration_status: "REGISTERED",
      },
    ],
    participant_room_assignments: [],
    participant_pickup_assignments: [],
    participant_travel: [],
    sessions: [
      { id: "arrival-session", code: "ARRIVAL" },
      { id: "day1-session", code: "DAY1_MEMBER_MEETING" },
      { id: "day2-session", code: "DAY2_AKKAI_NIGHT" },
    ],
    attendance: [
      {
        participant_id: "participant-1",
        session_id: "arrival-session",
        check_in_time: "2026-10-19T08:30:00+07:00",
      },
      {
        participant_id: "participant-1",
        session_id: "day1-session",
        check_in_time: "2026-10-19T10:30:00+07:00",
      },
      {
        participant_id: "participant-1",
        session_id: "day2-session",
        check_in_time: "2026-10-20T19:30:00+07:00",
      },
    ],
  };

  const client = {
    from: vi.fn((table: string) => {
      let rows = [...(rowsByTable[table] ?? [])];
      const builder = {
        select: vi.fn(() => builder),
        order: vi.fn(() => builder),
        eq: vi.fn((column: string, value: unknown) => {
          filters.push({ table, column, values: [value] });
          rows = rows.filter((row) => row[column] === value);
          return builder;
        }),
        in: vi.fn((column: string, values: unknown[]) => {
          filters.push({ table, column, values });
          rows = rows.filter((row) => values.includes(row[column]));
          return builder;
        }),
        then(resolve: (result: { data: MockRow[]; error: null }) => unknown) {
          return resolve({ data: rows, error: null });
        },
      };

      return builder;
    }),
  };

  mocks.createAdminClient.mockReturnValue(client);
  return { filters };
}

beforeEach(() => {
  mocks.createAdminClient.mockReset();
});

describe("operational attendance data by session", () => {
  it("maps the two new session rows to independent participant attendance fields", async () => {
    const { filters } = configureSupabase();

    const participants = await loadOperationalData();

    expect(participants).toHaveLength(1);
    expect(participants?.[0]).toMatchObject({
      arrival: { checkedIn: true, checkedInAt: "2026-10-19T08:30:00+07:00" },
      day1MemberMeeting: { checkedIn: true, checkedInAt: "2026-10-19T10:30:00+07:00" },
      day2AkkaiNight: { checkedIn: true, checkedInAt: "2026-10-20T19:30:00+07:00" },
      seminar: { checkedIn: false, checkedInAt: null },
      day3: { checkedIn: false, checkedInAt: null },
    });

    const sessionFilter = filters.find(
      (filter) => filter.table === "sessions" && filter.column === "code",
    );
    expect(sessionFilter?.values).toEqual(expect.arrayContaining([
      "DAY1_MEMBER_MEETING",
      "DAY2_AKKAI_NIGHT",
    ]));
  });
});
