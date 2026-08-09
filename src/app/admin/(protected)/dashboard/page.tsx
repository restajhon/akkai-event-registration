import Link from "next/link";

import { signOut } from "@/app/admin/actions";
import { requireRole, type UserProfile, type UserRole } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
  code: string;
  name: string;
  event_date: string;
  status: SessionStatus;
};

type AttendanceRow = {
  session_id: string;
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
  activeSessions: DashboardSession[];
  activeAttendanceCount: number;
  activeScannerCount: number;
  stations: DashboardStation[];
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

function formatDateTime(dateValue: string | null) {
  if (!dateValue) {
    return "Belum ada aktivitas";
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "Waktu tidak tersedia";
  }

  const formatted = new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(date);

  return `${formatted} WIB`;
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
      return "Terputus";
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

async function loadDashboardData(): Promise<DashboardData | null> {
  try {
    const adminSupabase = createAdminClient();
    const [participantsResult, sessionsResult, stationsResult] = await Promise.all([
      adminSupabase
        .from("participants")
        .select("id", { count: "exact", head: true })
        .eq("registration_status", "REGISTERED"),
      adminSupabase
        .from("sessions")
        .select("id, code, name, event_date, status")
        .order("event_date", { ascending: true })
        .order("code", { ascending: true }),
      adminSupabase
        .from("scanner_stations")
        .select(
          "id, station_name, session_id, status, paired_operator_id, last_activity_at, closed_at",
        ),
    ]);

    if (
      participantsResult.error ||
      sessionsResult.error ||
      stationsResult.error
    ) {
      return null;
    }

    const registeredCount = participantsResult.count ?? 0;
    const sessions = (sessionsResult.data ?? []) as SessionRow[];
    const stationRows = (stationsResult.data ?? []) as StationRow[];
    const activeSessionRows = sessions.filter((session) => session.status === "OPEN");
    const activeSessionIds = activeSessionRows.map((session) => session.id);
    const attendanceCountBySession = new Map<string, number>();

    if (activeSessionIds.length > 0) {
      const { data: attendanceData, error: attendanceError } = await adminSupabase
        .from("attendance")
        .select("session_id")
        .in("session_id", activeSessionIds);

      if (attendanceError) {
        return null;
      }

      const attendanceRows = (attendanceData ?? []) as AttendanceRow[];

      for (const attendance of attendanceRows) {
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
      activeSessions,
      activeAttendanceCount,
      activeScannerCount,
      stations,
    };
  } catch {
    return null;
  }
}

function DashboardHeader({ profile }: { profile: UserProfile }) {
  return (
    <header className="flex flex-col gap-5 rounded-2xl border border-[#e4d8c4] bg-[#fffdf8] p-5 shadow-sm sm:p-7 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p className="text-sm font-semibold tracking-[0.2em] text-[#9a7526]">
          AKKAI 2026
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#142842]">
          Admin Control Center
        </h1>
        <p className="mt-2 text-sm text-[#5b6c7c]">
          Ringkasan operasional registrasi, sesi, dan scanner event.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="rounded-xl bg-[#f1eadc] px-4 py-3 text-sm">
          <p className="font-semibold text-[#142842]">{profile.full_name}</p>
          <span className="mt-1 inline-flex rounded-full bg-[#142842] px-2.5 py-1 text-xs font-semibold text-[#fffdf8]">
            {profile.role}
          </span>
        </div>
        <form action={signOut}>
          <button
            className="w-full rounded-lg border border-[#b99a5a] px-4 py-3 text-sm font-semibold text-[#6d531e] hover:bg-[#fbf5e8] sm:w-auto"
            type="submit"
          >
            Logout
          </button>
        </form>
      </div>
    </header>
  );
}

function DashboardError({ profile }: { profile: UserProfile }) {
  return (
    <main className="min-h-screen bg-[#f7f3ea] px-4 py-6 sm:px-8 sm:py-8">
      <section className="mx-auto max-w-7xl">
        <DashboardHeader profile={profile} />
        <div className="mt-6 rounded-2xl border border-[#ead3cc] bg-[#fff5f2] p-6 text-sm text-[#9b3d31]" role="alert">
          <p className="font-semibold">Dashboard belum dapat dimuat.</p>
          <p className="mt-1">
            Silakan muat ulang halaman atau coba beberapa saat lagi.
          </p>
        </div>
        <div className="mt-5 flex flex-wrap gap-4 text-sm font-semibold">
          <Link className="text-[#344d68] underline underline-offset-4" href="/admin/sessions">
            Sessions
          </Link>
          <Link className="text-[#344d68] underline underline-offset-4" href="/admin/scanner/pair">
            Pairing
          </Link>
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
    <article className="relative overflow-hidden rounded-2xl border border-[#e4d8c4] bg-[#fffdf8] p-5 shadow-sm">
      <div className="absolute inset-y-0 left-0 w-1 bg-[#d9ad45]" />
      <p className="text-sm font-semibold text-[#5b6c7c]">{label}</p>
      <p className="mt-3 text-4xl font-bold tracking-tight text-[#142842]">{value}</p>
      <p className="mt-2 text-sm text-[#897657]">{subtitle}</p>
    </article>
  );
}

function QuickActionCard({
  href,
  label,
  description,
  disabled = false,
}: {
  href?: string;
  label: string;
  description: string;
  disabled?: boolean;
}) {
  const content = (
    <div
      className={`rounded-2xl border p-5 transition-colors ${
        disabled
          ? "border-[#dedbd3] bg-[#f2f0eb] text-[#77756e]"
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
          <span aria-hidden="true" className="text-lg text-[#9a7526]">
            →
          </span>
        )}
      </div>
      <p className="mt-2 text-sm leading-6">{description}</p>
    </div>
  );

  return href && !disabled ? <Link href={href}>{content}</Link> : content;
}

function SessionCard({
  session,
  registeredCount,
}: {
  session: DashboardSession;
  registeredCount: number;
}) {
  const percentage =
    registeredCount > 0
      ? Math.min(
          100,
          Math.round((session.attendanceCount / registeredCount) * 100),
        )
      : 0;

  return (
    <article className="rounded-2xl border border-[#e4d8c4] bg-[#fffdf8] p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#e9f5ed] px-2.5 py-1 text-xs font-semibold text-[#267044]">
              OPEN
            </span>
            <span className="text-sm font-bold tracking-[0.12em] text-[#9a7526]">
              {session.code}
            </span>
          </div>
          <h3 className="mt-3 text-xl font-semibold text-[#142842]">{session.name}</h3>
          <p className="mt-1 text-sm text-[#5b6c7c]">
            {formatEventDate(session.event_date)}
          </p>
        </div>
        <p className="text-3xl font-bold text-[#142842]">{percentage}%</p>
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="font-medium text-[#344d68]">
            {session.attendanceCount} dari {registeredCount} peserta sudah check-in
          </span>
          <span className="text-[#897657]">{percentage}%</span>
        </div>
        <div
          aria-label={`${percentage}% peserta sudah check-in`}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={percentage}
          className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#eee6d8]"
          role="progressbar"
        >
          <div
            className="h-full rounded-full bg-[#d9ad45] transition-[width]"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </article>
  );
}

function StationCard({ station }: { station: DashboardStation }) {
  return (
    <article className="rounded-xl border border-[#e4d8c4] bg-[#fffdf8] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-[#142842]">{station.stationName}</h3>
          <p className="mt-1 text-sm text-[#5b6c7c]">
            {station.sessionCode} - {station.sessionName}
          </p>
        </div>
        <span
          className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-xs font-semibold ${stationStatusClassName(
            station.status,
          )}`}
        >
          {formatStationStatus(station.status)}
        </span>
      </div>
      <dl className="mt-4 grid gap-2 text-sm text-[#5b6c7c] sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wide text-[#897657]">Operator</dt>
          <dd className="mt-1 font-medium text-[#344d68]">
            {station.operatorName ?? "Belum dipasangkan"}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-[#897657]">Aktivitas terakhir</dt>
          <dd className="mt-1 font-medium text-[#344d68]">
            {formatDateTime(station.lastActivityAt)}
          </dd>
        </div>
      </dl>
    </article>
  );
}

function getQuickActions(role: UserRole) {
  const actions = [
    {
      href: "/admin/sessions",
      label: "Sessions",
      description: "Kelola dan lihat status sesi event.",
      visible: true,
    },
    {
      href: "/admin/display/setup",
      label: "Stations",
      description: "Siapkan dan kelola scanner station.",
      visible: role === "ADMIN",
    },
    {
      href: "/admin/scanner/pair",
      label: "Pairing",
      description: "Pasangkan scanner dengan operator.",
      visible: true,
    },
  ];

  return actions.filter((action) => action.visible);
}

export default async function AdminDashboardPage() {
  const profile = await requireRole(["ADMIN", "OPERATOR"]);
  const dashboardData = await loadDashboardData();

  if (!dashboardData) {
    return <DashboardError profile={profile} />;
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
      ? `Pada sesi ${dashboardData.activeSessions[0].code}`
      : activeSessionCount > 1
        ? `${activeSessionCount} sesi sedang aktif`
        : "Belum ada sesi aktif";
  const sessionSubtitle =
    activeSessionCount === 1
      ? dashboardData.activeSessions[0].code
      : activeSessionCount > 1
        ? `${activeSessionCount} sesi sedang berjalan`
        : "Tidak ada sesi aktif";
  const quickActions = getQuickActions(profile.role);

  return (
    <main className="min-h-screen bg-[#f7f3ea] px-4 py-6 sm:px-8 sm:py-8">
      <section className="mx-auto max-w-7xl">
        <DashboardHeader profile={profile} />

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Peserta Terdaftar"
            subtitle="Peserta dengan registrasi aktif"
            value={dashboardData.registeredCount}
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
          <KpiCard
            label="Sesi Aktif"
            subtitle={sessionSubtitle}
            value={activeSessionCount}
          />
          <KpiCard
            label="Scanner Aktif"
            subtitle="Scanner siap digunakan"
            value={dashboardData.activeScannerCount}
          />
        </section>

        <section className="mt-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold tracking-[0.16em] text-[#9a7526]">OPERATIONS</p>
              <h2 className="mt-1 text-2xl font-semibold text-[#142842]">Sesi Aktif</h2>
            </div>
            <Link
              className="text-sm font-semibold text-[#344d68] underline underline-offset-4 hover:text-[#142842]"
              href="/admin/sessions"
            >
              Lihat semua sesi
            </Link>
          </div>

          {dashboardData.activeSessions.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-[#cfc5b4] bg-[#fffdf8] p-8 text-center">
              <p className="font-semibold text-[#142842]">Belum ada sesi aktif.</p>
              <p className="mt-2 text-sm text-[#5b6c7c]">
                Buka sesi untuk mulai menerima check-in peserta.
              </p>
              {profile.role === "ADMIN" ? (
                <Link
                  className="mt-5 inline-flex rounded-lg bg-[#142842] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#203d5d]"
                  href="/admin/sessions"
                >
                  Kelola Sesi
                </Link>
              ) : null}
            </div>
          ) : (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {dashboardData.activeSessions.map((session) => (
                <SessionCard
                  key={session.id}
                  registeredCount={dashboardData.registeredCount}
                  session={session}
                />
              ))}
            </div>
          )}
        </section>

        <section className="mt-8">
          <div>
            <p className="text-sm font-semibold tracking-[0.16em] text-[#9a7526]">NAVIGATION</p>
            <h2 className="mt-1 text-2xl font-semibold text-[#142842]">Quick Actions</h2>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {quickActions.map((action) => (
              <QuickActionCard
                description={action.description}
                href={action.href}
                key={action.label}
                label={action.label}
              />
            ))}
            <QuickActionCard
              description="Tampilkan check-in peserta secara realtime."
              href="/admin/display"
              label="Live Display"
            />
          </div>
        </section>

        <section className="mt-8 pb-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold tracking-[0.16em] text-[#9a7526]">STATION MONITORING</p>
              <h2 className="mt-1 text-2xl font-semibold text-[#142842]">Scanner Station</h2>
            </div>
            <Link
              className="text-sm font-semibold text-[#344d68] underline underline-offset-4 hover:text-[#142842]"
              href={profile.role === "ADMIN" ? "/admin/display/setup" : "/admin/scanner/pair"}
            >
              {profile.role === "ADMIN" ? "Kelola station" : "Lihat scanner saya"}
            </Link>
          </div>

          {dashboardData.stations.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-[#cfc5b4] bg-[#fffdf8] p-8 text-center">
              <p className="font-semibold text-[#142842]">Belum ada scanner station.</p>
            </div>
          ) : (
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {dashboardData.stations.map((station) => (
                <StationCard key={station.id} station={station} />
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
