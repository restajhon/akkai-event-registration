import type { UserRole } from "@/lib/auth/server";

export type Permission =
  | "dashboard.view"
  | "participants.view"
  | "participants.manage"
  | "participants.email"
  | "participants.export"
  | "rooms.view"
  | "rooms.manage"
  | "rooms.export"
  | "pickup.view"
  | "pickup.manage"
  | "pickup.export"
  | "attendance.view"
  | "attendance.export"
  | "sessions.view"
  | "sessions.manage"
  | "scanner.pair"
  | "scanner.checkin"
  | "display.view"
  | "display.manage"
  | "access.manage";

const rolePermissions: Record<UserRole, readonly Permission[]> = {
  ADMIN: [
    "dashboard.view",
    "participants.view",
    "participants.manage",
    "participants.email",
    "participants.export",
    "rooms.view",
    "rooms.manage",
    "rooms.export",
    "pickup.view",
    "pickup.manage",
    "pickup.export",
    "attendance.view",
    "attendance.export",
    "sessions.view",
    "sessions.manage",
    "scanner.pair",
    "scanner.checkin",
    "display.view",
    "display.manage",
  ],
  OPERATOR: [
    "scanner.pair",
    "scanner.checkin",
    "display.view",
  ],
  SUPER_ADMIN: [
    "dashboard.view",
    "participants.view",
    "participants.manage",
    "participants.email",
    "participants.export",
    "rooms.view",
    "rooms.manage",
    "rooms.export",
    "pickup.view",
    "pickup.manage",
    "pickup.export",
    "attendance.view",
    "attendance.export",
    "sessions.view",
    "sessions.manage",
    "scanner.pair",
    "scanner.checkin",
    "display.view",
    "display.manage",
    "access.manage",
  ],
  REGISTRATION: [
    "dashboard.view",
    "participants.view",
    "participants.manage",
    "participants.email",
    "participants.export",
    "attendance.view",
  ],
  OPERATIONAL: [
    "dashboard.view",
    "participants.view",
    "participants.manage",
    "participants.email",
    "participants.export",
    "rooms.view",
    "rooms.manage",
    "rooms.export",
    "pickup.view",
    "pickup.manage",
    "pickup.export",
    "attendance.view",
    "attendance.export",
  ],
  SCANNER: [
    "scanner.pair",
    "scanner.checkin",
    "display.view",
  ],
};

export function getPermissionsForRole(role: UserRole) {
  return rolePermissions[role];
}

export function hasPermission(role: UserRole, permission: Permission) {
  return rolePermissions[role].includes(permission);
}

export function getDefaultAdminRoute(role: UserRole) {
  switch (role) {
    case "SCANNER":
    case "OPERATOR":
      return "/admin/scanner/pair";
    default:
      return "/admin/dashboard";
  }
}

export function getRoleLabel(role: UserRole) {
  switch (role) {
    case "ADMIN":
      return "Admin (legacy)";
    case "OPERATOR":
      return "Operator (legacy)";
    case "SUPER_ADMIN":
      return "Super Admin";
    case "REGISTRATION":
      return "Registration";
    case "OPERATIONAL":
      return "Operational";
    case "SCANNER":
      return "Scanner";
  }
}
