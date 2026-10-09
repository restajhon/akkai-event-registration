"use client";

import Link from "next/link";
import { useState } from "react";

import type {
  PickupAssignment,
  PickupParticipant,
} from "@/lib/admin/assignment-types";
import { getEffectivePickupPoint } from "@/lib/admin/pickup-mapping";

type TransferType = "ARRIVAL" | "DEPARTURE";
type AssignmentFilter = "all" | "assigned" | "unassigned";
type TravelFilter = "all" | "available" | "missing";

function assignmentLabel(assignment: PickupAssignment | null) {
  if (!assignment) {
    return "Belum diatur";
  }

  switch (assignment.status) {
    case "SCHEDULED":
      return "Terjadwal";
    case "COMPLETED":
      return "Selesai";
    case "CANCELLED":
      return "Dibatalkan";
  }
}

function assignmentClassName(assignment: PickupAssignment | null) {
  if (!assignment || assignment.status === "CANCELLED") {
    return "border-[#dedbd3] bg-[#f2f0eb] text-[#6b6a66]";
  }

  return assignment.status === "COMPLETED"
    ? "border-[#b9dec8] bg-[#f3fbf5] text-[#267044]"
    : "border-[#e5cb8c] bg-[#fff9eb] text-[#80631e]";
}

function isAssigned(assignment: PickupAssignment | null) {
  return Boolean(assignment && assignment.status !== "CANCELLED");
}

function selectAssignment(participant: PickupParticipant, transferType: TransferType) {
  return transferType === "ARRIVAL"
    ? participant.arrivalAssignment
    : participant.departureAssignment;
}

export function getPickupAssignmentLists(
  participants: PickupParticipant[],
  query: string,
  assignmentFilter: AssignmentFilter,
  travelFilter: TravelFilter,
  transferType: TransferType,
) {
  const activeParticipants = participants.filter(
    (participant) => participant.registrationStatus === "REGISTERED",
  );
  const normalizedQuery = query.trim().toLowerCase();
  const visibleParticipants = activeParticipants.filter((participant) => {
    const assignment = selectAssignment(participant, transferType);
    const matchesQuery =
      !normalizedQuery ||
      participant.fullName.toLowerCase().includes(normalizedQuery) ||
      participant.registrationId.toLowerCase().includes(normalizedQuery);
    const matchesAssignment =
      assignmentFilter === "all" ||
      (assignmentFilter === "assigned" && isAssigned(assignment)) ||
      (assignmentFilter === "unassigned" && !isAssigned(assignment));
    const matchesTravel =
      travelFilter === "all" ||
      (travelFilter === "available" && Boolean(participant.travel)) ||
      (travelFilter === "missing" && !participant.travel);

    return matchesQuery && matchesAssignment && matchesTravel;
  });

  return { activeParticipants, visibleParticipants };
}

