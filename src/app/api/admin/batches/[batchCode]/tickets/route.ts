import { NextResponse } from "next/server";

import { authorizePermission } from "@/lib/auth/server";
import { participantQrFileName } from "@/lib/registration/participant-ticket";
import { loadParticipantTicketData } from "@/lib/registration/participant-ticket-data";
import { generateParticipantQrPng } from "@/lib/qr/participant-qr";
import { createZip } from "@/lib/registration/zip";
import { createAdminClient } from "@/lib/supabase/admin";

const batchCodePattern = /^BATCH-[A-Z0-9]{10}$/;
const MAX_BATCH_TICKETS = 100;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ batchCode: string }> },
) {
  const authorization = await authorizePermission("participants.view");
  if (!authorization.authorized) {
    return NextResponse.json(
      { error: authorization.status === 401 ? "Unauthorized" : "Forbidden" },
      { status: authorization.status },
    );
  }

  const { batchCode } = await params;
  if (!batchCodePattern.test(batchCode)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const supabase = createAdminClient();
  const { data: batch, error: batchError } = await supabase
    .from("registration_batches")
    .select("id")
    .eq("batch_code", batchCode)
    .maybeSingle();
  if (batchError || !batch) return NextResponse.json({ error: "Batch tidak ditemukan." }, { status: 404 });

  const { data: participants, error: participantsError } = await supabase
    .from("participants")
    .select("registration_id")
    .eq("batch_id", batch.id)
    .eq("registration_status", "REGISTERED")
    .order("created_at", { ascending: true });
  if (participantsError) return NextResponse.json({ error: "Data batch belum dapat dimuat." }, { status: 500 });
  const registrationIds = (participants ?? []).map((participant) => participant.registration_id as string);
  if (registrationIds.length === 0) return NextResponse.json({ error: "Batch belum memiliki peserta." }, { status: 404 });
  if (registrationIds.length > MAX_BATCH_TICKETS) return NextResponse.json({ error: `Batch melebihi batas ${MAX_BATCH_TICKETS} tiket.` }, { status: 413 });

  const settled = await Promise.allSettled(
    registrationIds.map(async (registrationId) => {
      const ticket = await loadParticipantTicketData(registrationId);
      if (!ticket) return null;
      return { ticket, qrPng: await generateParticipantQrPng(ticket.qrToken) };
    }),
  );
  const entries = [] as Array<{ name: string; content: Buffer }>;
  const failures: Array<{ registrationId: string; message: string }> = [];
  settled.forEach((result, index) => {
    const registrationId = registrationIds[index];
    if (result.status !== "fulfilled" || !result.value) {
      failures.push({ registrationId, message: "Data peserta tidak ditemukan." });
      return;
    }
    try {
      entries.push({
        name: participantQrFileName(result.value.ticket.registrationId, result.value.ticket.fullName),
        content: result.value.qrPng,
      });
    } catch {
      failures.push({ registrationId, message: "Tiket belum dapat dibuat." });
    }
  });
  if (entries.length === 0) return NextResponse.json({ error: "Tidak ada tiket yang berhasil dibuat.", failures }, { status: 500 });

  return new NextResponse(new Uint8Array(createZip(entries)), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="AKKAI-${batchCode}-QR.zip"`,
      "Content-Type": "application/zip",
      "X-AKKAI-Ticket-Failures": encodeURIComponent(JSON.stringify(failures)),
    },
  });
}
