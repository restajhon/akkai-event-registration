import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({ default: "a" }));
vi.mock("@/app/admin/(protected)/(admin-shell)/participants/actions", () => ({
  resendRegistrationQr: vi.fn(),
  updateParticipantData: vi.fn(),
}));
vi.mock("@/app/admin/(protected)/(admin-shell)/participants/search-actions", () => ({
  searchParticipants: vi.fn(),
}));

import { ParticipantList } from "@/app/admin/(protected)/(admin-shell)/participants/participant-list";
import { ParticipantEditForm } from "@/app/admin/(protected)/(admin-shell)/participants/participant-edit-form";

const initialData = {
  participants: [{
    registrationId: "AKKAI26-000001",
    fullName: "Peserta Uji",
    email: "peserta@example.com",
    sharedEmailCount: 1,
    phoneNumber: "081234567890",
    packageType: "Single",
    participationScope: "Seluruh acara",
    actuarialConsultantStatus: null,
    attendsPaiCongress: null,
    billingStatus: "UNPAID" as const,
    registrationStatus: "REGISTERED" as const,
    emailStatus: "SENT" as const,
    batchCode: "BATCH-001",
    createdAt: "2026-09-19T08:00:00Z",
    arrival: { checkedIn: false, checkedInAt: null },
    seminar: { checkedIn: false, checkedInAt: null },
    day3: { checkedIn: false, checkedInAt: null },
  }],
  summary: { registered: 1, cancelled: 0, emailFailed: 0, paid: 0, unpaid: 1 },
  totalCount: 1,
  page: 1,
  totalPages: 1,
  query: "",
  billingStatus: "all" as const,
  batchCode: "BATCH-001",
  batchOptions: ["BATCH-001"],
};

describe("participant list actions", () => {
  it("retains edit, resend, ticket, batch ZIP, and export actions", () => {
    const markup = renderToStaticMarkup(
      <ParticipantList
        actionVisibility={{
          canDownloadTicket: true,
          canEdit: true,
          canExport: true,
          canResendEmail: true,
          canUpdateBilling: true,
        }}
        initialData={initialData}
      />,
    );

    expect(markup).toContain("Download Excel");
    expect(markup).toContain("Download QR/Tiket Terpilih");
    expect(markup).toContain("Download Tiket Batch");
    expect(markup).toContain("Edit Data");
    expect(markup).toContain("Download QR/Tiket");
    expect(markup).toContain("Kirim Ulang Email Registrasi");
  });

  it("does not render sensitive controls when visibility is denied", () => {
    const markup = renderToStaticMarkup(
      <ParticipantList
        actionVisibility={{
          canDownloadTicket: false,
          canEdit: false,
          canExport: false,
          canResendEmail: false,
          canUpdateBilling: false,
        }}
        initialData={initialData}
      />,
    );

    expect(markup).not.toContain("Download Excel");
    expect(markup).not.toContain("Download QR/Tiket Terpilih");
    expect(markup).not.toContain("Download Tiket Batch");
    expect(markup).not.toContain("Download QR/Tiket");
    expect(markup).not.toContain("Edit Data");
    expect(markup).not.toContain("Kirim Ulang Email Registrasi");
  });

  it("renders participant data as disabled read-only fields without a submit form", () => {
    const markup = renderToStaticMarkup(
      <ParticipantEditForm
        canEdit={false}
        participant={{
          registration_id: "AKKAI26-000001",
          email: "peserta@example.com",
          email_generation: 0,
          full_name: "Peserta Uji",
          phone_number: "081234567890",
          member_number: null,
          institution: null,
          position: "Konsultan",
          kka_name: "KKA Maju",
          package_type: "Single",
          participation_scope: "Seluruh acara",
          polo_size: "L",
          polo_model: "Lengan Panjang",
          actuarial_consultant_status: "Peserta Baru",
          attends_pai_congress: true,
        }}
        travel={null}
      />,
    );

    expect(markup).toContain("Data Peserta (Hanya Baca)");
    expect(markup).toContain('value="Peserta Uji"');
    expect(markup).toContain("disabled=\"\"");
    expect(markup).not.toContain("<form");
    expect(markup).not.toContain("Simpan Perubahan");
  });
});
