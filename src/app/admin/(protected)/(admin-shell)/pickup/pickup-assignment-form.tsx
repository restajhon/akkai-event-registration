"use client";

import { useActionState } from "react";

import {
  initialAssignmentActionState,
  type AssignmentActionState,
} from "@/lib/admin/assignment-action-state";
import type {
  PickupParticipant,
  PickupTransferType,
} from "@/lib/admin/assignment-types";
import { getEffectivePickupPoint } from "@/lib/admin/pickup-mapping";

import { upsertPickupAssignment } from "./actions";

export function PickupAssignmentForm({
  participant,
  transferType,
}: {
  participant: PickupParticipant;
  transferType: PickupTransferType;
}) {
  const [state, formAction, pending] = useActionState<
    AssignmentActionState,
    FormData
  >(upsertPickupAssignment, initialAssignmentActionState);
  const assignment =
    transferType === "ARRIVAL"
      ? participant.arrivalAssignment
      : participant.departureAssignment;
  const canEdit = participant.registrationStatus === "REGISTERED";
  const prefix = transferType.toLowerCase();
  const effectivePoint = getEffectivePickupPoint(transferType, assignment, participant.travel);

  return (
    <div className="mt-5 border-t border-[#eee6d8] pt-5">
      {canEdit ? null : (
        <p className="mb-4 rounded-lg border border-[#dedbd3] bg-[#f2f0eb] p-3 text-sm text-[#6b6a66]">
          Peserta dibatalkan. Assignment pickup bersifat read-only.
        </p>
      )}
      <form
        action={formAction}
        className="grid gap-4 md:grid-cols-2"
        key={`${participant.registrationId}-${transferType}-${assignment?.updatedAt ?? "none"}`}
      >
        <input name="registrationId" type="hidden" value={participant.registrationId} />
        <input name="transferType" type="hidden" value={transferType} />
        <div>
          <label className="text-sm font-semibold text-[#344d68]" htmlFor={`${prefix}-status`}>
            Status
          </label>
          <select
            className="mt-1.5 min-h-11 w-full rounded-lg border border-[#cfc5b4] bg-white px-3 text-sm text-[#142842] outline-none focus:border-[#9a7526] focus:ring-2 focus:ring-[#ead9ac] disabled:bg-[#f2f0eb]"
            defaultValue={assignment?.status ?? "SCHEDULED"}
            disabled={!canEdit || pending}
            id={`${prefix}-status`}
            name="status"
          >
            <option value="SCHEDULED">SCHEDULED</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        </div>
        {transferType === "ARRIVAL" ? <div>
          <label className="text-sm font-semibold text-[#344d68]" htmlFor={`${prefix}-pickup-point`}>
            Titik Jemput
          </label>
           <input
            className="mt-1.5 min-h-11 w-full rounded-lg border border-[#cfc5b4] bg-white px-3 text-sm text-[#142842] outline-none focus:border-[#9a7526] focus:ring-2 focus:ring-[#ead9ac] disabled:bg-[#f2f0eb]"
             defaultValue={effectivePoint.value ?? ""}
            disabled={!canEdit || pending}
            id={`${prefix}-pickup-point`}
            maxLength={150}
            name="pickupPoint"
            placeholder="Contoh: Lobby hotel"
            type="text"
           />
           {effectivePoint.source === "TRAVEL" ? (
             <p className="mt-1 text-xs text-[#897657]">Default dari tujuan arrival travel peserta; dapat dikoreksi manual.</p>
           ) : null}
        </div> : null}
        {transferType === "DEPARTURE" ? <div>
          <label className="text-sm font-semibold text-[#344d68]" htmlFor={`${prefix}-dropoff-point`}>
            Titik Antar
          </label>
          <input
            className="mt-1.5 min-h-11 w-full rounded-lg border border-[#cfc5b4] bg-white px-3 text-sm text-[#142842] outline-none focus:border-[#9a7526] focus:ring-2 focus:ring-[#ead9ac] disabled:bg-[#f2f0eb]"
             defaultValue={effectivePoint.value ?? ""}
            disabled={!canEdit || pending}
            id={`${prefix}-dropoff-point`}
            maxLength={150}
            name="dropoffPoint"
            placeholder="Contoh: Bandara Ahmad Yani"
            type="text"
           />
           {effectivePoint.source === "TRAVEL" ? (
             <p className="mt-1 text-xs text-[#897657]">Default dari tujuan travel kepulangan peserta; dapat dikoreksi manual.</p>
           ) : null}
        </div> : null}
        <div>
          <label className="text-sm font-semibold text-[#344d68]" htmlFor={`${prefix}-vehicle-label`}>
            Kendaraan
          </label>
          <input
            className="mt-1.5 min-h-11 w-full rounded-lg border border-[#cfc5b4] bg-white px-3 text-sm text-[#142842] outline-none focus:border-[#9a7526] focus:ring-2 focus:ring-[#ead9ac] disabled:bg-[#f2f0eb]"
            defaultValue={assignment?.vehicleLabel ?? ""}
            disabled={!canEdit || pending}
            id={`${prefix}-vehicle-label`}
            maxLength={100}
            name="vehicleLabel"
            placeholder="Label kendaraan (opsional)"
            type="text"
          />
        </div>
        <div className="md:col-span-2">
          <label className="text-sm font-semibold text-[#344d68]" htmlFor={`${prefix}-notes`}>
            Catatan
          </label>
          <textarea
            className="mt-1.5 min-h-24 w-full rounded-lg border border-[#cfc5b4] bg-white px-3 py-2 text-sm text-[#142842] outline-none focus:border-[#9a7526] focus:ring-2 focus:ring-[#ead9ac] disabled:bg-[#f2f0eb]"
            defaultValue={assignment?.notes ?? ""}
            disabled={!canEdit || pending}
            id={`${prefix}-notes`}
            maxLength={500}
            name="notes"
            placeholder="Catatan operasional (opsional)"
          />
        </div>
        {canEdit ? (
          <div className="md:col-span-2">
            <button
              className="inline-flex min-h-11 items-center rounded-lg bg-[#142842] px-4 text-sm font-semibold text-white outline-none hover:bg-[#203d5d] focus-visible:ring-2 focus-visible:ring-[#9a7526] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={pending}
              type="submit"
            >
              {pending ? "Menyimpan..." : assignment ? "Perbarui Assignment" : "Simpan Assignment"}
            </button>
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
