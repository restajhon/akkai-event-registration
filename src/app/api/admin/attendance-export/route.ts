import { NextResponse } from "next/server";
import * as XLSX from "@e965/xlsx";

import { authorizePermission } from "@/lib/auth/server";
import { getAttendanceSession, isAttendanceSessionCode } from "@/lib/admin/attendance-sessions";
import { loadOperationalData } from "@/lib/admin/operational-data";
import { buildAttendanceSessionWorkbook } from "@/lib/admin/operational-workbook";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authorization = await authorizePermission("attendance.export");

  if (!authorization.authorized) {
    return NextResponse.json(
      { error: authorization.status === 401 ? "Authentication required." : "Forbidden." },
      { status: authorization.status },
    );
  }

  const sessionCode = new URL(request.url).searchParams.get("sessionCode");
  if (!isAttendanceSessionCode(sessionCode)) {
    return NextResponse.json({ error: "Sesi unduhan tidak valid." }, { status: 400 });
  }

  const participants = await loadOperationalData();
  if (!participants) {
    return NextResponse.json({ error: "Attendance data is unavailable." }, { status: 500 });
  }

  const session = getAttendanceSession(sessionCode);
  const buffer = XLSX.write(
    buildAttendanceSessionWorkbook(participants, sessionCode),
    { bookType: "xlsx", type: "buffer" },
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${session.exportFilename}"`,
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  });
}
