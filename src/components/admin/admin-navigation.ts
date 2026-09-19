import { hasPermission, type Permission } from "@/lib/auth/permissions";
import type { UserRole } from "@/lib/auth/server";

export type AdminNavigationSection = "UTAMA" | "OPERASIONAL" | "MONITORING" | "SETUP";

export type AdminNavigationIcon =
  | "access"
  | "attendance"
  | "dashboard"
  | "display"
  | "meeting"
  | "participants"
  | "pickup"
  | "rooms"
  | "scanner"
  | "sessions"
  | "station";

export type AdminNavigationItem = {
  href: string;
  icon: AdminNavigationIcon;
  label: string;
  permission: Permission;
  section: AdminNavigationSection;
};

export const adminNavigationSections: AdminNavigationSection[] = [
  "UTAMA",
  "OPERASIONAL",
  "MONITORING",
  "SETUP",
];

export const adminNavigationItems: AdminNavigationItem[] = [
  { href: "/admin/dashboard", icon: "dashboard", label: "Dashboard", permission: "dashboard.view", section: "UTAMA" },
  { href: "/admin/sessions", icon: "sessions", label: "Sesi", permission: "sessions.view", section: "OPERASIONAL" },
  { href: "/admin/scanner/pair", icon: "scanner", label: "Scanner", permission: "scanner.pair", section: "OPERASIONAL" },
  { href: "/admin/participants", icon: "participants", label: "Peserta", permission: "participants.view", section: "OPERASIONAL" },
  { href: "/admin/member-meetings", icon: "meeting", label: "Rapat Anggota", permission: "member_meetings.view", section: "OPERASIONAL" },
  { href: "/admin/rooms", icon: "rooms", label: "Room Assignment", permission: "rooms.view", section: "OPERASIONAL" },
  { href: "/admin/pickup", icon: "pickup", label: "Pickup Assignment", permission: "pickup.view", section: "OPERASIONAL" },
  { href: "/admin/attendance", icon: "attendance", label: "Kehadiran", permission: "attendance.view", section: "OPERASIONAL" },
  { href: "/admin/display", icon: "display", label: "Live Display", permission: "display.view", section: "MONITORING" },
  { href: "/admin/display/setup", icon: "station", label: "Station Scanner", permission: "display.manage", section: "SETUP" },
  { href: "/admin/access", icon: "access", label: "Akses Pengguna", permission: "access.manage", section: "SETUP" },
];

export function getVisibleAdminNavigationItems(role: UserRole) {
  return adminNavigationItems.filter((item) => hasPermission(role, item.permission));
}

export function getActiveAdminNavigationHref(
  pathname: string,
  items: readonly AdminNavigationItem[],
) {
  return items
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((left, right) => right.href.length - left.href.length)[0]?.href ?? null;
}

export function shouldCloseAdminDrawer(key: string) {
  return key === "Escape";
}
