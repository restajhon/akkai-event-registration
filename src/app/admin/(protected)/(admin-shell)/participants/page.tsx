import { redirect } from "next/navigation";

import { requirePermission } from "@/lib/auth/server";
import { loadParticipantPage } from "./participant-data";

import { ParticipantList } from "./participant-list";

export const dynamic = "force-dynamic";

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
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("participants.view");

  const params = await searchParams;
  if (Object.keys(params).length > 0) {
    redirect("/admin/participants");
  }

  const pageData = await loadParticipantPage("", 1);

  if (!pageData) {
    return <ParticipantPageError />;
  }

  return (
    <ParticipantList initialData={pageData} />
  );
}
