import { z } from "zod";

import {
  ACTUARIAL_CONSULTANT_STATUSES,
  PACKAGE_TYPES,
  PARTICIPATION_SCOPES,
  PAI_CONGRESS_OPTIONS,
  POLO_MODELS,
  POLO_SIZES,
} from "@/lib/validation/registration";

export const REGISTRATION_FIELD_TYPES = [
  "text",
  "email",
  "tel",
  "number",
  "textarea",
  "date",
  "select",
  "radio",
  "checkbox",
  "file",
] as const;

export const FORM_BUILDER_FIELD_TYPES = REGISTRATION_FIELD_TYPES.filter(
  (type) => type !== "file",
);

const plainText = (value: string) => !/[<>]/.test(value) && !/javascript\s*:/i.test(value);
const optionSchema = z.string().trim().min(1).max(100).refine(plainText, "Opsi hanya boleh berupa teks biasa.");

const formSectionSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_-]{0,39}$/),
  title: z.string().trim().min(1).max(120).refine(plainText, "Judul bagian hanya boleh berupa teks biasa."),
  description: z.string().trim().max(500).refine(plainText, "Instruksi bagian hanya boleh berupa teks biasa.").optional(),
  position: z.number().int().min(0).max(1000),
}).strict();

const formFieldSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_-]{0,59}$/),
  key: z.string().regex(/^[a-z][a-z0-9_]{0,59}$/),
  type: z.enum(REGISTRATION_FIELD_TYPES),
  label: z.string().trim().min(1).max(160).refine(plainText, "Label hanya boleh berupa teks biasa."),
  placeholder: z.string().max(200).refine(plainText, "Placeholder hanya boleh berupa teks biasa.").optional(),
  required: z.boolean(),
  options: z.array(optionSchema).max(30).optional(),
  sectionId: z.string().regex(/^[a-z][a-z0-9_-]{0,39}$/),
  position: z.number().int().min(0).max(1000),
  system: z.boolean().optional(),
}).strict().superRefine((field, context) => {
  if ((field.type === "select" || field.type === "radio") && (!field.options || field.options.length === 0)) {
    context.addIssue({ code: "custom", path: ["options"], message: "Field select/radio harus memiliki opsi." });
  }
  if (field.options && new Set(field.options).size !== field.options.length) {
    context.addIssue({ code: "custom", path: ["options"], message: "Opsi tidak boleh duplikat." });
  }
  if (field.type === "file" && (field.system !== true || field.key !== "certificate_file")) {
    context.addIssue({ code: "custom", path: ["type"], message: "Upload hanya tersedia untuk field sertifikat inti AKKAI." });
  }
});

export const registrationFormConfigSchema = z.object({
  schemaVersion: z.literal(1),
  title: z.string().trim().min(1).max(200).refine(plainText, "Judul formulir hanya boleh berupa teks biasa."),
  instructions: z.string().trim().max(2000).refine(plainText, "Instruksi hanya boleh berupa teks biasa."),
  sections: z.array(formSectionSchema).min(1).max(30),
  fields: z.array(formFieldSchema).max(100),
}).strict().superRefine((config, context) => {
  const sectionIds = new Set<string>();
  for (const section of config.sections) {
    if (sectionIds.has(section.id)) {
      context.addIssue({ code: "custom", path: ["sections"], message: "ID bagian harus unik." });
    }
    sectionIds.add(section.id);
  }

  const fieldIds = new Set<string>();
  const fieldKeys = new Set<string>();
  for (const field of config.fields) {
    if (fieldIds.has(field.id) || fieldKeys.has(field.key)) {
      context.addIssue({ code: "custom", path: ["fields"], message: "ID dan key field harus unik." });
    }
    if (!sectionIds.has(field.sectionId)) {
      context.addIssue({ code: "custom", path: ["fields"], message: `Bagian untuk field ${field.label} tidak ditemukan.` });
    }
    fieldIds.add(field.id);
    fieldKeys.add(field.key);
  }
});

export type RegistrationFormConfig = z.infer<typeof registrationFormConfigSchema>;
export type RegistrationFormField = RegistrationFormConfig["fields"][number];
export type RegistrationFormFieldType = RegistrationFormField["type"];

const coreFieldContract: Record<
  string,
  { type: RegistrationFormFieldType; required: boolean; options?: readonly string[] }
