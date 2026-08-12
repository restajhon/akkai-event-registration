"use client";

import type { ReactNode } from "react";

import { AdminSidebar, useAdminProfile } from "./admin-sidebar";

export function AdminShell({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const profile = useAdminProfile();

  return (
    <div className="min-h-screen bg-[#f7f3ea] lg:flex">
      <AdminSidebar profile={profile} />
      <div className="min-w-0 flex-1 lg:pl-60">
        <div className="min-h-screen">{children}</div>
      </div>
    </div>
  );
}
