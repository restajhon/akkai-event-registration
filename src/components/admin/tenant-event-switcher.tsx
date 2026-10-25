"use client";

import { selectActiveEvent } from "@/app/admin/tenant-actions";
import type { AccessibleEvent } from "@/lib/tenant/server-context";

export function TenantEventSwitcher({
  events,
  activeEventId,
}: {
  events: AccessibleEvent[];
  activeEventId: string;
}) {
  if (events.length < 2) {
    const active = events.find((event) => event.id === activeEventId);
    if (!active) return null;
    return (
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-[#e4d8c4] bg-[#fffdf8] px-4 py-2 text-xs text-[#53657b] sm:px-8">
        <span className="font-semibold text-[#142842]">{active.companyName}</span>
        <span aria-hidden="true">/</span>
        <span>{active.eventName}</span>
      </div>
    );
  }

  return (
    <form action={selectActiveEvent} className="flex flex-wrap items-center gap-3 border-b border-[#e4d8c4] bg-[#fffdf8] px-4 py-2 sm:px-8">
      <label className="text-xs font-semibold text-[#53657b]" htmlFor="active-event-id">
        Perusahaan / Event aktif
      </label>
      <select
        className="min-h-9 max-w-full rounded-md border border-[#d8c9af] bg-white px-2 text-sm text-[#142842]"
        defaultValue={activeEventId}
        id="active-event-id"
        name="eventId"
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
      >
        {events.map((event) => (
          <option key={event.id} value={event.id}>
            {event.companyName} — {event.eventName}
          </option>
        ))}
      </select>
    </form>
  );
}
