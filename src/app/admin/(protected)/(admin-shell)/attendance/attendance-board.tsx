"use client";

import { useState } from "react";

import { AdminMetricCard } from "@/components/admin/admin-ui";
import type { OperationalParticipant, OperationalSessionCode } from "@/lib/admin/operational-data";
import { ATTENDANCE_SESSIONS } from "@/lib/admin/attendance-sessions";

type PresenceFilter = "all" | "present" | "absent";
type RegistrationFilter = "all" | "REGISTERED" | "CANCELLED";
type AttendanceFilters = Record<OperationalSessionCode, PresenceFilter>;

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

export function getAttendanceTotals(participants: OperationalParticipant[]) {
  return Object.fromEntries(
    ATTENDANCE_SESSIONS.map(({ code, key }) => [
      code,
      participants.filter((participant) => participant[key].checkedIn).length,
    ]),
  ) as Record<OperationalSessionCode, number>;
}

export function getVisibleAttendanceParticipants(
  participants: OperationalParticipant[],
  query: string,
  registrationFilter: RegistrationFilter,
  filters: AttendanceFilters,
) {
  const normalizedQuery = query.trim().toLowerCase();

  return participants.filter((participant) => {
    const matchesQuery =
      !normalizedQuery ||
      participant.fullName.toLowerCase().includes(normalizedQuery) ||
      participant.registrationId.toLowerCase().includes(normalizedQuery);
    const matchesRegistration =
      registrationFilter === "all" || participant.registrationStatus === registrationFilter;
    const matchesSessions = ATTENDANCE_SESSIONS.every(({ code, key }) =>
      matchesPresence(participant[key].checkedIn, filters[code]),
    );

    return matchesQuery && matchesRegistration && matchesSessions;
  });
}

