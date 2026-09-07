import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  getCurrentUserProfile: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/server", () => ({
  getCurrentUserProfile: mocks.getCurrentUserProfile,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

import { GET } from "@/app/api/admin/member-meetings/[id]/authorization/route";

beforeEach(() => {
  mocks.createAdminClient.mockReset();
  mocks.getCurrentUserProfile.mockReset();
});

describe("member meeting authorization route", () => {
  it("rejects unauthenticated requests", async () => {
    mocks.getCurrentUserProfile.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000001" }),
    });

    expect(response.status).toBe(401);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("rejects OPERATIONAL requests", async () => {
    mocks.getCurrentUserProfile.mockResolvedValue({
      id: "profile-1",
      full_name: "Operational",
      email: "operational@example.com",
      role: "OPERATIONAL",
      is_active: true,
    });

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000001" }),
    });

    expect(response.status).toBe(403);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("allows the existing ADMIN role to continue to the data check", async () => {
    mocks.getCurrentUserProfile.mockResolvedValue({
      id: "profile-1",
      full_name: "Admin",
      email: "admin@example.com",
      role: "ADMIN",
      is_active: true,
    });
    mocks.createAdminClient.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      }),
    });

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000001" }),
    });

    expect(response.status).toBe(404);
    expect(mocks.createAdminClient).toHaveBeenCalledOnce();
  });

  it.each(["ADMIN", "SUPER_ADMIN"] as const)(
    "allows %s to download an authorization file",
    async (role) => {
      mocks.getCurrentUserProfile.mockResolvedValue({
        id: "profile-1",
        full_name: role,
        email: `${role.toLowerCase()}@example.com`,
        role,
        is_active: true,
      });
      mocks.createAdminClient.mockReturnValue({
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { authorization_file_path: "submissions/file.pdf" },
                error: null,
              }),
            }),
          }),
        }),
        storage: {
          from: () => ({
            createSignedUrl: async () => ({
              data: { signedUrl: "https://example.com/private-file" },
              error: null,
            }),
          }),
        },
      });

      const response = await GET(new Request("http://localhost"), {
        params: Promise.resolve({
          id: "00000000-0000-4000-8000-000000000001",
        }),
      });

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe(
        "https://example.com/private-file",
      );
    },
  );
});
