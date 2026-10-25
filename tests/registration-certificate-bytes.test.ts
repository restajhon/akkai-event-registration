import { describe, expect, it } from "vitest";

import { validateRegistrationCertificateBytes } from "@/lib/registration/certificate";

describe("registration certificate byte validation", () => {
  it("accepts bytes whose detected MIME, declared MIME, extension, and size agree", () => {
    const bytes = new TextEncoder().encode("%PDF-1.7\nvalid test fixture");

    expect(validateRegistrationCertificateBytes({
      file_name: "certificate.pdf",
      file_type: "application/pdf",
      file_size: bytes.byteLength,
    }, bytes)).toBe(true);
  });

  it("rejects forged PDF metadata when the actual bytes are not a PDF", () => {
    const bytes = new TextEncoder().encode("<html>not a PDF</html>");

    expect(validateRegistrationCertificateBytes({
      file_name: "certificate.pdf",
      file_type: "application/pdf",
      file_size: bytes.byteLength,
    }, bytes)).toBe(false);
  });

  it("rejects a valid signature when the declared size or MIME is forged", () => {
    const bytes = new TextEncoder().encode("%PDF-1.7\nvalid test fixture");

    expect(validateRegistrationCertificateBytes({
      file_name: "certificate.pdf",
      file_type: "image/jpeg",
      file_size: bytes.byteLength,
    }, bytes)).toBe(false);
    expect(validateRegistrationCertificateBytes({
      file_name: "certificate.pdf",
      file_type: "application/pdf",
      file_size: bytes.byteLength + 1,
    }, bytes)).toBe(false);
  });
});
