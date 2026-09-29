import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AttendanceBoard } from "@/app/admin/(protected)/(admin-shell)/attendance/attendance-board";
import {
  getDefaultAdminRoute,
  getPermissionsForRole,
  hasPermission,
} from "@/lib/auth/permissions";
import type { UserRole } from "@/lib/auth/server";

const roles: UserRole[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "REGISTRATION",
  "OPERATIONAL",
  "SCANNER",
  "OPERATOR",
];

const allPermissions = [
  "dashboard.view",
  "participants.view",
  "participants.manage",
  "participants.email",
  "participants.export",
  "participants.cancel",
  "participants.restore",
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
  "member_meetings.view",
  "access.manage",
] as const;

const expectedPermissions: Record<UserRole, readonly string[]> = {
  SUPER_ADMIN: allPermissions,
  ADMIN: allPermissions.filter((permission) => permission !== "access.manage" && permission !== "participants.restore"),
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
    "participants.cancel",
    "rooms.view",
    "rooms.manage",
    "rooms.export",
    "pickup.view",
    "pickup.manage",
    "pickup.export",
    "attendance.view",
    "attendance.export",
    "member_meetings.view",
  ],
  SCANNER: ["scanner.pair", "scanner.checkin", "display.view"],
  OPERATOR: ["scanner.pair", "scanner.checkin", "display.view"],
};

const participant = {
  id: "participant-1",
  registrationId: "AKKAI26-000001",
  fullName: "Test Participant",
  packageType: "Single",
  registrationStatus: "REGISTERED" as const,
  roomAssignment: null,
  travel: null,
  arrivalAssignment: null,
  departureAssignment: null,
  arrival: { checkedIn: false, checkedInAt: null },
  seminar: { checkedIn: false, checkedInAt: null },
  day3: { checkedIn: false, checkedInAt: null },
};

describe("RBAC parity", () => {
  it.each(roles)("covers the %s role with the actual permission matrix", (role) => {
    expect(getPermissionsForRole(role)).toEqual(expectedPermissions[role]);
  });

  it("keeps role-specific login destinations", () => {
    expect(getDefaultAdminRoute("SUPER_ADMIN")).toBe("/admin/dashboard");
    expect(getDefaultAdminRoute("ADMIN")).toBe("/admin/dashboard");
    expect(getDefaultAdminRoute("REGISTRATION")).toBe("/admin/dashboard");
    expect(getDefaultAdminRoute("OPERATIONAL")).toBe("/admin/dashboard");
    expect(getDefaultAdminRoute("SCANNER")).toBe("/admin/scanner/pair");
    expect(getDefaultAdminRoute("OPERATOR")).toBe("/admin/scanner/pair");
  });

  it("renders attendance export only when the caller has attendance.export", () => {
    const withoutExport = renderToStaticMarkup(
      <AttendanceBoard
        canExportAttendance={false}
        participants={[participant]}
      />,
    );
    const withExport = renderToStaticMarkup(
      <AttendanceBoard
        canExportAttendance={true}
        participants={[participant]}
      />,
    );

    expect(withoutExport).not.toContain("/api/admin/operational-export");
    expect(withExport).toContain("/api/admin/operational-export");
  });

  it("keeps attendance export permission explicit", () => {
    expect(hasPermission("REGISTRATION", "attendance.export")).toBe(false);
    expect(hasPermission("OPERATIONAL", "attendance.export")).toBe(true);
    expect(hasPermission("ADMIN", "attendance.export")).toBe(true);
    expect(hasPermission("SUPER_ADMIN", "attendance.export")).toBe(true);
    expect(hasPermission("SCANNER", "attendance.export")).toBe(false);
    expect(hasPermission("OPERATOR", "attendance.export")).toBe(false);
  });

  it("restricts access management to SUPER_ADMIN", () => {
    expect(hasPermission("SUPER_ADMIN", "access.manage")).toBe(true);
    expect(hasPermission("ADMIN", "access.manage")).toBe(false);
    expect(hasPermission("REGISTRATION", "access.manage")).toBe(false);
    expect(hasPermission("OPERATIONAL", "access.manage")).toBe(false);
    expect(hasPermission("SCANNER", "access.manage")).toBe(false);
    expect(hasPermission("OPERATOR", "access.manage")).toBe(false);
  });

  it("allows cancellation to ADMIN, SUPER_ADMIN, and OPERATIONAL, but restore only to SUPER_ADMIN", () => {
    for (const role of ["SUPER_ADMIN", "ADMIN", "OPERATIONAL"] as const) {
      expect(hasPermission(role, "participants.cancel")).toBe(true);
    }
    expect(hasPermission("OPERATOR", "participants.cancel")).toBe(false);
    expect(hasPermission("REGISTRATION", "participants.cancel")).toBe(false);

    expect(hasPermission("SUPER_ADMIN", "participants.restore")).toBe(true);
    for (const role of ["ADMIN", "OPERATOR", "OPERATIONAL", "REGISTRATION", "SCANNER"] as const) {
      expect(hasPermission(role, "participants.restore")).toBe(false);
    }
  });

  it("restricts operational users to participant and operational areas", () => {
    expect(hasPermission("OPERATIONAL", "participants.view")).toBe(true);
    expect(hasPermission("OPERATIONAL", "participants.manage")).toBe(true);
    expect(hasPermission("OPERATIONAL", "participants.email")).toBe(true);
    expect(hasPermission("OPERATIONAL", "participants.export")).toBe(true);
    expect(hasPermission("OPERATIONAL", "attendance.view")).toBe(true);
    expect(hasPermission("OPERATIONAL", "member_meetings.view")).toBe(true);
    expect(hasPermission("OPERATIONAL", "display.view")).toBe(false);
    expect(hasPermission("OPERATIONAL", "display.manage")).toBe(false);
    expect(hasPermission("OPERATIONAL", "scanner.pair")).toBe(false);
    expect(hasPermission("OPERATIONAL", "scanner.checkin")).toBe(false);
  });
});
