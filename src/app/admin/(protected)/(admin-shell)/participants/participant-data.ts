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
  phone_number: string;
  package_type: string | null;
  participation_scope: string | null;
  actuarial_consultant_status: string | null;
  attends_pai_congress: boolean | null;
  registration_status: "REGISTERED" | "CANCELLED";
  email_status: "PENDING" | "SENT" | "FAILED";
  batch_id: string | null;
  created_at: string;
};

type ParticipantEmailCountRow = { email: string };

type DatabaseBillingRow = {
  participant_id: string;
  payment_status: "PAID" | "UNPAID";
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
  billingStatus: "all" | "PAID" | "UNPAID" = "all",
  batchCode = "all",
): Promise<ParticipantPageData | null> {
  try {
    const adminSupabase = createAdminClient();
    const offset = (requestedPage - 1) * PAGE_SIZE;
    const batchesResult = await adminSupabase
      .from("registration_batches")
      .select("id, batch_code")
      .order("created_at", { ascending: false });
    if (batchesResult.error) return null;
    const batches = (batchesResult.data ?? []) as Array<{ id: string; batch_code: string }>;
    const selectedBatch = batchCode !== "all"
      ? batches.find((batch) => batch.batch_code === batchCode)
      : null;
    let billingParticipantIds: string[] | null = null;
    if (billingStatus !== "all") {
      const billingFilterResult = await adminSupabase
        .from("registration_billings")
        .select("participant_id")
        .eq("payment_status", billingStatus);

      if (billingFilterResult.error) {
        return null;
      }

      billingParticipantIds = (billingFilterResult.data ?? []).map(
        (row) => row.participant_id as string,
      );
    }

    let participantQuery = adminSupabase
      .from("participants")
      .select(
        "id, registration_id, full_name, email, phone_number, package_type, participation_scope, actuarial_consultant_status, attends_pai_congress, registration_status, email_status, created_at, batch_id",
        { count: "exact" },
      )
      .order("created_at", { ascending: false });

    if (billingParticipantIds) {
      participantQuery = participantQuery.in(
        "id",
        billingParticipantIds.length > 0 ? billingParticipantIds : ["00000000-0000-0000-0000-000000000000"],
      );
    }

    if (batchCode !== "all") {
      participantQuery = participantQuery.eq(
        "batch_id",
        selectedBatch?.id ?? "00000000-0000-0000-0000-000000000000",
      );
    }

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
      paidResult,
      unpaidResult,
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
        .from("registration_billings")
        .select("id", { count: "exact", head: true })
        .eq("payment_status", "PAID"),
      adminSupabase
        .from("registration_billings")
        .select("id", { count: "exact", head: true })
        .eq("payment_status", "UNPAID"),
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
      paidResult.error ||
      unpaidResult.error ||
      sessionsResult.error
    ) {
      return null;
    }

    const participantRows = (participantsResult.data ?? []) as DatabaseParticipantRow[];
    const participantEmails = Array.from(new Set(participantRows.map((participant) => participant.email)));
    const sharedEmailResult = participantEmails.length > 0
      ? await adminSupabase.from("participants").select("email").in("email", participantEmails)
      : { data: [], error: null };
    if (sharedEmailResult.error) return null;
    const emailCounts = new Map<string, number>();
    for (const row of (sharedEmailResult.data ?? []) as ParticipantEmailCountRow[]) {
      emailCounts.set(row.email, (emailCounts.get(row.email) ?? 0) + 1);
    }
    const sessionRows = (sessionsResult.data ?? []) as SessionRow[];
    const participantIds = participantRows.map((participant) => participant.id);
    const sessionIds = sessionRows.map((session) => session.id);
    let attendanceRows: AttendanceRow[] = [];
    let billingRows: DatabaseBillingRow[] = [];

    if (participantIds.length > 0) {
      const billingResult = await adminSupabase
        .from("registration_billings")
        .select("participant_id, payment_status")
        .in("participant_id", participantIds);

      if (billingResult.error) {
        return null;
      }

      billingRows = (billingResult.data ?? []) as DatabaseBillingRow[];
    }

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
    const billingByParticipant = new Map(
      billingRows.map((billing) => [billing.participant_id, billing.payment_status]),
    );

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
        sharedEmailCount: emailCounts.get(participant.email) ?? 1,
        phoneNumber: participant.phone_number,
        packageType: participant.package_type,
        participationScope: participant.participation_scope,
        actuarialConsultantStatus: participant.actuarial_consultant_status,
        attendsPaiCongress: participant.attends_pai_congress,
        billingStatus: billingByParticipant.get(participant.id) ?? null,
        registrationStatus: participant.registration_status,
        emailStatus: participant.email_status,
        createdAt: participant.created_at,
        arrival: attendance.arrival,
        seminar: attendance.seminar,
        day3: attendance.day3,
        batchCode: batches.find((batch) => batch.id === participant.batch_id)?.batch_code ?? null,
      };
    });
    const totalCount = participantsResult.count ?? 0;

    return {
      participants,
      summary: {
        registered: registeredResult.count ?? 0,
        cancelled: cancelledResult.count ?? 0,
        emailFailed: emailFailedResult.count ?? 0,
        paid: paidResult.count ?? 0,
        unpaid: unpaidResult.count ?? 0,
      },
      totalCount,
      page: requestedPage,
      totalPages: Math.max(1, Math.ceil(totalCount / PAGE_SIZE)),
      query,
      billingStatus,
      batchCode,
      batchOptions: batches.map((batch) => batch.batch_code),
    };
  } catch {
    return null;
  }
}
