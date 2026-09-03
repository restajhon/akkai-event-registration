import { NextResponse } from "next/server";
import * as XLSX from "@e965/xlsx";

import { requireRole } from "@/lib/auth/server";
import { loadOperationalData } from "@/lib/admin/operational-data";
import { buildOperationalWorkbook } from "@/lib/admin/operational-workbook";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireRole(["ADMIN"]);
  const participants = await loadOperationalData();

  if (!participants) {
    return NextResponse.json({ error: "Operational data is unavailable." }, { status: 500 });
  }

  const workbook = buildOperationalWorkbook(participants);
  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": 'attachment; filename="AKKAI-2026-Operational.xlsx"',
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  });
}