export function PickupAssignmentBoard({
  participants,
}: {
  participants: PickupParticipant[];
}) {
  const [transferType, setTransferType] = useState<TransferType>("ARRIVAL");
  const [query, setQuery] = useState("");
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>("all");
  const [travelFilter, setTravelFilter] = useState<TravelFilter>("all");
  const { activeParticipants, visibleParticipants } = getPickupAssignmentLists(
    participants,
    query,
    assignmentFilter,
    travelFilter,
    transferType,
  );

  return (
    <main className="min-h-screen bg-[#f7f3ea] px-4 py-5 sm:px-8 sm:py-6">
      <section className="mx-auto max-w-[1400px]">
        <header className="flex flex-col gap-4 border-b border-[#dfd3bf] pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold tracking-[0.18em] text-[#9a7526]">OPERASIONAL</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#142842] sm:text-3xl">
              Pickup Operasional
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-[#5b6c7c]">
              Kelola assignment dan pantau setiap kaki perjalanan tanpa mencampur kedatangan dengan kepulangan.
            </p>
          </div>
          <a
            className="inline-flex min-h-11 shrink-0 items-center rounded-lg border border-[#b99a5a] px-4 text-sm font-semibold text-[#6d531e] hover:bg-[#fbf5e8]"
            download="AKKAI-2026-Pickup-Assignment.xlsx"
            href="/api/admin/pickup-assignment-export"
          >
            Download Excel
          </a>
        </header>

        <div aria-label="Jenis perjalanan" className="mt-5 grid max-w-md grid-cols-2 overflow-hidden rounded-lg border border-[#d8cbb6] bg-[#fffdf8] p-1" role="group">
          {(["ARRIVAL", "DEPARTURE"] as const).map((leg) => (
            <button
              className={`min-h-10 rounded-md px-4 text-center text-sm font-bold transition focus-visible:ring-2 focus-visible:ring-[#9a7526] ${
                transferType === leg
                  ? "bg-[#142842] text-white"
                  : "text-[#344d68] hover:bg-[#f1eadc]"
              }`}
              key={leg}
              onClick={() => setTransferType(leg)}
              type="button"
            >
              {leg === "ARRIVAL" ? "Arrival" : "Departure"}
            </button>
          ))}
        </div>

        <section className="mt-4 rounded-xl border border-[#e4d8c4] bg-[#fffdf8] p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_180px_180px]">
            <div>
              <label className="text-sm font-semibold text-[#142842]" htmlFor="pickup-search">
                Cari peserta
              </label>
              <input
                className="mt-2 min-h-11 w-full rounded-lg border border-[#cfc5b4] bg-white px-3 text-sm text-[#142842] outline-none placeholder:text-[#9a9489] focus:border-[#9a7526] focus:ring-2 focus:ring-[#ead9ac]"
                id="pickup-search"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Nama atau Registration ID"
                type="search"
                value={query}
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-[#142842]" htmlFor="pickup-assignment-filter">
                Assignment
              </label>
              <select
                className="mt-2 min-h-11 w-full rounded-lg border border-[#cfc5b4] bg-white px-3 text-sm text-[#142842] outline-none focus:border-[#9a7526] focus:ring-2 focus:ring-[#ead9ac]"
                id="pickup-assignment-filter"
                onChange={(event) => setAssignmentFilter(event.target.value as AssignmentFilter)}
                value={assignmentFilter}
              >
                <option value="all">Semua</option>
                <option value="assigned">Sudah di-assign</option>
                <option value="unassigned">Belum di-assign</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold text-[#142842]" htmlFor="pickup-travel-filter">
                Travel
              </label>
              <select
                className="mt-2 min-h-11 w-full rounded-lg border border-[#cfc5b4] bg-white px-3 text-sm text-[#142842] outline-none focus:border-[#9a7526] focus:ring-2 focus:ring-[#ead9ac]"
                id="pickup-travel-filter"
                onChange={(event) => setTravelFilter(event.target.value as TravelFilter)}
                value={travelFilter}
              >
                <option value="all">Semua</option>
                <option value="available">Data travel tersedia</option>
                <option value="missing">Data travel belum tersedia</option>
              </select>
            </div>
          </div>
          <p className="mt-3 text-sm text-[#5b6c7c]">
            {visibleParticipants.length} dari {activeParticipants.length} peserta aktif ditampilkan pada pickup {transferType}.
          </p>
        </section>

         <div className="mt-5 grid gap-3 lg:hidden">
           {visibleParticipants.map((participant) => {
             const assignment = selectAssignment(participant, transferType);
             const travel = participant.travel;
             const isArrival = transferType === "ARRIVAL";
             const point = getEffectivePickupPoint(transferType, assignment, travel);

             return (
               <article className="rounded-xl border border-[#e4d8c4] bg-[#fffdf8] p-4" key={participant.registrationId}>
                 <div className="flex items-start justify-between gap-3">
                   <div className="min-w-0">
                     <h2 className="break-words font-semibold text-[#142842]">{participant.fullName}</h2>
                     <p className="mt-1 break-all text-xs font-semibold text-[#9a7526]">{participant.registrationId}</p>
                   </div>
                   <span className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${assignmentClassName(assignment)}`}>
                     {assignmentLabel(assignment)}
                   </span>
                 </div>
                 <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-[#eee6d8] pt-3 text-sm">
                   <div>
                     <dt className="text-[10px] font-bold uppercase tracking-wide text-[#897657]">Travel</dt>
                     <dd className="mt-1 break-words font-medium text-[#344d68]">{travel ? "Lengkap" : "Belum diisi"}</dd>
                   </div>
                   <div>
                     <dt className="text-[10px] font-bold uppercase tracking-wide text-[#897657]">Moda</dt>
                     <dd className="mt-1 break-words font-medium text-[#344d68]">{travel ? (isArrival ? travel.outboundTransportMode : travel.returnTransportMode) : "-"}</dd>
                   </div>
                   <div className="col-span-2">
                     <dt className="text-[10px] font-bold uppercase tracking-wide text-[#897657]">{isArrival ? "Titik Jemput" : "Titik Antar"}</dt>
                     <dd className="mt-1 break-words font-medium text-[#344d68]">{point.value ?? "Belum diisi"}</dd>
                   </div>
                   <div className="col-span-2">
                     <dt className="text-[10px] font-bold uppercase tracking-wide text-[#897657]">Kendaraan</dt>
                     <dd className="mt-1 break-words font-medium text-[#344d68]">{assignment?.vehicleLabel ?? "Belum diisi"}</dd>
                   </div>
                 </dl>
                 <Link
                   className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-[#b99a5a] px-4 text-sm font-semibold text-[#6d531e] outline-none hover:bg-[#fbf5e8] focus-visible:ring-2 focus-visible:ring-[#9a7526]"
                   href={`/admin/pickup/${participant.registrationId}`}
                 >
                   Lihat / Edit
                 </Link>
               </article>
             );
           })}
           {visibleParticipants.length === 0 ? (
             <p className="rounded-xl border border-dashed border-[#d8cbb6] bg-[#fffdf8] p-8 text-center text-sm text-[#5b6c7c]">Peserta tidak ditemukan.</p>
           ) : null}
         </div>

         <div aria-label="Geser horizontal untuk melihat seluruh kolom pickup" className="mt-5 hidden overflow-x-auto rounded-xl border border-[#e4d8c4] bg-[#fffdf8] lg:block" tabIndex={0}>
           <table className="min-w-[1280px] w-full text-left text-sm">
            <thead className="border-b border-[#e4d8c4] bg-[#fbf5e8] text-xs uppercase tracking-wide text-[#897657]">
              <tr>
                <th className="px-4 py-3 font-semibold">Registration ID</th>
                <th className="px-4 py-3 font-semibold">Nama</th>
                <th className="px-4 py-3 font-semibold">Status Registrasi</th>
                <th className="px-4 py-3 font-semibold">Travel</th>
                <th className="px-4 py-3 font-semibold">Moda</th>
                <th className="px-4 py-3 font-semibold">Nomor</th>
                 <th className="px-4 py-3 font-semibold">Lokasi</th>
                 <th className="px-4 py-3 font-semibold">Status pickup</th>
                 <th className="px-4 py-3 font-semibold">{transferType === "ARRIVAL" ? "Titik Jemput" : "Titik Antar"}</th>
                 <th className="px-4 py-3 font-semibold">Kendaraan</th>
                 <th className="px-4 py-3 font-semibold">Catatan</th>
                <th className="px-4 py-3 font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eee6d8] text-[#344d68]">
              {visibleParticipants.map((participant) => {
                const assignment = selectAssignment(participant, transferType);
                const travel = participant.travel;
                const isArrival = transferType === "ARRIVAL";

                return (
                  <tr className="align-top" key={participant.registrationId}>
                    <td className="px-4 py-4 font-semibold text-[#9a7526]">{participant.registrationId}</td>
                    <td className="px-4 py-4 font-semibold text-[#142842]">{participant.fullName}</td>
                    <td className="px-4 py-4">ACTIVE</td>
                    <td className="px-4 py-4">{travel ? "Tersedia" : "Belum tersedia"}</td>
                    <td className="px-4 py-4">{travel ? (isArrival ? travel.outboundTransportMode : travel.returnTransportMode) : "-"}</td>
                    <td className="px-4 py-4">{travel ? (isArrival ? travel.outboundTransportNumber : travel.returnTransportNumber) ?? "-" : "-"}</td>
                     <td className="px-4 py-4">{travel ? (isArrival ? travel.outboundDestination : travel.returnDestination) : "-"}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${assignmentClassName(assignment)}`}>
                        {assignmentLabel(assignment)}
                      </span>
                    </td>
                      <td className="px-4 py-4">
                        {(() => {
                          const point = getEffectivePickupPoint(transferType, assignment, travel);
                          return (
                            <>
                              <span>{point.value ?? "Belum diisi"}</span>
                              {point.source === "TRAVEL" ? (
                                <span className="mt-1 block text-xs text-[#897657]">Default dari travel peserta</span>
                              ) : null}
                            </>
                          );
                        })()}
                      </td>
                     <td className="px-4 py-4">{assignment?.vehicleLabel ?? "-"}</td>
                     <td className="px-4 py-4">{assignment?.notes ?? "-"}</td>
                    <td className="px-4 py-4">
                      <Link
                        className="font-semibold text-[#344d68] underline underline-offset-4 hover:text-[#142842]"
                        href={`/admin/pickup/${participant.registrationId}`}
                      >
                        Lihat / Edit
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {visibleParticipants.length === 0 ? (
            <p className="p-8 text-center text-sm text-[#5b6c7c]">Peserta tidak ditemukan.</p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
