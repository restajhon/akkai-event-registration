import Link from "next/link";

import { hasPermission } from "@/lib/auth/permissions";
import {
  requirePermission,
  type UserProfile,
  type UserRole,
} from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  calculateDashboardKpis,
  type DashboardAttendance,
  type DashboardBilling,
  type DashboardParticipant,
  type DashboardTravel,
} from "@/lib/admin/dashboard-kpis";

import { DashboardRealtimeClient } from "./dashboard-realtime-client";

export const dynamic = "force-dynamic";

type SessionStatus = "OPEN" | "CLOSED";
type StationStatus =
  | "WAITING_PAIRING"
  | "PAIRED"
  | "ACTIVE"
  | "DISCONNECTED"
  | "CLOSED";

type SessionRow = {
  id: string;
  code: "ARRIVAL" | "SEMINAR" | "DAY3";
  name: string;
  event_date: string;
  status: SessionStatus;
};

type AttendanceRow = {
  participant_id: string;
  session_id: string;
  check_in_time: string;
};

type DashboardParticipantDatabaseRow = {
  id: string;
  registration_id: string;
  full_name: string;
  package_type: string | null;
  participation_scope: string | null;
  actuarial_consultant_status: string | null;
  polo_model: string | null;
  polo_size: string | null;
  created_at: string;
  registration_status: "REGISTERED" | "CANCELLED";
};
type DashboardDocumentRow = { participant_id: string };
type MemberMeetingRow = { attendance_type: "SELF" | "PROXY" };
type DashboardBillingDatabaseRow = { participant_id: string; payment_status: "PAID" | "UNPAID" };
type DashboardTravelDatabaseRow = {
  participant_id: string;
  outbound_date: string;
  outbound_time: string;
  return_date: string;
  return_time: string;
};

type StationRow = {
  id: string;
  station_name: string;
  session_id: string;
  status: StationStatus;
  paired_operator_id: string | null;
  last_activity_at: string | null;
  closed_at: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string;
};

type DashboardSession = SessionRow & {
  attendanceCount: number;
};

type DashboardStation = {
  id: string;
  stationName: string;
  sessionCode: string;
  sessionName: string;
  status: StationStatus;
  operatorName: string | null;
  lastActivityAt: string | null;
};

type DashboardData = {
  registeredCount: number;
  activeSessionIds: string[];
  activeSessions: DashboardSession[];
  activeAttendanceCount: number;
  activeScannerCount: number;
  stations: DashboardStation[];
  kpis: ReturnType<typeof calculateDashboardKpis>;
  recentRegistrations: DashboardParticipant[];
  memberMeeting: { total: number; self: number; proxy: number };
};

const stationStatusPriority: Record<StationStatus, number> = {
  ACTIVE: 0,
  PAIRED: 1,
  WAITING_PAIRING: 2,
  DISCONNECTED: 3,
  CLOSED: 4,
};

