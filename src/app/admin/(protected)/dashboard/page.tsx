import { requireRole } from "@/lib/auth/server";

import { signOut } from "@/app/admin/actions";

export default async function AdminDashboardPage() {
  const profile = await requireRole(["ADMIN", "OPERATOR"]);

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-10 sm:px-8">
      <section className="mx-auto max-w-3xl rounded-xl bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-500">AKKAI 2026</p>
            <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
              Admin Dashboard
            </h1>
          </div>
          <form action={signOut}>
            <button
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              type="submit"
            >
              Logout
            </button>
          </form>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-zinc-200 p-4">
            <p className="text-sm text-zinc-500">Nama user</p>
            <p className="mt-1 font-medium text-zinc-900">{profile.full_name}</p>
          </div>
          <div className="rounded-lg border border-zinc-200 p-4">
            <p className="text-sm text-zinc-500">Email</p>
            <p className="mt-1 break-all font-medium text-zinc-900">
              {profile.email}
            </p>
          </div>
          <div className="rounded-lg border border-zinc-200 p-4">
            <p className="text-sm text-zinc-500">Role</p>
            <p className="mt-1 font-medium text-zinc-900">{profile.role}</p>
          </div>
        </div>

        <p className="mt-8 rounded-lg bg-zinc-50 p-4 text-sm text-zinc-600">
          Dashboard operasional akan tersedia pada task berikutnya.
        </p>
      </section>
    </main>
  );
}
