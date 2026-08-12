import Link from "next/link";

import { requireRole } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

import { SessionList, type Session } from "./session-list";

export default async function AdminSessionsPage() {
  const profile = await requireRole(["ADMIN", "OPERATOR"]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sessions")
    .select("id, code, name, event_date, status")
    .order("event_date", { ascending: true })
    .order("code", { ascending: true });

  if (error) {
    return (
      <main className="min-h-screen bg-zinc-100 px-4 py-10 sm:px-8">
        <section className="mx-auto max-w-3xl rounded-xl bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-medium text-zinc-500">AKKAI 2026</p>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
            Sesi Acara
          </h1>
          <p className="mt-6 rounded-lg bg-red-50 p-4 text-sm text-red-700" role="alert">
            Sesi belum dapat dimuat. Silakan coba kembali.
          </p>
          <Link
            className="mt-6 inline-flex text-sm font-medium text-zinc-700 underline underline-offset-4 hover:text-zinc-950"
            href="/admin/dashboard"
          >
            Kembali ke Dashboard
          </Link>
        </section>
      </main>
    );
  }

  return <SessionList sessions={(data ?? []) as Session[]} role={profile.role} />;
}
