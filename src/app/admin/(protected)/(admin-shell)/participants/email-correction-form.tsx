"use client";

import { useActionState, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import {
  correctParticipantEmail,
} from "./actions";
import { initialParticipantActionState } from "@/lib/participants/participant-action-state";

export function EmailCorrectionForm({
  registrationId,
  currentEmail,
  emailGeneration,
}: {
  registrationId: string;
  currentEmail: string;
  emailGeneration: number;
}) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [stalePendingConfirmed, setStalePendingConfirmed] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (previousState: typeof initialParticipantActionState, formData: FormData) => {
      const result = await correctParticipantEmail(previousState, formData);

      if (result.status === "success") {
        setIsEditing(false);
        setIsConfirming(false);
        setStalePendingConfirmed(false);
        router.refresh();
      }

      return result;
    },
    initialParticipantActionState,
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (!isConfirming) {
      event.preventDefault();
      setIsConfirming(true);
    }
  }

  return (
    <div className="grid justify-items-start gap-3">
      {!isEditing ? (
        <button
          className="inline-flex min-h-11 items-center rounded-lg border border-[#b99a5a] px-3.5 py-2 text-xs font-semibold text-[#6d531e] outline-none hover:bg-[#fbf5e8] focus-visible:ring-2 focus-visible:ring-[#9a7526]"
          onClick={() => setIsEditing(true)}
          type="button"
        >
          Ubah Email
        </button>
      ) : (
        <form
          action={formAction}
          className="grid w-full max-w-md gap-3 rounded-xl border border-[#e4d8c4] bg-[#fffdf8] p-4"
          onSubmit={handleSubmit}
        >
          <input name="registrationId" type="hidden" value={registrationId} />
          <input name="emailGeneration" type="hidden" value={emailGeneration} />
          <input
            name="stalePendingConfirmed"
            type="hidden"
            value={stalePendingConfirmed ? "true" : "false"}
          />
          <label className="grid gap-1.5 text-sm font-semibold text-[#344d68]">
            Email saat ini
            <input
              className="min-h-11 rounded-lg border border-[#dedbd3] bg-[#f2f0eb] px-3 text-sm font-normal text-[#6b6a66]"
              readOnly
              value={currentEmail}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold text-[#344d68]">
            Email baru
            <input
              autoComplete="email"
              className="min-h-11 rounded-lg border border-[#cfc5b4] bg-white px-3 text-sm font-normal text-[#142842] outline-none focus:border-[#9a7526] focus:ring-2 focus:ring-[#ead9ac]"
              disabled={pending}
              name="newEmail"
              required
              type="email"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold text-[#344d68]">
            Konfirmasi email baru
            <input
              autoComplete="email"
              className="min-h-11 rounded-lg border border-[#cfc5b4] bg-white px-3 text-sm font-normal text-[#142842] outline-none focus:border-[#9a7526] focus:ring-2 focus:ring-[#ead9ac]"
              disabled={pending}
              name="confirmNewEmail"
              required
              type="email"
            />
          </label>
          {isConfirming ? (
            <div className="rounded-lg border border-[#e5cb8c] bg-[#fff9eb] p-3 text-sm text-[#6d531e]">
              <p className="font-semibold">Simpan perubahan email?</p>
              <p className="mt-1">
                QR dan nomor registrasi tidak berubah. Email tidak akan dikirim
                otomatis.
              </p>
            </div>
          ) : null}
          {state.requiresStalePendingConfirmation ? (
            <label className="flex gap-2 rounded-lg border border-[#ead3cc] bg-[#fff5f2] p-3 text-sm text-[#9b3d31]">
              <input
                checked={stalePendingConfirmed}
                disabled={pending}
                onChange={(event) =>
                  setStalePendingConfirmed(event.target.checked)
                }
                type="checkbox"
              />
              <span>
                Status pengiriman sebelumnya tidak diketahui. Alamat lama
                mungkin masih menerima email sebelumnya. Saya tetap ingin
                mengubah alamat saat ini.
              </span>
            </label>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              className="inline-flex min-h-11 items-center rounded-lg border border-[#b99a5a] px-3.5 py-2 text-xs font-semibold text-[#6d531e] outline-none hover:bg-[#fbf5e8] focus-visible:ring-2 focus-visible:ring-[#9a7526] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={pending}
              onClick={() => {
                setIsEditing(false);
                setIsConfirming(false);
                setStalePendingConfirmed(false);
              }}
              type="button"
            >
              Batal
            </button>
            <button
              className="inline-flex min-h-11 items-center rounded-lg bg-[#142842] px-3.5 py-2 text-xs font-semibold text-white outline-none hover:bg-[#203d5d] focus-visible:ring-2 focus-visible:ring-[#9a7526] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={pending || (state.requiresStalePendingConfirmation && !stalePendingConfirmed)}
              type="submit"
            >
              {pending
                ? "Menyimpan..."
                : isConfirming
                  ? "Ya, Simpan Perubahan"
                  : "Lanjutkan"}
            </button>
          </div>
        </form>
      )}
      {state.message ? (
        <p
          aria-live="polite"
          className={`max-w-md text-xs ${
            state.status === "success"
              ? "text-[#267044]"
              : state.status === "info"
                ? "text-[#80631e]"
                : "text-[#9b3d31]"
          }`}
          role={state.status === "error" ? "alert" : "status"}
        >
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
