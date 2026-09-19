import type { ReactNode } from "react";
import { DM_Serif_Display, Inter } from "next/font/google";

import { requireAuthenticatedUser } from "@/lib/auth/server";
import { AdminProfileProvider } from "@/components/admin/admin-sidebar";

const adminDisplayFont = DM_Serif_Display({
  subsets: ["latin"],
  variable: "--font-admin-display",
  weight: "400",
});

const adminBodyFont = Inter({
  subsets: ["latin"],
  variable: "--font-admin-body",
});

export default async function ProtectedAdminLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const profile = await requireAuthenticatedUser();

  return (
    <AdminProfileProvider
      profile={{ full_name: profile.full_name, role: profile.role }}
    >
      <div className={`admin-root ${adminDisplayFont.variable} ${adminBodyFont.variable}`}>
        {children}
      </div>
    </AdminProfileProvider>
  );
}
