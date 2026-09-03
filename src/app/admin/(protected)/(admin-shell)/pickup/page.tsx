import { requireRole } from "@/lib/auth/server";
import { loadPickupAssignmentPage } from "@/lib/admin/assignment-data";

import { PickupAssignmentBoard } from "./pickup-assignment-board";

export const dynamic = "force-dynamic";

function PickupPageError() {
  return (
    <main className="min-h-screen bg-[#f7f3ea] px-4 py-6 sm:px-8 sm:py-8">
      <section className="mx-auto max-w-5xl rounded-xl border border-[#ead3cc] bg-[#fff5f2] p-6 text-[#9b3d31]">
        Data assignment pickup belum dapat dimuat. Silakan coba kembali.
      </section>
    </main>
  );
}

export default async function PickupPage() {
  await requireRole(["ADMIN"]);
  const participants = await loadPickupAssignmentPage();

  if (!participants) {
    return <PickupPageError />;
  }

  return <PickupAssignmentBoard participants={participants} />;
}
