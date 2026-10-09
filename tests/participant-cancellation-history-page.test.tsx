import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  requirePermission: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/server", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/app/admin/(protected)/(admin-shell)/participants/registration-status-actions", () => ({
  RegistrationStatusActions: ({ isCancelled, canRestore }: { isCancelled: boolean; canRestore: boolean }) =>
    isCancelled && canRestore ? "RESTORE_ACTION" : "CANCEL_ACTION",
}));

import ParticipantCancellationLookupPage from "@/app/admin/(protected)/(admin-shell)/participants/cancel/page";

type MockRow = Record<string, unknown>;

const tableRows: Record<string, MockRow[]> = {
  participants: [
    {
      registration_id: "AKKAI26-000001",
      full_name: "Peserta Aktif",
      registration_status: "REGISTERED",
      cancelled_at: null,
      cancelled_by: null,
      cancellation_reason: null,
    },
    {
      registration_id: "AKKAI26-000002",
      full_name: "Peserta Batal Satu",
      registration_status: "CANCELLED",
      cancelled_at: "2026-10-05T10:30:00+07:00",
      cancelled_by: "admin-profile-1",
      cancellation_reason: "Berhalangan hadir.",
    },
    {
      registration_id: "AKKAI26-000003",
      full_name: "Peserta Batal Dua",
      registration_status: "CANCELLED",
      cancelled_at: null,
      cancelled_by: null,
      cancellation_reason: null,
    },
  ],
  profiles: [
    { id: "admin-profile-1", full_name: "Admin AKKAI" },
  ],
};

function configureSupabase() {
  mocks.createAdminClient.mockReturnValue({
    from: vi.fn((table: string) => {
      let rows = [...(tableRows[table] ?? [])];
      const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn((column: string, value: unknown) => {
          rows = rows.filter((row) => row[column] === value);
          return builder;
        }),
        order: vi.fn(() => builder),
        in: vi.fn((column: string, values: string[]) => {
          rows = rows.filter((row) => values.includes(String(row[column])));
          return builder;
        }),
        maybeSingle: vi.fn(async () => ({ data: rows[0] ?? null, error: null })),
        then(resolve: (result: { data: MockRow[]; error: null }) => unknown) {
          return resolve({ data: rows, error: null });
        },
      };

      return builder;
    }),
  });
}

async function renderCancellationPage(searchParams: Record<string, string> = {}) {
  const page = await ParticipantCancellationLookupPage({
    searchParams: Promise.resolve(searchParams),
  });
  return renderToStaticMarkup(page);
}

beforeEach(() => {
  mocks.createAdminClient.mockReset();
  mocks.requirePermission.mockReset();
  mocks.requirePermission.mockResolvedValue({
    id: "operational-profile-1",
    role: "OPERATIONAL",
    is_active: true,
  });
  configureSupabase();
});

describe("participant cancellation history page", () => {
  it("keeps active participants in the cancellation lookup and shows available cancellation details in history only", async () => {
    const markup = await renderCancellationPage({ registrationId: "AKKAI26-000001" });

    expect(mocks.requirePermission).toHaveBeenCalledWith("participants.cancel");
    expect(markup).toContain("Peserta Aktif");
    expect(markup).toContain("CANCEL_ACTION");
    expect(markup).toContain("Riwayat Pendaftaran yang Dibatalkan");
    expect(markup).toContain("Peserta Batal Satu");
    expect(markup).toContain("Dibatalkan");
    expect(markup).toContain("5 Oktober 2026");
    expect(markup).toContain("Berhalangan hadir.");
    expect(markup).toContain("Admin AKKAI");
    expect(markup).not.toContain("RESTORE_ACTION");
  });

  it("searches the cancellation history and counts matches against all cancelled registrations", async () => {
    const markup = await renderCancellationPage({ historyQuery: "AKKAI26-000003" });

    expect(markup).toContain("1 dari 2 riwayat ditampilkan.");
    expect(markup).toContain("Peserta Batal Dua");
    expect(markup).not.toContain("Peserta Batal Satu");
    expect(markup).not.toContain("Waktu pembatalan");
    expect(markup).not.toContain("Dibatalkan oleh");
    expect(markup).not.toContain("RESTORE_ACTION");
    expect(markup).not.toContain("CANCEL_ACTION");
  });

  it("does not show a cancelled registration in the active cancellation lookup or offer history actions", async () => {
    mocks.requirePermission.mockResolvedValueOnce({
      id: "super-admin-profile-1",
      role: "SUPER_ADMIN",
      is_active: true,
    });
    const markup = await renderCancellationPage({
      registrationId: "AKKAI26-000002",
      historyQuery: "AKKAI26-000002",
    });

    expect(markup).toContain("Peserta aktif dengan Registration ID tersebut tidak ditemukan");
    expect(markup).not.toContain("PESERTA DITEMUKAN");
    expect(markup).toContain("Peserta Batal Satu");
    expect(markup).not.toContain("RESTORE_ACTION");
    expect(markup).not.toContain("CANCEL_ACTION");
  });
});
