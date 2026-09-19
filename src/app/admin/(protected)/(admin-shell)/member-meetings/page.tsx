import Link from "next/link";

import { AdminEmptyState, AdminMetricCard, AdminPageHeader } from "@/components/admin/admin-ui";
import { requirePermission } from "@/lib/auth/server";
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
  const profile = await requirePermission("member_meetings.view");
  const submissions = await loadMemberMeetingSubmissions();

  if (!submissions) {
    return <PageError />;
  }

  const attendingDirectly = submissions.filter(
    (submission) => submission.attendance_type !== "PROXY",
  ).length;
  const representedByProxy = submissions.filter(
    (submission) => submission.attendance_type === "PROXY",
  ).length;

  return (
    <main className="min-h-screen bg-[#f7f3ea] px-4 py-5 sm:px-8 sm:py-6">
      <section className="mx-auto max-w-[1200px]">
        <AdminPageHeader
          action={
            <div className="flex flex-wrap gap-2">
            {profile.role === "SUPER_ADMIN" || profile.role === "ADMIN" ? (
              <a
                className="inline-flex min-h-11 items-center rounded-lg bg-[#142842] px-4 text-sm font-semibold text-[#fffdf8] hover:bg-[#243e5e]"
                download
                href="/api/admin/member-meetings-export"
              >
                Export Excel
              </a>
            ) : null}
            <Link className="inline-flex min-h-11 items-center rounded-lg border border-[#b99a5a] px-4 text-sm font-semibold text-[#344d68] hover:bg-[#fffdf8]" href="/admin/dashboard">
                Dashboard
            </Link>
          </div>
          }
          description="Pantau kehadiran anggota dan surat kuasa yang dikirim secara terpisah dari registrasi peserta."
          eyebrow="Operasional"
          title="Rapat Anggota"
        />

        <section aria-label="Ringkasan submission Rapat Anggota" className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
          <AdminMetricCard label="Total" subtitle="submission" value={submissions.length} />
          <AdminMetricCard label="Hadir Sendiri" subtitle="anggota" value={attendingDirectly} />
          <AdminMetricCard label="Dikuasakan" subtitle="anggota" value={representedByProxy} />
        </section>

        <div className="mt-5 overflow-hidden rounded-xl border border-[#e4d8c4] bg-[#fffdf8]">
          {submissions.length === 0 ? (
            <div className="p-4 sm:p-5">
              <AdminEmptyState
                description="Submission kehadiran atau surat kuasa akan muncul di sini setelah dikirim."
                title="Belum ada submission Rapat Anggota"
              />
            </div>
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
