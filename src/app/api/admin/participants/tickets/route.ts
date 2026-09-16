import { NextResponse } from "next/server";

import { authorizePermission } from "@/lib/auth/server";
import {
  createParticipantTicketPdf,
  participantTicketFileName,
} from "@/lib/registration/participant-ticket";
import { loadParticipantTicketData } from "@/lib/registration/participant-ticket-data";
import { createZip } from "@/lib/registration/zip";

const registrationIdPattern = /^AKKAI26-[0-9]{6}$/;
const MAX_BULK_TICKETS = 100;

export async function POST(request: Request) {
  const authorization = await authorizePermission("participants.view");
  if (!authorization.authorized) {
    return NextResponse.json(
      { error: authorization.status === 401 ? "Unauthorized" : "Forbidden" },
      { status: authorization.status },
    );
  }

  let registrationIds: string[];
  try {
    const body = (await request.json()) as { registrationIds?: unknown };
    registrationIds = Array.isArray(body.registrationIds)
      ? Array.from(new Set(body.registrationIds.filter((value): value is string => typeof value === "string")))
      : [];
  } catch {
    return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 });
  }

  if (
    registrationIds.length === 0 ||
    registrationIds.length > MAX_BULK_TICKETS ||
    registrationIds.some((id) => !registrationIdPattern.test(id))
  ) {
    return NextResponse.json({ error: `Pilih 1-${MAX_BULK_TICKETS} peserta yang valid.` }, { status: 400 });
  }

  const results = await Promise.all(
    registrationIds.map(async (registrationId) => {
      try {
        const participant = await loadParticipantTicketData(registrationId);
        if (!participant) return { registrationId, participant: null, error: "Data peserta tidak ditemukan." };
        return { registrationId, participant, error: null };
      } catch {
        return { registrationId, participant: null, error: "Tiket belum dapat dibuat." };
      }
    }),
  );
  const failures = results
    .filter((result) => result.error)
    .map((result) => ({ registrationId: result.registrationId, message: result.error }));
  const entries = results.flatMap((result) => {
    if (!result.participant) return [];
    try {
      return [{
        name: participantTicketFileName(result.participant.registrationId, result.participant.fullName),
        content: createParticipantTicketPdf(result.participant),
      }];
    } catch {
      failures.push({ registrationId: result.registrationId, message: "Tiket belum dapat dibuat." });
      return [];
    }
  });

  if (entries.length === 0) {
    return NextResponse.json({ error: "Tidak ada tiket yang berhasil dibuat.", failures }, { status: 500 });
  }

  const zip = createZip(entries);
  return new NextResponse(new Uint8Array(zip), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": 'attachment; filename="AKKAI-2026-Tiket-Terpilih.zip"',
      "Content-Type": "application/zip",
      "X-AKKAI-Ticket-Failures": encodeURIComponent(JSON.stringify(failures)),
    },
  });
}
