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
    <header className="flex flex-col gap-4 border-b border-[#dfd3bf] pb-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-xs font-bold tracking-[0.2em] text-[#9a7526]">AKKAI 2026</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#142842] sm:text-3xl">
          Operational Dashboard
        </h1>
        <p className="mt-1 text-sm text-[#5b6c7c]">
          Pantau registrasi, sesi, dan scanner secara real-time.
        </p>
      </div>
      <div className="flex items-center justify-between gap-4 sm:justify-end">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[#142842]">{profile.full_name}</p>
          <span className="mt-1 inline-flex rounded-full bg-[#142842] px-2.5 py-1 text-[11px] font-semibold text-[#fffdf8]">
            {profile.role === "ADMIN" ? "Admin" : "Operator"}
          </span>
        </div>
        <form action={signOut}>
          <button
            className="min-h-11 rounded-lg border border-[#b99a5a] px-4 py-2.5 text-sm font-semibold text-[#6d531e] outline-none transition hover:bg-[#fbf5e8] focus-visible:ring-2 focus-visible:ring-[#9a7526]"
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
        <div className="mt-5 flex flex-wrap gap-3 text-sm font-semibold">
          <Link className="inline-flex min-h-11 items-center rounded-lg border border-[#b99a5a] px-4 py-2.5 text-[#6d531e] outline-none transition hover:bg-[#fbf5e8] focus-visible:ring-2 focus-visible:ring-[#9a7526]" href="/admin/sessions">
            Kelola Sesi
          </Link>
          <Link className="inline-flex min-h-11 items-center rounded-lg border border-[#b99a5a] px-4 py-2.5 text-[#6d531e] outline-none transition hover:bg-[#fbf5e8] focus-visible:ring-2 focus-visible:ring-[#9a7526]" href="/admin/scanner/pair">
            Pasangkan Scanner
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
    <article className="rounded-xl border border-[#e4d8c4] bg-[#fffdf8] p-4 sm:p-5">
      <p className="text-sm font-semibold text-[#5b6c7c]">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-[#142842] sm:text-4xl">{value}</p>
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
      className={`min-h-[92px] rounded-xl border p-4 transition-colors ${
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
      <p className={`mt-1 text-sm leading-5 ${primary ? "text-white/70" : "text-[#5b6c7c]"}`}>{description}</p>
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
    <article className="rounded-xl border border-[#e4d8c4] bg-[#fffdf8] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#edf7ef] px-2.5 py-1 text-xs font-bold text-[#267044]">
            <span aria-hidden="true">●</span>
            Aktif
          </span>
          <h3 className="mt-3 break-words text-xl font-semibold text-[#142842]">{session.name}</h3>
          <p className="mt-1 text-sm text-[#5b6c7c]">{formatEventDate(session.event_date)}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-2xl font-bold tracking-tight text-[#142842]">{session.attendanceCount}</p>
          <p className="mt-0.5 text-xs text-[#897657]">check-in</p>
        </div>
      </div>
      <p className="mt-4 border-t border-[#eee6d8] pt-3 text-sm text-[#5b6c7c]">
        {session.attendanceCount} peserta sudah check-in
      </p>
    </article>
  );
}

function StationCard({ station }: { station: DashboardStation }) {
  return (
    <article className="border-b border-[#eee6d8] py-4 first:pt-0 last:border-b-0 last:pb-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="break-words font-semibold text-[#142842]">{station.stationName}</h3>
          <p className="mt-1 text-sm text-[#5b6c7c]">
            {station.sessionName}
          </p>
        </div>
        <span
          className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${stationStatusClassName(
            station.status,
          )}`}
        >
          <span aria-hidden="true">●</span>
          {formatStationStatus(station.status)}
        </span>
      </div>
      <dl className="mt-3 grid gap-2 text-sm text-[#5b6c7c] sm:grid-cols-2">
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
      href: "/admin/scanner/pair",
      label: "Pasangkan Scanner",
      description: "Hubungkan scanner dengan station.",
      visible: true,
    },
    {
      href: "/admin/participants",
      label: "Kelola Peserta",
      description: "Cari dan kelola data peserta.",
      visible: role === "ADMIN",
    },
    {
      href: "/admin/display",
      label: "Buka Live Display",
      description: "Tampilkan check-in peserta secara real-time.",
      visible: true,
    },
    {
      href: "/admin/sessions",
      label: "Kelola Sesi",
      description: "Atur status sesi operasional.",
      visible: true,
      supporting: true,
    },
    {
      href: "/admin/display/setup",
      label: "Siapkan Station",
      description: "Siapkan dan kelola scanner station.",
      visible: role === "ADMIN",
      supporting: true,
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
  const quickActions = getQuickActions(profile.role);
  const primaryActions = quickActions.filter((action) => !action.supporting);
  const supportingActions = quickActions.filter((action) => action.supporting);

  return (
    <main className="min-h-screen bg-[#f7f3ea] px-4 py-5 sm:px-8 sm:py-6">
      <section className="mx-auto max-w-[1380px]">
        <DashboardHeader profile={profile} />

        <section className="mt-5" aria-labelledby="active-session-heading">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold tracking-[0.16em] text-[#9a7526]">OPERATIONS</p>
              <h2 className="mt-1 text-xl font-semibold text-[#142842]" id="active-session-heading">Sesi Aktif</h2>
            </div>
            <Link
              className="hidden min-h-11 items-center rounded-lg px-2 py-2 text-sm font-semibold text-[#344d68] underline underline-offset-4 outline-none hover:text-[#142842] focus-visible:ring-2 focus-visible:ring-[#9a7526] sm:inline-flex"
              href="/admin/sessions"
            >
              Lihat semua sesi
            </Link>
          </div>

          {dashboardData.activeSessions.length === 0 ? (
            <div className="mt-3 flex flex-col gap-4 rounded-xl border border-[#e5cb8c] bg-[#fff9eb] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div>
                <p className="font-semibold text-[#142842]">Belum ada sesi aktif</p>
                <p className="mt-1 text-sm text-[#80631e]">
                  {profile.role === "ADMIN" ? "Buka sesi untuk mulai menerima check-in peserta." : "Tunggu admin membuka sesi."}
                </p>
              </div>
              {profile.role === "ADMIN" ? (
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

        <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Ringkasan operasional">
          <KpiCard
            label="Peserta Terdaftar"
            subtitle="Registrasi aktif"
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
            label="Scanner Aktif"
            subtitle="Station siap digunakan"
            value={dashboardData.activeScannerCount}
          />
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
          <section className="rounded-xl border border-[#e4d8c4] bg-[#fffdf8] px-4 sm:px-5" aria-labelledby="station-heading">
            <div className="flex items-end justify-between gap-4 border-b border-[#eee6d8] py-4">
              <div>
                <p className="text-xs font-bold tracking-[0.16em] text-[#9a7526]">STATION MONITORING</p>
                <h2 className="mt-1 text-xl font-semibold text-[#142842]" id="station-heading">Scanner Station</h2>
              </div>
              <Link
                className="hidden min-h-11 items-center rounded-lg px-2 py-2 text-sm font-semibold text-[#344d68] underline underline-offset-4 outline-none hover:text-[#142842] focus-visible:ring-2 focus-visible:ring-[#9a7526] sm:inline-flex"
                href={profile.role === "ADMIN" ? "/admin/display/setup" : "/admin/scanner/pair"}
              >
                {profile.role === "ADMIN" ? "Siapkan Station" : "Pasangkan Scanner"}
              </Link>
            </div>

            {dashboardData.stations.length === 0 ? (
              <div className="py-6">
                <p className="font-semibold text-[#142842]">Belum ada scanner station</p>
                <p className="mt-1 text-sm text-[#5b6c7c]">Siapkan station untuk mulai memantau perangkat scanner.</p>
                <Link
                  className="mt-4 inline-flex min-h-11 items-center rounded-lg border border-[#b99a5a] px-4 py-2.5 text-sm font-semibold text-[#6d531e] outline-none transition hover:bg-[#fbf5e8] focus-visible:ring-2 focus-visible:ring-[#9a7526]"
                  href={profile.role === "ADMIN" ? "/admin/display/setup" : "/admin/scanner/pair"}
                >
                  {profile.role === "ADMIN" ? "Siapkan Station" : "Pasangkan Scanner"}
                </Link>
              </div>
            ) : (
              <div>
                {dashboardData.stations.map((station) => (
                  <StationCard key={station.id} station={station} />
                ))}
              </div>
            )}
          </section>

          <section aria-labelledby="actions-heading">
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
