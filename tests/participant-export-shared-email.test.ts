import * as XLSX from "@e965/xlsx";
import { describe, expect, it } from "vitest";

import { buildParticipantWorkbook, type ParticipantExportRow } from "@/lib/admin/revision-exports";

function exportRow(registrationId: string): ParticipantExportRow {
  return {
    registrationId,
    name: registrationId === "AKKAI26-000048" ? "Nyuluh Budi Santoso" : "Siti Aminah",
    kka: "KKA Maju", position: "Konsultan", phone: "081234567890", email: "admin@example.com",
    memberNumber: "", institution: "", participantCategory: "", packageType: "Twin Share", packagePrice: 6_000_000,
    currency: "IDR", participationScope: "Seluruh acara", ciacCategory: "", poloModel: "Lengan Panjang", poloSize: "L",
    attendsPaiCongress: "Ya", registrationStatus: "REGISTERED", billingNumber: `INV-${registrationId}`, billingStatus: "UNPAID",
    paidAt: "", paidBy: "", certificateStatus: "", certificateFileName: "", certificateMime: "", certificateSize: null,
    certificateCreatedAt: "", arrivalTravelStatus: "", arrivalDate: "", arrivalTime: "", arrivalMode: "", arrivalNumber: "",
    arrivalOrigin: "", arrivalDestination: "", departureTravelStatus: "", departureDate: "", departureTime: "", departureMode: "",
    departureNumber: "", departureDestination: "", extendStay: "", arrivalPickupPoint: "", arrivalPickupPointSource: "",
    arrivalAssignmentStatus: "", arrivalPickupAt: "", arrivalVehicle: "", arrivalDriver: "", arrivalNotes: "", departureDropoffPoint: "",
    departureDropoffPointSource: "", departureAssignmentStatus: "", departurePickupAt: "", departureVehicle: "", departureDriver: "",
    departureNotes: "", arrivalAttendance: { status: "", time: "", method: "", operator: "" },
    seminarAttendance: { status: "", time: "", method: "", operator: "" }, day3Attendance: { status: "", time: "", method: "", operator: "" },
    emailStatus: "SENT", emailLastSentAt: "", latestEmailStatus: "SENT", latestEmailAt: "", billingEmailStatus: "SENT",
    billingEmailSentAt: "", privacyConsentAt: "", createdAt: "", updatedAt: "",
  };
}

describe("participant export with shared email", () => {
  it("keeps one row and unique billing identifiers per participant", () => {
    const workbook = buildParticipantWorkbook([exportRow("AKKAI26-000048"), exportRow("AKKAI26-000049")]);
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets.Peserta, { header: 1 }) as string[][];
    const registrationIds = rows.slice(1).map((row) => row[0]);
    expect(registrationIds).toEqual(["AKKAI26-000048", "AKKAI26-000049"]);
    expect(rows.slice(1).map((row) => row[5])).toEqual(["admin@example.com", "admin@example.com"]);
    expect(JSON.stringify(rows)).not.toContain("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
  });
});
