import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/link", () => ({ default: "a" }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

import {
  loadPickupAssignmentDetail,
  loadPickupAssignmentPage,
  loadRoomAssignmentDetail,
  loadRoomAssignmentPage,
} from "@/lib/admin/assignment-data";
import type { PickupParticipant, RoomParticipant } from "@/lib/admin/assignment-types";
import {
  getPickupAssignmentLists,
  PickupAssignmentBoard,
} from "@/app/admin/(protected)/(admin-shell)/pickup/pickup-assignment-board";
import {
  getRoomAssignmentLists,
  RoomAssignmentBoard,
} from "@/app/admin/(protected)/(admin-shell)/rooms/room-assignment-board";

type MockRow = Record<string, unknown>;
type QueryFilter = {
  table: string;
  method: "eq" | "in";
  column: string;
  value: unknown;
};

const registrationRows: MockRow[] = [
  {
    id: "active-1",
    registration_id: "AKKAI26-000001",
    full_name: "Peserta Aktif Satu",
    package_type: "Twin Share",
    participant_category: "Anggota",
    registration_status: "REGISTERED",
  },
  {
    id: "active-2",
    registration_id: "AKKAI26-000002",
    full_name: "Peserta Aktif Dua",
    package_type: "Single",
    participant_category: "Anggota",
    registration_status: "REGISTERED",
  },
  {
    id: "cancelled-1",
    registration_id: "AKKAI26-000003",
    full_name: "Peserta Dibatalkan",
    package_type: "Twin Share",
    participant_category: "Anggota",
    registration_status: "CANCELLED",
  },
];

const roomRows: MockRow[] = [
  {
    participant_id: "active-1",
    room_number: "1201",
    room_type: "Twin Share",
    check_in_date: "2026-10-20",
    check_out_date: "2026-10-22",
    notes: null,
    updated_at: "2026-10-01T00:00:00.000Z",
  },
  {
    participant_id: "cancelled-1",
    room_number: "9999",
    room_type: "Twin Share",
    check_in_date: "2026-10-20",
    check_out_date: "2026-10-22",
    notes: "Jangan ikutkan",
    updated_at: "2026-10-01T00:00:00.000Z",
  },
];

const pickupRows: MockRow[] = [
  {
    participant_id: "active-1",
    transfer_type: "ARRIVAL",
    status: "SCHEDULED",
    pickup_at: "2026-10-20T09:00:00+07:00",
    pickup_point: "Lobby",
    dropoff_point: null,
    vehicle_label: "Bus 1",
    pic_driver: null,
    notes: null,
    updated_at: "2026-10-01T00:00:00.000Z",
  },
  {
    participant_id: "cancelled-1",
    transfer_type: "ARRIVAL",
    status: "SCHEDULED",
    pickup_at: "2026-10-20T09:00:00+07:00",
    pickup_point: "Lokasi lama",
    dropoff_point: null,
    vehicle_label: "Bus 9",
    pic_driver: null,
    notes: null,
    updated_at: "2026-10-01T00:00:00.000Z",
  },
];

const travelRows: MockRow[] = [
  {
    participant_id: "active-1",
    outbound_date: "2026-10-20",
    outbound_time: "09:00:00",
    outbound_transport_mode: "Pesawat",
    outbound_transport_number: null,
    outbound_origin: "Jakarta",
    outbound_destination: "Semarang",
    return_date: "2026-10-22",
    return_time: "15:00:00",
    return_transport_mode: "Pesawat",
    return_transport_number: null,
    return_destination: "Jakarta",
  },
  {
    participant_id: "cancelled-1",
    outbound_date: "2026-10-20",
    outbound_time: "09:00:00",
    outbound_transport_mode: "Pesawat",
    outbound_transport_number: null,
    outbound_origin: "Jakarta",
    outbound_destination: "Semarang",
    return_date: "2026-10-22",
    return_time: "15:00:00",
    return_transport_mode: "Pesawat",
    return_transport_number: null,
    return_destination: "Jakarta",
  },
];

