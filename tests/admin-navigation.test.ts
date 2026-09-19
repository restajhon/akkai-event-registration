import { describe, expect, it } from "vitest";

import {
  getActiveAdminNavigationHref,
  getVisibleAdminNavigationItems,
  shouldCloseAdminDrawer,
} from "@/components/admin/admin-navigation";
import { getParticipantActionVisibility } from "@/lib/admin/participant-ui";

describe("admin navigation", () => {
  it("selects only the most specific active route", () => {
    const items = getVisibleAdminNavigationItems("SUPER_ADMIN");

    expect(getActiveAdminNavigationHref("/admin/display/setup", items)).toBe("/admin/display/setup");
    expect(getActiveAdminNavigationHref("/admin/participants/AKKAI26-000001", items)).toBe("/admin/participants");
  });

  it("filters navigation based on the server permission matrix", () => {
    expect(getVisibleAdminNavigationItems("SUPER_ADMIN").map((item) => item.href)).toContain("/admin/access");
    expect(getVisibleAdminNavigationItems("REGISTRATION").map((item) => item.href)).not.toContain("/admin/access");
    expect(getVisibleAdminNavigationItems("SCANNER").map((item) => item.href)).toEqual([
      "/admin/scanner/pair",
      "/admin/display",
    ]);
  });

  it("closes the mobile drawer only for Escape", () => {
    expect(shouldCloseAdminDrawer("Escape")).toBe(true);
    expect(shouldCloseAdminDrawer("Enter")).toBe(false);
    expect(shouldCloseAdminDrawer("Tab")).toBe(false);
  });
});

describe("participant action visibility", () => {
  it("keeps sensitive participant actions permission-based", () => {
    expect(getParticipantActionVisibility("REGISTRATION")).toEqual({
      canDownloadTicket: true,
      canEdit: true,
      canExport: true,
      canResendEmail: true,
    });
    expect(getParticipantActionVisibility("SCANNER")).toEqual({
      canDownloadTicket: false,
      canEdit: false,
      canExport: false,
      canResendEmail: false,
    });
  });
});
