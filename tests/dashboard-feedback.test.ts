import { describe, expect, it } from "vitest";
import * as XLSX from "@e965/xlsx";

import { calculateDashboardKpis } from "@/lib/admin/dashboard-kpis";
import { getEffectivePickupPoint } from "@/lib/admin/pickup-mapping";
import { billingStatusLabel } from "@/lib/billing/status";
import { buildParticipantWorkbook } from "@/lib/admin/revision-exports";

const travel = {
  outboundDate: "2026-10-19",
  outboundTime: "10:00:00",
  outboundTransportMode: "Pesawat",
  outboundTransportNumber: "GA-1",
  outboundOrigin: "Jakarta",
  outboundDestination: "Semarang",
  returnDate: "2026-10-21",
  returnTime: "15:00:00",
  returnTransportMode: "Pesawat",
  returnTransportNumber: "GA-2",
  returnDestination: "Bandara Ahmad Yani",
};

describe("dashboard feedback mapping", () => {
  it("maps billing status to the requested badge labels", () => {
    expect(billingStatusLabel("PAID")).toBe("Lunas");
    expect(billingStatusLabel("UNPAID")).toBe("Belum Dibayar");
  });

  it("exports the important participant columns", () => {
    const workbook = buildParticipantWorkbook([]);
    const sheet = workbook.Sheets["Peserta"];
    const headers = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 })[0];

    expect(headers).toEqual(expect.arrayContaining([
      "Registration ID",
      "KKA",
      "Jabatan",
      "Harga Paket",
      "Status Billing",
      "Paid at",
      "Aktor/Admin Pembayaran",
      "Status Surat Keterangan Kerja",
      "Status Travel Arrival",
      "Titik Jemput Arrival",
      "Titik Antar Departure",
      "Attendance SEMINAR",
      "Status Email",
      "Created At",
      "Updated At",
    ]));
  });

  it("uses arrival destination as the default pickup point", () => {
    expect(getEffectivePickupPoint("ARRIVAL", null, travel)).toEqual({
      value: "Semarang",
      source: "TRAVEL",
    });
  });

  it("uses return destination as the departure drop-off point", () => {
    expect(getEffectivePickupPoint("DEPARTURE", null, travel)).toEqual({
      value: "Bandara Ahmad Yani",
      source: "TRAVEL",
    });
  });

  it("does not invent a point when travel is empty", () => {
    expect(getEffectivePickupPoint("ARRIVAL", null, null)).toEqual({
      value: null,
      source: "EMPTY",
    });
  });

  it("preserves a manual assignment over the travel default", () => {
    const assignment = {
      transferType: "ARRIVAL" as const,
      status: "SCHEDULED" as const,
      pickupAt: null,
      pickupPoint: "Lobby Hotel Manual",
      dropoffPoint: null,
      vehicleLabel: null,
      picDriver: null,
      notes: null,
      updatedAt: "2026-10-01T00:00:00Z",
    };

    expect(getEffectivePickupPoint("ARRIVAL", assignment, travel)).toEqual({
      value: "Lobby Hotel Manual",
      source: "MANUAL",
    });
  });

  it("calculates payment, travel, attendance, and distribution KPIs", () => {
    const participants = [
      {
        id: "p1", registrationId: "AKKAI26-000001", fullName: "A", packageType: "Twin Share",
        participationScope: "Seluruh acara", actuarialConsultantStatus: "Peserta Baru",
        poloModel: "Lengan Panjang", poloSize: "L", createdAt: "2026-10-01",
      },
      {
        id: "p2", registrationId: "AKKAI26-000002", fullName: "B", packageType: "Single",
        participationScope: "Rapat Anggota", actuarialConsultantStatus: "Penerima Grandfathering",
        poloModel: "Lengan Pendek", poloSize: "M", createdAt: "2026-10-02",
      },
    ];
    const result = calculateDashboardKpis(
      participants,
      [{ participantId: "p1", paymentStatus: "PAID" }, { participantId: "p2", paymentStatus: "UNPAID" }],
      [{ participantId: "p1", outboundDate: "2026-10-19", outboundTime: "10:00", returnDate: "2026-10-21", returnTime: "15:00" }],
      ["p1"],
      [{ participantId: "p1", sessionCode: "ARRIVAL" }, { participantId: "p2", sessionCode: "SEMINAR" }],
    );

    expect(result.totalParticipants).toBe(2);
    expect(result.paidCount).toBe(1);
    expect(result.unpaidCount).toBe(1);
    expect(result.paymentPercentage).toBe(50);
    expect(result.travel).toEqual({ arrivalComplete: 1, arrivalIncomplete: 1, departureComplete: 1, departureIncomplete: 1 });
    expect(result.certificateCount).toBe(1);
    expect(result.attendanceBySession).toEqual({ ARRIVAL: 1, SEMINAR: 1, DAY3: 0 });
  });
});
