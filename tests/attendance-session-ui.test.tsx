import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  closeStation: vi.fn(),
  createClient: vi.fn(() => ({})),
  createStation: vi.fn(),
  processManualCheckIn: vi.fn(),
  pairStation: vi.fn(),
  resetStationPairing: vi.fn(),
  searchManualParticipants: vi.fn(),
  routerRefresh: vi.fn(),
  updateSessionStatus: vi.fn(),
}));

vi.mock("next/link", () => ({ default: "a" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.routerRefresh }),
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: mocks.createClient }));
vi.mock("@/app/admin/(protected)/(admin-shell)/display/setup/actions", () => ({
  closeStation: mocks.closeStation,
  createStation: mocks.createStation,
  resetStationPairing: mocks.resetStationPairing,
}));
vi.mock("@/app/admin/(protected)/(admin-shell)/scanner/pair/actions", () => ({
  pairStation: mocks.pairStation,
}));
vi.mock("@/app/admin/(protected)/(admin-shell)/sessions/actions", () => ({
  updateSessionStatus: mocks.updateSessionStatus,
}));
vi.mock("@/app/admin/(protected)/(focused)/scanner/[stationId]/manual/actions", () => ({
  processManualCheckIn: mocks.processManualCheckIn,
  searchManualParticipants: mocks.searchManualParticipants,
}));

import {
  AttendanceBoard,
  getAttendanceTotals,
  getVisibleAttendanceParticipants,
} from "@/app/admin/(protected)/(admin-shell)/attendance/attendance-board";
import { LiveDisplayClient } from "@/app/admin/(protected)/(focused)/display/[stationId]/live-display-client";
import { ManualCheckInClient } from "@/app/admin/(protected)/(focused)/scanner/[stationId]/manual/manual-check-in-client";
import { ScannerClient } from "@/app/admin/(protected)/(focused)/scanner/[stationId]/scanner-client";
import { PairForm } from "@/app/admin/(protected)/(admin-shell)/scanner/pair/pair-form";
import { SessionList } from "@/app/admin/(protected)/(admin-shell)/sessions/session-list";
import { StationSetup } from "@/app/admin/(protected)/(admin-shell)/display/setup/station-setup";
import type { OperationalParticipant } from "@/lib/admin/operational-data";
import { participantCheckInEventSchema } from "@/lib/realtime/participant-check-in-event";

const day1Session = {
  id: "day1-session-id",
  code: "DAY1_MEMBER_MEETING",
  name: "Day 1 — Rapat Anggota",
  event_date: "2026-10-19",
  status: "OPEN" as const,
};

const day2Session = {
  id: "day2-session-id",
  code: "DAY2_AKKAI_NIGHT",
  name: "Day 2 — Akkai Night",
  event_date: "2026-10-20",
  status: "OPEN" as const,
};

function participant(
  id: string,
  registrationId: string,
  fullName: string,
  day1: boolean,
  day2: boolean,
): OperationalParticipant {
  return {
    id,
    registrationId,
    fullName,
    packageType: "Single",
    registrationStatus: "REGISTERED",
    roomAssignment: null,
    travel: null,
    arrivalAssignment: null,
    departureAssignment: null,
    arrival: { checkedIn: false, checkedInAt: null },
    seminar: { checkedIn: false, checkedInAt: null },
    day3: { checkedIn: false, checkedInAt: null },
    day1MemberMeeting: {
      checkedIn: day1,
      checkedInAt: day1 ? "2026-10-19T10:30:00+07:00" : null,
    },
    day2AkkaiNight: {
      checkedIn: day2,
      checkedInAt: day2 ? "2026-10-20T19:30:00+07:00" : null,
    },
  };
}

