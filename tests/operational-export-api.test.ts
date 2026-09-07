import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorizePermission: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/server", () => ({
  authorizePermission: mocks.authorizePermission,
}));

import { GET } from "@/app/api/admin/operational-export/route";

beforeEach(() => {
  mocks.authorizePermission.mockReset();
});

describe("attendance export API authorization", () => {
  it("returns 401 when there is no authenticated profile", async () => {
    mocks.authorizePermission.mockResolvedValueOnce({
      profile: null,
      authorized: false,
      status: 401,
    });

    const response = await GET();

    expect(mocks.authorizePermission).toHaveBeenCalledWith("attendance.export");
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Authentication required.",
    });
  });

  it("returns 403 when the authenticated profile lacks attendance.export", async () => {
    mocks.authorizePermission.mockResolvedValueOnce({
      profile: {
        id: "profile-1",
        full_name: "Registration",
        email: "registration@example.com",
        role: "REGISTRATION",
        is_active: true,
      },
      authorized: false,
      status: 403,
    });

    const response = await GET();

    expect(mocks.authorizePermission).toHaveBeenCalledWith("attendance.export");
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Forbidden.",
    });
  });

  it("uses attendance.export rather than a broader attendance permission", async () => {
    mocks.authorizePermission.mockImplementation(async (permission: string) => {
      expect(permission).toBe("attendance.export");
      return {
        profile: null,
        authorized: false,
        status: 401 as const,
      };
    });

    const response = await GET();

    expect(response.status).toBe(401);
  });
});
