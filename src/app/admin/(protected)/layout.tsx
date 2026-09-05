import type { ReactNode } from "react";

import { requireAuthenticatedUser } from "@/lib/auth/server";
import { AdminProfileProvider } from "@/components/admin/admin-sidebar";

export default async function ProtectedAdminLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const profile = await requireAuthenticatedUser();

  return (
    <AdminProfileProvider
      profile={{ full_name: profile.full_name, role: profile.role }}
    >
      {children}
    </AdminProfileProvider>
  );
}
