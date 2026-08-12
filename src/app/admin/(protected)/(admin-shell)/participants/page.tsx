import { z } from "zod";

import { requireRole } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";

import {
  ParticipantList,
  type AttendanceSummary,
  type ParticipantListItem,
  type ParticipantSummary,
} from "./participant-list";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;
const pageSchema = z.coerce.number().int().min(1).catch(1);

type DatabaseParticipantRow = {
  id: string;
  registration_id: string;
  full_name: string;
  email: string;
  institution: string;
  participant_category: string;
  registration_status: "REGISTERED" | "CANCELLED";
  email_status: "PENDING" | "SENT" | "FAILED";
  created_at: string;
};

type SessionRow = {
  id: string;
  code: "ARRIVAL" | "SEMINAR";
};

type AttendanceRow = {
  participant_id: string;
  session_id: string;
  check_in_time: string;
};

type ParticipantPageData = {
  participants: ParticipantListItem[];
  summary: ParticipantSummary;
  totalCount: number;
  page: number;
  totalPages: number;
};

function getFirstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function normalizeSearchQuery(value: string | string[] | undefined) {
  return getFirstSearchParam(value).trim().slice(0, 100);
}

function escapePostgrestSearchValue(value: string) {
  return value.replace(/[\\%_(),]/g, "\\$&");
}

function emptyAttendance(): AttendanceSummary {
  return {
    checkedIn: false,
    checkedInAt: null,
  };
}

async function loadParticipantPage(
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
        .in("code", ["ARRIVAL", "SEMINAR"]),
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
      { arrival: AttendanceSummary; seminar: AttendanceSummary }
    >();

    for (const attendance of attendanceRows) {
      const sessionCode = sessionCodeById.get(attendance.session_id);

      if (sessionCode !== "ARRIVAL" && sessionCode !== "SEMINAR") {
        continue;
      }

      const current =
        attendanceByParticipant.get(attendance.participant_id) ?? {
          arrival: emptyAttendance(),
          seminar: emptyAttendance(),
        };
      const nextAttendance: AttendanceSummary = {
        checkedIn: true,
        checkedInAt: attendance.check_in_time,
      };

      if (sessionCode === "ARRIVAL") {
        current.arrival = nextAttendance;
      } else {
        current.seminar = nextAttendance;
      }

      attendanceByParticipant.set(attendance.participant_id, current);
    }

    const participants: ParticipantListItem[] = participantRows.map((participant) => {
      const attendance = attendanceByParticipant.get(participant.id) ?? {
        arrival: emptyAttendance(),
        seminar: emptyAttendance(),
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
    };
  } catch {
    return null;
  }
}

function ParticipantPageError() {
  return (
    <main className="min-h-screen bg-[#f7f3ea] px-4 py-8 sm:px-8 sm:py-10">
      <section className="mx-auto max-w-3xl rounded-2xl border border-[#e4d8c4] bg-[#fffdf8] p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold tracking-[0.2em] text-[#9a7526]">
          AKKAI 2026
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-[#142842]">Peserta</h1>
        <p className="mt-6 rounded-xl border border-[#ead3cc] bg-[#fff5f2] p-4 text-sm text-[#9b3d31]" role="alert">
          Data peserta belum dapat dimuat. Silakan coba kembali.
        </p>
      </section>
    </main>
  );
}

export default async function ParticipantsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string | string[];
    page?: string | string[];
  }>;
}) {
  await requireRole(["ADMIN"]);

  const params = await searchParams;
  const query = normalizeSearchQuery(params.q);
  const requestedPage = pageSchema.parse(getFirstSearchParam(params.page));
  const pageData = await loadParticipantPage(query, requestedPage);

  if (!pageData) {
    return <ParticipantPageError />;
  }

  return (
    <ParticipantList
      page={pageData.page}
      participants={pageData.participants}
      query={query}
      summary={pageData.summary}
      totalCount={pageData.totalCount}
      totalPages={pageData.totalPages}
    />
  );
}
