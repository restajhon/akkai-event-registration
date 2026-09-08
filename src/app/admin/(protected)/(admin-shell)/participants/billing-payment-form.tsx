"use client";

import { useActionState } from "react";

import {
  initialParticipantActionState,
  type ParticipantActionState,
} from "@/lib/participants/participant-action-state";

import { updateRegistrationBillingPaymentStatus } from "./actions";

export function BillingPaymentForm({
  billingId,
  registrationId,
  paymentStatus,
}: {
  billingId: string;
  registrationId: string;
  paymentStatus: "PAID" | "UNPAID";
}) {
  const [state, formAction, pending] = useActionState<
    ParticipantActionState,
    FormData
  >(updateRegistrationBillingPaymentStatus, initialParticipantActionState);
  const nextStatus = paymentStatus === "PAID" ? "UNPAID" : "PAID";

  return (
    <div className="mt-4">
      <form action={formAction}>
        <input name="billingId" type="hidden" value={billingId} />
        <input name="registrationId" type="hidden" value={registrationId} />
        <input name="paymentStatus" type="hidden" value={nextStatus} />
        <button
          className="inline-flex min-h-11 items-center rounded-lg border border-[#b99a5a] px-4 py-2 text-sm font-semibold text-[#6d531e] outline-none hover:bg-[#fbf5e8] focus-visible:ring-2 focus-visible:ring-[#9a7526] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={pending}
          type="submit"
        >
          {pending ? "Menyimpan..." : nextStatus === "PAID" ? "Ubah menjadi Lunas" : "Ubah menjadi Belum Dibayar"}
        </button>
      </form>
      {state.message ? (
        <p className={`mt-2 text-sm ${state.status === "success" ? "text-[#267044]" : "text-[#9b3d31]"}`} role={state.status === "error" ? "alert" : "status"}>
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
