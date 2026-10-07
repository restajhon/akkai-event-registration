import Link from "next/link";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/server";
import { formatIndonesianRupiah, PAYMENT_INSTRUCTIONS } from "@/lib/billing/pricing";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadPickupAssignmentDetail } from "@/lib/admin/assignment-data";
import { getEffectivePickupPoint } from "@/lib/admin/pickup-mapping";
import {
  canChangeRegistrationStatus,
  getParticipantActionVisibility,
} from "@/lib/admin/participant-ui";
import type { PickupParticipant } from "@/lib/admin/assignment-types";
import { billingStatusLabel } from "@/lib/billing/status";
import { hasPermission } from "@/lib/auth/permissions";

import {
  ResendQrButton,
  type AttendanceSummary,
} from "../participant-list";
import { RegistrationStatusActions } from "../registration-status-actions";
import { EmailCorrectionForm } from "../email-correction-form";
import { BillingPaymentForm } from "../billing-payment-form";
import { ParticipantEditForm } from "../participant-edit-form";

export const dynamic = "force-dynamic";

const registrationIdSchema = z.string().regex(/^AKKAI26-[0-9]{6}$/);

type DatabaseParticipantRow = {
  id: string;
  registration_id: string;
  full_name: string;
  email: string;
  phone_number: string;
  member_number: string | null;
  institution: string | null;
  batch_id: string | null;
  kka_name: string | null;
  position: string | null;
  polo_size: string | null;
  polo_model: string | null;
  package_type: string | null;
  participation_scope: string | null;
  actuarial_consultant_status: string | null;
  attends_pai_congress: boolean | null;
  registration_status: "REGISTERED" | "CANCELLED";
  email_status: "PENDING" | "SENT" | "FAILED";
  email_generation: number;
  last_email_sent_at: string | null;
  created_at: string;
};

type SessionRow = {
  id: string;
  code: "ARRIVAL" | "SEMINAR" | "DAY3";
};

type AttendanceRow = {
  session_id: string;
  check_in_time: string;
};

type DetailData = {
  participant: DatabaseParticipantRow;
  sharedEmailCount: number;
  arrival: AttendanceSummary;
  seminar: AttendanceSummary;
  day3: AttendanceSummary;
  billing: BillingRow | null;
  certificate: CertificateRow | null;
  pickup: PickupParticipant | null;
  travel: TravelRow | null;
  batchCode: string | null;
};

type TravelRow = {
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
};

type BillingRow = {
  id: string;
  billing_number: string;
  registration_id: string;
  full_name: string;
  kka_name: string;
  package_type: string;
  participation_scope: string;
  amount: number;
  payment_status: "PAID" | "UNPAID";
  paid_at: string | null;
  paid_by: string | null;
  paid_by_name: string | null;
  billing_email_status: "PENDING" | "SENT" | "FAILED";
  billing_email_error: string | null;
  created_at: string;
};

type CertificateRow = {
  file_name: string;
  file_mime: string;
  file_size: number;
};

