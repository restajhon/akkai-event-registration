import type { ReactNode } from "react";

import { requireRole } from "@/lib/auth/server";

export default async function ProtectedAdminLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  await requireRole(["ADMIN", "OPERATOR"]);

  return children;
}
