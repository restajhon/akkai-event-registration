import { describe, expect, it } from "vitest";

import { REGISTRATION_PACKAGE_PRICES } from "@/lib/billing/pricing";
import {
  hasExpectedRegistrationCertificateSignature,
  REGISTRATION_CERTIFICATE_MAX_FILE_SIZE,
  validateRegistrationCertificateMetadata,
} from "@/lib/registration/certificate";
import {
  ACTUARIAL_CONSULTANT_STATUSES,
  PACKAGE_TYPES,
  PARTICIPATION_SCOPES,
  POLO_SIZES,
  POLO_MODELS,
  registrationSchema,
} from "@/lib/validation/registration";

const baseValues = {
  full_name: "Peserta AKKAI",
  email: "peserta@example.com",
  phone_number: "081234567890",
  kka_name: "KKA Maju",
  position: "Konsultan",
  polo_size: "L",
  polo_model: "Lengan Panjang",
  package_type: "Twin Share",
  participation_scope: "Seluruh acara",
  actuarial_consultant_status: "Penerima Grandfathering CIAC",
  attends_pai_congress: "true",
  privacy_consent: true,
  certificate_file: null,
  certificate_upload_id: "",
};

describe("registration form contract", () => {
  it("uses the requested public options and existing package prices", () => {
    expect(PACKAGE_TYPES).toEqual(["Twin Share", "Single"]);
    expect(PARTICIPATION_SCOPES).toEqual([
      "Seluruh acara",
      "Rapat Anggota AKKAI 2026",
      "Seminar Profesi Konsultan Aktuaria",
    ]);
    expect(ACTUARIAL_CONSULTANT_STATUSES).toEqual([
      "Peserta Baru",
      "Penerima Grandfathering CIAC",
    ]);
    expect(POLO_SIZES).toEqual(["S", "M", "L", "XL", "XXL", "XXXL", "XXXXL"]);
    expect(POLO_MODELS).toEqual(["Lengan Panjang", "Lengan Pendek"]);
    expect(REGISTRATION_PACKAGE_PRICES).toEqual({ "Twin Share": 6_000_000, Single: 7_000_000 });
  });

  it("does not require a certificate for grandfathering", () => {
    expect(registrationSchema.safeParse(baseValues).success).toBe(true);
  });

  it("accepts a blank or explicit null CIAC status and normalizes it to null", () => {
    const blank = registrationSchema.safeParse({
      ...baseValues,
      actuarial_consultant_status: "",
    });
    const explicitNull = registrationSchema.safeParse({
      ...baseValues,
      actuarial_consultant_status: null,
    });
    expect(blank.success && blank.data.actuarial_consultant_status).toBeNull();
    expect(explicitNull.success && explicitNull.data.actuarial_consultant_status).toBeNull();
  });

  it("preserves a selected CIAC status", () => {
    const result = registrationSchema.safeParse(baseValues);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.actuarial_consultant_status).toBe("Penerima Grandfathering CIAC");
    }
  });

  it("accepts separate participants that share one valid email address", () => {
    const first = registrationSchema.safeParse({ ...baseValues, full_name: "Peserta Pertama" });
    const second = registrationSchema.safeParse({ ...baseValues, full_name: "Peserta Kedua" });
    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
  });

  it("requires a certificate upload intent for a new participant", () => {
    const result = registrationSchema.safeParse({
      ...baseValues,
      actuarial_consultant_status: "Peserta Baru",
    });
    if (result.success) throw new Error("Peserta Baru must require a certificate");
    expect(result.error.issues.some((issue) => issue.path[0] === "certificate_file")).toBe(true);
  });
});

describe("registration certificate validation", () => {
  const validPdf = {
    file_name: "surat-kerja.pdf",
    file_type: "application/pdf",
    file_size: 100,
  };

  it("rejects files over 2 MiB", () => {
    expect(
      validateRegistrationCertificateMetadata({
        ...validPdf,
        file_size: REGISTRATION_CERTIFICATE_MAX_FILE_SIZE + 1,
      }),
    ).toContain("2 MiB");
  });

  it("rejects invalid extension and MIME combinations", () => {
    expect(
      validateRegistrationCertificateMetadata({
        ...validPdf,
        file_name: "surat-kerja.exe",
      }),
    ).toContain("PDF");
    expect(
      validateRegistrationCertificateMetadata({
        ...validPdf,
        file_type: "image/png",
      }),
    ).toContain("tidak sesuai");
  });

  it("checks file signatures instead of trusting MIME metadata", () => {
    expect(hasExpectedRegistrationCertificateSignature("pdf", new TextEncoder().encode("%PDF-1.7"))).toBe(true);
    expect(hasExpectedRegistrationCertificateSignature("pdf", new TextEncoder().encode("not a pdf"))).toBe(false);
    expect(hasExpectedRegistrationCertificateSignature("png", Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(true);
    expect(hasExpectedRegistrationCertificateSignature("jpg", Uint8Array.from([0xff, 0xd8, 0xff]))).toBe(true);
  });
});
