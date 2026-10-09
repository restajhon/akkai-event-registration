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
  registration_status: "REGISTERED";
};

type CancelledParticipantRow = {
  registration_id: string;
  full_name: string;
  registration_status: "CANCELLED";
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancellation_reason: string | null;
};

type CancellationActorRow = {
  id: string;
  full_name: string | null;
};

function formatDateTime(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

function HistoryField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-[#897657]">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium text-[#344d68]">{value}</dd>
    </div>
  );
}

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
  const historyQuery = typeof params.historyQuery === "string"
    ? params.historyQuery.trim()
    : "";
  const parsedRegistrationId = registrationIdSchema.safeParse(rawRegistrationId);
  const supabase = createAdminClient();
  let participant: ParticipantStatusRow | null = null;
  let lookupMessage: string | null = null;
  let cancelledParticipants: CancelledParticipantRow[] = [];
  let historyLoadError = false;

  if (rawRegistrationId) {
    if (!parsedRegistrationId.success) {
      lookupMessage = "Masukkan Registration ID dengan format AKKAI26-000000.";
    } else {
      const { data, error } = await supabase
        .from("participants")
        .select("registration_id, full_name, registration_status")
        .eq("registration_id", parsedRegistrationId.data)
        .eq("registration_status", "REGISTERED")
        .maybeSingle();

      if (error) {
        lookupMessage = "Data peserta belum dapat dimuat. Silakan coba kembali.";
      } else if (!data) {
        lookupMessage = "Peserta aktif dengan Registration ID tersebut tidak ditemukan. Jika sudah dibatalkan, lihat riwayat di bawah.";
      } else {
        participant = data as ParticipantStatusRow;
      }
    }
  }

  try {
    const { data, error } = await supabase
      .from("participants")
      .select("registration_id, full_name, registration_status, cancelled_at, cancelled_by, cancellation_reason")
      .eq("registration_status", "CANCELLED")
      .order("cancelled_at", { ascending: false });

    if (error) {
      historyLoadError = true;
    } else {
      cancelledParticipants = (data ?? []) as CancelledParticipantRow[];
    }
  } catch {
    historyLoadError = true;
  }

  const cancellationActorIds = [...new Set(
    cancelledParticipants
      .map((cancelledParticipant) => cancelledParticipant.cancelled_by)
      .filter((actorId): actorId is string => Boolean(actorId)),
  )];
  const cancellationActorNames = new Map<string, string>();

  if (cancellationActorIds.length > 0) {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", cancellationActorIds);

      for (const actor of (data ?? []) as CancellationActorRow[]) {
        if (actor.full_name?.trim()) {
          cancellationActorNames.set(actor.id, actor.full_name.trim());
        }
      }
    } catch {
      // Keep cancellation records visible even if an actor profile is unavailable.
    }
  }

  const normalizedHistoryQuery = historyQuery.toLocaleLowerCase("id-ID");
  const visibleCancelledParticipants = cancelledParticipants.filter((cancelledParticipant) => {
    if (!normalizedHistoryQuery) {
      return true;
    }

    return (
      cancelledParticipant.full_name.toLocaleLowerCase("id-ID").includes(normalizedHistoryQuery) ||
      cancelledParticipant.registration_id.toLocaleLowerCase("id-ID").includes(normalizedHistoryQuery)
    );
  });

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
          <input name="historyQuery" type="hidden" value={historyQuery} />
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
            <p className="mt-3 text-sm text-[#5b6c7c]">Status: Terdaftar</p>
            {canChangeRegistrationStatus(profile.role) ? (
              <div className="mt-4">
                <RegistrationStatusActions
                  canRestore={canRestoreParticipantRegistration(profile.role)}
                  isCancelled={false}
                  registrationId={participant.registration_id}
                />
              </div>
            ) : null}
          </section>
        ) : null}

        <section
          aria-labelledby="cancelled-registration-history-heading"
          className="mt-5 rounded-[10px] border border-[#e4d8c4] bg-[#fffdf8] p-4 sm:p-5"
        >
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold tracking-[0.14em] text-[#9a7526]">ARSIP OPERASIONAL</p>
              <h2 className="mt-1 text-xl font-semibold text-[#142842]" id="cancelled-registration-history-heading">
                Riwayat Pendaftaran yang Dibatalkan
              </h2>
            </div>
            <p className="text-sm text-[#5b6c7c]">
              {historyLoadError
                ? "Hitungan riwayat tidak tersedia."
                : `${visibleCancelledParticipants.length} dari ${cancelledParticipants.length} riwayat ditampilkan.`}
            </p>
          </div>

          <form action="/admin/participants/cancel" className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end" method="get">
            <input name="registrationId" type="hidden" value={rawRegistrationId} />
            <label className="grid gap-1.5 text-sm font-semibold text-[#142842]" htmlFor="cancelled-history-search">
              Cari nama atau Registration ID
              <input
                autoComplete="off"
                className="min-h-11 rounded-lg border border-[#cfc5b4] bg-white px-3 font-normal outline-none focus:border-[#9a7526] focus:ring-2 focus:ring-[#ead9ac]"
                id="cancelled-history-search"
                name="historyQuery"
                placeholder="Nama atau AKKAI26-000000"
                type="search"
                defaultValue={historyQuery}
              />
            </label>
            <button
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#b99a5a] px-5 text-sm font-semibold text-[#6d531e] outline-none hover:bg-[#fbf5e8] focus-visible:ring-2 focus-visible:ring-[#9a7526]"
              type="submit"
            >
              Cari Riwayat
            </button>
          </form>

          {historyLoadError ? (
            <p className="mt-4 rounded-lg border border-[#ead3cc] bg-[#fff5f2] p-3 text-sm text-[#9b3d31]" role="alert">
              Riwayat pembatalan belum dapat dimuat. Silakan coba kembali.
            </p>
          ) : visibleCancelledParticipants.length > 0 ? (
            <ul className="mt-4 grid gap-3">
              {visibleCancelledParticipants.map((cancelledParticipant) => {
                const cancelledByName = cancelledParticipant.cancelled_by
                  ? cancellationActorNames.get(cancelledParticipant.cancelled_by) ?? null
                  : null;
                const cancelledAt = formatDateTime(cancelledParticipant.cancelled_at);

                return (
                  <li
                    className="rounded-lg border border-[#eee6d8] bg-[#fbf7ef] p-4"
                    key={cancelledParticipant.registration_id}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="font-semibold text-[#142842]">{cancelledParticipant.full_name}</h3>
                        <p className="mt-1 text-sm font-semibold text-[#9a7526]">{cancelledParticipant.registration_id}</p>
                      </div>
                      <span className="inline-flex min-h-8 w-fit items-center rounded-full border border-[#dedbd3] bg-[#f2f0eb] px-3 py-1 text-xs font-semibold text-[#6b6a66]">
                        Dibatalkan
                      </span>
                    </div>
                    {cancelledAt || cancelledParticipant.cancellation_reason || cancelledByName ? (
                      <dl className="mt-4 grid gap-3 border-t border-[#e8dfd0] pt-3 sm:grid-cols-2">
                        {cancelledAt ? <HistoryField label="Waktu pembatalan" value={cancelledAt} /> : null}
                        {cancelledParticipant.cancellation_reason ? (
                          <HistoryField label="Alasan" value={cancelledParticipant.cancellation_reason} />
                        ) : null}
                        {cancelledByName ? <HistoryField label="Dibatalkan oleh" value={cancelledByName} /> : null}
                      </dl>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-4 rounded-lg border border-dashed border-[#d8cbb6] p-5 text-center text-sm text-[#5b6c7c]" role="status">
              {historyQuery ? "Tidak ada riwayat yang cocok dengan pencarian." : "Belum ada pendaftaran yang dibatalkan."}
            </p>
          )}
        </section>
      </section>
    </main>
  );
}
