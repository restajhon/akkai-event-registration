import { NextResponse } from "next/server";
import * as XLSX from "@e965/xlsx";

import { getCurrentUserProfile } from "@/lib/auth/server";
import {
  loadMemberMeetingSubmissions,
} from "@/lib/member-meeting/admin-data";
import { buildMemberMeetingWorkbook } from "@/lib/member-meeting/member-meeting-workbook";

export const dynamic = "force-dynamic";

const contentType =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function GET() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  if (profile.role !== "SUPER_ADMIN" && profile.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const submissions = await loadMemberMeetingSubmissions();
  if (!submissions) {
    return NextResponse.json(
      { error: "Member meeting data is unavailable." },
      { status: 500 },
    );
  }

  const buffer = XLSX.write(buildMemberMeetingWorkbook(submissions), {
    bookType: "xlsx",
    type: "buffer",
  });
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition":
        `attachment; filename="rapat-anggota-akkai-2026-${date}.xlsx"`,
      "Content-Type": contentType,
    },
  });
}
