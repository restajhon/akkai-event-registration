import Link from "next/link";
import { MonitorUp } from "lucide-react";

import { AdminEmptyState, AdminPageHeader } from "@/components/admin/admin-ui";
import { hasPermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type StationStatus =
  | "WAITING_PAIRING"
  | "PAIRED"
  | "ACTIVE"
  | "DISCONNECTED";
type SessionStatus = "OPEN" | "CLOSED";

type StationRow = {
  id: string;
  station_name: string;
  session_id: string;
  status: StationStatus;
};

type SessionRow = {
  id: string;
  code: string;
  name: string;
  event_date: string;
  status: SessionStatus;
};

type DisplayStation = {
  station: StationRow;
  session: SessionRow;
};

function formatSessionDate(dateValue: string) {
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

function stationStatusLabel(status: StationStatus) {
  switch (status) {
    case "WAITING_PAIRING":
      return "Menunggu pairing";
    case "PAIRED":
      return "Paired";
    case "ACTIVE":
      return "Aktif";
    case "DISCONNECTED":
      return "Terputus";
  }
}

function sortDisplayStations(left: DisplayStation, right: DisplayStation) {
  const statusDifference =
    Number(right.session.status === "OPEN") - Number(left.session.status === "OPEN");

  if (statusDifference !== 0) {
    return statusDifference;
  }

  const dateDifference = left.session.event_date.localeCompare(
    right.session.event_date,
  );

  if (dateDifference !== 0) {
    return dateDifference;
  }

  const sessionDifference = left.session.code.localeCompare(
    right.session.code,
    "id",
  );

  return sessionDifference !== 0
    ? sessionDifference
    : left.station.station_name.localeCompare(right.station.station_name, "id");
}

async function loadDisplayStations(): Promise<DisplayStation[] | null> {
  try {
    const adminSupabase = createAdminClient();
    const [stationsResult, sessionsResult] = await Promise.all([
      adminSupabase
        .from("scanner_stations")
        .select("id, station_name, session_id, status")
        .neq("status", "CLOSED"),
      adminSupabase
        .from("sessions")
        .select("id, code, name, event_date, status"),
    ]);

    if (stationsResult.error || sessionsResult.error) {
      return null;
    }

    const stations = (stationsResult.data ?? []) as StationRow[];
    const sessions = (sessionsResult.data ?? []) as SessionRow[];
    const sessionById = new Map(sessions.map((session) => [session.id, session]));

    return stations
      .map((station) => {
        const session = sessionById.get(station.session_id);

        return session ? { station, session } : null;
      })
      .filter((entry): entry is DisplayStation => entry !== null)
      .sort(sortDisplayStations);
  } catch {
    return null;
  }
}

function DisplaySelectionError() {
  return (
    <main className="min-h-screen bg-[#f7f3ea] px-4 py-8 sm:px-8 sm:py-10">
      <section className="mx-auto max-w-5xl rounded-2xl border border-[#e4d8c4] bg-[#fffdf8] p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold tracking-[0.2em] text-[#9a7526]">
          AKKAI 2026
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#142842]">
          Live Display
        </h1>
        <p className="mt-6 rounded-xl border border-[#ead3cc] bg-[#fff5f2] p-4 text-sm text-[#9b3d31]" role="alert">
          Station belum dapat dimuat. Silakan coba kembali.
        </p>
        <Link
          className="mt-6 inline-flex text-sm font-semibold text-[#344d68] underline underline-offset-4 hover:text-[#142842]"
          href="/admin/dashboard"
        >
          Kembali ke Dashboard
        </Link>
      </section>
    </main>
  );
}

export default async function LiveDisplaySelectionPage() {
  const profile = await requirePermission("display.view");

  const displayStations = await loadDisplayStations();

  if (!displayStations) {
    return <DisplaySelectionError />;
  }

  return (
    <main className="min-h-screen bg-[#f7f3ea] px-4 py-5 sm:px-8 sm:py-6">
      <section className="mx-auto max-w-[1200px]">
        <AdminPageHeader
          action={
            <div className="flex flex-wrap gap-2">
              {hasPermission(profile.role, "display.manage") ? (
                <Link className="inline-flex min-h-11 items-center rounded-lg bg-[#142842] px-4 text-sm font-semibold text-white outline-none hover:bg-[#203d5d] focus-visible:ring-2 focus-visible:ring-[#9a7526]" href="/admin/display/setup">
                  Kelola Station
                </Link>
              ) : null}
            <Link
                className="inline-flex min-h-11 items-center rounded-lg border border-[#b99a5a] px-4 text-sm font-semibold text-[#6d531e] outline-none hover:bg-[#fbf5e8] focus-visible:ring-2 focus-visible:ring-[#9a7526]"
              href="/admin/dashboard"
            >
                Dashboard
            </Link>
          </div>
          }
          description="Pilih station yang akan ditampilkan pada layar check-in secara realtime."
          eyebrow="Operasional"
          title="Live Display"
        />

        {displayStations.length === 0 ? (
          <div className="mt-5 rounded-xl border border-[#e4d8c4] bg-[#fffdf8] p-4 sm:p-6">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#f1eadc] text-[#9a7526]">
              <MonitorUp aria-hidden="true" size={26} strokeWidth={1.7} />
            </div>
            <AdminEmptyState
              action={hasPermission(profile.role, "display.manage") ? (
                <Link className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-[#142842] px-4 text-sm font-semibold text-white outline-none hover:bg-[#203d5d] focus-visible:ring-2 focus-visible:ring-[#9a7526] sm:w-auto" href="/admin/display/setup">
                  Siapkan Station
                </Link>
              ) : undefined}
              description="Buat station untuk sesi aktif terlebih dahulu. Station yang tersedia akan muncul di halaman ini tanpa menggunakan data contoh."
              title="Belum ada station untuk Live Display"
            />
          </div>
        ) : (
          <section className="mt-6 grid gap-4 lg:grid-cols-2">
            {displayStations.map(({ station, session }) => {
              const isSessionOpen = session.status === "OPEN";

              return (
                <article
                  className="rounded-2xl border border-[#e4d8c4] bg-[#fffdf8] p-5 shadow-sm sm:p-6"
                  key={station.id}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-bold tracking-[0.14em] text-[#9a7526]">
                        {station.station_name}
                      </p>
                      <h2 className="mt-2 text-xl font-semibold text-[#142842]">
                        {session.name}
                      </h2>
                      <p className="mt-1 text-sm font-medium text-[#344d68]">
                        {session.code}
                      </p>
                    </div>
                    <span
                      className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-xs font-semibold ${
                        station.status === "PAIRED" || station.status === "ACTIVE"
                          ? "border-[#b9dec8] bg-[#f3fbf5] text-[#267044]"
                          : "border-[#dedbd3] bg-[#f2f0eb] text-[#6b6a66]"
                      }`}
                    >
                      {stationStatusLabel(station.status)}
                    </span>
                  </div>

                  <dl className="mt-5 grid gap-3 text-sm text-[#5b6c7c] sm:grid-cols-2">
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-[#897657]">
                        Tanggal sesi
                      </dt>
                      <dd className="mt-1 font-medium text-[#344d68]">
                        {formatSessionDate(session.event_date)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-[#897657]">
                        Status sesi
                      </dt>
                      <dd className="mt-1 font-medium text-[#344d68]">
                        {isSessionOpen ? "OPEN" : "CLOSED"}
                      </dd>
                    </div>
                  </dl>

                  <Link
                    className={`mt-6 inline-flex w-full items-center justify-center rounded-lg px-4 py-3 text-sm font-semibold transition-colors sm:w-auto ${
                      isSessionOpen
                        ? "bg-[#142842] text-white hover:bg-[#203d5d]"
                        : "border border-[#b99a5a] text-[#6d531e] hover:bg-[#fbf5e8]"
                    }`}
                    href={`/admin/display/${station.id}`}
                  >
                    {isSessionOpen ? "Buka Live Display" : "Buka untuk Review"}
                  </Link>
                </article>
              );
            })}
          </section>
        )}
      </section>
    </main>
  );
}
