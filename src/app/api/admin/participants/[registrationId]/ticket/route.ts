import { NextResponse } from "next/server";

import { authorizePermission } from "@/lib/auth/server";
import {
  createParticipantTicketPdf,
  participantTicketFileName,
} from "@/lib/registration/participant-ticket";
import { loadParticipantTicketData } from "@/lib/registration/participant-ticket-data";

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
    const participant = await loadParticipantTicketData(registrationId);
    if (!participant) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const pdf = createParticipantTicketPdf(participant);
    const fileName = participantTicketFileName(participant.registrationId, participant.fullName);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Type": "application/pdf",
      },
    });
  } catch {
    return NextResponse.json({ error: "Tiket belum dapat dibuat." }, { status: 500 });
  }
}
