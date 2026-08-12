import type { ReactNode } from "react";

import { requireRole } from "@/lib/auth/server";
import { AdminProfileProvider } from "@/components/admin/admin-sidebar";

export default async function ProtectedAdminLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const profile = await requireRole(["ADMIN", "OPERATOR"]);

  return (
    <AdminProfileProvider
      profile={{ full_name: profile.full_name, role: profile.role }}
    >
      {children}
    </AdminProfileProvider>
  );
}
