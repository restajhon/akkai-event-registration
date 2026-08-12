import Link from "next/link";

import { requireRole } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type SessionStatus = "OPEN" | "CLOSED";

type SessionRow = {
  id: string;
  code: string;
  name: string;
  event_date: string;
  status: SessionStatus;
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

function sortSessions(left: SessionRow, right: SessionRow) {
  const statusDifference =
    Number(right.status === "OPEN") - Number(left.status === "OPEN");

  if (statusDifference !== 0) {
    return statusDifference;
  }

  const dateDifference = left.event_date.localeCompare(right.event_date);

  return dateDifference !== 0
    ? dateDifference
    : left.code.localeCompare(right.code, "id");
}

async function loadSessions(): Promise<SessionRow[] | null> {
  try {
    const adminSupabase = createAdminClient();
    const { data, error } = await adminSupabase
      .from("sessions")
      .select("id, code, name, event_date, status")
      .order("event_date", { ascending: true })
      .order("code", { ascending: true });

    if (error) {
      return null;
    }

    return ((data ?? []) as SessionRow[]).sort(sortSessions);
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
          Sesi belum dapat dimuat. Silakan coba kembali.
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
  await requireRole(["ADMIN", "OPERATOR"]);

  const sessions = await loadSessions();

  if (!sessions) {
    return <DisplaySelectionError />;
  }

  return (
    <main className="min-h-screen bg-[#f7f3ea] px-4 py-8 sm:px-8 sm:py-10">
      <section className="mx-auto max-w-5xl">
        <header className="rounded-2xl border border-[#e4d8c4] bg-[#fffdf8] p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold tracking-[0.2em] text-[#9a7526]">
                AKKAI 2026
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#142842]">
                Live Display
              </h1>
              <p className="mt-2 text-sm text-[#5b6c7c]">
                Pilih sesi yang akan ditampilkan pada layar check-in.
              </p>
            </div>
            <Link
              className="text-sm font-semibold text-[#344d68] underline underline-offset-4 hover:text-[#142842]"
              href="/admin/dashboard"
            >
              Kembali ke Dashboard
            </Link>
          </div>
        </header>

        {sessions.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-dashed border-[#cfc5b4] bg-[#fffdf8] p-8 text-center text-sm text-[#5b6c7c]">
            Belum ada sesi tersedia.
          </p>
        ) : (
          <section className="mt-6 grid gap-4 lg:grid-cols-2">
            {sessions.map((session) => {
              const isOpen = session.status === "OPEN";

              return (
                <article
                  className="rounded-2xl border border-[#e4d8c4] bg-[#fffdf8] p-5 shadow-sm sm:p-6"
                  key={session.id}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-bold tracking-[0.14em] text-[#9a7526]">
                        {session.code}
                      </p>
                      <h2 className="mt-2 text-xl font-semibold text-[#142842]">
                        {session.name}
                      </h2>
                    </div>
                    <span
                      className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-xs font-semibold ${
                        isOpen
                          ? "border-[#b9dec8] bg-[#f3fbf5] text-[#267044]"
                          : "border-[#dedbd3] bg-[#f2f0eb] text-[#6b6a66]"
                      }`}
                    >
                      {session.status}
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
                        Status display
                      </dt>
                      <dd className="mt-1 font-medium text-[#344d68]">
                        {isOpen ? "Siap menerima check-in" : "Sesi tidak aktif"}
                      </dd>
                    </div>
                  </dl>

                  <Link
                    className={`mt-6 inline-flex w-full items-center justify-center rounded-lg px-4 py-3 text-sm font-semibold transition-colors sm:w-auto ${
                      isOpen
                        ? "bg-[#142842] text-white hover:bg-[#203d5d]"
                        : "border border-[#b99a5a] text-[#6d531e] hover:bg-[#fbf5e8]"
                    }`}
                    href={`/admin/display/${session.id}`}
                  >
                    {isOpen ? "Buka Live Display" : "Buka untuk Review"}
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