function formatEventDate(dateValue: string) {
  const [year, month, day] = dateValue.split("-").map(Number);

  if (!year || !month || !day) {
    return "Tanggal tidak tersedia";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function formatStationStatus(status: StationStatus) {
  switch (status) {
    case "ACTIVE":
      return "Aktif";
    case "PAIRED":
      return "Siap";
    case "WAITING_PAIRING":
      return "Menunggu Pairing";
    case "DISCONNECTED":
      return "Tidak Terhubung";
    case "CLOSED":
      return "Ditutup";
  }
}

function stationStatusClassName(status: StationStatus) {
  switch (status) {
    case "ACTIVE":
      return "border-[#b9dec8] bg-[#f3fbf5] text-[#267044]";
    case "PAIRED":
      return "border-[#b8cce2] bg-[#f3f8fd] text-[#345e88]";
    case "WAITING_PAIRING":
      return "border-[#e5cb8c] bg-[#fff9eb] text-[#80631e]";
    case "DISCONNECTED":
      return "border-[#ead3cc] bg-[#fff5f2] text-[#9b3d31]";
    case "CLOSED":
      return "border-[#dedbd3] bg-[#f2f0eb] text-[#6b6a66]";
  }
}

function compareStationRows(left: StationRow, right: StationRow) {
  const priorityDifference =
    stationStatusPriority[left.status] - stationStatusPriority[right.status];

  if (priorityDifference !== 0) {
    return priorityDifference;
  }

  if (left.last_activity_at === null && right.last_activity_at !== null) {
    return 1;
  }

  if (left.last_activity_at !== null && right.last_activity_at === null) {
    return -1;
  }

  if (left.last_activity_at !== null && right.last_activity_at !== null) {
    const activityDifference =
      Date.parse(right.last_activity_at) - Date.parse(left.last_activity_at);

    if (activityDifference !== 0) {
      return activityDifference;
    }
  }

  return left.station_name.localeCompare(right.station_name, "id");
}

function DistributionCard({
  title,
  values,
}: {
  title: string;
  values: Record<string, number>;
}) {
  const entries = Object.entries(values);

  return (
    <section className="rounded-xl border border-[#e4d8c4] bg-[#fffdf8] p-4 sm:p-5">
      <h2 className="text-lg font-semibold text-[#142842]">{title}</h2>
      {entries.length === 0 ? (
        <p className="mt-3 text-sm text-[#897657]">Belum ada data.</p>
      ) : (
        <dl className="mt-3 divide-y divide-[#eee6d8] text-sm">
          {entries.map(([label, value]) => (
            <div className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0" key={label}>
              <dt className="break-words text-[#5b6c7c]">{label}</dt>
              <dd className="font-bold text-[#142842]">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

function TravelSummary({ kpis }: { kpis: ReturnType<typeof calculateDashboardKpis> }) {
  return (
    <section className="rounded-xl border border-[#e4d8c4] bg-[#fffdf8] p-4 sm:p-5">
      <h2 className="text-lg font-semibold text-[#142842]">Kelengkapan Travel</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg bg-[#fbf5e8] p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#897657]">Arrival</p>
          <p className="mt-1 text-xl font-bold text-[#267044]">{kpis.travel.arrivalComplete} lengkap</p>
          <p className="text-sm text-[#5b6c7c]">{kpis.travel.arrivalIncomplete} belum lengkap</p>
        </div>
        <div className="rounded-lg bg-[#fbf5e8] p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#897657]">Departure</p>
          <p className="mt-1 text-xl font-bold text-[#267044]">{kpis.travel.departureComplete} lengkap</p>
          <p className="text-sm text-[#5b6c7c]">{kpis.travel.departureIncomplete} belum lengkap</p>
        </div>
      </div>
    </section>
  );
}

export function canLoadScannerDashboardData(role: UserRole) {
  return (
    hasPermission(role, "scanner.pair") ||
    hasPermission(role, "scanner.checkin") ||
    hasPermission(role, "display.view") ||
    hasPermission(role, "display.manage")
  );
}

export function canSubscribeToDashboardRealtime(role: UserRole) {
  return hasPermission(role, "display.view");
}

export async function loadDashboardData(
  canViewScanner: boolean,
): Promise<DashboardData | null> {
  try {
    const adminSupabase = createAdminClient();
    const [participantsResult, sessionsResult] = await Promise.all([
      adminSupabase
        .from("participants")
        .select(
          "id, registration_id, full_name, package_type, participation_scope, actuarial_consultant_status, polo_model, polo_size, created_at, registration_status",
        )
        .order("created_at", { ascending: false }),
      adminSupabase
        .from("sessions")
        .select("id, code, name, event_date, status")
        .order("event_date", { ascending: true })
        .order("code", { ascending: true }),
    ]);

    if (participantsResult.error || sessionsResult.error) {
      return null;
    }

    const participantRows = (participantsResult.data ?? []) as DashboardParticipantDatabaseRow[];
    const registeredParticipants = participantRows.filter(
      (participant) => participant.registration_status === "REGISTERED",
    );
    const registeredParticipantKpis: DashboardParticipant[] = registeredParticipants.map(
      (participant) => ({
        id: participant.id,
        registrationId: participant.registration_id,
        fullName: participant.full_name,
        packageType: participant.package_type,
        participationScope: participant.participation_scope,
        actuarialConsultantStatus: participant.actuarial_consultant_status,
        poloModel: participant.polo_model,
        poloSize: participant.polo_size,
        createdAt: participant.created_at,
      }),
    );
    const registeredCount = registeredParticipants.length;
    const sessions = (sessionsResult.data ?? []) as SessionRow[];
    const sessionIds = sessions.map((session) => session.id);
    const [billingResult, travelResult, documentResult, attendanceResult, memberMeetingResult] = await Promise.all([
      adminSupabase.from("registration_billings").select("participant_id, payment_status"),
      adminSupabase.from("participant_travel").select("participant_id, outbound_date, outbound_time, return_date, return_time"),
      adminSupabase.from("registration_documents").select("participant_id"),
      sessionIds.length > 0
        ? adminSupabase.from("attendance").select("participant_id, session_id, check_in_time").in("session_id", sessionIds)
        : Promise.resolve({ data: [], error: null }),
      adminSupabase.from("member_meeting_submissions").select("attendance_type"),
    ]);

    if ([billingResult, travelResult, documentResult, attendanceResult, memberMeetingResult].some((result) => result.error)) {
      return null;
    }

    const billingRows: DashboardBilling[] = (
      (billingResult.data ?? []) as DashboardBillingDatabaseRow[]
    ).map((row) => ({
      participantId: row.participant_id,
      paymentStatus: row.payment_status,
    }));
    const travelRows: DashboardTravel[] = (
      (travelResult.data ?? []) as DashboardTravelDatabaseRow[]
    ).map((row) => ({
      participantId: row.participant_id,
      outboundDate: row.outbound_date,
      outboundTime: row.outbound_time,
      returnDate: row.return_date,
      returnTime: row.return_time,
    }));
    const attendanceRows = (attendanceResult.data ?? []) as AttendanceRow[];
    const dashboardAttendance: DashboardAttendance[] = attendanceRows
      .map((row) => {
        const code = sessions.find((session) => session.id === row.session_id)?.code;
        return code === "ARRIVAL" || code === "SEMINAR" || code === "DAY3"
          ? { participantId: row.participant_id, sessionCode: code }
          : null;
      })
      .filter((row): row is DashboardAttendance => row !== null);
    const kpis = calculateDashboardKpis(
      registeredParticipantKpis,
      billingRows,
      travelRows,
      ((documentResult.data ?? []) as DashboardDocumentRow[]).map(
        (row) => row.participant_id,
      ),
      dashboardAttendance,
    );
    const memberMeetingRows = (memberMeetingResult.data ?? []) as MemberMeetingRow[];
    let stationRows: StationRow[] = [];

    if (canViewScanner) {
      const stationsResult = await adminSupabase
        .from("scanner_stations")
        .select(
          "id, station_name, session_id, status, paired_operator_id, last_activity_at, closed_at",
        );

      if (stationsResult.error) {
        return null;
      }

      stationRows = (stationsResult.data ?? []) as StationRow[];
    }
    const activeSessionRows = sessions.filter((session) => session.status === "OPEN");
    const activeSessionIds = activeSessionRows.map((session) => session.id);
    const attendanceCountBySession = new Map<string, number>();

    if (activeSessionIds.length > 0) {
      for (const attendance of attendanceRows) {
        if (!activeSessionIds.includes(attendance.session_id)) continue;
        attendanceCountBySession.set(
          attendance.session_id,
          (attendanceCountBySession.get(attendance.session_id) ?? 0) + 1,
        );
      }
    }

    const pairedOperatorIds = Array.from(
      new Set(
        stationRows
          .map((station) => station.paired_operator_id)
          .filter((id): id is string => id !== null),
      ),
    );
    let profiles: ProfileRow[] = [];

    if (pairedOperatorIds.length > 0) {
      const { data: profileData, error: profileError } = await adminSupabase
        .from("profiles")
        .select("id, full_name")
        .in("id", pairedOperatorIds);

      if (profileError) {
        return null;
      }

      profiles = (profileData ?? []) as ProfileRow[];
    }

    const sessionById = new Map(sessions.map((session) => [session.id, session]));
    const profileNameById = new Map(
      profiles.map((profile) => [profile.id, profile.full_name]),
    );
    const activeSessions: DashboardSession[] = activeSessionRows.map((session) => ({
      ...session,
      attendanceCount: attendanceCountBySession.get(session.id) ?? 0,
    }));
    const activeAttendanceCount = activeSessions.reduce(
      (total, session) => total + session.attendanceCount,
      0,
    );
    const activeScannerCount = stationRows.filter(
      (station) =>
        (station.status === "PAIRED" || station.status === "ACTIVE") &&
        station.closed_at === null,
    ).length;
    const stations: DashboardStation[] = [...stationRows]
      .sort(compareStationRows)
      .slice(0, 5)
      .map((station) => {
        const session = sessionById.get(station.session_id);

        return {
          id: station.id,
          stationName: station.station_name,
          sessionCode: session?.code ?? "-",
          sessionName: session?.name ?? "Sesi tidak ditemukan",
          status: station.status,
          operatorName: station.paired_operator_id
            ? profileNameById.get(station.paired_operator_id) ??
              "Operator tidak ditemukan"
            : null,
          lastActivityAt: station.last_activity_at,
        };
      });

    return {
      registeredCount,
      activeSessionIds,
      activeSessions,
      activeAttendanceCount,
      activeScannerCount,
      stations,
      kpis,
      recentRegistrations: registeredParticipantKpis.slice(0, 5),
      memberMeeting: {
        total: memberMeetingRows.length,
        self: memberMeetingRows.filter((row) => row.attendance_type === "SELF").length,
        proxy: memberMeetingRows.filter((row) => row.attendance_type === "PROXY").length,
      },
    };
  } catch {
    return null;
  }
}

function DashboardHeader() {
  return (
    <header className="border-b border-[#dfd3bf] pb-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#142842] sm:text-3xl">
          Dashboard Operasional
        </h1>
        <p className="mt-1 text-sm text-[#5b6c7c]">
          Ringkasan operasional AKKAI 2026.
        </p>
      </div>
    </header>
  );
}

function DashboardError() {
  return (
    <main className="min-h-screen bg-[#f7f3ea] px-4 py-6 sm:px-8 sm:py-8">
      <section className="mx-auto max-w-[1380px]">
        <DashboardHeader />
        <div className="mt-6 rounded-2xl border border-[#ead3cc] bg-[#fff5f2] p-6 text-sm text-[#9b3d31]" role="alert">
          <p className="font-semibold">Dashboard belum dapat dimuat.</p>
          <p className="mt-1">
            Silakan muat ulang halaman atau coba beberapa saat lagi.
          </p>
        </div>
      </section>
    </main>
  );
}

function KpiCard({
  label,
  value,
  subtitle,
}: {
  label: string;
  value: number;
  subtitle: string;
}) {
  return (
    <article className="rounded-xl border border-[#e4d8c4] bg-[#fffdf8] px-4 py-3.5 sm:px-5 sm:py-4">
      <p className="text-sm font-semibold text-[#5b6c7c]">{label}</p>
      <p className="mt-1.5 text-3xl font-bold tracking-tight text-[#142842] sm:text-4xl">{value}</p>
      <p className="mt-1 text-sm text-[#897657]">{subtitle}</p>
    </article>
  );
}

function QuickActionCard({
  href,
  label,
  description,
  disabled = false,
  primary = false,
  supporting = false,
}: {
  href?: string;
  label: string;
  description: string;
  disabled?: boolean;
  primary?: boolean;
  supporting?: boolean;
}) {
  const content = (
    <div
      className={`min-h-12 rounded-lg border px-3.5 py-3 transition-colors ${
        disabled
          ? "border-[#dedbd3] bg-[#f2f0eb] text-[#77756e]"
          : primary
            ? "border-[#142842] bg-[#142842] text-white hover:bg-[#203d5d]"
            : supporting
              ? "border-[#e4d8c4] bg-transparent text-[#344d68] hover:border-[#b99a5a] hover:bg-[#fbf5e8]"
              : "border-[#e4d8c4] bg-[#fffdf8] text-[#142842] hover:border-[#b99a5a] hover:bg-[#fbf5e8]"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">{label}</h3>
        {disabled ? (
          <span className="rounded-full bg-[#dedbd3] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide">
            Segera hadir
          </span>
        ) : (
          <span aria-hidden="true" className={`text-lg ${primary ? "text-[#d9ad45]" : "text-[#9a7526]"}`}>
            →
          </span>
        )}
      </div>
      <p className={`mt-1 text-xs leading-4 ${primary ? "text-white/70" : "text-[#5b6c7c]"}`}>{description}</p>
    </div>
  );

  return href && !disabled ? <Link href={href}>{content}</Link> : content;
}

function SessionCard({
  session,
}: {
  session: DashboardSession;
}) {
  return (
    <article className="rounded-xl border border-[#e4d8c4] bg-[#fffdf8] px-4 py-3.5 sm:px-5 sm:py-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#edf7ef] px-2.5 py-1 text-xs font-bold text-[#267044]">
            <span aria-hidden="true">●</span>
            Aktif
          </span>
          <h3 className="mt-2 break-words text-lg font-semibold text-[#142842] sm:text-xl">{session.name}</h3>
          <p className="mt-0.5 text-sm text-[#5b6c7c]">{formatEventDate(session.event_date)}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-2xl font-bold tracking-tight text-[#142842]">{session.attendanceCount}</p>
          <p className="mt-0.5 text-xs text-[#897657]">peserta check-in</p>
        </div>
      </div>
    </article>
  );
}

function StationCard({ station }: { station: DashboardStation }) {
  return (
    <article className="border-b border-[#eee6d8] py-3.5 last:border-b-0 sm:grid sm:grid-cols-[minmax(150px,1.2fr)_minmax(130px,1fr)_minmax(110px,0.8fr)_minmax(110px,0.8fr)_auto] sm:items-center sm:gap-4">
      <div className="min-w-0">
        <h3 className="break-words font-semibold text-[#142842]">{station.stationName}</h3>
      </div>
      <div className="mt-1 min-w-0 sm:mt-0">
        <p className="break-words text-sm text-[#5b6c7c]">{station.sessionName}</p>
      </div>
      <div className="mt-2 min-w-0 sm:mt-0">
        <p className="text-xs uppercase tracking-wide text-[#897657] sm:hidden">Operator</p>
        <p className="mt-0.5 break-words text-sm font-medium text-[#344d68] sm:mt-0">
          {station.operatorName ?? "Belum dipasangkan"}
        </p>
      </div>
      <div className="mt-2 min-w-0 sm:mt-0">
        <p className="text-xs uppercase tracking-wide text-[#897657] sm:hidden">Aktivitas</p>
        <p className="mt-0.5 text-sm font-medium text-[#344d68] sm:mt-0">
          {formatActivityTime(station.lastActivityAt)}
        </p>
      </div>
      <span
        className={`mt-2 inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold sm:mt-0 ${stationStatusClassName(
          station.status,
        )}`}
      >
        <span aria-hidden="true">●</span>
        {formatStationStatus(station.status)}
      </span>
    </article>
  );
}

function formatActivityTime(dateValue: string | null) {
  if (!dateValue) {
    return "Belum ada aktivitas";
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "Waktu tidak tersedia";
  }

  return `${new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(date)} WIB`;
}

function getQuickActions(profile: UserProfile) {
  const actions = [
    {
      href: "/admin/scanner/pair",
      label: "Pasangkan Scanner",
      description: "Hubungkan scanner dengan station.",
      visible: hasPermission(profile.role, "scanner.pair"),
    },
    {
      href: "/admin/participants",
      label: "Kelola Peserta",
      description: "Cari dan kelola data peserta.",
      visible: hasPermission(profile.role, "participants.view"),
    },
    {
      href: "/admin/display",
      label: "Buka Live Display",
      description: "Tampilkan check-in peserta secara real-time.",
      visible: hasPermission(profile.role, "display.view"),
    },
    {
      href: "/admin/sessions",
      label: "Kelola Sesi",
      description: "Atur status sesi operasional.",
      visible: hasPermission(profile.role, "sessions.view"),
      supporting: true,
    },
    {
      href: "/admin/display/setup",
      label: "Siapkan Station",
      description: "Siapkan dan kelola scanner station.",
      visible: hasPermission(profile.role, "display.manage"),
      supporting: true,
    },
  ];

  return actions.filter((action) => action.visible);
}

export default async function AdminDashboardPage() {
  const profile = await requirePermission("dashboard.view");
  const canViewScanner = canLoadScannerDashboardData(profile.role);
  const canViewDashboardRealtime = canSubscribeToDashboardRealtime(profile.role);
  const dashboardData = await loadDashboardData(canViewScanner);

  if (!dashboardData) {
    return <DashboardError />;
  }

  const activeSessionCount = dashboardData.activeSessions.length;
  const checkInLabel =
    activeSessionCount === 1
      ? "Sudah Check-in"
      : activeSessionCount > 1
        ? "Total Check-in Sesi Aktif"
        : "Sudah Check-in";
  const checkInSubtitle =
    activeSessionCount === 1
      ? dashboardData.activeSessions[0].name
      : activeSessionCount > 1
        ? `${activeSessionCount} sesi sedang aktif`
        : "Belum ada sesi aktif";
  const quickActions = getQuickActions(profile);
  const primaryActions = quickActions.filter((action) => !action.supporting);
  const supportingActions = quickActions.filter((action) => action.supporting);
  const stationManagementHref = hasPermission(profile.role, "display.manage")
    ? "/admin/display/setup"
    : hasPermission(profile.role, "scanner.pair")
      ? "/admin/scanner/pair"
      : null;

  return (
    <main className="min-h-screen bg-[#f7f3ea] px-4 py-5 sm:px-8 sm:py-6">
      <section className="mx-auto max-w-[1380px]">
        {canViewDashboardRealtime ? (
          <DashboardRealtimeClient sessionIds={dashboardData.activeSessionIds} />
        ) : null}
        <DashboardHeader />

        <section className="mt-4" aria-labelledby="active-session-heading">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold tracking-[0.16em] text-[#9a7526]">STATUS OPERASIONAL</p>
              <h2 className="mt-1 text-xl font-semibold text-[#142842]" id="active-session-heading">Sesi Aktif</h2>
            </div>
            {hasPermission(profile.role, "sessions.view") ? (
              <Link
                className="hidden min-h-11 items-center rounded-lg px-2 py-2 text-sm font-semibold text-[#344d68] underline underline-offset-4 outline-none hover:text-[#142842] focus-visible:ring-2 focus-visible:ring-[#9a7526] sm:inline-flex"
                href="/admin/sessions"
              >
                Lihat semua sesi
              </Link>
            ) : null}
          </div>

          {dashboardData.activeSessions.length === 0 ? (
            <div className="mt-3 flex flex-col gap-3 rounded-xl border border-[#e5cb8c] bg-[#fff9eb] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-4">
              <div>
                <p className="font-semibold text-[#142842]">Belum ada sesi aktif</p>
                <p className="mt-1 text-sm text-[#80631e]">
                  {hasPermission(profile.role, "sessions.manage") ? "Buka sesi untuk mulai menerima check-in peserta." : "Tunggu admin membuka sesi."}
                </p>
              </div>
              {hasPermission(profile.role, "sessions.manage") ? (
                <Link
                  className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#142842] px-4 py-2.5 text-sm font-semibold text-white outline-none transition hover:bg-[#203d5d] focus-visible:ring-2 focus-visible:ring-[#9a7526]"
                  href="/admin/sessions"
                >
                  Kelola Sesi
                </Link>
              ) : null}
            </div>
          ) : (
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              {dashboardData.activeSessions.map((session) => (
                <SessionCard key={session.id} session={session} />
              ))}
            </div>
          )}
        </section>

        <section
          aria-label="Ringkasan operasional"
          className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        >
          <KpiCard
            label="Total Peserta"
            subtitle="Registrasi aktif"
            value={dashboardData.kpis.totalParticipants}
          />
          <KpiCard
            label="Total Lunas"
            subtitle="Billing berstatus PAID"
            value={dashboardData.kpis.paidCount}
          />
          <KpiCard
            label="Total Belum Dibayar"
            subtitle="Billing berstatus UNPAID"
            value={dashboardData.kpis.unpaidCount}
          />
          <KpiCard
            label="Persentase Pembayaran"
            subtitle="Dari billing yang tersedia"
            value={dashboardData.kpis.paymentPercentage}
          />
          <KpiCard
            label={checkInLabel}
            subtitle={checkInSubtitle}
            value={
              activeSessionCount === 0
                ? 0
                : activeSessionCount === 1
                  ? dashboardData.activeSessions[0].attendanceCount
                  : dashboardData.activeAttendanceCount
            }
          />
          {canViewScanner ? (
            <KpiCard
              label="Scanner Aktif"
              subtitle="Station siap digunakan"
              value={dashboardData.activeScannerCount}
            />
          ) : null}
        </section>

        <section aria-label="KPI detail peserta" className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <DistributionCard title="Distribusi Paket" values={dashboardData.kpis.packageDistribution} />
            <DistributionCard title="Pilihan Mengikuti Acara" values={dashboardData.kpis.participationDistribution} />
            <DistributionCard title="Kategori CIAC" values={dashboardData.kpis.ciacDistribution} />
            <DistributionCard title="Model / Ukuran Poloshirt" values={dashboardData.kpis.poloDistribution} />
          </div>
          <div className="grid gap-4">
            <TravelSummary kpis={dashboardData.kpis} />
            <section className="rounded-xl border border-[#e4d8c4] bg-[#fffdf8] p-4 sm:p-5">
              <h2 className="text-lg font-semibold text-[#142842]">Kehadiran dan Dokumen</h2>
              <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                <div><dt className="text-[#897657]">ARRIVAL</dt><dd className="font-bold text-[#142842]">{dashboardData.kpis.attendanceBySession.ARRIVAL} peserta</dd></div>
                <div><dt className="text-[#897657]">SEMINAR</dt><dd className="font-bold text-[#142842]">{dashboardData.kpis.attendanceBySession.SEMINAR} peserta</dd></div>
                <div><dt className="text-[#897657]">DAY3</dt><dd className="font-bold text-[#142842]">{dashboardData.kpis.attendanceBySession.DAY3} peserta</dd></div>
                <div><dt className="text-[#897657]">Surat Keterangan Kerja</dt><dd className="font-bold text-[#142842]">{dashboardData.kpis.certificateCount} dokumen</dd></div>
              </dl>
            </section>
            <section className="rounded-xl border border-[#e4d8c4] bg-[#fffdf8] p-4 sm:p-5">
              <h2 className="text-lg font-semibold text-[#142842]">Rapat Anggota</h2>
              {dashboardData.memberMeeting.total === 0 ? (
                <p className="mt-3 text-sm text-[#897657]">Belum ada data rapat anggota.</p>
              ) : (
                <p className="mt-3 text-sm text-[#5b6c7c]">
                  {dashboardData.memberMeeting.total} submission: {dashboardData.memberMeeting.self} hadir sendiri dan {dashboardData.memberMeeting.proxy} dikuasakan.
                </p>
              )}
            </section>
          </div>
        </section>

        <section className="mt-5 rounded-xl border border-[#e4d8c4] bg-[#fffdf8] p-4 sm:p-5" aria-labelledby="recent-registrations-heading">
          <h2 className="text-xl font-semibold text-[#142842]" id="recent-registrations-heading">Registrasi Terbaru</h2>
          {dashboardData.recentRegistrations.length === 0 ? (
            <p className="mt-3 text-sm text-[#897657]">Belum ada registrasi terbaru.</p>
          ) : (
            <div className="mt-3 divide-y divide-[#eee6d8]">
              {dashboardData.recentRegistrations.map((participant) => (
                <div className="flex flex-col gap-1 py-3 first:pt-0 sm:flex-row sm:items-center sm:justify-between" key={participant.id}>
                  <div>
                    <p className="font-semibold text-[#142842]">{participant.fullName}</p>
                    <p className="text-xs text-[#9a7526]">{participant.registrationId}</p>
                  </div>
                  <p className="text-sm text-[#5b6c7c]">{participant.packageType ?? "Paket belum diisi"} · {formatActivityTime(participant.createdAt)}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section
          className={`mt-5 ${canViewScanner ? "grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]" : ""}`}
        >
          {canViewScanner ? (
            <section
              aria-labelledby="station-heading"
              className="rounded-xl border border-[#e4d8c4] bg-[#fffdf8] px-4 sm:px-5"
            >
              <div className="flex items-end justify-between gap-4 border-b border-[#eee6d8] py-3.5">
                <div>
                  <p className="text-xs font-bold tracking-[0.16em] text-[#9a7526]">STATION MONITORING</p>
                  <h2 className="mt-1 text-xl font-semibold text-[#142842]" id="station-heading">
                    Scanner Station
                  </h2>
                </div>
                {stationManagementHref ? (
                  <Link
                    className="hidden min-h-11 items-center rounded-lg px-2 py-2 text-sm font-semibold text-[#344d68] underline underline-offset-4 outline-none hover:text-[#142842] focus-visible:ring-2 focus-visible:ring-[#9a7526] sm:inline-flex"
                    href={stationManagementHref}
                  >
                    {hasPermission(profile.role, "display.manage") ? "Siapkan Station" : "Pasangkan Scanner"}
                  </Link>
                ) : null}
              </div>

              {dashboardData.stations.length === 0 ? (
                <div className="py-6">
                  <p className="font-semibold text-[#142842]">Belum ada scanner station</p>
                  <p className="mt-1 text-sm text-[#5b6c7c]">Siapkan station untuk mulai memantau perangkat scanner.</p>
                  {stationManagementHref ? (
                    <Link
                      className="mt-4 inline-flex min-h-11 items-center rounded-lg border border-[#b99a5a] px-4 py-2.5 text-sm font-semibold text-[#6d531e] outline-none transition hover:bg-[#fbf5e8] focus-visible:ring-2 focus-visible:ring-[#9a7526]"
                      href={stationManagementHref}
                    >
                      {hasPermission(profile.role, "display.manage") ? "Siapkan Station" : "Pasangkan Scanner"}
                    </Link>
                  ) : null}
                </div>
              ) : (
                <div>
                  {dashboardData.stations.map((station) => (
                    <StationCard key={station.id} station={station} />
                  ))}
                </div>
              )}
            </section>
          ) : null}

          <section className="rounded-xl border border-[#e4d8c4] bg-[#fffdf8] p-4 sm:p-5" aria-labelledby="actions-heading">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-bold tracking-[0.16em] text-[#9a7526]">AKSI HARI ACARA</p>
                <h2 className="mt-1 text-xl font-semibold text-[#142842]" id="actions-heading">Aksi Hari Acara</h2>
              </div>
            </div>
            <div className="mt-3 grid gap-3">
              {primaryActions.map((action, index) => (
                <div key={action.label} className={index === 0 ? "rounded-xl bg-[#142842] p-1" : ""}>
                  <QuickActionCard
                    description={action.description}
                    href={action.href}
                    label={action.label}
                    primary={index === 0}
                  />
                </div>
              ))}
            </div>
            {supportingActions.length > 0 ? (
              <div className="mt-5 border-t border-[#dfd3bf] pt-4">
                <p className="text-xs font-bold tracking-[0.14em] text-[#897657]">ADMINISTRASI</p>
                <div className="mt-2 grid gap-2">
                  {supportingActions.map((action) => (
                    <QuickActionCard
                      description={action.description}
                      href={action.href}
                      key={action.label}
                      label={action.label}
                      supporting
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        </section>
      </section>
    </main>
  );
}
