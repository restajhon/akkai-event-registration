"use client";

import { useActionState } from "react";

import {
  initialAssignmentActionState,
  type AssignmentActionState,
} from "@/lib/admin/assignment-action-state";
import type { RoomParticipant } from "@/lib/admin/assignment-types";

import { upsertRoomAssignment } from "./actions";

export function RoomAssignmentForm({ participant }: { participant: RoomParticipant }) {
  const [state, formAction, pending] = useActionState<
    AssignmentActionState,
    FormData
  >(upsertRoomAssignment, initialAssignmentActionState);
  const assignment = participant.assignment;
  const canEdit = participant.registrationStatus === "REGISTERED";

  return (
    <div className="mt-5 border-t border-[#eee6d8] pt-5">
      {canEdit ? null : (
        <p className="mb-4 rounded-lg border border-[#dedbd3] bg-[#f2f0eb] p-3 text-sm text-[#6b6a66]">
          Peserta dibatalkan. Assignment kamar bersifat read-only.
        </p>
      )}
      <form
        action={formAction}
        className="grid gap-4 md:grid-cols-2"
        key={`${participant.registrationId}-${assignment?.updatedAt ?? "none"}`}
      >
        <input name="registrationId" type="hidden" value={participant.registrationId} />
        <div>
          <label className="text-sm font-semibold text-[#344d68]" htmlFor="room-number">
            Nomor kamar
          </label>
          <input
            className="mt-1.5 min-h-11 w-full rounded-lg border border-[#cfc5b4] bg-white px-3 text-sm text-[#142842] outline-none focus:border-[#9a7526] focus:ring-2 focus:ring-[#ead9ac] disabled:bg-[#f2f0eb]"
            defaultValue={assignment?.roomNumber ?? ""}
            disabled={!canEdit || pending}
            id="room-number"
            maxLength={50}
            name="roomNumber"
            placeholder="Contoh: 1205"
            type="text"
          />
        </div>
        <div>
          <label className="text-sm font-semibold text-[#344d68]" htmlFor="room-type">
            Tipe kamar
          </label>
          <input
            className="mt-1.5 min-h-11 w-full rounded-lg border border-[#cfc5b4] bg-white px-3 text-sm text-[#142842] outline-none focus:border-[#9a7526] focus:ring-2 focus:ring-[#ead9ac] disabled:bg-[#f2f0eb]"
            defaultValue={assignment?.roomType ?? ""}
            disabled={!canEdit || pending}
            id="room-type"
            maxLength={100}
            name="roomType"
            placeholder="Contoh: Twin"
            type="text"
          />
        </div>
        <div>
          <label className="text-sm font-semibold text-[#344d68]" htmlFor="check-in">
            Check-in
          </label>
          <input
            className="mt-1.5 min-h-11 w-full rounded-lg border border-[#cfc5b4] bg-white px-3 text-sm text-[#142842] outline-none focus:border-[#9a7526] focus:ring-2 focus:ring-[#ead9ac] disabled:bg-[#f2f0eb]"
            defaultValue={assignment?.checkInDate ?? ""}
            disabled={!canEdit || pending}
            id="check-in"
            name="checkInDate"
            type="date"
          />
        </div>
        <div>
          <label className="text-sm font-semibold text-[#344d68]" htmlFor="check-out">
            Check-out
          </label>
          <input
            className="mt-1.5 min-h-11 w-full rounded-lg border border-[#cfc5b4] bg-white px-3 text-sm text-[#142842] outline-none focus:border-[#9a7526] focus:ring-2 focus:ring-[#ead9ac] disabled:bg-[#f2f0eb]"
            defaultValue={assignment?.checkOutDate ?? ""}
            disabled={!canEdit || pending}
            id="check-out"
            name="checkOutDate"
            type="date"
          />
        </div>
        <div className="md:col-span-2">
          <label className="text-sm font-semibold text-[#344d68]" htmlFor="room-notes">
            Catatan
          </label>
          <textarea
            className="mt-1.5 min-h-24 w-full rounded-lg border border-[#cfc5b4] bg-white px-3 py-2 text-sm text-[#142842] outline-none focus:border-[#9a7526] focus:ring-2 focus:ring-[#ead9ac] disabled:bg-[#f2f0eb]"
            defaultValue={assignment?.notes ?? ""}
            disabled={!canEdit || pending}
            id="room-notes"
            maxLength={500}
            name="notes"
            placeholder="Catatan operasional (opsional)"
          />
        </div>
        {canEdit ? (
          <div className="flex flex-wrap gap-2 md:col-span-2">
            <button
              className="inline-flex min-h-11 items-center rounded-lg bg-[#142842] px-4 text-sm font-semibold text-white outline-none hover:bg-[#203d5d] focus-visible:ring-2 focus-visible:ring-[#9a7526] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={pending}
              type="submit"
            >
              {pending ? "Menyimpan..." : assignment ? "Perbarui Assignment" : "Simpan Assignment"}
            </button>
            {assignment ? (
              <button
                className="inline-flex min-h-11 items-center rounded-lg border border-[#b99a5a] px-4 text-sm font-semibold text-[#6d531e] outline-none hover:bg-[#fbf5e8] focus-visible:ring-2 focus-visible:ring-[#9a7526] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={pending}
                name="clear"
                type="submit"
                value="true"
              >
                {pending ? "Memproses..." : "Kosongkan Assignment"}
              </button>
            ) : null}
          </div>
        ) : null}
      </form>
      {state.message ? (
        <p
          aria-live="polite"
          className={`mt-3 text-sm ${state.status === "success" ? "text-[#267044]" : "text-[#9b3d31]"}`}
          role={state.status === "error" ? "alert" : "status"}
        >
          {state.status === "success" ? "✓ " : null}
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
