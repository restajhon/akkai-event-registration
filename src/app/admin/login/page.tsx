import { redirect } from "next/navigation";

import { getDefaultAdminRoute } from "@/lib/auth/permissions";
import { getCurrentUserProfile } from "@/lib/auth/server";

import { LoginForm } from "./login-form";

export default async function AdminLoginPage() {
  const profile = await getCurrentUserProfile();

  if (profile) {
    redirect(getDefaultAdminRoute(profile.role));
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f7f3ea] px-4 py-8 sm:px-8 sm:py-12">
      <div aria-hidden="true" className="pointer-events-none absolute -left-24 top-16 h-56 w-56 rounded-full border border-[#d9ad45]/20" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 -right-24 h-72 w-72 rounded-full border border-[#142842]/10" />
      <div aria-hidden="true" className="pointer-events-none absolute left-0 top-0 h-px w-40 bg-[#d9ad45] sm:w-64" />
      <section className="relative w-full max-w-md rounded-2xl border border-[#e4d8c4] bg-[#fffdf8] p-6 shadow-sm sm:p-8">
        <div className="border-b border-[#eee6d8] pb-5">
          <p className="text-xs font-bold tracking-[0.2em] text-[#9a7526]">AKKAI 2026</p>
          <p className="mt-1 text-sm font-semibold text-[#142842]">Event Operations</p>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-[#142842]">
            Login Admin &amp; Operator
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#5b6c7c]">
            Masuk untuk mengakses area operasional acara.
          </p>
        </div>
        <div className="mt-6">
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
