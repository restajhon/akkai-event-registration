import Link from "next/link";
import {
  ArrowUpRight,
  Award,
  CalendarClock,
  ChartNoAxesColumn,
  CircleCheck,
  ClipboardCheck,
  Clock3,
  FileText,
  Info,
  ListChecks,
  MonitorPlay,
  Package,
  Plane,
  Plus,
  RadioTower,
  ScanLine,
  Shirt,
  Users,
  type LucideIcon,
} from "lucide-react";

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

function DashboardSectionHeading({
  action,
  eyebrow,
  id,
  title,
}: {
  action?: React.ReactNode;
  eyebrow?: string;
  id?: string;
  title: string;
}) {
  return (
    <div className="flex w-full items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-[10px] font-bold tracking-[0.17em] text-[#9a7526]">{eyebrow}</p>
        ) : null}
        <h2 className="mt-1 break-words text-[20px] font-normal leading-tight text-[#142842]" id={id}>{title}</h2>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function DashboardMetricCard({
  icon: Icon,
  label,
  progress,
  subtitle,
  value,
}: {
  icon: LucideIcon;
  label: string;
  progress?: number;
  subtitle: string;
  value: React.ReactNode;
}) {
  const safeProgress = progress === undefined ? undefined : Math.max(0, Math.min(100, progress));

  return (
    <article className="flex min-w-0 flex-col justify-between rounded-[10px] border border-[#e4d8c4] bg-[#fffdf8] p-[17px] shadow-none max-sm:min-h-[118px] max-sm:p-[14px] lg:h-36">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[11px] font-semibold text-[#5b6c7c] max-sm:text-[10px]">{label}</p>
        <Icon aria-hidden="true" className="shrink-0 text-[#142842] max-sm:h-[15px] max-sm:w-[15px]" size={17} strokeWidth={1.8} />
      </div>
      <div>
        <p className="mt-3 break-words text-[28px] font-normal leading-none tracking-tight text-[#142842] max-sm:mt-0 max-sm:text-[25px]">{value}</p>
        {safeProgress !== undefined ? (
          <div aria-label={`${safeProgress}%`} aria-valuemax={100} aria-valuemin={0} aria-valuenow={safeProgress} className="mt-3 h-1 overflow-hidden rounded-full bg-[#e9e3d8]" role="progressbar">
            <div className="h-full rounded-full bg-[#9a7526]" style={{ width: `${safeProgress}%` }} />
          </div>
        ) : null}
        <p className="mt-2 truncate text-[10px] leading-4 text-[#8793a0]">{subtitle}</p>
      </div>
    </article>
  );
}

function InsightList({
  icon: Icon,
  title,
  values,
}: {
  icon: LucideIcon;
  title: string;
  values: Record<string, number>;
}) {
  const entries = Object.entries(values);

  return (
    <div>
      <div className="flex items-center gap-2">
        <Icon aria-hidden="true" className="shrink-0 text-[#9a7526]" size={17} strokeWidth={1.8} />
        <h3 className="text-[14px] font-normal text-[#142842]">{title}</h3>
      </div>
      <dl className="mt-2 divide-y divide-[#eee6d8]">
        {entries.length === 0 ? (
          <div className="py-2 text-xs text-[#897657]">Belum ada data.</div>
        ) : (
          entries.map(([label, value]) => (
            <div className="flex min-h-[32px] items-center justify-between gap-3 py-2" key={label}>
              <dt className="break-words text-xs text-[#344d68]">{label}</dt>
              <dd className="shrink-0 text-xs font-bold text-[#142842]">{value}</dd>
            </div>
          ))
        )}
      </dl>
    </div>
  );
}

function ParticipantInsights({ kpis }: { kpis: ReturnType<typeof calculateDashboardKpis> }) {
  const poloEntries = Object.entries(kpis.poloDistribution);
  const longSleeve = poloEntries.filter(([label]) => /panjang/i.test(label));
  const shortSleeve = poloEntries.filter(([label]) => !/panjang/i.test(label));

  return (
    <section className="flex flex-col gap-3.5" aria-labelledby="participant-profile-heading">
      <DashboardSectionHeading eyebrow="KPI DETAIL PESERTA" id="participant-profile-heading" title="Profil Kebutuhan Peserta" />
      <div className="grid gap-3.5 lg:min-h-[374px] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_382px]">
        <article className="rounded-[10px] border border-[#e4d8c4] bg-[#fffdf8] p-5 lg:min-h-[374px]">
          <InsightList icon={Package} title="Distribusi Paket" values={kpis.packageDistribution} />
          <div className="my-3 border-t border-[#eee6d8]" />
          <InsightList icon={Award} title="Kategori CIAC" values={kpis.ciacDistribution} />
        </article>
        <article className="rounded-[10px] border border-[#e4d8c4] bg-[#fffdf8] p-5 lg:min-h-[374px]">
          <InsightList icon={ListChecks} title="Pilihan Mengikuti Acara" values={kpis.participationDistribution} />
          <div className="mt-3 flex gap-2.5 rounded-lg bg-[#f7f3ea] p-3 text-[11px] leading-4 text-[#5b6c7c]">
            <Info aria-hidden="true" className="mt-0.5 shrink-0 text-[#9a7526]" size={16} strokeWidth={1.8} />
            <span>Pilihan peserta digunakan untuk kesiapan sesi dan kehadiran.</span>
          </div>
        </article>
        <article className="rounded-[10px] border border-[#e4d8c4] bg-[#fffdf8] p-5 lg:min-h-[374px]">
          <div className="flex items-center gap-2">
            <Shirt aria-hidden="true" className="shrink-0 text-[#9a7526]" size={17} strokeWidth={1.8} />
            <h3 className="text-[14px] font-normal text-[#142842]">Model / Ukuran Poloshirt</h3>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-5">
            <PoloColumn label="LENGAN PANJANG" entries={longSleeve} />
            <PoloColumn label="LENGAN PENDEK" entries={shortSleeve} />
          </div>
        </article>
      </div>
    </section>
  );
}

function PoloColumn({
  entries,
  label,
}: {
  entries: Array<[string, number]>;
  label: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[9px] font-bold tracking-[0.12em] text-[#9a7526]">{label}</p>
      <dl className="mt-1 divide-y divide-[#eee6d8]">
        {entries.length === 0 ? (
          <div className="py-2 text-xs text-[#897657]">Belum ada</div>
        ) : (
          entries.map(([key, value]) => (
            <div className="flex min-h-[32px] items-center justify-between gap-2 py-2" key={key}>
              <dt className="truncate text-xs text-[#344d68]">{key.replace(/^(Lengan Panjang|Lengan Pendek)\s*\/\s*/i, "")}</dt>
              <dd className="text-xs font-bold text-[#142842]">{value}</dd>
            </div>
          ))
        )}
      </dl>
    </div>
  );
}

function ReadinessCard({
  children,
  icon: Icon,
  title,
}: {
  children: React.ReactNode;
  icon: LucideIcon;
  title: string;
}) {
  return (
    <article className="min-w-0 rounded-[10px] border border-[#e4d8c4] bg-[#fffdf8] p-5 lg:h-[266px]">
      <div className="flex items-center gap-2">
        <Icon aria-hidden="true" className="shrink-0 text-[#9a7526]" size={17} strokeWidth={1.8} />
        <h3 className="text-[14px] font-normal text-[#142842]">{title}</h3>
      </div>
      {children}
    </article>
  );
}

function ReadinessRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex min-h-[32px] items-center justify-between gap-3 border-b border-[#eee6d8] py-2 last:border-b-0">
      <span className="break-words text-xs text-[#344d68]">{label}</span>
      <span className="shrink-0 text-xs font-bold text-[#142842]">{value}</span>
    </div>
  );
}

function TravelReadiness({ kpis }: { kpis: ReturnType<typeof calculateDashboardKpis> }) {
  const rows = [
    ["ARRIVAL", kpis.travel.arrivalComplete, kpis.travel.arrivalIncomplete],
    ["DEPARTURE", kpis.travel.departureComplete, kpis.travel.departureIncomplete],
  ] as const;

  return (
    <ReadinessCard icon={Plane} title="Kelengkapan Travel">
      <div className="mt-4 grid gap-5">
        {rows.map(([label, complete, incomplete]) => {
          const percentage = kpis.totalParticipants === 0 ? 0 : Math.round((complete / kpis.totalParticipants) * 100);
          return (
            <div className="grid gap-2" key={label}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-bold tracking-[0.11em] text-[#9a7526]">{label}</p>
                <p className="text-[10px] text-[#5b6c7c]">{complete} lengkap · {incomplete} belum lengkap</p>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[#e9e3d8]">
                <div className="h-full rounded-full bg-[#9a7526]" style={{ width: `${percentage}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </ReadinessCard>
  );
}

function AttendanceReadiness({ kpis }: { kpis: ReturnType<typeof calculateDashboardKpis> }) {
  return (
    <ReadinessCard icon={ClipboardCheck} title="Kehadiran dan Dokumen">
      <dl className="mt-3">
        <ReadinessRow label="ARRIVAL" value={`${kpis.attendanceBySession.ARRIVAL} peserta`} />
        <ReadinessRow label="SEMINAR" value={`${kpis.attendanceBySession.SEMINAR} peserta`} />
        <ReadinessRow label="DAY3" value={`${kpis.attendanceBySession.DAY3} peserta`} />
        <ReadinessRow label="Surat Keterangan Kerja" value={`${kpis.certificateCount} dokumen`} />
      </dl>
    </ReadinessCard>
  );
}

function MemberMeetingReadiness({
  memberMeeting,
}: {
  memberMeeting: DashboardData["memberMeeting"];
}) {
  return (
    <ReadinessCard icon={FileText} title="Rapat Anggota">
      <div className="mt-5 flex items-end gap-2">
        <p className="text-[44px] font-normal leading-none text-[#142842]">{memberMeeting.total}</p>
        <p className="pb-1 text-xs font-semibold text-[#5b6c7c]">submission</p>
      </div>
      <p className="mt-4 text-[13px] leading-5 text-[#344d68]">
        {memberMeeting.self} hadir sendiri dan {memberMeeting.proxy} dikuasakan.
      </p>
    </ReadinessCard>
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
  canViewMemberMeeting: boolean,
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
      canViewMemberMeeting
        ? adminSupabase.from("member_meeting_submissions").select("attendance_type")
        : Promise.resolve({ data: [], error: null }),
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

function DashboardHeader({ ready = true }: { ready?: boolean }) {
  return (
    <header className="flex h-[82px] flex-col justify-end gap-1.5 border-b border-[#e4d8c4] pb-[18px] lg:h-[125px] lg:flex-row lg:items-end lg:justify-between lg:gap-4 lg:pb-6">
      <div className="min-w-0">
        <h1 className="font-[var(--font-admin-display)] text-[30px] font-normal leading-none tracking-[-0.015em] text-[#142842] lg:text-[38px]">
          Dashboard Operasional
        </h1>
        <p className="mt-2 truncate text-[13px] text-[#5b6c7c] lg:mt-1.5 lg:text-sm">
          Ringkasan operasional AKKAI 2026.
        </p>
      </div>
      <div className={`inline-flex w-fit items-center gap-2 rounded-lg border border-[#e4d8c4] bg-[#fffdf8] px-3 py-[9px] text-xs font-semibold ${ready ? "text-[#2f6b4f]" : "text-[#9a3e35]"}`}>
        <span aria-hidden="true" className={`h-[7px] w-[7px] rounded-full ${ready ? "bg-[#2f6b4f]" : "bg-[#9a3e35]"}`} />
        {ready ? "Sistem operasional siap" : "Sistem operasional bermasalah"}
      </div>
    </header>
  );
}

function DashboardError() {
  return (
    <main className="min-h-screen bg-[#f7f3ea] px-[18px] py-[26px] sm:px-8 lg:px-10 lg:py-[38px]">
      <section className="w-full">
        <DashboardHeader ready={false} />
        <div className="mt-7 rounded-[10px] border border-[#ead3cc] bg-[#fff5f2] p-6 text-sm text-[#9b3d31]" role="alert">
          <p className="font-semibold">Dashboard belum dapat dimuat.</p>
          <p className="mt-1">
            Silakan muat ulang halaman atau coba beberapa saat lagi.
          </p>
        </div>
      </section>
    </main>
  );
}

function QuickActionCard({
  href,
  icon: Icon,
  label,
  description,
  disabled = false,
  primary = false,
  supporting = false,
}: {
  href?: string;
  icon: LucideIcon;
  label: string;
  description: string;
  disabled?: boolean;
  primary?: boolean;
  supporting?: boolean;
}) {
  const content = (
    <div
      className={`flex h-full min-h-[126px] flex-col justify-between rounded-[10px] border p-[18px] transition-colors max-sm:grid max-sm:min-h-[96px] max-sm:grid-cols-[40px_minmax(0,1fr)_16px] max-sm:items-center max-sm:gap-[14px] max-sm:p-4 ${primary ? "lg:min-h-[150px]" : ""} ${
        disabled
          ? "border-[#dedbd3] bg-[#f2f0eb] text-[#77756e]"
          : primary
            ? "border-[#142842] bg-[#142842] text-white hover:bg-[#203d5d]"
            : supporting
              ? "border-[#e4d8c4] bg-[#fffdf8] text-[#344d68] hover:border-[#b99a5a] hover:bg-[#fbf5e8]"
              : "border-[#e4d8c4] bg-[#fffdf8] text-[#142842] hover:border-[#b99a5a] hover:bg-[#fbf5e8]"
      }`}
    >
      <div className="flex items-center justify-between gap-3 max-sm:contents">
        <Icon aria-hidden="true" className={`${primary ? "text-[#ead9ac]" : "text-[#9a7526]"} max-sm:order-1 max-sm:flex max-sm:h-10 max-sm:w-10 max-sm:items-center max-sm:justify-center max-sm:rounded-lg max-sm:p-[10px] ${primary ? "max-sm:bg-white/10" : "max-sm:bg-[#f7f3ea]"}`} size={21} strokeWidth={1.8} />
        {disabled ? (
          <span className="rounded-full bg-[#dedbd3] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide">
            Segera hadir
          </span>
        ) : (
          <ArrowUpRight aria-hidden="true" className={`${primary ? "text-[#fffdf8]" : "text-[#5b6c7c]"} max-sm:order-3`} size={16} strokeWidth={1.8} />
        )}
      </div>
      <div className="max-sm:order-2">
        <h3 className={`text-[14px] font-normal ${primary ? "text-[#fffdf8]" : "text-[#142842]"}`}>{label}</h3>
        <p className={`mt-1 text-[11px] leading-4 ${primary ? "text-[#d9e0e7]" : "text-[#5b6c7c]"}`}>{description}</p>
      </div>
    </div>
  );

  return href && !disabled ? <Link className="block h-full" href={href}>{content}</Link> : content;
}

function SessionEmptyState({ canManage }: { canManage: boolean }) {
  return (
    <div className="flex flex-col gap-4 rounded-[10px] border border-[#e4d8c4] bg-[#fffdf8] p-[18px] lg:h-[126px] lg:flex-row lg:items-center lg:justify-between lg:p-6">
      <div className="flex items-center gap-3 lg:gap-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#f7ecd4] lg:h-11 lg:w-11">
          <CalendarClock aria-hidden="true" className="text-[#98651d]" size={21} strokeWidth={1.8} />
        </span>
        <div>
          <p className="text-[14px] text-[#142842] lg:text-base">Belum ada sesi aktif</p>
          <p className="mt-1 text-[11px] text-[#5b6c7c] lg:text-[13px]">Buka sesi untuk mulai menerima check-in peserta.</p>
        </div>
      </div>
      {canManage ? (
        <Link className="inline-flex h-[42px] w-full items-center justify-center gap-2 rounded-lg bg-[#142842] px-[17px] text-[12px] text-[#fffdf8] outline-none transition hover:bg-[#203d5d] focus-visible:ring-2 focus-visible:ring-[#9a7526] lg:w-auto lg:text-[13px]" href="/admin/sessions">
          <ArrowUpRight aria-hidden="true" size={15} strokeWidth={1.8} />
          Kelola Sesi
        </Link>
      ) : null}
    </div>
  );
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
      icon: ScanLine,
      label: "Pasangkan Scanner",
      description: "Hubungkan scanner dengan station.",
      visible: hasPermission(profile.role, "scanner.pair"),
    },
    {
      href: "/admin/participants",
      icon: Users,
      label: "Kelola Peserta",
      description: "Cari dan kelola data peserta.",
      visible: hasPermission(profile.role, "participants.view"),
    },
    {
      href: "/admin/display",
      icon: MonitorPlay,
      label: "Buka Live Display",
      description: "Tampilkan check-in peserta secara real-time.",
      visible: hasPermission(profile.role, "display.view"),
    },
    {
      href: "/admin/sessions",
      icon: CalendarClock,
      label: "Kelola Sesi",
      description: "Atur status sesi operasional.",
      visible: hasPermission(profile.role, "sessions.view"),
      supporting: true,
    },
    {
      href: "/admin/display/setup",
      icon: RadioTower,
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
  const canViewMemberMeeting = hasPermission(profile.role, "member_meetings.view");
  const dashboardData = await loadDashboardData(canViewScanner, canViewMemberMeeting);

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
    <main className="min-h-screen bg-[#f7f3ea] px-[18px] py-[26px] pb-[38px] sm:px-8 lg:px-10 lg:py-[38px] lg:pb-12">
      <section className="flex w-full flex-col gap-7">
        {canViewDashboardRealtime ? (
          <DashboardRealtimeClient sessionIds={dashboardData.activeSessionIds} />
        ) : null}
        <DashboardHeader />

        <section className="flex flex-col gap-3" aria-labelledby="active-session-heading">
          <DashboardSectionHeading
            action={hasPermission(profile.role, "sessions.view") ? (
              <Link className="text-[11px] font-semibold text-[#9a7526] outline-none hover:text-[#142842] focus-visible:ring-2 focus-visible:ring-[#9a7526]" href="/admin/sessions">
                <span className="hidden sm:inline">Lihat semua sesi →</span>
                <span className="sm:hidden">Lihat semua</span>
              </Link>
            ) : null}
            eyebrow="STATUS OPERASIONAL"
            id="active-session-heading"
            title="Sesi Aktif"
          />

          {dashboardData.activeSessions.length === 0 ? (
            <SessionEmptyState canManage={hasPermission(profile.role, "sessions.manage")} />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {dashboardData.activeSessions.map((session) => (
                <SessionCard key={session.id} session={session} />
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="core-kpi-heading" className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <p className="text-[10px] font-bold tracking-[0.17em] text-[#9a7526]">RINGKASAN UTAMA</p>
            <h2 className="text-[19px] font-normal leading-tight text-[#142842] sm:hidden" id="core-kpi-heading">Ringkasan Peserta</h2>
          </div>
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-6 lg:gap-3" aria-label="Ringkasan operasional">
          <DashboardMetricCard
            icon={Users}
            label="Total Peserta"
            subtitle="Registrasi tercatat"
            value={dashboardData.kpis.totalParticipants}
          />
          <DashboardMetricCard
            icon={CircleCheck}
            label="Total Lunas"
            subtitle="Pembayaran terverifikasi"
            value={dashboardData.kpis.paidCount}
          />
          <DashboardMetricCard
            icon={Clock3}
            label="Belum Dibayar"
            subtitle="Menunggu pembayaran"
            value={dashboardData.kpis.unpaidCount}
          />
          <DashboardMetricCard
            icon={ChartNoAxesColumn}
            label="Pembayaran"
            progress={dashboardData.kpis.paymentPercentage}
            subtitle="Dari billing tersedia"
            value={`${dashboardData.kpis.paymentPercentage}%`}
          />
          <DashboardMetricCard
            icon={ClipboardCheck}
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
            <DashboardMetricCard
              icon={ScanLine}
              label="Scanner Aktif"
              subtitle={dashboardData.activeScannerCount === 0 ? "Tidak ada perangkat" : "Station siap digunakan"}
              value={dashboardData.activeScannerCount}
            />
          ) : null}
          </div>
        </section>

        <ParticipantInsights kpis={dashboardData.kpis} />

        <section className="flex flex-col gap-3.5" aria-labelledby="readiness-heading">
          <DashboardSectionHeading eyebrow="KESIAPAN ACARA" id="readiness-heading" title="Kesiapan Operasional" />
          <div className="grid gap-3 lg:grid-cols-3">
            <TravelReadiness kpis={dashboardData.kpis} />
            <AttendanceReadiness kpis={dashboardData.kpis} />
            {canViewMemberMeeting ? (
              <MemberMeetingReadiness memberMeeting={dashboardData.memberMeeting} />
            ) : null}
          </div>
        </section>

        <section className="flex flex-col gap-3.5" aria-labelledby="recent-registrations-heading">
          <DashboardSectionHeading
            action={hasPermission(profile.role, "participants.view") ? (
              <Link className="text-[11px] font-semibold text-[#9a7526] outline-none hover:text-[#142842] focus-visible:ring-2 focus-visible:ring-[#9a7526]" href="/admin/participants">
                <span className="hidden sm:inline">Lihat semua peserta →</span>
                <span className="sm:hidden">Lihat semua</span>
              </Link>
            ) : null}
            eyebrow="PESERTA TERBARU"
            id="recent-registrations-heading"
            title="Registrasi Terbaru"
          />
          {dashboardData.recentRegistrations.length === 0 ? (
            <div className="rounded-[10px] border border-[#e4d8c4] bg-[#fffdf8] p-5 text-sm text-[#897657]">Belum ada registrasi terbaru.</div>
          ) : (
            <>
              <div className="hidden overflow-hidden rounded-[10px] border border-[#e4d8c4] bg-[#fffdf8] sm:block">
                <div className="grid h-[42px] grid-cols-[360px_220px_220px_minmax(0,1fr)] items-center gap-4 bg-[#f3eee4] px-[18px] text-[9px] font-bold tracking-[0.115em] text-[#9a7526]">
                  <span>NAMA PESERTA</span>
                  <span>ID REGISTRASI</span>
                  <span>PAKET</span>
                  <span>WAKTU REGISTRASI</span>
                </div>
                {dashboardData.recentRegistrations.map((participant, index) => (
                  <div className={`grid min-h-[58px] grid-cols-[360px_220px_220px_minmax(0,1fr)] items-center gap-4 px-[18px] text-xs ${index < dashboardData.recentRegistrations.length - 1 ? "border-b border-[#eee6d8]" : ""}`} key={participant.id}>
                    <span className="font-semibold text-[#142842]">{participant.fullName}</span>
                    <span className="text-[#5b6c7c]">{participant.registrationId}</span>
                    <span className="text-[#5b6c7c]">{participant.packageType ?? "Paket belum diisi"}</span>
                    <span className="text-[#5b6c7c]">{formatActivityTime(participant.createdAt)}</span>
                  </div>
                ))}
              </div>
              <div className="grid gap-3 sm:hidden">
                {dashboardData.recentRegistrations.map((participant) => (
                  <article className="rounded-[9px] border border-[#e4d8c4] bg-[#fffdf8] p-[15px]" key={participant.id}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-[13px] text-[#142842]">{participant.fullName}</p>
                      <p className="shrink-0 text-[10px] font-semibold text-[#9a7526]">{participant.packageType ?? "Belum diisi"}</p>
                    </div>
                    <div className="mt-2 flex items-start justify-between gap-3 text-[10px] text-[#5b6c7c]">
                      <span>{participant.registrationId}</span>
                      <span>{formatActivityTime(participant.createdAt)}</span>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>

        {canViewScanner ? (
          <section className="flex flex-col gap-3.5" aria-labelledby="station-heading">
            <DashboardSectionHeading
              action={stationManagementHref ? (
                <Link className="text-[11px] font-semibold text-[#9a7526] outline-none hover:text-[#142842] focus-visible:ring-2 focus-visible:ring-[#9a7526]" href={stationManagementHref}>
                  <span className="hidden sm:inline">{hasPermission(profile.role, "display.manage") ? "Siapkan Station →" : "Pasangkan Scanner →"}</span>
                  <span className="sm:hidden">Siapkan</span>
                </Link>
              ) : null}
              eyebrow="STATION MONITORING"
              id="station-heading"
              title="Scanner Station"
            />
            {dashboardData.stations.length === 0 ? (
              <div className="flex flex-col gap-3 rounded-[10px] border border-[#e4d8c4] bg-[#fffdf8] p-4 lg:h-[132px] lg:flex-row lg:items-center lg:justify-between lg:px-[26px] lg:py-6">
                <div className="flex items-center gap-3 lg:gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#eff1f2] lg:h-11 lg:w-11">
                    <RadioTower aria-hidden="true" className="text-[#5b6c7c]" size={21} strokeWidth={1.8} />
                  </span>
                  <div>
                    <p className="text-[14px] text-[#142842] lg:text-base">Belum ada scanner station</p>
                    <p className="mt-1 text-[11px] text-[#5b6c7c] lg:text-[13px]">Siapkan station untuk mulai memantau perangkat scanner.</p>
                  </div>
                </div>
                {stationManagementHref ? (
                  <Link className="inline-flex h-[42px] w-full items-center justify-center gap-2 rounded-lg bg-[#142842] px-[17px] text-[12px] text-[#fffdf8] outline-none transition hover:bg-[#203d5d] focus-visible:ring-2 focus-visible:ring-[#9a7526] lg:w-auto lg:text-[13px]" href={stationManagementHref}>
                    <Plus aria-hidden="true" size={15} strokeWidth={1.8} />
                    {hasPermission(profile.role, "display.manage") ? "Siapkan Station" : "Pasangkan Scanner"}
                  </Link>
                ) : null}
              </div>
            ) : (
              <div className="rounded-[10px] border border-[#e4d8c4] bg-[#fffdf8] px-4 sm:px-5">
                {dashboardData.stations.map((station) => (
                  <StationCard key={station.id} station={station} />
                ))}
              </div>
            )}
          </section>
        ) : null}

        <section className="flex flex-col gap-3.5" aria-labelledby="actions-heading">
          <h2 className="text-[19px] font-normal leading-tight text-[#142842]" id="actions-heading">Aksi Hari Acara</h2>
          {primaryActions.length > 0 ? (
            <div className="grid gap-3.5 lg:grid-cols-3">
              {primaryActions.map((action, index) => (
                <QuickActionCard
                  description={action.description}
                  href={action.href}
                  icon={action.icon}
                  key={action.label}
                  label={action.label}
                  primary={index === 0}
                />
              ))}
            </div>
          ) : null}
          {supportingActions.length > 0 ? (
            <div className="flex flex-col gap-2.5">
              <p className="text-[10px] font-bold tracking-[0.17em] text-[#9a7526]">ADMINISTRASI</p>
              <div className="grid gap-3.5 lg:grid-cols-2">
                {supportingActions.map((action) => (
                  <QuickActionCard
                    description={action.description}
                    href={action.href}
                    icon={action.icon}
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
    </main>
  );
}
