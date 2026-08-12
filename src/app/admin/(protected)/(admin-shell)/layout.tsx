import type { ReactNode } from "react";

import { AdminShell } from "@/components/admin/admin-shell";

export default async function AdminShellLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return <AdminShell>{children}</AdminShell>;
}
