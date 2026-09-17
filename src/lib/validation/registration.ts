import { z } from "zod";

import { participantEmailSchema } from "./email";
import {
  validateRegistrationCertificateFile,
} from "@/lib/registration/certificate";

export const POLO_SIZES = ["S", "M", "L", "XL", "XXL", "XXXL", "XXXXL"] as const;
export const POLO_MODELS = ["Lengan Panjang", "Lengan Pendek"] as const;

export const PACKAGE_TYPES = ["Twin Share", "Single"] as const;
export const PARTICIPATION_SCOPES = [
  "Seluruh acara",
  "Rapat Anggota AKKAI 2026",
  "Seminar Profesi Konsultan Aktuaria",
] as const;
export const ACTUARIAL_CONSULTANT_STATUSES = [
  "Peserta Baru",
  "Penerima Grandfathering CIAC",
] as const;
export const PAI_CONGRESS_OPTIONS = ["true", "false"] as const;

export type PoloSize = (typeof POLO_SIZES)[number];
export type PoloModel = (typeof POLO_MODELS)[number];
export type PackageType = (typeof PACKAGE_TYPES)[number];
export type ParticipationScope = (typeof PARTICIPATION_SCOPES)[number];
export type ActuarialConsultantStatus =
  (typeof ACTUARIAL_CONSULTANT_STATUSES)[number];

export type RegistrationField =
  | "full_name"
  | "email"
  | "phone_number"
  | "kka_name"
  | "position"
  | "polo_size"
  | "polo_model"
  | "package_type"
  | "participation_scope"
  | "actuarial_consultant_status"
  | "attends_pai_congress"
  | "privacy_consent"
  | "certificate_file";

export type RegistrationFormValues = {
  full_name: string;
  email: string;
  phone_number: string;
  kka_name: string;
  position: string;
  polo_size: string;
  polo_model: string;
  package_type: string;
  participation_scope: string;
  actuarial_consultant_status: string;
  attends_pai_congress: string;
  privacy_consent: boolean;
  certificate_file: File | null;
  certificate_upload_id: string;
};

export type CollectiveParticipantFormValues = RegistrationFormValues & {
  member_number: string;
  institution: string;
  include_travel: boolean;
  travel: RegistrationTravelValues;
};

export type RegistrationTravelValues = {
  outbound_date: string;
  outbound_time: string;
  outbound_transport_mode: string;
  outbound_transport_number: string;
  outbound_origin: string;
  outbound_destination: string;
  return_date: string;
  return_time: string;
  return_transport_mode: string;
  return_transport_number: string;
  return_destination: string;
  extend_stay: boolean;
};

const requiredMessages = {
  full_name: "Nama lengkap wajib diisi.",
  email: "Email wajib diisi.",
  phone_number: "Nomor WhatsApp wajib diisi.",
  kka_name: "KKA wajib diisi.",
  position: "Jabatan wajib diisi.",
  polo_size: "Ukuran Poloshirt wajib dipilih.",
  polo_model: "Model Poloshirt wajib dipilih.",
  package_type: "Paket yang diambil wajib dipilih.",
  participation_scope: "Mengikuti wajib dipilih.",
  actuarial_consultant_status: "Sertifikasi CIAC wajib dipilih.",
  attends_pai_congress: "Kehadiran Kongres PAI wajib dipilih.",
  privacy_consent: "Persetujuan penggunaan data wajib diberikan.",
  certificate_file: "Upload Surat Keterangan Kerja wajib diisi.",
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
    position: z
      .string()
      .trim()
      .min(1, requiredMessages.position)
      .max(100, requiredMessages.position),
    polo_size: z.enum(POLO_SIZES, { error: requiredMessages.polo_size }),
    polo_model: z.enum(POLO_MODELS, { error: requiredMessages.polo_model }),
    package_type: z.enum(PACKAGE_TYPES, { error: requiredMessages.package_type }),
    participation_scope: z.enum(PARTICIPATION_SCOPES, {
      error: requiredMessages.participation_scope,
    }),
    actuarial_consultant_status: z.enum(ACTUARIAL_CONSULTANT_STATUSES, {
      error: requiredMessages.actuarial_consultant_status,
    }),
    attends_pai_congress: z
      .enum(PAI_CONGRESS_OPTIONS, { error: requiredMessages.attends_pai_congress })
      .transform((value) => value === "true"),
    privacy_consent: z
      .boolean()
      .refine((value) => value, requiredMessages.privacy_consent),
    certificate_file: z.custom<File | null>((value) => value === null || (typeof File !== "undefined" && value instanceof File)),
    certificate_upload_id: z.string(),
  })
  .superRefine((data, context) => {
    if (data.actuarial_consultant_status === "Peserta Baru") {
      if (data.certificate_file) {
        const fileError = validateRegistrationCertificateFile(data.certificate_file);
        if (fileError) {
          context.addIssue({ code: "custom", path: ["certificate_file"], message: fileError });
        }
      } else if (!data.certificate_upload_id) {
        context.addIssue({ code: "custom", path: ["certificate_file"], message: requiredMessages.certificate_file });
      }
    } else if (data.certificate_file || data.certificate_upload_id) {
      context.addIssue({ code: "custom", path: ["certificate_file"], message: "Upload hanya diperlukan untuk Peserta Baru." });
    }
  });

