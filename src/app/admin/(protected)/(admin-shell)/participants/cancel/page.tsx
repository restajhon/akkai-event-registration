import { z } from "zod";

import { requirePermission } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  canChangeRegistrationStatus,
  canRestoreParticipantRegistration,
} from "@/lib/admin/participant-ui";

import { RegistrationStatusActions } from "../registration-status-actions";

export const dynamic = "force-dynamic";

const registrationIdSchema = z.string().regex(/^AKKAI26-[0-9]{6}$/);

type ParticipantStatusRow = {
  registration_id: string;
  full_name: string;
  registration_status: "REGISTERED" | "CANCELLED";
};

export default async function ParticipantCancellationLookupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requirePermission("participants.cancel");
  const params = await searchParams;
  const rawRegistrationId = typeof params.registrationId === "string"
    ? params.registrationId.trim()
    : "";
  const parsedRegistrationId = registrationIdSchema.safeParse(rawRegistrationId);
  let participant: ParticipantStatusRow | null = null;
  let lookupMessage: string | null = null;

  if (rawRegistrationId) {
    if (!parsedRegistrationId.success) {
      lookupMessage = "Masukkan Registration ID dengan format AKKAI26-000000.";
    } else {
      const { data, error } = await createAdminClient()
        .from("participants")
        .select("registration_id, full_name, registration_status")
        .eq("registration_id", parsedRegistrationId.data)
        .maybeSingle();

      if (error) {
        lookupMessage = "Data peserta belum dapat dimuat. Silakan coba kembali.";
      } else if (!data) {
        lookupMessage = "Peserta dengan Registration ID tersebut tidak ditemukan.";
      } else {
        participant = data as ParticipantStatusRow;
      }
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f3ea] px-4 py-6 sm:px-8 lg:px-10 lg:py-9">
      <section className="mx-auto max-w-3xl">
        <header className="border-b border-[#dfd3bf] pb-5">
          <p className="text-[11px] font-bold tracking-[0.18em] text-[#9a7526]">AKKAI 2026</p>
          <h1 className="mt-2 text-3xl font-semibold text-[#142842]">Batalkan Pendaftaran</h1>
          <p className="mt-2 text-sm leading-6 text-[#5b6c7c]">
            Cari peserta menggunakan Registration ID. Data peserta tidak dihapus; alasan pembatalan akan dicatat pada histori.
          </p>
        </header>

        <form action="/admin/participants/cancel" className="mt-5 grid gap-3 rounded-[10px] border border-[#e4d8c4] bg-[#fffdf8] p-4 sm:grid-cols-[1fr_auto] sm:items-end" method="get">
          <label className="grid gap-1.5 text-sm font-semibold text-[#142842]" htmlFor="participant-registration-id">
            Registration ID peserta
            <input
              autoComplete="off"
              className="min-h-11 rounded-lg border border-[#cfc5b4] bg-white px-3 font-normal outline-none focus:border-[#9a7526] focus:ring-2 focus:ring-[#ead9ac]"
              id="participant-registration-id"
              maxLength={14}
              name="registrationId"
              placeholder="AKKAI26-000001"
              required
              defaultValue={rawRegistrationId}
            />
          </label>
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#142842] px-5 text-sm font-semibold text-white outline-none hover:bg-[#203d5d] focus-visible:ring-2 focus-visible:ring-[#9a7526]"
            type="submit"
          >
            Cari Peserta
          </button>
        </form>

        {lookupMessage ? (
          <p className="mt-4 rounded-lg border border-[#ead3cc] bg-[#fff5f2] p-3 text-sm text-[#9b3d31]" role="alert">
            {lookupMessage}
          </p>
        ) : null}

        {participant ? (
          <section aria-label="Peserta ditemukan" className="mt-5 rounded-[10px] border border-[#e4d8c4] bg-[#fffdf8] p-4 sm:p-5">
            <p className="text-xs font-bold tracking-[0.14em] text-[#9a7526]">PESERTA DITEMUKAN</p>
            <h2 className="mt-2 text-xl font-semibold text-[#142842]">{participant.full_name}</h2>
            <p className="mt-1 text-sm font-semibold text-[#5b6c7c]">{participant.registration_id}</p>
            <p className="mt-3 text-sm text-[#5b6c7c]">
              Status: {participant.registration_status === "CANCELLED" ? "Dibatalkan" : "Terdaftar"}
            </p>
            {participant.registration_status === "CANCELLED" && !canRestoreParticipantRegistration(profile.role) ? (
              <p className="mt-4 rounded-lg bg-[#f2f0eb] p-3 text-sm text-[#6b6a66]">
                Pendaftaran sudah dibatalkan. Hanya SUPER_ADMIN yang dapat memulihkannya.
              </p>
            ) : null}
            {canChangeRegistrationStatus(profile.role) ? (
              <div className="mt-4">
                <RegistrationStatusActions
                  canRestore={canRestoreParticipantRegistration(profile.role)}
                  isCancelled={participant.registration_status === "CANCELLED"}
                  registrationId={participant.registration_id}
                />
              </div>
            ) : null}
          </section>
        ) : null}
      </section>
    </main>
  );
}
