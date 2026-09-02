import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

import type {
  AttendanceSummary,
  ParticipantListItem,
  ParticipantPageData,
} from "./participant-page-data";

const PAGE_SIZE = 25;

type DatabaseParticipantRow = {
  id: string;
  registration_id: string;
  full_name: string;
  email: string;
  institution: string | null;
  participant_category: string | null;
  registration_status: "REGISTERED" | "CANCELLED";
  email_status: "PENDING" | "SENT" | "FAILED";
  created_at: string;
};

type SessionRow = {
  id: string;
  code: "ARRIVAL" | "SEMINAR" | "DAY3";
};

type AttendanceRow = {
  participant_id: string;
  session_id: string;
  check_in_time: string;
};

function escapePostgrestSearchValue(value: string) {
  return value.replace(/[\\%_(),*]/g, "\\$&");
}

function emptyAttendance(): AttendanceSummary {
  return {
    checkedIn: false,
    checkedInAt: null,
  };
}

export async function loadParticipantPage(
  query: string,
  requestedPage: number,
): Promise<ParticipantPageData | null> {
  try {
    const adminSupabase = createAdminClient();
    const offset = (requestedPage - 1) * PAGE_SIZE;
    let participantQuery = adminSupabase
      .from("participants")
      .select(
        "id, registration_id, full_name, email, institution, participant_category, registration_status, email_status, created_at",
        { count: "exact" },
      )
      .order("created_at", { ascending: false });

    if (query) {
      const escapedQuery = escapePostgrestSearchValue(query);
      participantQuery = participantQuery.or(
        `registration_id.ilike.*${escapedQuery}*,full_name.ilike.*${escapedQuery}*,email.ilike.*${escapedQuery}*,member_number.ilike.*${escapedQuery}*`,
      );
    }

    const [
      participantsResult,
      registeredResult,
      cancelledResult,
      emailFailedResult,
      sessionsResult,
    ] = await Promise.all([
      participantQuery.range(offset, offset + PAGE_SIZE - 1),
      adminSupabase
        .from("participants")
        .select("id", { count: "exact", head: true })
        .eq("registration_status", "REGISTERED"),
      adminSupabase
        .from("participants")
        .select("id", { count: "exact", head: true })
        .eq("registration_status", "CANCELLED"),
      adminSupabase
        .from("participants")
        .select("id", { count: "exact", head: true })
        .eq("email_status", "FAILED"),
        adminSupabase
          .from("sessions")
          .select("id, code")
          .in("code", ["ARRIVAL", "SEMINAR", "DAY3"]),
    ]);

    if (
      participantsResult.error ||
      registeredResult.error ||
      cancelledResult.error ||
      emailFailedResult.error ||
      sessionsResult.error
    ) {
      return null;
    }

    const participantRows = (participantsResult.data ?? []) as DatabaseParticipantRow[];
    const sessionRows = (sessionsResult.data ?? []) as SessionRow[];
    const participantIds = participantRows.map((participant) => participant.id);
    const sessionIds = sessionRows.map((session) => session.id);
    let attendanceRows: AttendanceRow[] = [];

    if (participantIds.length > 0 && sessionIds.length > 0) {
      const attendanceResult = await adminSupabase
        .from("attendance")
        .select("participant_id, session_id, check_in_time")
        .in("participant_id", participantIds)
        .in("session_id", sessionIds);

      if (attendanceResult.error) {
        return null;
      }

      attendanceRows = (attendanceResult.data ?? []) as AttendanceRow[];
    }

    const sessionCodeById = new Map(
      sessionRows.map((session) => [session.id, session.code]),
    );
    const attendanceByParticipant = new Map<
      string,
      {
        arrival: AttendanceSummary;
        seminar: AttendanceSummary;
        day3: AttendanceSummary;
      }
    >();

    for (const attendance of attendanceRows) {
      const sessionCode = sessionCodeById.get(attendance.session_id);

      if (
        sessionCode !== "ARRIVAL" &&
        sessionCode !== "SEMINAR" &&
        sessionCode !== "DAY3"
      ) {
        continue;
      }

      const current =
        attendanceByParticipant.get(attendance.participant_id) ?? {
          arrival: emptyAttendance(),
          seminar: emptyAttendance(),
          day3: emptyAttendance(),
        };
      const nextAttendance: AttendanceSummary = {
        checkedIn: true,
        checkedInAt: attendance.check_in_time,
      };

      if (sessionCode === "ARRIVAL") {
        current.arrival = nextAttendance;
      } else if (sessionCode === "SEMINAR") {
        current.seminar = nextAttendance;
      } else {
        current.day3 = nextAttendance;
      }

      attendanceByParticipant.set(attendance.participant_id, current);
    }

    const participants: ParticipantListItem[] = participantRows.map((participant) => {
      const attendance = attendanceByParticipant.get(participant.id) ?? {
        arrival: emptyAttendance(),
        seminar: emptyAttendance(),
          day3: emptyAttendance(),
      };

      return {
        registrationId: participant.registration_id,
        fullName: participant.full_name,
        email: participant.email,
        institution: participant.institution,
        participantCategory: participant.participant_category,
        registrationStatus: participant.registration_status,
        emailStatus: participant.email_status,
        createdAt: participant.created_at,
        arrival: attendance.arrival,
        seminar: attendance.seminar,
        day3: attendance.day3,
      };
    });
    const totalCount = participantsResult.count ?? 0;

    return {
      participants,
      summary: {
        registered: registeredResult.count ?? 0,
        cancelled: cancelledResult.count ?? 0,
        emailFailed: emailFailedResult.count ?? 0,
      },
      totalCount,
      page: requestedPage,
      totalPages: Math.max(1, Math.ceil(totalCount / PAGE_SIZE)),
      query,
    };
  } catch {
    return null;
  }
}
