import { z } from "zod";

import { participantEmailSchema } from "./email";

export const MEMBER_MEETING_ATTENDANCE_TYPES = ["SELF", "PROXY"] as const;
export const MEMBER_MEETING_ALLOWED_EXTENSIONS = [
  "doc",
  "docx",
  "pdf",
  "png",
  "jpg",
  "jpeg",
] as const;
export const MEMBER_MEETING_MAX_FILE_SIZE = 2 * 1024 * 1024;

const authorizationFileSizeMessage = "Ukuran Surat Kuasa maksimal 2 MB.";

const allowedMimeTypes = {
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
} as const;

export type MemberMeetingField =
  | "name"
  | "consulting_firm"
  | "position"
  | "phone"
  | "email"
  | "attendance_type"
  | "proxy_name"
  | "proxy_position"
  | "authorization_file";

export type MemberMeetingFormValues = {
  name: string;
  consulting_firm: string;
  position: string;
  phone: string;
  email: string;
  attendance_type: string;
  proxy_name: string;
  proxy_position: string;
  authorization_file: File | null;
};

export type MemberMeetingUploadMetadata = {
  file_name: string;
  file_type: string;
  file_size: number;
};

const fieldMessages = {
  name: "Nama wajib diisi dan maksimal 100 karakter.",
  consulting_firm:
    "Kantor Konsultan Aktuaria wajib diisi dan maksimal 150 karakter.",
  position: "Jabatan wajib diisi dan maksimal 100 karakter.",
  phone: "No. HP wajib diisi dengan nomor yang valid.",
  email: "Alamat Email wajib diisi dengan format yang benar.",
  attendance_type: "Pilihan kehadiran wajib dipilih.",
  proxy_name: "Nama penerima kuasa wajib diisi dan maksimal 100 karakter.",
  proxy_position:
    "Jabatan penerima kuasa wajib diisi dan maksimal 100 karakter.",
  authorization_file: "Upload Surat Kuasa wajib diisi.",
} as const;

const requiredText = (message: string, max: number) =>
  z.string().trim().min(1, message).max(max, message);

function isFile(value: unknown): value is File {
  return typeof File !== "undefined" && value instanceof File;
}

function getExtension(fileName: string) {
  const extension = fileName.toLowerCase().split(".").pop();
  return extension ?? "";
}

export function validateAuthorizationFileMetadata({
  file_name,
  file_type,
  file_size,
}: MemberMeetingUploadMetadata) {
  if (!file_name.trim() || file_name.length > 255) {
    return "Nama file Surat Kuasa tidak valid.";
  }

  if (!Number.isSafeInteger(file_size) || file_size <= 0) {
    return fieldMessages.authorization_file;
  }

  if (file_size > MEMBER_MEETING_MAX_FILE_SIZE) {
    return authorizationFileSizeMessage;
  }

  const extension = getExtension(file_name);
  if (
    !MEMBER_MEETING_ALLOWED_EXTENSIONS.includes(
      extension as (typeof MEMBER_MEETING_ALLOWED_EXTENSIONS)[number],
    )
  ) {
    return "Format Surat Kuasa harus .doc, .docx, .pdf, .png, .jpg, atau .jpeg.";
  }

  if (
    allowedMimeTypes[extension as keyof typeof allowedMimeTypes] !== file_type
  ) {
    return "Tipe file Surat Kuasa tidak sesuai dengan format file.";
  }

  return null;
}

export function validateAuthorizationFile(file: File | null) {
  if (!file || file.size === 0) {
    return fieldMessages.authorization_file;
  }

  return validateAuthorizationFileMetadata({
    file_name: file.name,
    file_type: file.type,
    file_size: file.size,
  });
}

export const memberMeetingUploadMetadataSchema = z
  .object({
    file_name: z.string().trim().min(1).max(255),
    file_type: z.string().trim().min(1),
    file_size: z
      .number()
      .int()
      .positive()
      .max(MEMBER_MEETING_MAX_FILE_SIZE, authorizationFileSizeMessage),
  })
  .superRefine((data, context) => {
    const fileError = validateAuthorizationFileMetadata(data);
    if (fileError) {
      context.addIssue({
        code: "custom",
        path: ["file_name"],
        message: fileError,
      });
    }
  });

