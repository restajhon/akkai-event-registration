import { NextResponse } from "next/server";
import * as XLSX from "@e965/xlsx";

import { authorizePermission } from "@/lib/auth/server";
import { loadPickupAssignmentPage } from "@/lib/admin/assignment-data";
import { buildPickupAssignmentWorkbook } from "@/lib/admin/revision-exports";

export const dynamic = "force-dynamic";

export async function GET() {
  const authorization = await authorizePermission("pickup.export");
  if (!authorization.authorized) {
    return NextResponse.json(
      { error: authorization.status === 401 ? "Authentication required." : "Forbidden." },
      { status: authorization.status },
    );
  }
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
