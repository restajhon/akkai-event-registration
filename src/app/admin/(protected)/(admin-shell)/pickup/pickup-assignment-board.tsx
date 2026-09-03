"use client";

import Link from "next/link";
import { useState } from "react";

import type {
  PickupAssignment,
  PickupParticipant,
} from "@/lib/admin/assignment-types";

type PickupFilter =
  | "all"
  | "arrival-unassigned"
  | "arrival-scheduled"
  | "arrival-completed"
  | "departure-unassigned"
  | "departure-scheduled"
  | "departure-completed";

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

function matchesFilter(participant: PickupParticipant, filter: PickupFilter) {
  if (filter === "all") {
    return true;
  }

  const [leg, state] = filter.split("-") as ["arrival" | "departure", string];
  const assignment = leg === "arrival" ? participant.arrivalAssignment : participant.departureAssignment;

  return state === "unassigned"
    ? !assignment || assignment.status === "CANCELLED"
    : assignment?.status.toLowerCase() === state;
}

export function PickupAssignmentBoard({
  participants,
}: {
  participants: PickupParticipant[];
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<PickupFilter>("all");
  const normalizedQuery = query.trim().toLowerCase();
  const visibleParticipants = participants.filter((participant) => {
    const matchesQuery =
      !normalizedQuery ||
      participant.fullName.toLowerCase().includes(normalizedQuery) ||
      participant.registrationId.toLowerCase().includes(normalizedQuery) ||
      participant.participantCategory.toLowerCase().includes(normalizedQuery);

    return matchesQuery && matchesFilter(participant, filter);
  });

  return (
    <main className="min-h-screen bg-[#f7f3ea] px-4 py-5 sm:px-8 sm:py-6">
      <section className="mx-auto max-w-[1200px]">
        <header className="border-b border-[#dfd3bf] pb-5">
          <p className="text-xs font-bold tracking-[0.18em] text-[#9a7526]">OPERASIONAL</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#142842] sm:text-3xl">
            Pickup Assignment
          </h1>
          <p className="mt-1 text-sm text-[#5b6c7c]">
            Pantau penjemputan kedatangan dan kepulangan di Hotel Gumaya Semarang.
          </p>
        </header>

        <section className="mt-5 rounded-xl border border-[#e4d8c4] bg-[#fffdf8] p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_260px]">
            <div>
              <label className="text-sm font-semibold text-[#142842]" htmlFor="pickup-search">
                Cari peserta
              </label>
              <input
                className="mt-2 min-h-11 w-full rounded-lg border border-[#cfc5b4] bg-white px-3 text-sm text-[#142842] outline-none placeholder:text-[#9a9489] focus:border-[#9a7526] focus:ring-2 focus:ring-[#ead9ac]"
                id="pickup-search"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Nama, Registration ID, atau kategori"
                type="search"
                value={query}
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-[#142842]" htmlFor="pickup-filter">
                Filter operasional
              </label>
              <select
                className="mt-2 min-h-11 w-full rounded-lg border border-[#cfc5b4] bg-white px-3 text-sm text-[#142842] outline-none focus:border-[#9a7526] focus:ring-2 focus:ring-[#ead9ac]"
                id="pickup-filter"
                onChange={(event) => setFilter(event.target.value as PickupFilter)}
                value={filter}
              >
                <option value="all">Semua peserta</option>
                <option value="arrival-unassigned">Arrival: Unassigned</option>
                <option value="arrival-scheduled">Arrival: Scheduled</option>
                <option value="arrival-completed">Arrival: Completed</option>
                <option value="departure-unassigned">Departure: Unassigned</option>
                <option value="departure-scheduled">Departure: Scheduled</option>
                <option value="departure-completed">Departure: Completed</option>
              </select>
            </div>
          </div>
          <p className="mt-3 text-sm text-[#5b6c7c]">
            {visibleParticipants.length} dari {participants.length} peserta ditampilkan.
          </p>
        </section>

        <div className="mt-5 overflow-x-auto rounded-xl border border-[#e4d8c4] bg-[#fffdf8]">
          <table className="min-w-[850px] w-full text-left text-sm">
            <thead className="border-b border-[#e4d8c4] bg-[#fbf5e8] text-xs uppercase tracking-wide text-[#897657]">
              <tr>
                <th className="px-4 py-3 font-semibold">Registration ID</th>
                <th className="px-4 py-3 font-semibold">Nama</th>
                <th className="px-4 py-3 font-semibold">Kategori</th>
                <th className="px-4 py-3 font-semibold">Travel</th>
                <th className="px-4 py-3 font-semibold">Pickup Kedatangan</th>
                <th className="px-4 py-3 font-semibold">Pickup Kepulangan</th>
                <th className="px-4 py-3 font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eee6d8] text-[#344d68]">
              {visibleParticipants.map((participant) => (
                <tr className="align-top" key={participant.registrationId}>
                  <td className="px-4 py-4 font-semibold text-[#9a7526]">{participant.registrationId}</td>
                  <td className="px-4 py-4 font-semibold text-[#142842]">{participant.fullName}</td>
                  <td className="px-4 py-4">{participant.participantCategory}</td>
                  <td className="px-4 py-4">{participant.travel ? "Sudah diisi" : "Belum diisi"}</td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${assignmentClassName(participant.arrivalAssignment)}`}>
                      {assignmentLabel(participant.arrivalAssignment)}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${assignmentClassName(participant.departureAssignment)}`}>
                      {assignmentLabel(participant.departureAssignment)}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <Link
                      className="font-semibold text-[#344d68] underline underline-offset-4 hover:text-[#142842]"
                      href={`/admin/pickup/${participant.registrationId}`}
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
