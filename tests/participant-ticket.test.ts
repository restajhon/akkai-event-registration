import { inflateRawSync } from "node:zlib";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createParticipantTicketPdf, participantTicketFileName } from "@/lib/registration/participant-ticket";
import { createZip } from "@/lib/registration/zip";

const ticket = (registrationId: string, fullName: string, qrToken: string) => ({
  fullName,
  registrationId,
  email: "admin@example.com",
  phoneNumber: "081234567890",
  kkaName: "KKA Maju",
  packageType: "Twin Share",
  participationScope: "Seluruh acara",
  actuarialConsultantStatus: "Penerima Grandfathering CIAC",
  attendsPaiCongress: true,
  billingNumber: `INV-${registrationId}`,
  billingAmount: 6_000_000,
  paymentStatus: "UNPAID" as const,
  qrToken,
});

function readZipEntry(zip: Buffer) {
  const nameLength = zip.readUInt16LE(26);
  const extraLength = zip.readUInt16LE(28);
  const compressedSize = zip.readUInt32LE(18);
  const name = zip.subarray(30, 30 + nameLength).toString("utf8");
  const start = 30 + nameLength + extraLength;
  return { name, content: inflateRawSync(zip.subarray(start, start + compressedSize)) };
}

describe("participant ticket files", () => {
  it("creates a participant-specific PDF without exposing the raw QR token", () => {
    const qrToken = "a".repeat(64);
    const pdf = createParticipantTicketPdf(ticket("AKKAI26-000048", "Nyuluh Budi Santoso", qrToken));
    const text = pdf.toString("utf8");
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("(AKKAI26-000048)");
    expect(text).toContain("(Nyuluh Budi Santoso)");
    expect(text).not.toContain(qrToken);
    expect(participantTicketFileName("AKKAI26-000048", "Nyuluh Budi Santoso")).toBe("AKKAI26-000048_Nyuluh_Budi_Santoso.pdf");
  });

  it("keeps selected participant tickets separate in a ZIP", () => {
    const first = createParticipantTicketPdf(ticket("AKKAI26-000048", "Nyuluh Budi Santoso", "a".repeat(64)));
    const second = createParticipantTicketPdf(ticket("AKKAI26-000049", "Siti Aminah", "b".repeat(64)));
    const zip = createZip([
      { name: "AKKAI26-000048_Nyuluh_Budi_Santoso.pdf", content: first },
      { name: "AKKAI26-000049_Siti_Aminah.pdf", content: second },
    ]);
    const firstEntry = readZipEntry(zip);
    const secondOffset = zip.indexOf(Buffer.from("PK\x03\x04"), 1);
    const secondEntry = readZipEntry(zip.subarray(secondOffset));
    expect(firstEntry.name).toContain("000048");
    expect(firstEntry.content.toString("utf8")).toContain("(AKKAI26-000048)");
    expect(secondEntry.name).toContain("000049");
    expect(secondEntry.content.toString("utf8")).toContain("(AKKAI26-000049)");
    expect(secondEntry.content.toString("utf8")).not.toContain("(AKKAI26-000048)");
  });
});
