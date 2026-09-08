import { NextResponse } from "next/server";

import { authorizePermission } from "@/lib/auth/server";
import { REGISTRATION_CERTIFICATE_BUCKET } from "@/lib/registration/certificate";
import { createAdminClient } from "@/lib/supabase/admin";

const registrationIdPattern = /^AKKAI26-[0-9]{6}$/;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ registrationId: string }> },
) {
  const authorization = await authorizePermission("participants.view");
  if (!authorization.authorized) {
    return NextResponse.json(
      { error: authorization.status === 401 ? "Unauthorized" : "Forbidden" },
      { status: authorization.status },
    );
  }

  const { registrationId } = await params;
  if (!registrationIdPattern.test(registrationId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const supabase = createAdminClient();
    const { data: participant } = await supabase
      .from("participants")
      .select("id")
      .eq("registration_id", registrationId)
      .maybeSingle();
    if (!participant) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { data: document, error: documentError } = await supabase
      .from("registration_documents")
      .select("storage_path")
      .eq("participant_id", participant.id)
      .maybeSingle();
    if (documentError || !document) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { data, error } = await supabase.storage
      .from(REGISTRATION_CERTIFICATE_BUCKET)
      .createSignedUrl(document.storage_path, 60);
    if (error || !data?.signedUrl) {
      return NextResponse.json({ error: "File belum dapat dibuka." }, { status: 500 });
    }

    return NextResponse.redirect(data.signedUrl);
  } catch {
    return NextResponse.json({ error: "File belum dapat dibuka." }, { status: 500 });
  }
}
