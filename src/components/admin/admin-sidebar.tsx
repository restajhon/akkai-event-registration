"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useState } from "react";

import { signOut } from "@/app/admin/actions";
import { getRoleLabel, hasPermission, type Permission } from "@/lib/auth/permissions";
import type { UserRole } from "@/lib/auth/server";

export type AdminSidebarProfile = {
  full_name: string;
  role: UserRole;
};

type MenuItem = {
  href: string;
  label: string;
  permission?: Permission;
  roles?: readonly UserRole[];
  section: "UTAMA" | "OPERASIONAL" | "MONITORING" | "SETUP";
};

const menuItems: MenuItem[] = [
  {
    href: "/admin/dashboard",
    label: "Dashboard",
    permission: "dashboard.view",
    section: "UTAMA",
  },
  {
    href: "/admin/sessions",
    label: "Sesi",
    permission: "sessions.view",
    section: "OPERASIONAL",
  },
  {
    href: "/admin/scanner/pair",
    label: "Scanner",
    permission: "scanner.pair",
    section: "OPERASIONAL",
  },
  {
    href: "/admin/participants",
    label: "Peserta",
    permission: "participants.view",
    section: "OPERASIONAL",
  },
  {
    href: "/admin/member-meetings",
    label: "Rapat Anggota",
    roles: ["SUPER_ADMIN", "ADMIN"],
    section: "OPERASIONAL",
  },
  {
    href: "/admin/rooms",
    label: "Room Assignment",
    permission: "rooms.view",
    section: "OPERASIONAL",
  },
  {
    href: "/admin/pickup",
    label: "Pickup Assignment",
    permission: "pickup.view",
    section: "OPERASIONAL",
  },
  {
    href: "/admin/attendance",
    label: "Kehadiran",
    permission: "attendance.view",
    section: "OPERASIONAL",
  },
  {
    href: "/admin/display",
    label: "Live Display",
    permission: "display.view",
    section: "MONITORING",
  },
  {
    href: "/admin/display/setup",
    label: "Station Scanner",
    permission: "display.manage",
    section: "SETUP",
  },
  {
    href: "/admin/access",
    label: "Akses Pengguna",
    permission: "access.manage",
    section: "SETUP",
  },
];

const sectionOrder: MenuItem["section"][] = [
  "UTAMA",
  "OPERASIONAL",
  "MONITORING",
  "SETUP",
];

const AdminProfileContext = createContext<AdminSidebarProfile | null>(null);

export function AdminProfileProvider({
  children,
  profile,
}: Readonly<{
  children: React.ReactNode;
  profile: AdminSidebarProfile;
}>) {
  return (
    <AdminProfileContext.Provider value={profile}>
      {children}
    </AdminProfileContext.Provider>
  );
}

export function useAdminProfile() {
  const profile = useContext(AdminProfileContext);

  if (!profile) {
    throw new Error("Admin profile context is unavailable.");
  }

  return profile;
}

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function visibleItems(role: UserRole) {
  return menuItems.filter((item) =>
    item.roles ? item.roles.includes(role) : item.permission ? hasPermission(role, item.permission) : false,
  );
}

export function AdminSidebar({ profile }: { profile: AdminSidebarProfile }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const items = visibleItems(profile.role);

  function closeDrawer() {
    setDrawerOpen(false);
  }

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[#e4d8c4] bg-[#fffdf8] px-4 lg:hidden">
        <div>
          <p className="text-xs font-bold tracking-[0.18em] text-[#9a7526]">AKKAI 2026</p>
          <p className="mt-0.5 text-sm font-semibold text-[#142842]">Event Operations</p>
        </div>
        <button
          aria-controls="admin-navigation-drawer"
          aria-expanded={drawerOpen}
          aria-label={drawerOpen ? "Tutup menu navigasi" : "Buka menu navigasi"}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-[#b99a5a] text-xl text-[#142842] outline-none focus-visible:ring-2 focus-visible:ring-[#9a7526]"
          onClick={() => setDrawerOpen((open) => !open)}
          type="button"
        >
          <span aria-hidden="true">{drawerOpen ? "×" : "☰"}</span>
        </button>
      </header>

      {drawerOpen ? (
        <button
          aria-label="Tutup menu navigasi"
          className="fixed inset-0 z-40 bg-[#142842]/35 lg:hidden"
          onClick={closeDrawer}
          type="button"
        />
      ) : null}

      <aside
        aria-label="Navigasi admin"
        className={`fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-[#e4d8c4] bg-[#fffdf8] px-4 py-5 transition-transform duration-200 lg:translate-x-0 ${
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        id="admin-navigation-drawer"
      >
        <div className="flex items-start justify-between gap-3 px-2">
          <div>
            <p className="text-sm font-bold tracking-[0.2em] text-[#9a7526]">AKKAI 2026</p>
            <p className="mt-1 text-sm font-semibold text-[#142842]">Event Operations</p>
          </div>
          <button
            aria-label="Tutup menu navigasi"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-xl text-[#344d68] outline-none hover:bg-[#f1eadc] focus-visible:ring-2 focus-visible:ring-[#9a7526] lg:hidden"
            onClick={closeDrawer}
            type="button"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <nav className="mt-8 flex-1" aria-label="Menu utama">
          {sectionOrder.map((section) => {
            const sectionItems = items.filter((item) => item.section === section);

            if (sectionItems.length === 0) {
              return null;
            }

            return (
              <div className="mb-6 last:mb-0" key={section}>
                <p className="px-2 text-[11px] font-bold tracking-[0.16em] text-[#897657]">{section}</p>
                <div className="mt-2 grid gap-1">
                  {sectionItems.map((item) => {
                    const active = isActivePath(pathname, item.href);

                    return (
                      <Link
                        aria-current={active ? "page" : undefined}
                        className={`flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#9a7526] ${
                          active
                            ? "bg-[#142842] text-[#fffdf8]"
                            : "text-[#344d68] hover:bg-[#f1eadc] hover:text-[#142842]"
                        }`}
                        href={item.href}
                        key={item.href}
                        onClick={closeDrawer}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="border-t border-[#e4d8c4] px-2 pt-4">
          <p className="truncate text-sm font-semibold text-[#142842]">{profile.full_name}</p>
          <p className="mt-1 text-xs font-medium text-[#897657]">
            {getRoleLabel(profile.role)}
          </p>
          <form action={signOut} className="mt-3">
            <button
              className="flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm font-semibold text-[#6d531e] outline-none hover:bg-[#fbf5e8] focus-visible:ring-2 focus-visible:ring-[#9a7526]"
              type="submit"
            >
              Keluar
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
