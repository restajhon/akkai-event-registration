import { describe, expect, it } from "vitest";

import { AKKAI_DEFAULT_REGISTRATION_FORM } from "@/lib/forms/akkai-default-form";
import {
  validateRegistrationFormAnswers,
  validateRegistrationFormConfig,
} from "@/lib/forms/form-schema";

describe("published registration form schema", () => {
  it("accepts the AKKAI form seed and versioned custom fields", () => {
    const config = structuredClone(AKKAI_DEFAULT_REGISTRATION_FORM);
    config.fields.push({
      id: "dietary-needs",
      key: "dietary_needs",
      type: "select",
      label: "Kebutuhan konsumsi",
      placeholder: "Pilih kebutuhan",
      required: true,
      options: ["Tidak ada", "Vegetarian"],
      sectionId: "identitas",
      position: 6,
    });

    expect(validateRegistrationFormConfig(config).success).toBe(true);
    expect(validateRegistrationFormAnswers(config, {
      full_name: "Peserta Uji",
      email: "peserta@example.com",
      phone_number: "081234567890",
      kka_name: "KKA Uji",
      position: "Konsultan",
      polo_size: "L",
      polo_model: "Lengan Panjang",
      package_type: "Twin Share",
      participation_scope: "Seluruh acara",
      actuarial_consultant_status: "",
      attends_pai_congress: "false",
      privacy_consent: true,
      dietary_needs: "Vegetarian",
    })).toMatchObject({ success: true });
  });

  it("rejects HTML, JavaScript-like text, arbitrary field types, and extra answer keys", () => {
    const htmlConfig = structuredClone(AKKAI_DEFAULT_REGISTRATION_FORM);
    htmlConfig.fields[0].label = "<script>alert(1)</script>";
    expect(validateRegistrationFormConfig(htmlConfig).success).toBe(false);

    const codeConfig = structuredClone(AKKAI_DEFAULT_REGISTRATION_FORM);
    codeConfig.instructions = "javascript:alert(1)";
    expect(validateRegistrationFormConfig(codeConfig).success).toBe(false);

    const unsupportedConfig = structuredClone(AKKAI_DEFAULT_REGISTRATION_FORM) as unknown as Record<string, unknown>;
    const fields = unsupportedConfig.fields as Array<Record<string, unknown>>;
    fields.push({
      id: "free-code",
      key: "free_code",
      type: "javascript",
      label: "Free code",
      required: false,
      sectionId: "identitas",
      position: 6,
    });
    expect(validateRegistrationFormConfig(unsupportedConfig).success).toBe(false);

    const validConfig = validateRegistrationFormConfig(AKKAI_DEFAULT_REGISTRATION_FORM);
    expect(validConfig.success).toBe(true);
    if (validConfig.success) {
      expect(validateRegistrationFormAnswers(validConfig.data, { injected_value: "no" })).toMatchObject({
        success: false,
        errors: { injected_value: expect.any(String) },
      });
    }
  });

  it("validates legacy answers with nullable fields omitted and boolean select values stringified", () => {
    const legacyConfig = structuredClone(AKKAI_DEFAULT_REGISTRATION_FORM);
    legacyConfig.fields = legacyConfig.fields.map((field) => {
      if (field.key === "participation_scope") {
        return {
          ...field,
          required: false,
          options: [
            "Seluruh acara",
            "Rapat Anggota",
            "Rapat Anggota AKKAI 2026",
            "Seminar Profesi Konsultan Aktuaria",
            "Seminar Profesi Konsultan Akruaria",
          ],
        };
      }
      if (field.key === "actuarial_consultant_status") {
        return {
          ...field,
          required: false,
          options: ["Peserta Baru", "Penerima Grandfathering", "Penerima Grandfathering CIAC"],
        };
      }
      return { ...field, required: false };
    });

    const result = validateRegistrationFormAnswers(legacyConfig, {
      full_name: "Legacy participant",
      email: "legacy@example.com",
      phone_number: "081234567890",
      participation_scope: "Rapat Anggota",
      actuarial_consultant_status: "Penerima Grandfathering",
      attends_pai_congress: "false",
    });

    expect(result).toEqual({
      success: true,
      data: {
        full_name: "Legacy participant",
        email: "legacy@example.com",
        phone_number: "081234567890",
        participation_scope: "Rapat Anggota",
        actuarial_consultant_status: "Penerima Grandfathering",
        attends_pai_congress: "false",
      },
    });
  });
});
