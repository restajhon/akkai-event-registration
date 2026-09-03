"use client";

import { useState } from "react";

import type { OperationalParticipant, OperationalSessionCode } from "@/lib/admin/operational-data";

type PresenceFilter = "all" | "present" | "absent";
type RegistrationFilter = "all" | "REGISTERED" | "CANCELLED";

const sessions: { code: OperationalSessionCode; label: string; date: string }[] = [
  { code: "ARRIVAL", label: "Registrasi Kedatangan", date: "19 Oktober 2026" },
  { code: "SEMINAR", label: "Seminar AKKAI 2026", date: "20 Oktober 2026" },
  { code: "DAY3", label: "Registrasi Day 3", date: "21 Oktober 2026" },
];

function presenceLabel(present: boolean) {
  return present ? "Hadir" : "Belum hadir";
}

function presenceClassName(present: boolean) {
  return present
    ? "border-[#b9dec8] bg-[#f3fbf5] text-[#267044]"
    : "border-[#dedbd3] bg-[#f2f0eb] text-[#6b6a66]";
}

function matchesPresence(present: boolean, filter: PresenceFilter) {
  return filter === "all" || (filter === "present" ? present : !present);
}

function formatCheckIn(value: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

export function AttendanceBoard({
  participants,
}: {
  participants: OperationalParticipant[];
}) {
  const [query, setQuery] = useState("");
  const [registrationFilter, setRegistrationFilter] = useState<RegistrationFilter>("all");
  const [filters, setFilters] = useState<Record<OperationalSessionCode, PresenceFilter>>({
    ARRIVAL: "all",
    SEMINAR: "all",
    DAY3: "all",
  });
  const normalizedQuery = query.trim().toLowerCase();
  const visibleParticipants = participants.filter((participant) => {
    const matchesQuery =
      !normalizedQuery ||
      participant.fullName.toLowerCase().includes(normalizedQuery) ||
      participant.registrationId.toLowerCase().includes(normalizedQuery);
    const matchesRegistration =
      registrationFilter === "all" || participant.registrationStatus === registrationFilter;
    const matchesSessions = sessions.every(({ code }) =>
      matchesPresence(participant[code === "ARRIVAL" ? "arrival" : code === "SEMINAR" ? "seminar" : "day3"].checkedIn, filters[code]),
    );

    return matchesQuery && matchesRegistration && matchesSessions;
  });

  return (
    <main className="min-h-screen bg-[#f7f3ea] px-4 py-5 sm:px-8 sm:py-6">
      <section className="mx-auto max-w-[1400px]">
        <header className="flex flex-col gap-4 border-b border-[#dfd3bf] pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold tracking-[0.18em] text-[#9a7526]">MONITORING</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#142842] sm:text-3xl">Kehadiran</h1>
            <p className="mt-1 text-sm text-[#5b6c7c]">Ringkasan check-in peserta pada tiga sesi operasional acara.</p>
          </div>
          <a
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#142842] px-4 text-sm font-semibold text-white hover:bg-[#203d5d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9a7526]"
            download="AKKAI-2026-Operational.xlsx"
            href="/api/admin/operational-export"
          >
            Unduh workbook Excel
          </a>
        </header>

        <section className="mt-5 rounded-xl border border-[#e4d8c4] bg-[#fffdf8] p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_180px_180px_180px_180px]">
            <div>
              <label className="text-sm font-semibold text-[#142842]" htmlFor="attendance-search">Cari peserta</label>
              <input
                className="mt-2 min-h-11 w-full rounded-lg border border-[#cfc5b4] bg-white px-3 text-sm text-[#142842] outline-none placeholder:text-[#9a9489] focus:border-[#9a7526] focus:ring-2 focus:ring-[#ead9ac]"
                id="attendance-search"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Nama atau Registration ID"
                type="search"
                value={query}
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-[#142842]" htmlFor="attendance-registration-filter">Status registrasi</label>
              <select
                className="mt-2 min-h-11 w-full rounded-lg border border-[#cfc5b4] bg-white px-3 text-sm text-[#142842] outline-none focus:border-[#9a7526] focus:ring-2 focus:ring-[#ead9ac]"
                id="attendance-registration-filter"
                onChange={(event) => setRegistrationFilter(event.target.value as RegistrationFilter)}
                value={registrationFilter}
              >
                <option value="all">Semua status</option>
                <option value="REGISTERED">ACTIVE</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </div>
            {sessions.map(({ code, label, date }) => (
              <div key={code}>
                <label className="text-sm font-semibold text-[#142842]" htmlFor={`attendance-${code.toLowerCase()}-filter`}>{label} · {date}</label>
                <select
                  className="mt-2 min-h-11 w-full rounded-lg border border-[#cfc5b4] bg-white px-3 text-sm text-[#142842] outline-none focus:border-[#9a7526] focus:ring-2 focus:ring-[#ead9ac]"
                  id={`attendance-${code.toLowerCase()}-filter`}
                  onChange={(event) => setFilters((current) => ({ ...current, [code]: event.target.value as PresenceFilter }))}
                  value={filters[code]}
                >
                  <option value="all">Semua</option>
                  <option value="present">Hadir</option>
                  <option value="absent">Belum hadir</option>
                </select>
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm text-[#5b6c7c]">{visibleParticipants.length} dari {participants.length} peserta ditampilkan.</p>
        </section>

        <div className="mt-5 overflow-x-auto rounded-xl border border-[#e4d8c4] bg-[#fffdf8]">
          <table className="min-w-[1000px] w-full text-left text-sm">
            <thead className="border-b border-[#e4d8c4] bg-[#fbf5e8] text-xs uppercase tracking-wide text-[#897657]">
              <tr>
                <th className="px-4 py-3 font-semibold">Registration ID</th>
                <th className="px-4 py-3 font-semibold">Nama</th>
                <th className="px-4 py-3 font-semibold">Status Registrasi</th>
                {sessions.map(({ code }) => <th className="px-4 py-3 font-semibold" key={code}>{code}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eee6d8] text-[#344d68]">
              {visibleParticipants.map((participant) => (
                <tr className="align-top" key={participant.registrationId}>
                  <td className="px-4 py-4 font-semibold text-[#9a7526]">{participant.registrationId}</td>
                  <td className="px-4 py-4 font-semibold text-[#142842]">{participant.fullName}</td>
                  <td className="px-4 py-4">{participant.registrationStatus === "REGISTERED" ? "ACTIVE" : "CANCELLED"}</td>
                  {(["arrival", "seminar", "day3"] as const).map((session) => {
                    const attendance = participant[session];
                    return (
                      <td className="px-4 py-4" key={session}>
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${presenceClassName(attendance.checkedIn)}`}>
                          {presenceLabel(attendance.checkedIn)}
                        </span>
                        {attendance.checkedInAt ? <p className="mt-2 text-xs text-[#897657]">{formatCheckIn(attendance.checkedInAt)}</p> : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {visibleParticipants.length === 0 ? <p className="p-8 text-center text-sm text-[#5b6c7c]">Peserta tidak ditemukan.</p> : null}
        </div>
      </section>
    </main>
  );
}
