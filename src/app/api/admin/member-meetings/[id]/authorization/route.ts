import { NextResponse } from "next/server";

import { authorizePermission } from "@/lib/auth/server";
import { MEMBER_MEETING_BUCKET } from "@/lib/member-meeting/storage";
import { createAdminClient } from "@/lib/supabase/admin";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authorization = await authorizePermission("member_meetings.manage");
  if (!authorization.authorized) {
    return NextResponse.json(
      { error: authorization.status === 401 ? "Unauthorized" : "Forbidden" },
      { status: authorization.status },
    );
  }

  const { id } = await params;
  if (!uuidPattern.test(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const supabase = createAdminClient();
    const { data: submission, error: submissionError } = await supabase
      .from("member_meeting_submissions")
      .select("authorization_file_path")
      .eq("id", id)
      .maybeSingle();

    if (submissionError || !submission?.authorization_file_path) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { data, error } = await supabase.storage
      .from(MEMBER_MEETING_BUCKET)
      .createSignedUrl(submission.authorization_file_path, 60);

    if (error || !data?.signedUrl) {
      return NextResponse.json(
        { error: "File belum dapat dibuka." },
        { status: 500 },
      );
    }

    return NextResponse.redirect(data.signedUrl);
  } catch {
    return NextResponse.json(
      { error: "File belum dapat dibuka." },
      { status: 500 },
    );
  }
}
