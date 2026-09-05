import { NextResponse } from "next/server";
import * as XLSX from "@e965/xlsx";

import { requireRole } from "@/lib/auth/server";
import { loadRoomAssignmentPage } from "@/lib/admin/assignment-data";
import { buildRoomAssignmentWorkbook } from "@/lib/admin/revision-exports";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireRole(["ADMIN"]);
  const participants = await loadRoomAssignmentPage();

  if (!participants) {
    return NextResponse.json({ error: "Room assignment data is unavailable." }, { status: 500 });
  }

  const buffer = XLSX.write(buildRoomAssignmentWorkbook(participants), { bookType: "xlsx", type: "buffer" });
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": 'attachment; filename="AKKAI-2026-Room-Assignment.xlsx"',
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  });
}