export function AttendanceBoard({
  participants,
  canExportAttendance,
}: {
  participants: OperationalParticipant[];
  canExportAttendance: boolean;
}) {
  const [query, setQuery] = useState("");
  const [registrationFilter, setRegistrationFilter] = useState<RegistrationFilter>("all");
  const [filters, setFilters] = useState<AttendanceFilters>({
    ARRIVAL: "all",
    SEMINAR: "all",
    DAY3: "all",
    DAY1_MEMBER_MEETING: "all",
    DAY2_AKKAI_NIGHT: "all",
  });
  const attendanceTotals = getAttendanceTotals(participants);
  const visibleParticipants = getVisibleAttendanceParticipants(
    participants,
    query,
    registrationFilter,
    filters,
  );

  return (
    <main className="min-h-screen bg-[#f7f3ea] px-4 py-5 sm:px-8 sm:py-6">
      <section className="mx-auto max-w-[1400px]">
        <header className="flex flex-col gap-4 border-b border-[#dfd3bf] pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold tracking-[0.18em] text-[#9a7526]">MONITORING</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#142842] sm:text-3xl">Kehadiran</h1>
            <p className="mt-1 text-sm text-[#5b6c7c]">Ringkasan check-in peserta pada seluruh sesi operasional acara.</p>
          </div>
          {canExportAttendance ? (
            <div className="flex flex-wrap gap-2">
              <a
                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#142842] px-4 text-sm font-semibold text-white hover:bg-[#203d5d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9a7526]"
                download="AKKAI-2026-Operational.xlsx"
                href="/api/admin/operational-export"
              >
                Unduh workbook Excel
              </a>
              <a
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#b99a5a] px-4 text-sm font-semibold text-[#6d531e] hover:bg-[#fbf5e8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9a7526]"
                download="AKKAI-2026-Day-1-Rapat-Anggota.xlsx"
                href="/api/admin/attendance-export?sessionCode=DAY1_MEMBER_MEETING"
              >
                Unduh Day 1 — Rapat Anggota
              </a>
              <a
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#b99a5a] px-4 text-sm font-semibold text-[#6d531e] hover:bg-[#fbf5e8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9a7526]"
                download="AKKAI-2026-Day-2-Akkai-Night.xlsx"
                href="/api/admin/attendance-export?sessionCode=DAY2_AKKAI_NIGHT"
              >
                Unduh Day 2 — Akkai Night
              </a>
            </div>
          ) : null}
        </header>

        <section aria-label="Ringkasan kehadiran" className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 sm:gap-3">
          {ATTENDANCE_SESSIONS.map(({ code, summaryLabel }) => (
            <AdminMetricCard
              key={code}
              label={summaryLabel}
              subtitle="peserta"
              value={attendanceTotals[code]}
            />
          ))}
        </section>

        <section className="mt-5 rounded-xl border border-[#e4d8c4] bg-[#fffdf8] p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-[minmax(0,1fr)_180px_180px_180px_180px_180px_180px]">
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
            {ATTENDANCE_SESSIONS.map(({ code, label }) => (
              <div key={code}>
                <label className="text-sm font-semibold text-[#142842]" htmlFor={`attendance-${code.toLowerCase()}-filter`}>{label}</label>
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

        <div className="mt-5 grid gap-3 lg:hidden">
          {visibleParticipants.map((participant) => (
            <article className="rounded-xl border border-[#e4d8c4] bg-[#fffdf8] p-4" key={participant.registrationId}>
              <h2 className="break-words font-semibold text-[#142842]">{participant.fullName}</h2>
              <p className="mt-1 break-all text-xs font-semibold text-[#9a7526]">{participant.registrationId}</p>
              {participant.registrationStatus === "CANCELLED" ? (
                <p className="mt-1 text-xs font-semibold text-[#9a3e35]">Registrasi dibatalkan</p>
              ) : null}
              <dl className="mt-4 grid gap-3 border-t border-[#eee6d8] pt-3">
                {ATTENDANCE_SESSIONS.map(({ key, label }) => {
                  const attendance = participant[key];
                  return (
                    <div className="flex items-start justify-between gap-3" key={key}>
                      <dt className="text-xs font-bold uppercase tracking-wide text-[#897657]">{label}</dt>
                      <dd className="text-right">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${presenceClassName(attendance.checkedIn)}`}>
                          {presenceLabel(attendance.checkedIn)}
                        </span>
                        {attendance.checkedInAt ? <p className="mt-1 text-xs text-[#897657]">{formatCheckIn(attendance.checkedInAt)}</p> : null}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </article>
          ))}
          {visibleParticipants.length === 0 ? <p className="rounded-xl border border-dashed border-[#d8cbb6] bg-[#fffdf8] p-8 text-center text-sm text-[#5b6c7c]">Peserta tidak ditemukan.</p> : null}
        </div>

        <div className="mt-5 hidden overflow-x-auto rounded-xl border border-[#e4d8c4] bg-[#fffdf8] lg:block">
          <table className="min-w-[1450px] w-full text-left text-sm">
            <thead className="border-b border-[#e4d8c4] bg-[#fbf5e8] text-xs uppercase tracking-wide text-[#897657]">
              <tr>
                <th className="px-4 py-3 font-semibold">Registration ID</th>
                <th className="px-4 py-3 font-semibold">Nama</th>
                <th className="px-4 py-3 font-semibold">Status Registrasi</th>
                {ATTENDANCE_SESSIONS.map(({ code, summaryLabel }) => <th className="px-4 py-3 font-semibold" key={code}>{summaryLabel}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eee6d8] text-[#344d68]">
              {visibleParticipants.map((participant) => (
                <tr className="align-top" key={participant.registrationId}>
                  <td className="px-4 py-4 font-semibold text-[#9a7526]">{participant.registrationId}</td>
                  <td className="px-4 py-4 font-semibold text-[#142842]">{participant.fullName}</td>
                  <td className="px-4 py-4">{participant.registrationStatus === "REGISTERED" ? "ACTIVE" : "CANCELLED"}</td>
                  {ATTENDANCE_SESSIONS.map(({ code, key }) => {
                    const attendance = participant[key];
                    return (
                      <td className="px-4 py-4" key={code}>
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
