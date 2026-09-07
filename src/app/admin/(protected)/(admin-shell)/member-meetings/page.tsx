import Link from "next/link";

import { requireRole } from "@/lib/auth/server";
import {
  loadMemberMeetingSubmissions,
  type MemberMeetingSubmission,
} from "@/lib/member-meeting/admin-data";

export const dynamic = "force-dynamic";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

function attendanceLabel(value: MemberMeetingSubmission["attendance_type"]) {
  return value === "PROXY" ? "Dikuasakan" : "Hadir sendiri";
}

function PageError() {
  return (
    <main className="min-h-screen bg-[#f7f3ea] px-4 py-8 sm:px-8 sm:py-10">
      <section className="mx-auto max-w-4xl rounded-2xl border border-[#e4d8c4] bg-[#fffdf8] p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold tracking-[0.2em] text-[#9a7526]">AKKAI 2026</p>
        <h1 className="mt-2 text-2xl font-semibold text-[#142842]">Rapat Anggota</h1>
        <p className="mt-6 rounded-xl border border-[#ead3cc] bg-[#fff5f2] p-4 text-sm text-[#9b3d31]" role="alert">
          Data submission belum dapat dimuat. Silakan coba kembali.
        </p>
      </section>
    </main>
  );
}

export default async function MemberMeetingsPage() {
  await requireRole(["SUPER_ADMIN", "ADMIN"]);
  const submissions = await loadMemberMeetingSubmissions();

  if (!submissions) {
    return <PageError />;
  }

  return (
    <main className="min-h-screen bg-[#f7f3ea] px-4 py-8 sm:px-8 sm:py-10">
      <section className="mx-auto max-w-6xl">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold tracking-[0.2em] text-[#9a7526]">AKKAI 2026</p>
            <h1 className="mt-2 text-3xl font-semibold text-[#142842]">Submission Rapat Anggota</h1>
            <p className="mt-2 text-sm text-[#667085]">Data berdiri sendiri dan tidak terkait dengan data peserta.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              className="inline-flex min-h-11 items-center rounded-lg bg-[#142842] px-4 text-sm font-semibold text-[#fffdf8] hover:bg-[#243e5e]"
              download
              href="/api/admin/member-meetings-export"
            >
              Export Excel
            </a>
            <Link className="inline-flex min-h-11 items-center rounded-lg border border-[#b99a5a] px-4 text-sm font-semibold text-[#344d68] hover:bg-[#fffdf8]" href="/admin/dashboard">
              Kembali ke Dashboard
            </Link>
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-[#e4d8c4] bg-[#fffdf8] shadow-sm">
          {submissions.length === 0 ? (
            <p className="p-6 text-sm text-[#667085]">Belum ada submission.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[50rem] text-left text-sm">
                <thead className="bg-[#f1eadc] text-xs uppercase tracking-[0.12em] text-[#6d531e]">
                  <tr>
                    <th className="px-5 py-4" scope="col">Nama</th>
                    <th className="px-5 py-4" scope="col">Kantor</th>
                    <th className="px-5 py-4" scope="col">Kehadiran</th>
                    <th className="px-5 py-4" scope="col">Surat Kuasa</th>
                    <th className="px-5 py-4" scope="col">Dikirim</th>
                    <th className="px-5 py-4" scope="col"><span className="sr-only">Aksi</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e4d8c4] text-[#344d68]">
                  {submissions.map((submission) => (
                    <tr key={submission.id}>
                      <td className="px-5 py-4 font-semibold text-[#142842]">{submission.name}</td>
                      <td className="px-5 py-4">{submission.consulting_firm}</td>
                      <td className="px-5 py-4">{attendanceLabel(submission.attendance_type)}</td>
                      <td className="px-5 py-4">{submission.authorization_file_name ?? "-"}</td>
                      <td className="whitespace-nowrap px-5 py-4">{formatDate(submission.created_at)}</td>
                      <td className="px-5 py-4"><Link className="font-semibold text-[#80631e] underline underline-offset-4" href={`/admin/member-meetings/${submission.id}`}>Detail</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
