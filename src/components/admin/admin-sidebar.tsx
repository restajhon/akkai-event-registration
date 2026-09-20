"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BedDouble,
  BusFront,
  CalendarClock,
  ClipboardCheck,
  LayoutDashboard,
  LogOut,
  Menu,
  Monitor,
  RadioTower,
  ScanLine,
  ScrollText,
  UserCog,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { createContext, useContext, useEffect, useRef, useState } from "react";

import { signOut } from "@/app/admin/actions";
import { getRoleLabel } from "@/lib/auth/permissions";
import type { UserRole } from "@/lib/auth/server";

import {
  adminNavigationSections,
  getActiveAdminNavigationHref,
  getVisibleAdminNavigationItems,
  shouldCloseAdminDrawer,
  type AdminNavigationIcon,
} from "./admin-navigation";

export type AdminSidebarProfile = {
  full_name: string;
  role: UserRole;
};

const navigationIcons: Record<AdminNavigationIcon, LucideIcon> = {
  access: UserCog,
  attendance: ClipboardCheck,
  dashboard: LayoutDashboard,
  display: Monitor,
  meeting: ScrollText,
  participants: Users,
  pickup: BusFront,
  rooms: BedDouble,
  scanner: ScanLine,
  sessions: CalendarClock,
  station: RadioTower,
};

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

export function AdminSidebar({ profile }: { profile: AdminSidebarProfile }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const drawerRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const items = getVisibleAdminNavigationItems(profile.role);
  const activeHref = getActiveAdminNavigationHref(pathname, items);
  const drawerInteractive = isDesktop || drawerOpen;
  const profileInitials = profile.full_name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((name) => name[0]?.toUpperCase())
    .join("");

  function closeDrawer() {
    setDrawerOpen(false);
  }

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!drawerOpen || isDesktop) return;

    const previousOverflow = document.body.style.overflow;
    const menuButton = menuButtonRef.current;
    document.body.style.overflow = "hidden";
    const drawer = drawerRef.current;
    const focusable = drawer?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    focusable?.[0]?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (shouldCloseAdminDrawer(event.key)) {
        event.preventDefault();
        closeDrawer();
        return;
      }

      if (event.key !== "Tab" || !focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      menuButton?.focus();
    };
  }, [drawerOpen, isDesktop]);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-[#e4d8c4] bg-[#fffdf8]/95 px-[18px] backdrop-blur lg:hidden">
        <div>
          <p className="text-[10px] font-bold tracking-[0.18em] text-[#9a7526]">AKKAI 2026</p>
          <p className="mt-0.5 text-[13px] font-semibold text-[#142842]">Event Operations</p>
        </div>
        <button
          aria-controls="admin-navigation-drawer"
          aria-expanded={drawerOpen}
          aria-label={drawerOpen ? "Tutup menu navigasi" : "Buka menu navigasi"}
           className={`inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#e4d8c4] text-xl text-[#142842] outline-none focus-visible:ring-2 focus-visible:ring-[#9a7526] ${drawerOpen ? "invisible" : ""}`}
          onClick={() => setDrawerOpen((open) => !open)}
          ref={menuButtonRef}
          type="button"
        >
          {drawerOpen ? <X aria-hidden="true" size={20} /> : <Menu aria-hidden="true" size={20} />}
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
        aria-hidden={!drawerInteractive}
        aria-modal={drawerOpen && !isDesktop ? true : undefined}
        className={`fixed inset-y-0 left-0 z-50 flex w-[min(318px,calc(100vw-48px))] flex-col border-r border-[#e4d8c4] bg-[#fffdf8] px-4 py-4 shadow-[10px_0_28px_rgba(20,40,66,0.12)] transition-transform duration-200 motion-reduce:transition-none lg:w-[272.5px] lg:px-5 lg:pt-8 lg:pb-6 lg:translate-x-0 lg:shadow-none ${
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        id="admin-navigation-drawer"
        inert={!drawerInteractive}
        ref={drawerRef}
        role={drawerOpen && !isDesktop ? "dialog" : undefined}
      >
        <div className="flex items-start justify-between gap-3 px-2">
          <div>
             <p className="text-sm font-bold tracking-[0.2em] text-[#9a7526] lg:text-xs">AKKAI 2026</p>
             <p className="mt-1 text-sm font-semibold text-[#142842] lg:text-[15px]">Event Operations</p>
          </div>
          <button
            aria-label="Tutup menu navigasi"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-xl text-[#344d68] outline-none hover:bg-[#f1eadc] focus-visible:ring-2 focus-visible:ring-[#9a7526] lg:hidden"
            onClick={closeDrawer}
            type="button"
          >
            <X aria-hidden="true" size={20} />
          </button>
        </div>

        <nav className="mt-5 min-h-0 flex-1 scroll-pb-4 overflow-y-auto pr-1 lg:mt-7" aria-label="Menu utama">
          {adminNavigationSections.map((section) => {
            const sectionItems = items.filter((item) => item.section === section);

            if (sectionItems.length === 0) {
              return null;
            }

            return (
              <div className="mb-4 last:mb-0 lg:mb-[22px]" key={section}>
                <p className="px-2 text-[11px] font-bold tracking-[0.16em] text-[#897657] lg:text-[10px]">{section}</p>
                <div className="mt-1.5 grid gap-0.5">
                  {sectionItems.map((item) => {
                    const active = activeHref === item.href;
                    const Icon = navigationIcons[item.icon];

                    return (
                      <Link
                        aria-current={active ? "page" : undefined}
                         className={`flex min-h-9 items-center gap-3 rounded-lg px-3 text-[13px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#9a7526] lg:min-h-10 lg:gap-2.5 ${
                          active
                            ? "bg-[#142842] text-[#fffdf8]"
                            : "text-[#344d68] hover:bg-[#f1eadc] hover:text-[#142842]"
                        }`}
                        href={item.href}
                        key={item.href}
                        onClick={closeDrawer}
                      >
                        <Icon aria-hidden="true" className="shrink-0" size={17} strokeWidth={1.8} />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="shrink-0 border-t border-[#e4d8c4] bg-[#fffdf8] px-2 pt-3">
          <div className="flex items-center gap-3">
             <span aria-hidden="true" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#d9ad45] text-xs font-bold text-[#142842]">
              {profileInitials || "A"}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#142842]">{profile.full_name}</p>
              <p className="mt-0.5 text-xs font-medium text-[#897657]">
                {getRoleLabel(profile.role)}
              </p>
            </div>
          </div>
          <form action={signOut} className="mt-2">
            <button
              className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-semibold text-[#9a3e35] outline-none hover:bg-[#fff5f2] focus-visible:ring-2 focus-visible:ring-[#9a7526]"
              type="submit"
            >
              <LogOut aria-hidden="true" size={17} strokeWidth={1.8} />
              Keluar
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