const nullableProxyText = (message: string, max: number) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((value) => (value === "" ? null : value));

const memberMeetingDetailsShape = {
  name: requiredText(fieldMessages.name, 100),
  consulting_firm: requiredText(fieldMessages.consulting_firm, 150),
  position: requiredText(fieldMessages.position, 100),
  phone: z
    .string()
    .trim()
    .min(8, fieldMessages.phone)
    .max(25, fieldMessages.phone)
    .regex(/^[0-9+().\s-]+$/, fieldMessages.phone),
  email: participantEmailSchema,
  attendance_type: z.enum(MEMBER_MEETING_ATTENDANCE_TYPES, {
    error: fieldMessages.attendance_type,
  }),
  proxy_name: nullableProxyText(fieldMessages.proxy_name, 100),
  proxy_position: nullableProxyText(fieldMessages.proxy_position, 100),
};

function validateProxyFields(
  data: {
    attendance_type: "SELF" | "PROXY";
    proxy_name: string | null;
    proxy_position: string | null;
  },
  context: z.RefinementCtx,
) {
  if (data.attendance_type !== "PROXY") {
    return;
  }

  if (!data.proxy_name) {
    context.addIssue({
      code: "custom",
      path: ["proxy_name"],
      message: fieldMessages.proxy_name,
    });
  }

  if (!data.proxy_position) {
    context.addIssue({
      code: "custom",
      path: ["proxy_position"],
      message: fieldMessages.proxy_position,
    });
  }
}

export const memberMeetingDetailsSchema = z
  .object(memberMeetingDetailsShape)
  .superRefine(validateProxyFields);

export const memberMeetingSchema = z
  .object({
    ...memberMeetingDetailsShape,
    authorization_file: z.custom<File | null>(
      (value) => value === null || isFile(value),
      fieldMessages.authorization_file,
    ),
  })
  .superRefine((data, context) => {
    validateProxyFields(data, context);

    if (data.attendance_type === "PROXY") {
      const fileError = validateAuthorizationFile(data.authorization_file);
      if (fileError) {
        context.addIssue({
          code: "custom",
          path: ["authorization_file"],
          message: fileError,
        });
      }
    }
  });

export type NormalizedMemberMeetingData = z.output<typeof memberMeetingSchema>;
export type MemberMeetingFieldErrors = Partial<
  Record<MemberMeetingField, string>
>;

export function getMemberMeetingFieldErrors(
  error: z.ZodError,
): MemberMeetingFieldErrors {
  const fieldErrors: MemberMeetingFieldErrors = {};

  for (const issue of error.issues) {
    const field = issue.path[0];

    if (
      typeof field === "string" &&
      field in fieldMessages &&
      !fieldErrors[field as MemberMeetingField]
    ) {
      fieldErrors[field as MemberMeetingField] = issue.message;
    }
  }

  return fieldErrors;
}

export function getMemberMeetingFileExtension(fileName: string) {
  return getExtension(fileName);
}

export function getMemberMeetingFileMimeType(extension: string) {
  return allowedMimeTypes[extension as keyof typeof allowedMimeTypes];
}

function hasPrefix(bytes: Uint8Array, prefix: number[]) {
  return prefix.every((byte, index) => bytes[index] === byte);
}

export function hasExpectedAuthorizationFileSignature(
  extension: string,
  bytes: Uint8Array,
) {
  switch (extension) {
    case "pdf":
      return new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-";
    case "png":
      return hasPrefix(bytes, [137, 80, 78, 71, 13, 10, 26, 10]);
    case "jpg":
    case "jpeg":
      return hasPrefix(bytes, [255, 216, 255]);
    case "doc":
      return hasPrefix(bytes, [208, 207, 17, 224, 161, 177, 26, 225]);
    case "docx":
      return hasPrefix(bytes, [80, 75, 3, 4]);
    default:
      return false;
  }
}
