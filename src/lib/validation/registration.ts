import { z } from "zod";

import { participantEmailSchema } from "./email";

export const PARTICIPANT_CATEGORIES = [
  "Anggota AKKAI",
  "Pengurus AKKAI",
  "Narasumber",
  "Tamu Undangan",
  "Panitia",
  "Lainnya",
] as const;

export type ParticipantCategory = (typeof PARTICIPANT_CATEGORIES)[number];

export const MEMBER_CATEGORIES = new Set<ParticipantCategory>([
  "Anggota AKKAI",
  "Pengurus AKKAI",
]);

export type RegistrationField =
  | "full_name"
  | "email"
  | "phone_number"
  | "institution"
  | "participant_category"
  | "member_number"
  | "privacy_consent";

export type RegistrationFormValues = {
  full_name: string;
  email: string;
  phone_number: string;
  institution: string;
  participant_category: string;
  member_number: string;
  privacy_consent: boolean;
};

const requiredMessages = {
  full_name: "Nama lengkap wajib diisi.",
  email: "Email wajib diisi.",
  phone_number: "Nomor WhatsApp wajib diisi.",
  institution: "Institusi atau cabang wajib diisi.",
  participant_category: "Pilih kategori peserta.",
  member_number: "Nomor anggota wajib diisi.",
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
    institution: z
      .string()
      .trim()
      .min(2, requiredMessages.institution)
      .max(150, requiredMessages.institution),
    participant_category: z.string(),
    member_number: z.string().trim(),
    privacy_consent: z
      .boolean()
      .refine((value) => value, requiredMessages.privacy_consent),
  })
  .superRefine((data, context) => {
    if (!PARTICIPANT_CATEGORIES.includes(data.participant_category as ParticipantCategory)) {
      context.addIssue({
        code: "custom",
        path: ["participant_category"],
        message: requiredMessages.participant_category,
      });
      return;
    }

    if (MEMBER_CATEGORIES.has(data.participant_category as ParticipantCategory)) {
      if (
        data.member_number.length < 3 ||
        data.member_number.length > 50
      ) {
        context.addIssue({
          code: "custom",
          path: ["member_number"],
          message: requiredMessages.member_number,
        });
      }
    }
  })
  .transform((data) => ({
    ...data,
    participant_category: data.participant_category as ParticipantCategory,
    member_number: MEMBER_CATEGORIES.has(
      data.participant_category as ParticipantCategory,
    )
      ? data.member_number.toUpperCase()
      : null,
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
