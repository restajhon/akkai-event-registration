"use client";

import Link from "next/link";
import { useState } from "react";

import { AdminMetricCard, AdminPageHeader } from "@/components/admin/admin-ui";
import type { RoomParticipant } from "@/lib/admin/assignment-types";

type AssignmentFilter = "all" | "assigned" | "unassigned";
type PackageFilter = "all" | "Twin Share" | "Single";

function isAssigned(participant: RoomParticipant) {
  return Boolean(participant.assignment?.roomNumber);
}

function statusLabel(participant: RoomParticipant) {
  return isAssigned(participant) ? "Sudah diatur" : "Belum diatur";
}

function statusClassName(participant: RoomParticipant) {
  return isAssigned(participant)
    ? "border-[#b9dec8] bg-[#f3fbf5] text-[#267044]"
    : "border-[#e5cb8c] bg-[#fff9eb] text-[#80631e]";
}

export function getRoomAssignmentLists(
  participants: RoomParticipant[],
  query: string,
  filter: AssignmentFilter,
  packageFilter: PackageFilter,
) {
  const activeParticipants = participants.filter(
    (participant) => participant.registrationStatus === "REGISTERED",
  );
  const normalizedQuery = query.trim().toLowerCase();
  const visibleParticipants = activeParticipants.filter((participant) => {
    const matchesQuery =
      !normalizedQuery ||
      participant.fullName.toLowerCase().includes(normalizedQuery) ||
      participant.registrationId.toLowerCase().includes(normalizedQuery);
    const matchesFilter =
      filter === "all" ||
      (filter === "assigned" && isAssigned(participant)) ||
      (filter === "unassigned" && !isAssigned(participant));
    const matchesPackage = packageFilter === "all" || participant.packageType === packageFilter;

    return matchesQuery && matchesFilter && matchesPackage;
  });

  return { activeParticipants, visibleParticipants };
}

