import { hasPermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/server";
import { loadOperationalData } from "@/lib/admin/operational-data";

import { AttendanceBoard } from "./attendance-board";

export const dynamic = "force-dynamic";

function AttendancePageError() {
  return (
    <main className="min-h-screen bg-[#f7f3ea] px-4 py-6 sm:px-8 sm:py-8">
      <section className="mx-auto max-w-5xl rounded-xl border border-[#ead3cc] bg-[#fff5f2] p-6 text-[#9b3d31]">
        Data kehadiran belum dapat dimuat. Silakan coba kembali.
      </section>
    </main>
  );
}

export default async function AttendancePage() {
  const profile = await requirePermission("attendance.view");
  const participants = await loadOperationalData();

  if (!participants) {
    return <AttendancePageError />;
  }

  return (
    <AttendanceBoard
      canExportAttendance={hasPermission(profile.role, "attendance.export")}
      participants={participants}
    />
  );
}
