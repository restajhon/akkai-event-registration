"use client";

import { useActionState, useEffect, useRef } from "react";

import { initialParticipantActionState } from "@/lib/participants/participant-action-state";
import { ACTUARIAL_CONSULTANT_STATUSES, PACKAGE_TYPES, PARTICIPATION_SCOPES, POLO_MODELS, POLO_SIZES } from "@/lib/validation/registration";

import { updateParticipantData } from "./actions";

type ParticipantEditFormProps = {
  participant: {
    registration_id: string;
    email: string;
    email_generation: number;
    full_name: string;
    phone_number: string;
    member_number: string | null;
    institution: string | null;
    position: string | null;
    kka_name: string | null;
    package_type: string | null;
    participation_scope: string | null;
    polo_size: string | null;
    polo_model: string | null;
    actuarial_consultant_status: string | null;
    attends_pai_congress: boolean | null;
  };
  travel: {
    outbound_date: string;
    outbound_time: string;
    outbound_transport_mode: string;
    outbound_transport_number: string | null;
    outbound_origin: string;
    outbound_destination: string;
    return_date: string;
    return_time: string;
    return_transport_mode: string;
    return_transport_number: string | null;
    return_destination: string;
    extend_stay: boolean;
  } | null;
};

function Field({ label, name, defaultValue, type = "text", required = false }: { label: string; name: string; defaultValue: string; type?: string; required?: boolean }) {
  return <label className="grid gap-1.5 text-sm font-semibold text-[#142842]">{label}<input className="min-h-11 rounded-lg border border-[#cfc5b4] bg-white px-3 font-normal outline-none focus:border-[#9a7526] focus:ring-2 focus:ring-[#ead9ac]" defaultValue={defaultValue} name={name} required={required} type={type} /></label>;
}

function Select({ label, name, defaultValue, options }: { label: string; name: string; defaultValue: string; options: readonly string[] }) {
  return <label className="grid gap-1.5 text-sm font-semibold text-[#142842]">{label}<select className="min-h-11 rounded-lg border border-[#cfc5b4] bg-white px-3 font-normal outline-none focus:border-[#9a7526] focus:ring-2 focus:ring-[#ead9ac]" defaultValue={defaultValue} name={name} required><option value="">Pilih {label.toLowerCase()}</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}

export function ParticipantEditForm({ participant, travel }: ParticipantEditFormProps) {
  const [state, formAction, pending] = useActionState(updateParticipantData, initialParticipantActionState);
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function openFromHash() {
      if (window.location.hash === "#edit-participant" && detailsRef.current) {
        detailsRef.current.open = true;
        detailsRef.current.scrollIntoView({ block: "start" });
      }
    }

    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, []);

  return (
    <details className="mt-5 scroll-mt-24 border-t border-[#eee6d8] pt-4" id="edit-participant" ref={detailsRef}>
      <summary className="flex min-h-11 cursor-pointer items-center rounded-lg px-2 text-sm font-semibold text-[#344d68] outline-none hover:bg-[#fbf7ef] focus-visible:ring-2 focus-visible:ring-[#9a7526]">Edit Data Peserta</summary>
      <form action={formAction} className="mt-4 grid gap-4" noValidate>
        <input name="registrationId" type="hidden" value={participant.registration_id} />
        <input name="emailGeneration" type="hidden" value={participant.email_generation} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field defaultValue={participant.full_name} label="Nama lengkap" name="full_name" required />
          <Field defaultValue={participant.email} label="Email penerima" name="email" required type="email" />
          <Field defaultValue={participant.phone_number} label="Nomor WhatsApp" name="phone_number" required />
          <Field defaultValue={participant.member_number ?? ""} label="Nomor anggota" name="member_number" />
          <Field defaultValue={participant.institution ?? ""} label="Institusi" name="institution" />
          <Field defaultValue={participant.position ?? ""} label="Jabatan" name="position" />
          <Field defaultValue={participant.kka_name ?? ""} label="Nama KKA" name="kka_name" required />
          <Select defaultValue={participant.package_type ?? ""} label="Paket menginap" name="package_type" options={PACKAGE_TYPES} />
          <Select defaultValue={participant.participation_scope ?? ""} label="Pilihan acara" name="participation_scope" options={PARTICIPATION_SCOPES} />
          <Select defaultValue={participant.polo_model ?? ""} label="Model Poloshirt" name="polo_model" options={POLO_MODELS} />
          <Select defaultValue={participant.polo_size ?? ""} label="Ukuran Poloshirt" name="polo_size" options={POLO_SIZES} />
          <Select defaultValue={participant.actuarial_consultant_status ?? ""} label="Status CIAC" name="actuarial_consultant_status" options={ACTUARIAL_CONSULTANT_STATUSES} />
          <Select defaultValue={participant.attends_pai_congress === null ? "" : String(participant.attends_pai_congress)} label="Hadir Kongres PAI" name="attends_pai_congress" options={["true", "false"]} />
        </div>
        <fieldset className="grid gap-4 rounded-lg border border-[#e4d8c4] p-4">
          <legend className="px-1 text-sm font-semibold text-[#142842]">Data Travel, kosongkan seluruh field untuk menghapus</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field defaultValue={travel?.outbound_date ?? ""} label="Tanggal berangkat" name="outbound_date" type="date" />
            <Field defaultValue={travel?.outbound_time?.slice(0, 5) ?? ""} label="Waktu berangkat" name="outbound_time" type="time" />
            <Field defaultValue={travel?.outbound_transport_mode ?? ""} label="Moda berangkat" name="outbound_transport_mode" />
            <Field defaultValue={travel?.outbound_transport_number ?? ""} label="Nomor berangkat" name="outbound_transport_number" />
            <Field defaultValue={travel?.outbound_origin ?? ""} label="Asal berangkat" name="outbound_origin" />
            <Field defaultValue={travel?.outbound_destination ?? ""} label="Tujuan berangkat" name="outbound_destination" />
            <Field defaultValue={travel?.return_date ?? ""} label="Tanggal pulang" name="return_date" type="date" />
            <Field defaultValue={travel?.return_time?.slice(0, 5) ?? ""} label="Waktu pulang" name="return_time" type="time" />
            <Field defaultValue={travel?.return_transport_mode ?? ""} label="Moda pulang" name="return_transport_mode" />
            <Field defaultValue={travel?.return_transport_number ?? ""} label="Nomor pulang" name="return_transport_number" />
            <Field defaultValue={travel?.return_destination ?? ""} label="Tujuan pulang" name="return_destination" />
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold text-[#344d68]"><input defaultChecked={travel?.extend_stay ?? false} name="extend_stay" type="checkbox" value="true" /> Memperpanjang masa tinggal</label>
        </fieldset>
        {state.message ? <p className={state.status === "success" ? "text-sm text-[#267044]" : "text-sm text-[#9b3d31]"} role={state.status === "error" ? "alert" : "status"}>{state.message}</p> : null}
        <button className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#142842] px-4 text-sm font-semibold text-white outline-none hover:bg-[#203d5d] disabled:cursor-not-allowed disabled:opacity-50 sm:w-fit" disabled={pending} type="submit">{pending ? "Menyimpan..." : "Simpan Perubahan"}</button>
      </form>
    </details>
  );
}
