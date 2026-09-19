"use client";

import { useActionState } from "react";

import { AdminMetricCard } from "@/components/admin/admin-ui";
import { getRoleLabel } from "@/lib/auth/permissions";
import type { UserRole } from "@/lib/auth/server";

import {
  updateProfileAccess,
  type AccessActionState,
} from "./actions";
import type { AccessProfile } from "./page";

const roles: UserRole[] = [
  "SUPER_ADMIN",
  "REGISTRATION",
  "OPERATIONAL",
  "SCANNER",
  "ADMIN",
  "OPERATOR",
];

const initialState: AccessActionState = {
  status: "idle",
  message: null,
};

export function AccessList({ profiles }: { profiles: AccessProfile[] }) {
  const [state, formAction, pending] = useActionState(
    updateProfileAccess,
    initialState,
  );
  const roleSummary = roles.map((role) => ({
    label: getRoleLabel(role),
    role,
    value: profiles.filter((profile) => profile.role === role).length,
  }));

  return (
    <main className="min-h-screen bg-[#f7f3ea] px-4 py-6 sm:px-8 sm:py-8">
      <section className="mx-auto max-w-5xl">
        <header className="border-b border-[#dfd3bf] pb-5">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#9a7526]">
            Setup
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#142842] sm:text-3xl">
            Akses Pengguna
          </h1>
          <p className="mt-1 text-sm text-[#5b6c7c]">
            Atur peran dan status akun admin AKKAI 2026.
          </p>
        </header>

        <section aria-label="Ringkasan peran pengguna" className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {roleSummary.map((item) => (
            <AdminMetricCard
              key={item.role}
              label={item.label}
              subtitle="akun"
              value={item.value}
            />
          ))}
        </section>

        {state.message ? (
          <p
            className={`mt-5 inline-flex rounded-lg px-3 py-2 text-sm ${
              state.status === "success"
                ? "bg-[#edf7ef] text-[#267044]"
                : "bg-[#fff5f2] text-[#9b3d31]"
            }`}
            role={state.status === "error" ? "alert" : "status"}
          >
            {state.message}
          </p>
        ) : null}

        <div className="mt-6 grid gap-3">
          {profiles.map((profile) => (
            <form
              action={formAction}
              className="rounded-xl border border-[#e4d8c4] bg-[#fffdf8] p-4 sm:p-5"
              key={profile.id}
            >
              <input name="profileId" type="hidden" value={profile.id} />
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_130px_auto] lg:items-end">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-[#142842]">
                    {profile.full_name}
                  </p>
                  <p className="mt-1 truncate text-sm text-[#5b6c7c]">
                    {profile.email}
                  </p>
                </div>
                <label className="grid gap-1 text-sm font-semibold text-[#344d68]">
                  Peran
                  <select
                    className="min-h-11 rounded-lg border border-[#d8cbb6] bg-white px-3 font-normal outline-none focus-visible:ring-2 focus-visible:ring-[#9a7526]"
                    defaultValue={profile.role}
                    name="role"
                  >
                    {roles.map((role) => (
                      <option key={role} value={role}>
                        {getRoleLabel(role)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex min-h-11 items-center gap-2 text-sm font-semibold text-[#344d68]">
                  <input
                    defaultChecked={profile.is_active}
                    name="isActive"
                    type="checkbox"
                    value="true"
                  />
                  Aktif
                </label>
                <button
                  className="min-h-11 rounded-lg bg-[#142842] px-4 py-2 text-sm font-semibold text-white outline-none hover:bg-[#203d5d] focus-visible:ring-2 focus-visible:ring-[#9a7526] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={pending}
                  type="submit"
                >
                  {pending ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </form>
          ))}
          {profiles.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[#d8cbb6] bg-[#fffdf8] p-8 text-center text-sm text-[#5b6c7c]">
              Belum ada akun admin yang dapat dikelola.
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