function textContent(markup: string) {
  return markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

describe("AKKAI attendance sessions in operations UI", () => {
  it("shows both sessions in station creation and session management lists", () => {
    const setup = [day1Session, day2Session]
      .map((session) => renderToStaticMarkup(<StationSetup sessions={[session]} stations={[]} />))
      .join("");
    const sessionList = renderToStaticMarkup(
      <SessionList
        role="SUPER_ADMIN"
        sessions={[
          { ...day1Session, status: "CLOSED" },
          { ...day2Session, status: "CLOSED" },
        ]}
      />,
    );

    expect(setup).toContain("Day 1 — Rapat Anggota");
    expect(setup).toContain("Day 2 — Akkai Night");
    expect(setup).toContain('value="day1-session-id"');
    expect(setup).toContain('value="day2-session-id"');
    expect(sessionList).toContain("Day 1 — Rapat Anggota");
    expect(sessionList).toContain("Day 2 — Akkai Night");
  });

  it("shows each opened session through scanner pairing, scanner, and live display", () => {
    for (const [index, session] of [day1Session, day2Session].entries()) {
      const stationName = `Station Day ${index + 1}`;
      const pairing = renderToStaticMarkup(
        <PairForm
          isAdmin={false}
          myStations={[]}
          stations={[
            {
              id: `day${index + 1}-station-id`,
              stationName,
              sessionName: session.name,
              sessionCode: session.code,
              pairingExpiresAt: `${session.event_date}T08:00:00+07:00`,
            },
          ]}
        />,
      );
      const scanner = renderToStaticMarkup(
        <ScannerClient
          sessionCode={session.code}
          sessionName={session.name}
          stationId="00000000-0000-4000-8000-000000000001"
          stationName={stationName}
        />,
      );
      const display = renderToStaticMarkup(
        <LiveDisplayClient
          initialDisplayEvent={null}
          session={{
            code: session.code,
            name: session.name,
            eventDate: session.event_date,
            status: session.status,
          }}
          stationId="00000000-0000-4000-8000-000000000001"
          stationName={stationName}
        />,
      );
      const manual = renderToStaticMarkup(
        <ManualCheckInClient
          sessionCode={session.code}
          sessionName={session.name}
          stationId="00000000-0000-4000-8000-000000000001"
          stationName={stationName}
        />,
      );

      expect(pairing).toContain(`${stationName} · ${session.name}`);
      expect(scanner).toContain(session.name);
      expect(display).toContain(session.name);
      expect(manual).toContain(session.name);
      expect(
        participantCheckInEventSchema.safeParse({
          status: "success",
          participant: {
            registrationId: "AKKAI26-000001",
            fullName: "Peserta Uji",
            institution: null,
            participantCategory: "Anggota",
          },
          session: { code: session.code, name: session.name },
          station: { name: "Station AKKAI" },
          eventAt: "2026-10-19T10:30:00+07:00",
          eventSequence: "1",
        }).success,
      ).toBe(true);
    }
  });

  it("shows separate session filters, totals, and permission-gated downloads", () => {
    const participants = [
      participant("p1", "AKKAI26-000001", "Peserta Day 1", true, false),
      participant("p2", "AKKAI26-000002", "Peserta Day 2", false, true),
    ];
    const permitted = renderToStaticMarkup(
      <AttendanceBoard canExportAttendance participants={participants} />,
    );
    const restricted = renderToStaticMarkup(
      <AttendanceBoard canExportAttendance={false} participants={participants} />,
    );
    const permittedText = textContent(permitted);

    expect(getAttendanceTotals(participants)).toMatchObject({
      DAY1_MEMBER_MEETING: 1,
      DAY2_AKKAI_NIGHT: 1,
    });
    expect(getVisibleAttendanceParticipants(participants, "", "all", {
      ARRIVAL: "all",
      SEMINAR: "all",
      DAY3: "all",
      DAY1_MEMBER_MEETING: "present",
      DAY2_AKKAI_NIGHT: "absent",
    }).map((entry) => entry.registrationId)).toEqual(["AKKAI26-000001"]);
    expect(getVisibleAttendanceParticipants(participants, "", "all", {
      ARRIVAL: "all",
      SEMINAR: "all",
      DAY3: "all",
      DAY1_MEMBER_MEETING: "absent",
      DAY2_AKKAI_NIGHT: "present",
    }).map((entry) => entry.registrationId)).toEqual(["AKKAI26-000002"]);

    expect(permitted).toContain("Day 1 — Rapat Anggota");
    expect(permitted).toContain("Day 2 — Akkai Night");
    expect(permitted).toContain("sessionCode=DAY1_MEMBER_MEETING");
    expect(permitted).toContain("sessionCode=DAY2_AKKAI_NIGHT");
    expect(permittedText).toContain("Day 1 — Rapat Anggota 1 peserta");
    expect(permittedText).toContain("Day 2 — Akkai Night 1 peserta");
    expect(restricted).not.toContain("/api/admin/attendance-export");
  });
});
