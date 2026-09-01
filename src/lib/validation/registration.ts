import { z } from "zod";

import { participantEmailSchema } from "./email";

export const POLO_SIZES = ["S", "M", "L", "XL", "XXL", "XXXL"] as const;

export const POLO_MODELS = ["Lengan Panjang", "Lengan Pendek"] as const;

export type PoloSize = (typeof POLO_SIZES)[number];
export type PoloModel = (typeof POLO_MODELS)[number];

export type RegistrationField =
  | "full_name"
  | "email"
  | "phone_number"
  | "kka_name"
  | "participant_category"
  | "member_number"
  | "polo_size"
  | "polo_model"
  | "privacy_consent";

export type RegistrationFormValues = {
  full_name: string;
  email: string;
  phone_number: string;
  kka_name: string;
  participant_category: string;
  member_number: string;
  polo_size: string;
  polo_model: string;
  privacy_consent: boolean;
};

const requiredMessages = {
  full_name: "Nama lengkap wajib diisi.",
  email: "Email wajib diisi.",
  phone_number: "Nomor WhatsApp wajib diisi.",
  kka_name: "Nama KKA wajib diisi.",
  participant_category: "Kategori peserta wajib diisi.",
  member_number: "Nomor anggota harus terdiri dari 3-50 karakter bila diisi.",
  polo_size: "Ukuran Poloshirt wajib dipilih.",
  polo_model: "Model Poloshirt wajib dipilih.",
  privacy_consent: "Persetujuan penggunaan data wajib diberikan.",
} as const;

export const registrationSchema = z
  .object({
    full_name: z
      .string()
      .trim()
      .min(3, requiredMessages.full_name)
      .max(100, requiredMessages.full_name),
    email: participantEmailSchema,
    phone_number: z.string().trim().min(1, requiredMessages.phone_number),
    kka_name: z
      .string()
      .trim()
      .min(1, requiredMessages.kka_name)
      .max(150, requiredMessages.kka_name),
    participant_category: z
      .string()
      .trim()
      .min(1, requiredMessages.participant_category)
      .max(100, requiredMessages.participant_category),
    member_number: z
      .string()
      .trim()
      .refine(
        (value) => value === "" || (value.length >= 3 && value.length <= 50),
        requiredMessages.member_number,
      ),
    polo_size: z.enum(POLO_SIZES, { error: requiredMessages.polo_size }),
    polo_model: z.enum(POLO_MODELS, { error: requiredMessages.polo_model }),
    privacy_consent: z
      .boolean()
      .refine((value) => value, requiredMessages.privacy_consent),
  })
  .transform((data) => ({
    ...data,
    member_number:
      data.member_number === "" ? null : data.member_number.toUpperCase(),
  }));

export type NormalizedRegistrationData = z.output<typeof registrationSchema>;

export type RegistrationFieldErrors = Partial<
  Record<RegistrationField, string>
>;

export function getRegistrationFieldErrors(
  error: z.ZodError,
): RegistrationFieldErrors {
  const fieldErrors: RegistrationFieldErrors = {};

  for (const issue of error.issues) {
    const field = issue.path[0];

    if (
      typeof field === "string" &&
      field in requiredMessages &&
      !fieldErrors[field as RegistrationField]
    ) {
      fieldErrors[field as RegistrationField] = issue.message;
    }
  }

  return fieldErrors;
}