function mockAssignmentSupabase() {
  const filters: QueryFilter[] = [];
  const tableData: Record<string, MockRow[]> = {
    participants: registrationRows,
    participant_room_assignments: roomRows,
    participant_pickup_assignments: pickupRows,
    participant_travel: travelRows,
  };

  const client = {
    from: vi.fn((table: string) => {
      let rows = [...(tableData[table] ?? [])];
      const builder = {
        select: vi.fn(() => builder),
        order: vi.fn(() => builder),
        eq: vi.fn((column: string, value: unknown) => {
          filters.push({ table, method: "eq", column, value });
          rows = rows.filter((row) => row[column] === value);
          return builder;
        }),
        in: vi.fn((column: string, values: string[]) => {
          filters.push({ table, method: "in", column, value: values });
          rows = rows.filter((row) => values.includes(String(row[column])));
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

function textContent(markup: string) {
  return markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

const roomParticipants: RoomParticipant[] = [
  {
    registrationId: "AKKAI26-000001",
    fullName: "Peserta Aktif Satu",
    packageType: "Twin Share",
    participantCategory: "Anggota",
    registrationStatus: "REGISTERED",
    assignment: {
      roomNumber: "1201",
      roomType: "Twin Share",
      checkInDate: "2026-10-20",
      checkOutDate: "2026-10-22",
      notes: null,
      updatedAt: "2026-10-01T00:00:00.000Z",
    },
  },
  {
    registrationId: "AKKAI26-000002",
    fullName: "Peserta Aktif Dua",
    packageType: "Single",
    participantCategory: "Anggota",
    registrationStatus: "REGISTERED",
    assignment: null,
  },
  {
    registrationId: "AKKAI26-000003",
    fullName: "Peserta Dibatalkan",
    packageType: "Twin Share",
    participantCategory: "Anggota",
    registrationStatus: "CANCELLED",
    assignment: {
      roomNumber: "9999",
      roomType: "Twin Share",
      checkInDate: "2026-10-20",
      checkOutDate: "2026-10-22",
      notes: "Jangan ikutkan",
      updatedAt: "2026-10-01T00:00:00.000Z",
    },
  },
];

const pickupParticipants: PickupParticipant[] = [
  {
    registrationId: "AKKAI26-000001",
    fullName: "Peserta Aktif Satu",
    participantCategory: "Anggota",
    registrationStatus: "REGISTERED",
    travel: null,
    arrivalAssignment: {
      transferType: "ARRIVAL",
      status: "SCHEDULED",
      pickupAt: "2026-10-20T09:00:00+07:00",
      pickupPoint: "Lobby",
      dropoffPoint: null,
      vehicleLabel: "Bus 1",
      picDriver: null,
      notes: null,
      updatedAt: "2026-10-01T00:00:00.000Z",
    },
    departureAssignment: null,
  },
  {
    registrationId: "AKKAI26-000002",
    fullName: "Peserta Aktif Dua",
    participantCategory: "Anggota",
    registrationStatus: "REGISTERED",
    travel: null,
    arrivalAssignment: null,
    departureAssignment: null,
  },
  {
    registrationId: "AKKAI26-000003",
    fullName: "Peserta Dibatalkan",
    participantCategory: "Anggota",
    registrationStatus: "CANCELLED",
    travel: null,
    arrivalAssignment: {
      transferType: "ARRIVAL",
      status: "SCHEDULED",
      pickupAt: "2026-10-20T09:00:00+07:00",
      pickupPoint: "Lokasi lama",
      dropoffPoint: null,
      vehicleLabel: "Bus 9",
      picDriver: null,
      notes: null,
      updatedAt: "2026-10-01T00:00:00.000Z",
    },
    departureAssignment: null,
  },
];

beforeEach(() => {
  mocks.createAdminClient.mockReset();
});

describe("active participants in assignment data", () => {
  it("loads only registered participants and their room assignment rows", async () => {
    const { filters } = mockAssignmentSupabase();

    const participants = await loadRoomAssignmentPage();

    expect(participants?.map((participant) => participant.registrationId)).toEqual([
      "AKKAI26-000001",
      "AKKAI26-000002",
    ]);
    expect(filters).toContainEqual({
      table: "participants",
      method: "eq",
      column: "registration_status",
      value: "REGISTERED",
    });
    expect(filters).toContainEqual({
      table: "participant_room_assignments",
      method: "in",
      column: "participant_id",
      value: ["active-1", "active-2"],
    });
  });

  it("loads only registered participants and their pickup/travel rows", async () => {
    const { filters } = mockAssignmentSupabase();

    const participants = await loadPickupAssignmentPage();

    expect(participants?.map((participant) => participant.registrationId)).toEqual([
      "AKKAI26-000001",
      "AKKAI26-000002",
    ]);
    expect(filters).toContainEqual({
      table: "participants",
      method: "eq",
      column: "registration_status",
      value: "REGISTERED",
    });
    expect(filters).toContainEqual({
      table: "participant_pickup_assignments",
      method: "in",
      column: "participant_id",
      value: ["active-1", "active-2"],
    });
    expect(filters).toContainEqual({
      table: "participant_travel",
      method: "in",
      column: "participant_id",
      value: ["active-1", "active-2"],
    });
  });

  it("keeps cancelled pickup detail available to participant details but not the pickup assignment route", async () => {
    const { filters } = mockAssignmentSupabase();

    const participantDetail = await loadPickupAssignmentDetail("AKKAI26-000003");
    expect(participantDetail?.registrationStatus).toBe("CANCELLED");

    const assignmentDetail = await loadPickupAssignmentDetail(
      "AKKAI26-000003",
      "REGISTERED",
    );
    expect(assignmentDetail).toBeNull();
    expect(filters).toContainEqual({
      table: "participants",
      method: "eq",
      column: "registration_status",
      value: "REGISTERED",
    });
  });

  it("does not load cancelled participants in direct room assignment detail", async () => {
    mockAssignmentSupabase();

    await expect(loadRoomAssignmentDetail("AKKAI26-000003")).resolves.toBeNull();
  });
});

describe("Room Assignment board", () => {
  it("excludes cancelled participants from the list, search results, and active counts", () => {
    const all = getRoomAssignmentLists(roomParticipants, "", "all", "all");
    expect(all.activeParticipants.map((participant) => participant.registrationId)).toEqual([
      "AKKAI26-000001",
      "AKKAI26-000002",
    ]);
    expect(all.visibleParticipants.map((participant) => participant.registrationId)).toEqual([
      "AKKAI26-000001",
      "AKKAI26-000002",
    ]);
    expect(getRoomAssignmentLists(roomParticipants, "Peserta Dibatalkan", "all", "all").visibleParticipants).toEqual([]);
    expect(getRoomAssignmentLists(roomParticipants, "", "assigned", "all").visibleParticipants.map((participant) => participant.registrationId)).toEqual(["AKKAI26-000001"]);

    const markup = renderToStaticMarkup(<RoomAssignmentBoard participants={roomParticipants} />);
    const text = textContent(markup);
    expect(markup).toContain("Peserta Aktif Satu");
    expect(markup).toContain("Peserta Aktif Dua");
    expect(markup).not.toContain("Peserta Dibatalkan");
    expect(markup).not.toContain("AKKAI26-000003");
    expect(markup).not.toContain("room-registration-filter");
    expect(text).toContain("Peserta Aktif 2 membutuhkan kamar");
    expect(text).toContain("Sudah Diatur 1 assignment");
    expect(text).toContain("Belum Diatur 1 assignment");
    expect(text).toContain("2 dari 2 peserta ditampilkan.");
  });
});

describe("Pickup Assignment board", () => {
  it("excludes cancelled participants from the list, search results, and active counts", () => {
    const all = getPickupAssignmentLists(pickupParticipants, "", "all", "all", "ARRIVAL");
    expect(all.activeParticipants.map((participant) => participant.registrationId)).toEqual([
      "AKKAI26-000001",
      "AKKAI26-000002",
    ]);
    expect(all.visibleParticipants.map((participant) => participant.registrationId)).toEqual([
      "AKKAI26-000001",
      "AKKAI26-000002",
    ]);
    expect(getPickupAssignmentLists(pickupParticipants, "Peserta Dibatalkan", "all", "all", "ARRIVAL").visibleParticipants).toEqual([]);
    expect(getPickupAssignmentLists(pickupParticipants, "", "assigned", "all", "ARRIVAL").visibleParticipants.map((participant) => participant.registrationId)).toEqual(["AKKAI26-000001"]);

    const markup = renderToStaticMarkup(<PickupAssignmentBoard participants={pickupParticipants} />);
    const text = textContent(markup);
    expect(markup).toContain("Peserta Aktif Satu");
    expect(markup).toContain("Peserta Aktif Dua");
    expect(markup).not.toContain("Peserta Dibatalkan");
    expect(markup).not.toContain("AKKAI26-000003");
    expect(markup).not.toContain("pickup-registration-filter");
    expect(text).toContain("2 dari 2 peserta aktif ditampilkan pada pickup ARRIVAL.");
  });
});
