import { requirePermission, type UserRole } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";

import { AccessList } from "./access-list";

export const dynamic = "force-dynamic";

export type AccessProfile = {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
};

export default async function AccessManagementPage() {
  await requirePermission("access.manage");

  const { data, error } = await createAdminClient()
    .from("profiles")
    .select("id, full_name, email, role, is_active")
    .order("full_name", { ascending: true });

  if (error) {
    return (
      <main className="min-h-screen bg-[#f7f3ea] px-4 py-6 sm:px-8 sm:py-8">
        <section className="mx-auto max-w-5xl rounded-xl border border-[#ead3cc] bg-[#fff5f2] p-6 text-[#9b3d31]">
          Data akses belum dapat dimuat. Silakan coba kembali.
        </section>
      </main>
    );
  }

  return <AccessList profiles={(data ?? []) as AccessProfile[]} />;
}
