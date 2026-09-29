"use client";

import { useActionState, useState } from "react";

import { initialParticipantActionState } from "@/lib/participants/participant-action-state";

import {
  cancelParticipantRegistration,
  restoreParticipantRegistration,
} from "./actions";

export function RegistrationStatusActions({
  canRestore,
  isCancelled,
  registrationId,
}: {
  canRestore: boolean;
  isCancelled: boolean;
  registrationId: string;
}) {
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelState, cancelAction, cancelPending] = useActionState(
    async (previousState: typeof initialParticipantActionState, formData: FormData) => {
      const result = await cancelParticipantRegistration(previousState, formData);
      if (result.status === "success") setIsCancelModalOpen(false);
      return result;
    },
    initialParticipantActionState,
  );
  const [restoreState, restoreAction, restorePending] = useActionState(
    restoreParticipantRegistration,
    initialParticipantActionState,
  );

  const message = cancelState.message ?? restoreState.message;
  const messageStatus = cancelState.message ? cancelState.status : restoreState.status;

  if (isCancelled && !canRestore) return null;

  return (
    <div className="grid justify-items-start gap-2">
      {isCancelled ? (
        <form action={restoreAction}>
          <input name="registrationId" type="hidden" value={registrationId} />
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#b99a5a] px-4 text-sm font-semibold text-[#6d531e] outline-none hover:bg-[#fbf5e8] focus-visible:ring-2 focus-visible:ring-[#9a7526] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={restorePending}
            type="submit"
          >
            {restorePending ? "Memulihkan..." : "Pulihkan Pendaftaran"}
          </button>
        </form>
      ) : (
        <>
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#b85c4e] px-4 text-sm font-semibold text-[#9b3d31] outline-none hover:bg-[#fff5f2] focus-visible:ring-2 focus-visible:ring-[#9b3d31]"
            onClick={() => setIsCancelModalOpen(true)}
            type="button"
          >
            Batalkan Pendaftaran
          </button>
          {isCancelModalOpen ? (
            <div
              aria-labelledby="cancel-registration-title"
              aria-modal="true"
              className="fixed inset-0 z-50 grid place-items-center bg-[#142842]/45 p-4"
              role="dialog"
            >
              <div className="w-full max-w-lg rounded-xl border border-[#e4d8c4] bg-[#fffdf8] p-5 shadow-2xl sm:p-6">
                <h2 className="text-xl font-semibold text-[#142842]" id="cancel-registration-title">
                  Batalkan Pendaftaran?
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#5b6c7c]">
                  Data, billing, email log, travel, room, pickup, attendance, dan histori idempotency tidak akan dihapus.
                </p>
                <form action={cancelAction} className="mt-5 grid gap-4">
                  <input name="registrationId" type="hidden" value={registrationId} />
                  <label className="grid gap-1.5 text-sm font-semibold text-[#142842]" htmlFor="registration-id-confirmation">
                    Ketik Registration ID untuk konfirmasi
                    <input
                      autoComplete="off"
                      className="min-h-11 rounded-lg border border-[#cfc5b4] bg-white px-3 font-normal outline-none focus:border-[#9a7526] focus:ring-2 focus:ring-[#ead9ac]"
                      id="registration-id-confirmation"
                      name="registrationIdConfirmation"
                      placeholder={registrationId}
                      required
                      type="text"
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm font-semibold text-[#142842]" htmlFor="cancellation-reason">
                    Alasan pembatalan
                    <textarea
                      className="min-h-28 rounded-lg border border-[#cfc5b4] bg-white px-3 py-2 font-normal outline-none focus:border-[#9a7526] focus:ring-2 focus:ring-[#ead9ac]"
                      id="cancellation-reason"
                      maxLength={500}
                      name="cancellationReason"
                      required
                    />
                  </label>
                  {cancelState.message ? (
                    <p className="text-sm text-[#9b3d31]" role="alert">{cancelState.message}</p>
                  ) : null}
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      className="inline-flex min-h-11 items-center rounded-lg border border-[#b99a5a] px-4 text-sm font-semibold text-[#6d531e] outline-none hover:bg-[#fbf5e8] focus-visible:ring-2 focus-visible:ring-[#9a7526]"
                      onClick={() => setIsCancelModalOpen(false)}
                      type="button"
                    >
                      Kembali
                    </button>
                    <button
                      className="inline-flex min-h-11 items-center rounded-lg bg-[#9b3d31] px-4 text-sm font-semibold text-white outline-none hover:bg-[#7f3027] focus-visible:ring-2 focus-visible:ring-[#9b3d31] disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={cancelPending}
                      type="submit"
                    >
                      {cancelPending ? "Membatalkan..." : "Batalkan Pendaftaran"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : null}
        </>
      )}
      {message ? (
        <p
          aria-live="polite"
          className={messageStatus === "success" ? "text-sm text-[#267044]" : messageStatus === "info" ? "text-sm text-[#80631e]" : "text-sm text-[#9b3d31]"}
          role={messageStatus === "error" ? "alert" : "status"}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
