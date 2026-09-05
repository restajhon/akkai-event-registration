import Link from "next/link";
import { z } from "zod";

import { requireRole } from "@/lib/auth/server";
import {
  loadRoomAssignmentDetail,
} from "@/lib/admin/assignment-data";

import { RoomAssignmentForm } from "../room-assignment-form";

export const dynamic = "force-dynamic";

const registrationIdSchema = z.string().regex(/^AKKAI26-[0-9]{6}$/);

function DetailError({ message }: { message: string }) {
  return (
    <main className="min-h-screen bg-[#f7f3ea] px-4 py-6 sm:px-8 sm:py-8">
      <section className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold text-[#142842]">Room Assignment</h1>
        <p className="mt-5 rounded-xl border border-[#ead3cc] bg-[#fff5f2] p-4 text-sm text-[#9b3d31]" role="alert">
          {message}
        </p>
        <Link
          className="mt-5 inline-flex min-h-11 items-center rounded-lg border border-[#b99a5a] px-4 text-sm font-semibold text-[#6d531e]"
          href="/admin/rooms"
        >
          Kembali ke Room Assignment
        </Link>
      </section>
    </main>
  );
}

export default async function RoomAssignmentDetailPage({
  params,
}: {
  params: Promise<{ registrationId: string }>;
}) {
  await requireRole(["ADMIN"]);
  const { registrationId: rawRegistrationId } = await params;
  const parsed = registrationIdSchema.safeParse(rawRegistrationId);

  if (!parsed.success) {
    return <DetailError message="Registration ID peserta tidak valid." />;
  }

  const participant = await loadRoomAssignmentDetail(parsed.data);

  if (!participant) {
    return <DetailError message="Data peserta belum dapat dimuat." />;
  }

  return (
    <main className="min-h-screen bg-[#f7f3ea] px-4 py-5 sm:px-8 sm:py-6">
      <section className="mx-auto max-w-3xl">
        <header className="border-b border-[#dfd3bf] pb-5">
          <p className="text-xs font-bold tracking-[0.18em] text-[#9a7526]">ROOM ASSIGNMENT</p>
          <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-[#142842] sm:text-3xl">
                {participant.fullName}
              </h1>
              <p className="mt-1 text-sm font-semibold text-[#9a7526]">{participant.registrationId}</p>
               <p className="mt-2 text-sm text-[#5b6c7c]">Paket: {participant.packageType ?? "Tidak diisi"}</p>
            </div>
            <Link
              className="inline-flex min-h-11 items-center text-sm font-semibold text-[#344d68] underline underline-offset-4"
              href="/admin/rooms"
            >
              Kembali ke Daftar
            </Link>
          </div>
        </header>
        <section className="mt-5 rounded-xl border border-[#e4d8c4] bg-[#fffdf8] p-4 sm:p-5">
          <h2 className="text-xl font-semibold text-[#142842]">Hotel Gumaya Semarang</h2>
          <p className="mt-1 text-sm text-[#5b6c7c]">Satu assignment kamar untuk peserta ini.</p>
          <RoomAssignmentForm participant={participant} />
        </section>
      </section>
    </main>
  );
}