> = {
  full_name: { type: "text", required: true },
  kka_name: { type: "text", required: true },
  position: { type: "text", required: true },
  phone_number: { type: "tel", required: true },
  email: { type: "email", required: true },
  package_type: { type: "select", required: true, options: PACKAGE_TYPES },
  polo_size: { type: "select", required: true, options: POLO_SIZES },
  polo_model: { type: "select", required: true, options: POLO_MODELS },
  participation_scope: { type: "select", required: true, options: PARTICIPATION_SCOPES },
  actuarial_consultant_status: { type: "select", required: false, options: ACTUARIAL_CONSULTANT_STATUSES },
  attends_pai_congress: { type: "select", required: true, options: PAI_CONGRESS_OPTIONS },
  privacy_consent: { type: "checkbox", required: true },
  certificate_file: { type: "file", required: false },
};

export const CORE_REGISTRATION_FIELD_KEYS = Object.keys(coreFieldContract);

/**
 * Form configuration is data only. Core AKKAI fields remain present and keep
 * the types, options, and required rules expected by registration/billing.
 */
export function validateRegistrationFormConfig(input: unknown) {
  const parsed = registrationFormConfigSchema.safeParse(input);
  if (!parsed.success) return parsed;

  const fieldsByKey = new Map(parsed.data.fields.map((field) => [field.key, field]));
  const customIssues: string[] = [];
  for (const [key, contract] of Object.entries(coreFieldContract)) {
    const field = fieldsByKey.get(key);
    if (
      !field ||
      field.id !== key ||
      field.system !== true ||
      field.type !== contract.type ||
      field.required !== contract.required ||
      (contract.options && JSON.stringify(field.options) !== JSON.stringify(contract.options))
    ) {
      customIssues.push(`Field inti ${key} harus tetap tersedia sesuai alur AKKAI.`);
    }
  }
  for (const field of parsed.data.fields) {
    if (field.system === true && !Object.hasOwn(coreFieldContract, field.key)) {
      customIssues.push(`Field sistem ${field.key} tidak dikenali.`);
    }
    if (field.type === "file" && field.system !== true) {
      customIssues.push("Field upload hanya tersedia untuk dokumen CIAC inti AKKAI.");
    }
  }

  if (customIssues.length > 0) {
    return {
      success: false as const,
      error: new z.ZodError(customIssues.map((message) => ({
        code: "custom" as const,
        path: ["fields"],
        message,
      }))),
    };
  }
  return parsed;
}

export function validateRegistrationFormAnswers(
  config: RegistrationFormConfig,
  input: unknown,
): { success: true; data: Record<string, string | number | boolean> } | {
  success: false;
  errors: Record<string, string>;
} {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { success: false, errors: { _form: "Jawaban formulir tidak valid." } };
  }

  const answers = input as Record<string, unknown>;
  const fields = config.fields.filter((field) => field.type !== "file");
  const allowed = new Set(fields.map((field) => field.key));
  const errors: Record<string, string> = {};

  for (const key of Object.keys(answers)) {
    if (!allowed.has(key)) errors[key] = "Field tidak dikenal pada versi formulir ini.";
  }

  const output: Record<string, string | number | boolean> = {};
  for (const field of fields) {
    const value = answers[field.key];
    const empty = value === undefined || value === null || value === "";
    if (field.required && (empty || (field.type === "checkbox" && value !== true))) {
      errors[field.key] ??= `${field.label} wajib diisi.`;
      continue;
    }
    if (empty && !field.required) continue;

    if (field.type === "checkbox") {
      if (typeof value !== "boolean") errors[field.key] ??= `${field.label} harus berupa pilihan ya/tidak.`;
      else output[field.key] = value;
      continue;
    }
    if (field.type === "number") {
      if (typeof value !== "number" || !Number.isFinite(value)) errors[field.key] ??= `${field.label} harus berupa angka.`;
      else output[field.key] = value;
      continue;
    }
    if (typeof value !== "string") {
      errors[field.key] ??= `${field.label} tidak valid.`;
      continue;
    }

    const normalized = value.trim();
    if (normalized.length > 2000) {
      errors[field.key] ??= `${field.label} terlalu panjang.`;
      continue;
    }
    if (field.type === "email" && !z.string().email().safeParse(normalized).success) {
      errors[field.key] ??= `Format ${field.label} tidak valid.`;
      continue;
    }
    if (field.type === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      errors[field.key] ??= `Format ${field.label} tidak valid.`;
      continue;
    }
    if ((field.type === "select" || field.type === "radio") && !field.options?.includes(normalized)) {
      errors[field.key] ??= `Pilih opsi ${field.label} yang tersedia.`;
      continue;
    }
    output[field.key] = normalized;
  }

  return Object.keys(errors).length > 0
    ? { success: false, errors }
    : { success: true, data: output };
}