export type NormalizedRegistrationData = z.output<typeof registrationSchema>;

const travelSchema = z.object({
  outbound_date: z.string().trim().min(1, "Tanggal keberangkatan wajib diisi."),
  outbound_time: z.string().trim().min(1, "Waktu keberangkatan wajib diisi."),
  outbound_transport_mode: z.string().trim().min(1, "Moda keberangkatan wajib diisi.").max(50),
  outbound_transport_number: z.string().trim().max(100),
  outbound_origin: z.string().trim().min(1, "Asal keberangkatan wajib diisi.").max(150),
  outbound_destination: z.string().trim().min(1, "Tujuan keberangkatan wajib diisi.").max(150),
  return_date: z.string().trim().min(1, "Tanggal kepulangan wajib diisi."),
  return_time: z.string().trim().min(1, "Waktu kepulangan wajib diisi."),
  return_transport_mode: z.string().trim().min(1, "Moda kepulangan wajib diisi.").max(50),
  return_transport_number: z.string().trim().max(100),
  return_destination: z.string().trim().min(1, "Tujuan kepulangan wajib diisi.").max(150),
  extend_stay: z.boolean(),
});

export const collectiveParticipantSchema = z
  .object({
    ...registrationSchema.shape,
    certificate_file: z.custom<File | null | undefined>(
      (value) => value === undefined || value === null || (typeof File !== "undefined" && value instanceof File),
    ).optional(),
    member_number: z.string().trim().max(50, "Nomor anggota maksimal 50 karakter."),
    institution: z.string().trim().max(150, "Institusi maksimal 150 karakter."),
    include_travel: z.boolean(),
    travel: travelSchema.partial().nullable(),
  })
  .superRefine((data, context) => {
    if (data.actuarial_consultant_status === "Peserta Baru" && !data.certificate_file && !data.certificate_upload_id) {
      context.addIssue({ code: "custom", path: ["certificate_file"], message: requiredMessages.certificate_file });
    }
    if (data.actuarial_consultant_status !== "Peserta Baru" && (data.certificate_file || data.certificate_upload_id)) {
      context.addIssue({ code: "custom", path: ["certificate_file"], message: "Upload hanya diperlukan untuk Peserta Baru." });
    }
    if (data.include_travel) {
      const travelResult = travelSchema.safeParse(data.travel);
      if (!travelResult.success) {
        for (const issue of travelResult.error.issues) {
          context.addIssue({
            ...issue,
            path: ["travel", ...issue.path],
          });
        }
      } else if (travelResult.data.return_date < travelResult.data.outbound_date) {
        context.addIssue({
          code: "custom",
          path: ["travel", "return_date"],
          message: "Tanggal kepulangan tidak boleh sebelum keberangkatan.",
        });
      }
    }
  });

export type NormalizedCollectiveParticipantData = z.output<
  typeof collectiveParticipantSchema
>;

export const collectiveRegistrationPayloadSchema = z.object({
  idempotency_key: z.string().uuid(),
  participants: z.array(collectiveParticipantSchema).min(1).max(100),
});

export type CollectiveParticipantFieldErrors = Partial<
  Record<keyof CollectiveParticipantFormValues | "travel" | `travel.${keyof RegistrationTravelValues}`, string>
>;

export function getCollectiveParticipantFieldErrors(
  error: z.ZodError,
): CollectiveParticipantFieldErrors {
  const fieldErrors: CollectiveParticipantFieldErrors = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && !fieldErrors[field as keyof CollectiveParticipantFormValues]) {
      fieldErrors[field as keyof CollectiveParticipantFormValues] = issue.message;
    }
  }
  return fieldErrors;
}

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
