import Link from "next/link";
import { notFound } from "next/navigation";

import { requireRole } from "@/lib/auth/server";
import { loadMemberMeetingSubmission } from "@/lib/member-meeting/admin-data";

export const dynamic = "force-dynamic";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

export default async function MemberMeetingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["SUPER_ADMIN", "ADMIN"]);
  const { id } = await params;

  if (!uuidPattern.test(id)) {
    notFound();
  }

  const submission = await loadMemberMeetingSubmission(id);
  if (!submission) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[#f7f3ea] px-4 py-8 sm:px-8 sm:py-10">
      <section className="mx-auto max-w-3xl">
        <Link className="text-sm font-semibold text-[#80631e] underline underline-offset-4" href="/admin/member-meetings">&larr; Kembali ke daftar submission</Link>
        <div className="mt-5 rounded-2xl border border-[#e4d8c4] bg-[#fffdf8] p-6 shadow-sm sm:p-8">
          <p className="text-sm font-semibold tracking-[0.2em] text-[#9a7526]">AKKAI 2026</p>
          <h1 className="mt-2 text-3xl font-semibold text-[#142842]">Detail Rapat Anggota</h1>
          <dl className="mt-8 grid gap-5 sm:grid-cols-2">
            {[
              ["Nama", submission.name],
              ["Kantor Konsultan Aktuaria", submission.consulting_firm],
              ["Jabatan", submission.position],
              ["No. HP", submission.phone],
              ["Alamat Email", submission.email],
              ["Kehadiran", submission.attendance_type === "PROXY" ? "Dikuasakan" : "Hadir sendiri"],
              ["Nama penerima kuasa", submission.proxy_name ?? "-"],
              ["Jabatan penerima kuasa", submission.proxy_position ?? "-"],
              ["Dikirim", formatDate(submission.created_at)],
              ["Diperbarui", formatDate(submission.updated_at)],
            ].map(([label, value]) => (
              <div className="border-t border-[#e4d8c4] pt-3" key={label}>
                <dt className="text-xs font-bold uppercase tracking-[0.1em] text-[#897657]">{label}</dt>
                <dd className="mt-1 text-sm font-semibold text-[#344d68]">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-8 border-t border-[#e4d8c4] pt-5">
            <h2 className="text-lg font-semibold text-[#142842]">Surat Kuasa</h2>
            {submission.authorization_file_path && submission.authorization_file_name ? (
              <div className="mt-3 flex flex-col justify-between gap-3 rounded-xl border border-[#e4d8c4] bg-[#f7f3ea] p-4 sm:flex-row sm:items-center">
                <div>
                  <p className="text-sm font-semibold text-[#344d68]">{submission.authorization_file_name}</p>
                  <p className="mt-1 text-xs text-[#667085]">{submission.authorization_file_mime} · {Math.ceil((submission.authorization_file_size ?? 0) / 1024)} KB</p>
                </div>
                <a className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#142842] px-4 text-sm font-semibold text-[#fffdf8] hover:bg-[#243e5e]" href={`/api/admin/member-meetings/${submission.id}/authorization`} rel="noreferrer" target="_blank">Buka / Download</a>
              </div>
            ) : (
              <p className="mt-3 text-sm text-[#667085]">Tidak ada surat kuasa karena pemimpin KKA hadir sendiri.</p>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
