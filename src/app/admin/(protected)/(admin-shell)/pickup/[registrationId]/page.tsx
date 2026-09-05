import Link from "next/link";
import { z } from "zod";

import { loadPickupAssignmentDetail } from "@/lib/admin/assignment-data";
import { requirePermission } from "@/lib/auth/server";
import type { ParticipantTravel } from "@/lib/admin/assignment-types";

import { PickupAssignmentForm } from "../pickup-assignment-form";

export const dynamic = "force-dynamic";

const registrationIdSchema = z.string().regex(/^AKKAI26-[0-9]{6}$/);

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00+07:00`);

  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("id-ID", {
        dateStyle: "long",
        timeZone: "Asia/Jakarta",
      }).format(date);
}

function formatTime(value: string) {
  return value.slice(0, 5);
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-[#897657]">{label}</dt>
      <dd className="mt-1 break-words font-semibold text-[#344d68]">{value || "Tidak diisi"}</dd>
    </div>
  );
}

function TravelSection({ travel }: { travel: ParticipantTravel | null }) {
  if (!travel) {
    return (
      <p className="mt-4 rounded-lg border border-[#e5cb8c] bg-[#fff9eb] p-3 text-sm text-[#80631e]">
        Data travel peserta belum diisi.
      </p>
    );
  }

  return (
    <div className="mt-4 grid gap-5 md:grid-cols-2">
      <section className="rounded-lg border border-[#eee6d8] bg-[#fbf5e8] p-4">
        <h3 className="font-semibold text-[#142842]">ARRIVAL TRAVEL</h3>
        <dl className="mt-4 grid gap-3 text-sm">
          <DetailField label="Tanggal Kedatangan" value={formatDate(travel.outboundDate)} />
          <DetailField label="Waktu Kedatangan" value={formatTime(travel.outboundTime)} />
          <DetailField label="Moda Transportasi" value={travel.outboundTransportMode} />
          <DetailField label="Nomor Pesawat/Kereta" value={travel.outboundTransportNumber ?? "Tidak diisi"} />
          <DetailField label="Asal" value={travel.outboundOrigin} />
          <DetailField label="Tujuan" value={travel.outboundDestination} />
        </dl>
      </section>
      <section className="rounded-lg border border-[#eee6d8] bg-[#fbf5e8] p-4">
        <h3 className="font-semibold text-[#142842]">RETURN TRAVEL</h3>
        <dl className="mt-4 grid gap-3 text-sm">
          <DetailField label="Tanggal Kepulangan" value={formatDate(travel.returnDate)} />
          <DetailField label="Waktu Kepulangan" value={formatTime(travel.returnTime)} />
          <DetailField label="Moda Transportasi" value={travel.returnTransportMode} />
          <DetailField label="Nomor Pesawat/Kereta" value={travel.returnTransportNumber ?? "Tidak diisi"} />
          <DetailField label="Tujuan Kepulangan" value={travel.returnDestination} />
        </dl>
      </section>
    </div>
  );
}

function DetailError({ message }: { message: string }) {
  return (
    <main className="min-h-screen bg-[#f7f3ea] px-4 py-6 sm:px-8 sm:py-8">
      <section className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold text-[#142842]">Pickup Assignment</h1>
        <p className="mt-5 rounded-xl border border-[#ead3cc] bg-[#fff5f2] p-4 text-sm text-[#9b3d31]" role="alert">
          {message}
        </p>
        <Link
          className="mt-5 inline-flex min-h-11 items-center rounded-lg border border-[#b99a5a] px-4 text-sm font-semibold text-[#6d531e]"
          href="/admin/pickup"
        >
          Kembali ke Pickup Assignment
        </Link>
      </section>
    </main>
  );
}

export default async function PickupAssignmentDetailPage({
  params,
}: {
  params: Promise<{ registrationId: string }>;
}) {
  await requirePermission("pickup.view");
  const { registrationId: rawRegistrationId } = await params;
  const parsed = registrationIdSchema.safeParse(rawRegistrationId);

  if (!parsed.success) {
    return <DetailError message="Registration ID peserta tidak valid." />;
  }

  const participant = await loadPickupAssignmentDetail(parsed.data);

  if (!participant) {
    return <DetailError message="Data peserta belum dapat dimuat." />;
  }

  return (
    <main className="min-h-screen bg-[#f7f3ea] px-4 py-5 sm:px-8 sm:py-6">
      <section className="mx-auto max-w-[1000px]">
        <header className="border-b border-[#dfd3bf] pb-5">
          <p className="text-xs font-bold tracking-[0.18em] text-[#9a7526]">PICKUP ASSIGNMENT</p>
          <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-[#142842] sm:text-3xl">
                {participant.fullName}
              </h1>
              <p className="mt-1 text-sm font-semibold text-[#9a7526]">{participant.registrationId}</p>
            </div>
            <Link
              className="inline-flex min-h-11 items-center text-sm font-semibold text-[#344d68] underline underline-offset-4"
              href="/admin/pickup"
            >
              Kembali ke Daftar
            </Link>
          </div>
        </header>

        <section className="mt-5 rounded-xl border border-[#e4d8c4] bg-[#fffdf8] p-4 sm:p-5">
          <h2 className="text-xs font-bold tracking-[0.18em] text-[#9a7526]">PARTICIPANT</h2>
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
            <DetailField label="Registration ID" value={participant.registrationId} />
            <DetailField label="Nama" value={participant.fullName} />
          </dl>
        </section>

        <section className="mt-4 rounded-xl border border-[#e4d8c4] bg-[#fffdf8] p-4 sm:p-5">
          <h2 className="text-xl font-semibold text-[#142842]">Travel Context</h2>
          <p className="mt-1 text-sm text-[#5b6c7c]">Data travel peserta, hanya untuk referensi operasional.</p>
          <TravelSection travel={participant.travel} />
        </section>

        <section className="mt-4 rounded-xl border border-[#e4d8c4] bg-[#fffdf8] p-4 sm:p-5">
          <h2 className="text-xl font-semibold text-[#142842]">Pickup Kedatangan</h2>
          <p className="mt-1 text-sm text-[#5b6c7c]">Transfer type: ARRIVAL</p>
          <PickupAssignmentForm participant={participant} transferType="ARRIVAL" />
        </section>

        <section className="mt-4 rounded-xl border border-[#e4d8c4] bg-[#fffdf8] p-4 sm:p-5">
          <h2 className="text-xl font-semibold text-[#142842]">Pickup Kepulangan</h2>
          <p className="mt-1 text-sm text-[#5b6c7c]">Transfer type: DEPARTURE</p>
          <PickupAssignmentForm participant={participant} transferType="DEPARTURE" />
        </section>
      </section>
    </main>
  );
}
