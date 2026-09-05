import { requirePermission } from "@/lib/auth/server";
import { loadRoomAssignmentPage } from "@/lib/admin/assignment-data";

import { RoomAssignmentBoard } from "./room-assignment-board";

export const dynamic = "force-dynamic";

function RoomPageError() {
  return (
    <main className="min-h-screen bg-[#f7f3ea] px-4 py-6 sm:px-8 sm:py-8">
      <section className="mx-auto max-w-5xl rounded-xl border border-[#ead3cc] bg-[#fff5f2] p-6 text-[#9b3d31]">
        Data assignment kamar belum dapat dimuat. Silakan coba kembali.
      </section>
    </main>
  );
}

export default async function RoomsPage() {
  await requirePermission("rooms.view");
  const participants = await loadRoomAssignmentPage();

  if (!participants) {
    return <RoomPageError />;
  }

  return <RoomAssignmentBoard participants={participants} />;
}
