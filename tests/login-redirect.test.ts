import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUserProfile: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/auth/server", () => ({
  getCurrentUserProfile: mocks.getCurrentUserProfile,
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

import AdminLoginPage from "@/app/admin/login/page";
import { getDefaultAdminRoute } from "@/lib/auth/permissions";
import type { UserRole } from "@/lib/auth/server";

const roles: UserRole[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "REGISTRATION",
  "OPERATIONAL",
  "SCANNER",
  "OPERATOR",
];

describe("admin login redirect", () => {
  it.each(roles)("redirects an authenticated %s user to its default route", async (role) => {
    mocks.getCurrentUserProfile.mockResolvedValueOnce({
      id: "profile-1",
      full_name: "Test User",
      email: "test@example.com",
      role,
      is_active: true,
    });

    await AdminLoginPage();

    expect(mocks.redirect).toHaveBeenCalledWith(getDefaultAdminRoute(role));
    mocks.redirect.mockClear();
  });
});
