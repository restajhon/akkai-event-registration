import Link from "next/link";

import { requirePermission } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

import { SessionList, type Session } from "./session-list";

export default async function AdminSessionsPage() {
  const profile = await requirePermission("sessions.view");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sessions")
    .select("id, code, name, event_date, status")
    .order("event_date", { ascending: true })
    .order("code", { ascending: true });

  if (error) {
    return (
      <main className="min-h-screen bg-[#f7f3ea] px-4 py-8 sm:px-8">
        <section className="mx-auto max-w-3xl rounded-xl border border-[#e4d8c4] bg-[#fffdf8] p-6 shadow-sm sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#9a7526]">AKKAI 2026</p>
          <h1 className="mt-2 text-3xl text-[#142842]">
            Sesi Acara
          </h1>
          <p className="mt-6 rounded-lg border border-[#ead3cc] bg-[#fff5f2] p-4 text-sm text-[#9a3e35]" role="alert">
            Sesi belum dapat dimuat. Silakan coba kembali.
          </p>
          <Link
            className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-[#142842] px-4 text-sm font-semibold text-white outline-none hover:bg-[#203d5d] focus-visible:ring-2 focus-visible:ring-[#9a7526]"
            href="/admin/sessions"
          >
            Coba Muat Ulang
          </Link>
        </section>
      </main>
    );
  }

  return <SessionList sessions={(data ?? []) as Session[]} role={profile.role} />;
}
