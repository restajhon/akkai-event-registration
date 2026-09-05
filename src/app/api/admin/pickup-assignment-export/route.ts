import { NextResponse } from "next/server";
import * as XLSX from "@e965/xlsx";

import { requireRole } from "@/lib/auth/server";
import { loadPickupAssignmentPage } from "@/lib/admin/assignment-data";
import { buildPickupAssignmentWorkbook } from "@/lib/admin/revision-exports";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireRole(["ADMIN"]);
  const participants = await loadPickupAssignmentPage();

  if (!participants) {
    return NextResponse.json({ error: "Pickup assignment data is unavailable." }, { status: 500 });
  }

  const buffer = XLSX.write(buildPickupAssignmentWorkbook(participants), { bookType: "xlsx", type: "buffer" });
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": 'attachment; filename="AKKAI-2026-Pickup-Assignment.xlsx"',
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  });
}
