import { requirePermission } from "@/lib/auth/server";
import { getParticipantActionVisibility } from "@/lib/admin/participant-ui";
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
  const profile = await requirePermission("participants.view");

  const params = await searchParams;
  const query = typeof params.query === "string" ? params.query.trim().slice(0, 100) : "";
  const billingStatus = params.billingStatus === "PAID" || params.billingStatus === "UNPAID" ? params.billingStatus : "all";
  const batchCode = typeof params.batchCode === "string" ? params.batchCode.trim().slice(0, 30) : "all";
  const pageData = await loadParticipantPage(query, 1, billingStatus, batchCode);

  if (!pageData) {
    return <ParticipantPageError />;
  }

  return (
    <ParticipantList
      actionVisibility={getParticipantActionVisibility(profile.role)}
      initialData={pageData}
    />
  );
}