export function RoomAssignmentBoard({
  participants,
}: {
  participants: RoomParticipant[];
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<AssignmentFilter>("all");
  const [packageFilter, setPackageFilter] = useState<PackageFilter>("all");
  const { activeParticipants, visibleParticipants } = getRoomAssignmentLists(
    participants,
    query,
    filter,
    packageFilter,
  );
  const assignedCount = activeParticipants.filter(isAssigned).length;
  const unassignedCount = activeParticipants.length - assignedCount;

  return (
    <main className="min-h-screen bg-[#f7f3ea] px-4 py-5 sm:px-8 sm:py-6">
      <section className="mx-auto max-w-[1200px]">
        <AdminPageHeader
          action={<a
            className="inline-flex min-h-11 items-center rounded-lg border border-[#b99a5a] px-4 text-sm font-semibold text-[#6d531e] hover:bg-[#fbf5e8]"
            download="AKKAI-2026-Room-Assignment.xlsx"
            href="/api/admin/room-assignment-export"
          >
            Download Excel
          </a>}
          description="Pantau kebutuhan kamar peserta di Hotel Gumaya Semarang."
          eyebrow="Operasional"
          title="Room Assignment"
        />

        <section aria-label="Ringkasan room assignment" className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
          <AdminMetricCard label="Peserta Aktif" subtitle="membutuhkan kamar" value={activeParticipants.length} />
          <AdminMetricCard label="Sudah Diatur" subtitle="assignment" value={assignedCount} />
          <AdminMetricCard label="Belum Diatur" subtitle="assignment" value={unassignedCount} />
        </section>

        <section className="mt-5 rounded-xl border border-[#e4d8c4] bg-[#fffdf8] p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_180px_180px]">
            <div>
              <label className="text-sm font-semibold text-[#142842]" htmlFor="room-search">
                Cari peserta
              </label>
              <input
                className="mt-2 min-h-11 w-full rounded-lg border border-[#cfc5b4] bg-white px-3 text-sm text-[#142842] outline-none placeholder:text-[#9a9489] focus:border-[#9a7526] focus:ring-2 focus:ring-[#ead9ac]"
                id="room-search"
                onChange={(event) => setQuery(event.target.value)}
               placeholder="Nama atau Registration ID"
                type="search"
                value={query}
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-[#142842]" htmlFor="room-filter">
                Tampilkan
              </label>
              <select
                className="mt-2 min-h-11 w-full rounded-lg border border-[#cfc5b4] bg-white px-3 text-sm text-[#142842] outline-none focus:border-[#9a7526] focus:ring-2 focus:ring-[#ead9ac]"
                id="room-filter"
                onChange={(event) => setFilter(event.target.value as AssignmentFilter)}
                value={filter}
              >
                <option value="all">Semua peserta</option>
                <option value="assigned">Assigned</option>
                <option value="unassigned">Unassigned</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold text-[#142842]" htmlFor="room-package-filter">
                Paket
              </label>
              <select
                className="mt-2 min-h-11 w-full rounded-lg border border-[#cfc5b4] bg-white px-3 text-sm text-[#142842] outline-none focus:border-[#9a7526] focus:ring-2 focus:ring-[#ead9ac]"
                id="room-package-filter"
                onChange={(event) => setPackageFilter(event.target.value as PackageFilter)}
                value={packageFilter}
              >
                <option value="all">Semua paket</option>
                <option value="Twin Share">Twin Share</option>
                <option value="Single">Single</option>
              </select>
            </div>
          </div>
          <p className="mt-3 text-sm text-[#5b6c7c]">
            {visibleParticipants.length} dari {activeParticipants.length} peserta ditampilkan.
          </p>
        </section>

        <div className="mt-5 grid gap-3 lg:hidden">
          {visibleParticipants.map((participant) => (
            <article className="rounded-xl border border-[#e4d8c4] bg-[#fffdf8] p-4" key={participant.registrationId}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="break-words font-semibold text-[#142842]">{participant.fullName}</h2>
                  <p className="mt-1 break-all text-xs font-semibold text-[#9a7526]">{participant.registrationId}</p>
                  <p className="mt-1 text-xs text-[#637487]">Paket {participant.packageType ?? "belum diisi"}</p>
                </div>
                <span className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClassName(participant)}`}>
                  {statusLabel(participant)}
                </span>
              </div>
              <div className="mt-4 border-t border-[#eee6d8] pt-3">
                <p className={`text-sm font-semibold ${isAssigned(participant) ? "text-[#344d68]" : "text-[#80631e]"}`}>
                  {participant.assignment?.roomNumber ? `Kamar ${participant.assignment.roomNumber}` : "Kamar belum ditetapkan"}
                </p>
                {participant.assignment?.notes ? <p className="mt-1 break-words text-xs text-[#637487]">{participant.assignment.notes}</p> : null}
                <Link
                  className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-[#b99a5a] px-4 text-sm font-semibold text-[#6d531e] outline-none hover:bg-[#fbf5e8] focus-visible:ring-2 focus-visible:ring-[#9a7526]"
                  href={`/admin/rooms/${participant.registrationId}`}
                >
                  Lihat / Edit
                </Link>
              </div>
            </article>
          ))}
          {visibleParticipants.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[#d8cbb6] bg-[#fffdf8] p-8 text-center text-sm text-[#5b6c7c]">Peserta tidak ditemukan.</p>
          ) : null}
        </div>

        <div className="mt-5 hidden overflow-x-auto rounded-xl border border-[#e4d8c4] bg-[#fffdf8] lg:block">
          <table className="min-w-[900px] w-full text-left text-sm">
            <thead className="border-b border-[#e4d8c4] bg-[#fbf5e8] text-xs uppercase tracking-wide text-[#897657]">
              <tr>
                <th className="px-4 py-3 font-semibold">Registration ID</th>
                <th className="px-4 py-3 font-semibold">Nama</th>
                <th className="px-4 py-3 font-semibold">Status Registrasi</th>
                <th className="px-4 py-3 font-semibold">Paket</th>
                <th className="px-4 py-3 font-semibold">Status Room</th>
                <th className="px-4 py-3 font-semibold">Nomor Kamar</th>
                <th className="px-4 py-3 font-semibold">Catatan</th>
                <th className="px-4 py-3 font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eee6d8] text-[#344d68]">
              {visibleParticipants.map((participant) => (
                <tr className="align-top" key={participant.registrationId}>
                  <td className="px-4 py-4 font-semibold text-[#9a7526]">
                    {participant.registrationId}
                  </td>
                  <td className="px-4 py-4 font-semibold text-[#142842]">{participant.fullName}</td>
                  <td className="px-4 py-4">ACTIVE</td>
                  <td className="px-4 py-4">{participant.packageType ?? "-"}</td>
                   <td className="px-4 py-4">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClassName(participant)}`}>
                      {statusLabel(participant)}
                    </span>
                  </td>
                   <td className="px-4 py-4">{participant.assignment?.roomNumber ?? "-"}</td>
                   <td className="px-4 py-4">{participant.assignment?.notes ?? "-"}</td>
                  <td className="px-4 py-4">
                    <Link
                      className="font-semibold text-[#344d68] underline underline-offset-4 hover:text-[#142842]"
                      href={`/admin/rooms/${participant.registrationId}`}
                    >
                      Lihat / Edit
                    </Link>
                  </td>
                </tr>
              ))}
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
