import { NextResponse } from "next/server";
import * as XLSX from "@e965/xlsx";

import { requireRole } from "@/lib/auth/server";
import { loadParticipantExportRows } from "@/lib/admin/revision-export-data";
import { buildParticipantWorkbook } from "@/lib/admin/revision-exports";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireRole(["ADMIN"]);
  const rows = await loadParticipantExportRows();

  if (!rows) {
    return NextResponse.json({ error: "Participant data is unavailable." }, { status: 500 });
  }

  const buffer = XLSX.write(buildParticipantWorkbook(rows), { bookType: "xlsx", type: "buffer" });
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": 'attachment; filename="AKKAI-2026-Peserta.xlsx"',
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  });
}