function formatDateTime(
  dateValue: string | null,
  emptyLabel = "Waktu tidak tersedia",
) {
  if (!dateValue) {
    return emptyLabel;
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "Waktu tidak tersedia";
  }

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

function registrationStatusLabel(status: DatabaseParticipantRow["registration_status"]) {
  return status === "REGISTERED" ? "Terdaftar" : "Dibatalkan";
}

function statusClassName(status: DatabaseParticipantRow["registration_status"]) {
  return status === "REGISTERED"
    ? "border-[#b9dec8] bg-[#f3fbf5] text-[#267044]"
    : "border-[#dedbd3] bg-[#f2f0eb] text-[#6b6a66]";
}

function emailStatusLabel(status: DatabaseParticipantRow["email_status"]) {
  switch (status) {
    case "SENT":
      return "Diterima layanan pengiriman";
    case "FAILED":
      return "Gagal sebelum diterima layanan";
    case "PENDING":
      return "Belum terkonfirmasi / perlu dicek";
  }
}

function emailStatusClassName(status: DatabaseParticipantRow["email_status"]) {
  switch (status) {
    case "SENT":
      return "text-[#267044]";
    case "FAILED":
      return "text-[#9b3d31]";
    case "PENDING":
      return "text-[#80631e]";
  }
}

async function loadDetailData(
  registrationId: string,
  canViewPickup: boolean,
): Promise<DetailData | null> {
  try {
    const adminSupabase = createAdminClient();
    const { data: participant, error: participantError } = await adminSupabase
      .from("participants")
      .select(
         "id, registration_id, full_name, email, phone_number, member_number, institution, batch_id, kka_name, position, polo_size, polo_model, package_type, participation_scope, actuarial_consultant_status, attends_pai_congress, registration_status, email_status, email_generation, last_email_sent_at, created_at",
      )
      .eq("registration_id", registrationId)
      .maybeSingle();

    if (participantError || !participant) {
      return participantError ? null : null;
    }

    const participantRow = participant as DatabaseParticipantRow;
    let batchCode: string | null = null;
    if (participantRow.batch_id) {
      const { data: batch } = await adminSupabase
        .from("registration_batches")
        .select("batch_code")
        .eq("id", participantRow.batch_id)
        .maybeSingle();
      batchCode = batch?.batch_code ?? null;
    }
    const sharedEmailResult = await adminSupabase
      .from("participants")
      .select("id", { count: "exact", head: true })
      .eq("email", participantRow.email);
    const sharedEmailCount = sharedEmailResult.error ? 1 : sharedEmailResult.count ?? 1;
    const pickup = canViewPickup ? await loadPickupAssignmentDetail(registrationId) : null;
    const { data: billing, error: billingError } = await adminSupabase
      .from("registration_billings")
      .select("id, billing_number, registration_id, full_name, kka_name, package_type, participation_scope, amount, payment_status, paid_at, paid_by, billing_email_status, billing_email_error, created_at")
      .eq("participant_id", participantRow.id)
      .maybeSingle();
    if (billingError) return null;

    let billingWithAdmin = billing as BillingRow | null;
    if (billingWithAdmin?.paid_by) {
      const { data: paidByProfile } = await adminSupabase
        .from("profiles")
        .select("full_name")
        .eq("id", billingWithAdmin.paid_by)
        .maybeSingle();
      billingWithAdmin = {
        ...billingWithAdmin,
        paid_by_name: paidByProfile?.full_name ?? billingWithAdmin.paid_by,
      };
    }

    const { data: certificate, error: certificateError } = await adminSupabase
      .from("registration_documents")
      .select("file_name, file_mime, file_size")
      .eq("participant_id", participantRow.id)
      .maybeSingle();
    if (certificateError) return null;
    const { data: travel, error: travelError } = await adminSupabase
      .from("participant_travel")
      .select("outbound_date, outbound_time, outbound_transport_mode, outbound_transport_number, outbound_origin, outbound_destination, return_date, return_time, return_transport_mode, return_transport_number, return_destination, extend_stay")
      .eq("participant_id", participantRow.id)
      .maybeSingle();
    if (travelError) return null;
    const { data: sessions, error: sessionsError } = await adminSupabase
      .from("sessions")
      .select("id, code")
      .in("code", ["ARRIVAL", "SEMINAR", "DAY3"]);

    if (sessionsError) {
      return null;
    }

    const sessionRows = (sessions ?? []) as SessionRow[];
    const sessionIds = sessionRows.map((session) => session.id);
    let attendanceRows: AttendanceRow[] = [];

    if (sessionIds.length > 0) {
      const attendanceResult = await adminSupabase
        .from("attendance")
        .select("session_id, check_in_time")
        .eq("participant_id", participantRow.id)
        .in("session_id", sessionIds);

      if (attendanceResult.error) {
        return null;
      }

      attendanceRows = (attendanceResult.data ?? []) as AttendanceRow[];
    }

    const sessionCodeById = new Map(
      sessionRows.map((session) => [session.id, session.code]),
    );
    const arrival: AttendanceSummary = {
      checkedIn: false,
      checkedInAt: null,
    };
    const seminar: AttendanceSummary = {
      checkedIn: false,
      checkedInAt: null,
    };
    const day3: AttendanceSummary = {
      checkedIn: false,
      checkedInAt: null,
    };

    for (const attendance of attendanceRows) {
      const code = sessionCodeById.get(attendance.session_id);

      if (code === "ARRIVAL") {
        arrival.checkedIn = true;
        arrival.checkedInAt = attendance.check_in_time;
      }

      if (code === "SEMINAR") {
        seminar.checkedIn = true;
        seminar.checkedInAt = attendance.check_in_time;
      }

      if (code === "DAY3") {
        day3.checkedIn = true;
        day3.checkedInAt = attendance.check_in_time;
      }
    }

    return {
      participant: participantRow,
      sharedEmailCount,
      arrival,
      seminar,
      day3,
      billing: billingWithAdmin,
      certificate: certificate as CertificateRow | null,
      pickup,
      travel: travel as TravelRow | null,
      batchCode,
    };
  } catch {
    return null;
  }
}

function AttendanceCard({
  label,
  attendance,
}: {
  label: string;
  attendance: AttendanceSummary;
}) {
  return (
    <article className="rounded-xl border border-[#e4d8c4] bg-[#fffdf8] p-4">
      <h3 className="text-sm font-semibold text-[#142842]">{label}</h3>
      <p
        className={`mt-3 flex items-center gap-2 text-lg font-semibold ${
          attendance.checkedIn ? "text-[#267044]" : "text-[#897657]"
        }`}
      >
        <span aria-hidden="true">{attendance.checkedIn ? "●" : "○"}</span>
        {attendance.checkedIn ? "Sudah Check-in" : "Belum Check-in"}
      </p>
      <p className="mt-1 text-sm text-[#5b6c7c]">
        {attendance.checkedIn
          ? formatDateTime(attendance.checkedInAt)
          : "Belum ada check-in"}
      </p>
    </article>
  );
}

function ParticipantDetailError({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <main className="min-h-screen bg-[#f7f3ea] px-4 py-6 sm:px-8 sm:py-8">
      <section className="mx-auto max-w-3xl">
        <header className="border-b border-[#dfd3bf] pb-4">
          <h1 className="text-2xl font-semibold tracking-tight text-[#142842]">{title}</h1>
        </header>
        <p className="mt-6 rounded-xl border border-[#ead3cc] bg-[#fff5f2] p-4 text-sm text-[#9b3d31]" role="alert">
          {message}
        </p>
        <Link
          className="mt-5 inline-flex min-h-11 items-center rounded-lg border border-[#b99a5a] px-4 text-sm font-semibold text-[#6d531e] outline-none hover:bg-[#fbf5e8] focus-visible:ring-2 focus-visible:ring-[#9a7526]"
          href="/admin/participants"
        >
          Kembali ke Peserta
        </Link>
      </section>
    </main>
  );
}

export default async function ParticipantDetailPage({
  params,
}: {
  params: Promise<{ registrationId: string }>;
}) {
  const profile = await requirePermission("participants.view");

  const { registrationId: rawRegistrationId } = await params;
  const parsedRegistrationId = registrationIdSchema.safeParse(rawRegistrationId);

  if (!parsedRegistrationId.success) {
    return (
      <ParticipantDetailError
        title="Peserta Tidak Ditemukan"
        message="Registration ID peserta tidak valid. Kembali ke daftar peserta."
      />
    );
  }

  const detailData = await loadDetailData(
    parsedRegistrationId.data,
    hasPermission(profile.role, "pickup.view"),
  );

  if (!detailData) {
    return (
      <ParticipantDetailError
        title="Peserta Belum Dapat Dimuat"
        message="Data peserta belum dapat dimuat. Silakan coba kembali."
      />
    );
  }

  const participant = detailData.participant;
  const isCancelled = participant.registration_status === "CANCELLED";
  const actionVisibility = getParticipantActionVisibility(profile.role);

  return (
    <main className="min-h-screen bg-[#f7f3ea] px-4 py-5 sm:px-8 sm:py-6">
      <section className="mx-auto max-w-[1100px]">
        <header className="border-b border-[#dfd3bf] pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-bold tracking-[0.16em] text-[#9a7526]">DETAIL PESERTA</p>
              <h1 className="mt-1 break-words text-2xl font-semibold tracking-tight text-[#142842] sm:text-3xl">
                {participant.full_name}
              </h1>
              <p className="mt-1 break-all text-sm font-semibold text-[#9a7526]">
                {participant.registration_id}
              </p>
               <p className="mt-3 break-words text-sm text-[#5b6c7c]">
                 Konsultan Aktuaria: {participant.actuarial_consultant_status ?? "-"}
                </p>
               <p className="mt-1 break-words text-sm font-semibold text-[#80631e]">
                 Batch: {detailData.batchCode ?? "Single registration"}
               </p>
            </div>
            <div className="flex shrink-0 flex-col items-start gap-3 sm:items-end">
              <span
                className={`inline-flex min-h-8 items-center rounded-full border px-3 py-1.5 text-xs font-semibold ${statusClassName(
                  participant.registration_status,
                )}`}
              >
                {registrationStatusLabel(participant.registration_status)}
              </span>
              <Link
                className="inline-flex min-h-11 items-center text-sm font-semibold text-[#344d68] underline underline-offset-4 outline-none hover:text-[#142842] focus-visible:ring-2 focus-visible:ring-[#9a7526]"
                href="/admin/participants"
              >
                Kembali ke Peserta
              </Link>
            </div>
          </div>
        </header>

        <section aria-label="Aksi peserta" className="mt-4 flex flex-col gap-2 rounded-xl border border-[#e4d8c4] bg-[#fffdf8] p-3 sm:flex-row sm:flex-wrap sm:items-start">
          {canChangeRegistrationStatus(profile.role) ? (
            <RegistrationStatusActions
              canRestore={profile.role === "SUPER_ADMIN"}
              isCancelled={isCancelled}
              registrationId={participant.registration_id}
            />
          ) : null}
          {actionVisibility.canEdit ? (
            <a
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#142842] px-4 text-sm font-semibold text-white outline-none hover:bg-[#203d5d] focus-visible:ring-2 focus-visible:ring-[#9a7526]"
              href="#edit-participant"
            >
              Edit Data Peserta
            </a>
          ) : null}
          {actionVisibility.canResendEmail && !isCancelled ? (
            <ResendQrButton email={participant.email} registrationId={participant.registration_id} />
          ) : null}
          {actionVisibility.canDownloadTicket ? (
            <a
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#b99a5a] px-4 text-sm font-semibold text-[#6d531e] outline-none hover:bg-[#fbf5e8] focus-visible:ring-2 focus-visible:ring-[#9a7526]"
              download
              href={`/api/admin/participants/${participant.registration_id}/ticket`}
            >
              Download QR/Tiket
            </a>
          ) : null}
        </section>

        <section
          aria-labelledby="registration-information-heading"
          className="mt-5 rounded-xl border border-[#e4d8c4] bg-[#fffdf8] p-4 sm:p-5"
        >
          <h2 className="text-xl font-semibold text-[#142842]" id="registration-information-heading">
            Informasi Registrasi
          </h2>
          <dl className="mt-5 grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
            <DetailField label="Email" value={participant.email} />
            {detailData.sharedEmailCount > 1 ? (
              <DetailField
                label="Indikator email bersama"
                value={`Email ini digunakan oleh ${detailData.sharedEmailCount} peserta`}
                valueClassName="text-[#80631e]"
              />
            ) : null}
            <DetailField label="WhatsApp / Kontak" value={participant.phone_number} />
            <DetailField
              label="Nomor Anggota"
              value={participant.member_number ?? "Tidak diisi"}
            />
             <DetailField label="Institusi" value={participant.institution ?? "Tidak diisi"} />
             <DetailField label="Nama KKA" value={participant.kka_name ?? "Tidak diisi"} />
             <DetailField label="Jabatan" value={participant.position ?? "Tidak diisi"} />
            <DetailField label="Ukuran Poloshirt" value={participant.polo_size ?? "Tidak diisi"} />
            <DetailField label="Model Poloshirt" value={participant.polo_model ?? "Tidak diisi"} />
            <DetailField label="Paket yang diambil" value={participant.package_type ?? "-"} />
            <DetailField label="Mengikuti" value={participant.participation_scope ?? "-"} />
            <DetailField
              label="Konsultan Aktuaria"
              value={participant.actuarial_consultant_status ?? "-"}
            />
            <DetailField
              label="Hadir Kongres PAI"
              value={
                participant.attends_pai_congress === null
                  ? "-"
                  : participant.attends_pai_congress
                    ? "Ya"
                    : "Tidak"
              }
            />
            <DetailField
              label="Status Email ke Alamat Saat Ini"
              value={emailStatusLabel(participant.email_status)}
              valueClassName={emailStatusClassName(participant.email_status)}
            />
            <DetailField
              label="Penerimaan Layanan untuk Alamat Saat Ini"
              value={formatDateTime(
                participant.last_email_sent_at,
                "Belum ada penerimaan layanan",
              )}
            />
            <DetailField
              label="Tanggal Registrasi"
              value={formatDateTime(participant.created_at)}
            />
          </dl>
            <div className="mt-5 border-t border-[#eee6d8] pt-4">
              {actionVisibility.canEdit && actionVisibility.canResendEmail ? <EmailCorrectionForm
                currentEmail={participant.email}
                emailGeneration={participant.email_generation}
                registrationId={participant.registration_id}
              /> : null}
              <ParticipantEditForm canEdit={actionVisibility.canEdit} participant={participant} travel={detailData.travel} />
           </div>
           {detailData.certificate ? (
             <div className="mt-5 border-t border-[#eee6d8] pt-4">
               <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#897657]">Surat Keterangan Kerja CIAC</p>
               <p className="mt-1 break-words text-sm font-semibold text-[#344d68]">{detailData.certificate.file_name} ({Math.ceil(detailData.certificate.file_size / 1024)} KiB)</p>
               <a
                 className="mt-3 inline-flex min-h-11 items-center rounded-lg border border-[#b99a5a] px-4 text-sm font-semibold text-[#6d531e] outline-none hover:bg-[#fbf5e8] focus-visible:ring-2 focus-visible:ring-[#9a7526]"
                 href={`/api/admin/participants/${participant.registration_id}/certificate`}
               >
                 Buka file private
               </a>
             </div>
           ) : null}
          </section>

          <section aria-label="Download informasi pendaftaran" className="mt-4 rounded-xl border border-[#e4d8c4] bg-[#fffdf8] p-4 sm:p-5">
            <h2 className="text-xl font-semibold text-[#142842]">Informasi Pendaftaran</h2>
            <p className="mt-1 text-sm text-[#5b6c7c]">Buat file PDF untuk peserta yang sedang dibuka. QR di dalam file tetap milik peserta ini.</p>
            <a
              className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-[#142842] px-4 text-sm font-semibold text-white outline-none hover:bg-[#203d5d] focus-visible:ring-2 focus-visible:ring-[#9a7526]"
              download
              href={`/api/admin/participants/${participant.registration_id}/ticket`}
            >
               Download Informasi Pendaftaran
             </a>
            {detailData.batchCode ? (
              <a className="ml-2 mt-4 inline-flex min-h-11 items-center rounded-lg border border-[#b99a5a] px-4 text-sm font-semibold text-[#6d531e] outline-none hover:bg-[#fbf5e8] focus-visible:ring-2 focus-visible:ring-[#9a7526]" download href={`/api/admin/batches/${detailData.batchCode}/tickets`}>
                Download QR Batch
              </a>
            ) : null}
          </section>

         {detailData.billing ? (
           <section aria-labelledby="billing-heading" className="mt-4 rounded-xl border border-[#e4d8c4] bg-[#fffdf8] p-4 sm:p-5">
             <h2 className="text-xl font-semibold text-[#142842]" id="billing-heading">Tagihan Biaya Pendaftaran</h2>
             <dl className="mt-5 grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
               <DetailField label="Nomor tagihan unik" value={detailData.billing.billing_number} />
               <DetailField label="Nomor registrasi" value={detailData.billing.registration_id} />
               <DetailField label="Nama peserta" value={detailData.billing.full_name} />
               <DetailField label="KKA" value={detailData.billing.kka_name} />
               <DetailField label="Paket yang diambil" value={detailData.billing.package_type} />
               <DetailField label="Pilihan mengikuti acara" value={detailData.billing.participation_scope} />
               <DetailField label="Rincian biaya" value={`${detailData.billing.package_type}: ${formatIndonesianRupiah(detailData.billing.amount)}`} />
               <DetailField label="Total tagihan" value={formatIndonesianRupiah(detailData.billing.amount)} />
                <DetailField label="Status pembayaran" value={billingStatusLabel(detailData.billing.payment_status)} valueClassName={detailData.billing.payment_status === "PAID" ? "text-[#267044]" : "text-[#80631e]"} />
               <DetailField label="Tanggal pembayaran" value={formatDateTime(detailData.billing.paid_at, "Belum dibayar")} />
               <DetailField label="Admin yang mengubah status" value={detailData.billing.paid_by_name ?? "Belum ada"} />
               <DetailField label="Status email tagihan" value={detailData.billing.billing_email_status === "SENT" ? "Diterima layanan pengiriman" : detailData.billing.billing_email_status === "FAILED" ? "Gagal dikirim" : "Belum diproses"} />
               <DetailField label="Tanggal pembuatan tagihan" value={formatDateTime(detailData.billing.created_at)} />
             </dl>
             {detailData.billing.billing_email_error ? <p className="mt-4 text-sm text-[#9b3d31]">Log email: {detailData.billing.billing_email_error}</p> : null}
             <p className="mt-4 text-sm leading-6 text-[#5b6c7c]">Instruksi pembayaran: {PAYMENT_INSTRUCTIONS.bank}, rekening {PAYMENT_INSTRUCTIONS.accountNumber} atas nama {PAYMENT_INSTRUCTIONS.accountName}. Batas akhir {PAYMENT_INSTRUCTIONS.deadline}. Bukti: {PAYMENT_INSTRUCTIONS.proofEmail} atau {PAYMENT_INSTRUCTIONS.proofWhatsapp}.</p>
               {actionVisibility.canUpdateBilling ? <BillingPaymentForm billingId={detailData.billing.id} registrationId={participant.registration_id} paymentStatus={detailData.billing.payment_status} /> : null}
           </section>
          ) : null}

         {detailData.pickup ? (
           <section aria-labelledby="travel-pickup-heading" className="mt-4 rounded-xl border border-[#e4d8c4] bg-[#fffdf8] p-4 sm:p-5">
             <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
               <div>
                 <h2 className="text-xl font-semibold text-[#142842]" id="travel-pickup-heading">Travel dan Pickup</h2>
                 <p className="mt-1 text-sm text-[#5b6c7c]">Titik travel menjadi default; koreksi manual yang sudah ada tetap diprioritaskan.</p>
               </div>
               <Link className="text-sm font-semibold text-[#344d68] underline underline-offset-4" href={`/admin/pickup/${participant.registration_id}`}>Buka assignment pickup</Link>
             </div>
             <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
               <DetailField label="Arrival travel" value={detailData.pickup.travel?.outboundDestination ?? "Belum diisi"} />
               <DetailField label="Pickup arrival" value={getEffectivePickupPoint("ARRIVAL", detailData.pickup.arrivalAssignment, detailData.pickup.travel).value ?? "Belum diisi"} />
               <DetailField label="Departure travel" value={detailData.pickup.travel?.returnDestination ?? "Belum diisi"} />
               <DetailField label="Drop-off departure" value={getEffectivePickupPoint("DEPARTURE", detailData.pickup.departureAssignment, detailData.pickup.travel).value ?? "Belum diisi"} />
             </div>
           </section>
         ) : null}

        {actionVisibility.canResendEmail ? <section
          aria-labelledby="registration-email-heading"
          className="mt-4 rounded-xl border border-[#e4d8c4] bg-[#fffdf8] p-4 sm:p-5"
        >
          <h2 className="text-xl font-semibold text-[#142842]" id="registration-email-heading">
            Email Registrasi
          </h2>
          <p className="mt-1 text-sm text-[#5b6c7c]">
            Email registrasi dengan QR yang sama akan dikirim kembali ke alamat peserta.
          </p>
          <div className="mt-4">
            {isCancelled ? (
              <p className="rounded-lg border border-[#dedbd3] bg-[#f2f0eb] p-3 text-sm text-[#6b6a66]">
                Email registrasi tidak dapat dikirim ulang karena peserta berstatus Dibatalkan.
              </p>
            ) : (
              <ResendQrButton
                email={participant.email}
                registrationId={participant.registration_id}
              />
            )}
          </div>
        </section> : null}

        <section aria-labelledby="attendance-heading" className="mt-4">
          <h2 className="text-xl font-semibold text-[#142842]" id="attendance-heading">
            Kehadiran
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <AttendanceCard
              attendance={detailData.arrival}
              label="Registrasi Kedatangan"
            />
            <AttendanceCard
              attendance={detailData.seminar}
              label="Seminar AKKAI 2026"
            />
            <AttendanceCard
              attendance={detailData.day3}
              label="Registrasi Kepulangan"
            />
          </div>
        </section>
      </section>
    </main>
  );
}

function DetailField({
  label,
  value,
  valueClassName = "text-[#344d68]",
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-[#897657]">
        {label}
      </dt>
      <dd className={`mt-1 break-words font-semibold ${valueClassName}`}>{value}</dd>
    </div>
  );
}
