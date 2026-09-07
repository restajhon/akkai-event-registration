import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

import {
  authorizePermission,
  getCurrentUserProfile,
  requirePermission,
} from "@/lib/auth/server";
import AccessManagementPage from "@/app/admin/(protected)/(admin-shell)/access/page";
import LiveDisplaySelectionPage from "@/app/admin/(protected)/(admin-shell)/display/page";
import ScannerPairPage from "@/app/admin/(protected)/(admin-shell)/scanner/pair/page";

function configureProfile(profile: unknown) {
  mocks.createClient.mockResolvedValue({
    auth: {
      getClaims: vi.fn().mockResolvedValue({
        data: { claims: { sub: "profile-1" } },
        error: null,
      }),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: profile, error: null }),
        })),
      })),
    })),
  });
}

beforeEach(() => {
  mocks.createClient.mockReset();
  mocks.redirect.mockReset();
});

describe("server authorization", () => {
  it("rejects an inactive profile", async () => {
    configureProfile({
      id: "profile-1",
      full_name: "Inactive",
      email: "inactive@example.com",
      role: "ADMIN",
      is_active: false,
    });

    await expect(getCurrentUserProfile()).resolves.toBeNull();
  });

  it("rejects a profile without a valid role", async () => {
    configureProfile({
      id: "profile-1",
      full_name: "Invalid Role",
      email: "invalid@example.com",
      role: "UNKNOWN",
      is_active: true,
    });

    await expect(getCurrentUserProfile()).resolves.toBeNull();
  });

  it("redirects an authenticated user from an unauthorized route", async () => {
    configureProfile({
      id: "profile-1",
      full_name: "Scanner",
      email: "scanner@example.com",
      role: "SCANNER",
      is_active: true,
    });

    await requirePermission("attendance.view");

    expect(mocks.redirect).toHaveBeenCalledWith("/admin/unauthorized");
  });

  it.each([
    ["ADMIN", "access.manage"],
    ["OPERATIONAL", "display.view"],
    ["OPERATIONAL", "display.manage"],
    ["OPERATIONAL", "scanner.pair"],
    ["OPERATIONAL", "scanner.checkin"],
  ] as const)("redirects %s from %s", async (role, permission) => {
    configureProfile({
      id: "profile-1",
      full_name: role,
      email: `${role.toLowerCase()}@example.com`,
      role,
      is_active: true,
    });

    await requirePermission(permission);

    expect(mocks.redirect).toHaveBeenCalledWith("/admin/unauthorized");
  });

  it("protects the access-management page from ADMIN", async () => {
    configureProfile({
      id: "profile-1",
      full_name: "Admin",
      email: "admin@example.com",
      role: "ADMIN",
      is_active: true,
    });
    mocks.redirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });

    await expect(AccessManagementPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledWith("/admin/unauthorized");
  });

  it.each([
    ["display", LiveDisplaySelectionPage],
    ["scanner", ScannerPairPage],
  ] as const)("protects the %s page from OPERATIONAL", async (_name, page) => {
    configureProfile({
      id: "profile-1",
      full_name: "Operational",
      email: "operational@example.com",
      role: "OPERATIONAL",
      is_active: true,
    });
    mocks.redirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });

    await expect(page()).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledWith("/admin/unauthorized");
  });

  it("returns 401 for an unauthenticated request", async () => {
    mocks.createClient.mockResolvedValue({
      auth: {
        getClaims: vi.fn().mockResolvedValue({
          data: { claims: null },
          error: null,
        }),
      },
    });

    await expect(authorizePermission("attendance.export")).resolves.toMatchObject({
      authorized: false,
      status: 401,
    });
  });

  it("returns 403 for an authenticated role without the permission", async () => {
    configureProfile({
      id: "profile-1",
      full_name: "Registration",
      email: "registration@example.com",
      role: "REGISTRATION",
      is_active: true,
    });

    await expect(authorizePermission("attendance.export")).resolves.toMatchObject({
      authorized: false,
      status: 403,
    });
  });
});
