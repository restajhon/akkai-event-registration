"use client";

import { useActionState, useState } from "react";

import {
  deleteMemberMeetingSubmission,
  type DeleteMemberMeetingSubmissionState,
} from "./actions";

const initialState: DeleteMemberMeetingSubmissionState = { status: "idle" };

export function MemberMeetingSubmissionDelete({
  submissionId,
  name,
  consultingFirm,
  createdAt,
}: {
  submissionId: string;
  name: string;
  consultingFirm: string;
  createdAt: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, action, pending] = useActionState(
    async (previousState: DeleteMemberMeetingSubmissionState, formData: FormData) => {
      const result = await deleteMemberMeetingSubmission(previousState, formData);
      if (result.status === "success") setIsOpen(false);
      return result;
    },
    initialState,
  );

  return (
    <>
      <button
        className="font-semibold text-[#9b3d31] underline underline-offset-4"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        Hapus submission
      </button>
      {isOpen ? (
        <div
          aria-labelledby={`delete-member-meeting-${submissionId}`}
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-[#142842]/45 p-4"
          role="dialog"
        >
          <section className="w-full max-w-lg rounded-xl border border-[#e4d8c4] bg-[#fffdf8] p-5 shadow-2xl sm:p-6">
            <h2 className="text-xl font-semibold text-[#142842]" id={`delete-member-meeting-${submissionId}`}>
              Hapus submission Rapat Anggota?
            </h2>
            <dl className="mt-4 grid gap-2 rounded-lg bg-[#f7f3ea] p-4 text-sm">
              <div><dt className="inline font-semibold">Nama: </dt><dd className="inline">{name}</dd></div>
              <div><dt className="inline font-semibold">Kantor: </dt><dd className="inline">{consultingFirm}</dd></div>
              <div><dt className="inline font-semibold">Dikirim: </dt><dd className="inline">{createdAt}</dd></div>
            </dl>
            <p className="mt-3 text-sm leading-6 text-[#5b6c7c]">
              Hanya submission Rapat Anggota ini dan surat kuasa yang terkait dengannya yang akan dihapus. Data peserta global, pendaftaran, billing, QR/tiket, dan status peserta tidak berubah.
            </p>
            <form action={action} className="mt-5 flex flex-wrap justify-end gap-2">
              <input name="submissionId" type="hidden" value={submissionId} />
              {state.message ? <p className="mr-auto w-full text-sm text-[#9b3d31]" role="alert">{state.message}</p> : null}
              <button
                className="inline-flex min-h-11 items-center rounded-lg border border-[#b99a5a] px-4 text-sm font-semibold text-[#6d531e]"
                onClick={() => setIsOpen(false)}
                type="button"
              >
                Batal
              </button>
              <button
                className="inline-flex min-h-11 items-center rounded-lg bg-[#9b3d31] px-4 text-sm font-semibold text-white disabled:opacity-50"
                disabled={pending}
                type="submit"
              >
                {pending ? "Menghapus..." : "Ya, hapus submission"}
              </button>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
