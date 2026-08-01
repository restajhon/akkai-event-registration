import { redirect } from "next/navigation";

import { getCurrentUserProfile } from "@/lib/auth/server";

import { LoginForm } from "./login-form";

export default async function AdminLoginPage() {
  const profile = await getCurrentUserProfile();

  if (profile) {
    redirect("/admin/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-4 py-12">
      <section className="w-full max-w-md rounded-xl bg-white p-8 shadow-sm">
        <p className="text-sm font-medium text-zinc-500">AKKAI 2026</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
          Login Admin dan Operator
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          Masuk untuk mengakses area operasional.
        </p>
        <div className="mt-8">
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
