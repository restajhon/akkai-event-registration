import { z } from "zod";

import { participantEmailSchema } from "./email";

export type TravelField =
  | "registration_id"
  | "registered_email"
  | "outbound_date"
  | "outbound_time"
  | "outbound_transport_mode"
  | "outbound_transport_number"
  | "outbound_origin"
  | "outbound_destination"
  | "return_date"
  | "return_time"
  | "return_transport_mode"
  | "return_transport_number"
  | "return_destination"
  | "extend_stay";

export type TravelFormValues = {
  registration_id: string;
  registered_email: string;
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
  extend_stay: boolean | undefined;
};

const fieldMessages = {
  registration_id: "Registration ID wajib diisi.",
  registered_email: "Email terdaftar wajib diisi.",
  outbound_date: "Tanggal keberangkatan wajib diisi.",
  outbound_time: "Waktu keberangkatan wajib diisi.",
  outbound_transport_mode: "Moda keberangkatan wajib diisi.",
  outbound_transport_number:
    "Nomor penerbangan atau kereta maksimal 100 karakter.",
  outbound_origin: "Asal keberangkatan wajib diisi.",
  outbound_destination: "Tujuan keberangkatan wajib diisi.",
  return_date: "Tanggal kepulangan wajib diisi.",
  return_time: "Waktu kepulangan wajib diisi.",
  return_transport_mode: "Moda kepulangan wajib diisi.",
  return_transport_number:
    "Nomor penerbangan atau kereta maksimal 100 karakter.",
  return_destination: "Tujuan kepulangan wajib diisi.",
  extend_stay: "Pilihan perpanjangan menginap wajib dipilih.",
} as const;

function isValidCalendarDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

const travelDateSchema = z
  .string()
  .trim()
  .min(1, "Tanggal wajib diisi.")
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal belum sesuai.")
  .refine(isValidCalendarDate, "Tanggal tidak valid.");

const travelTimeSchema = z
  .string()
  .trim()
  .min(1, "Waktu wajib diisi.")
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Format waktu belum sesuai.");

const requiredTravelText = (message: string, max: number) =>
  z.string().trim().min(1, message).max(max, message);

const optionalTransportNumber = z
  .string()
  .trim()
  .max(100, fieldMessages.outbound_transport_number)
  .transform((value) => (value === "" ? null : value));

export const travelSchema = z
  .object({
    registration_id: z
      .string()
      .trim()
      .transform((value) => value.toUpperCase())
      .refine(
        (value) => /^AKKAI26-[0-9]{6}$/.test(value),
        "Format Registration ID belum sesuai.",
      ),
    registered_email: participantEmailSchema,
    outbound_date: travelDateSchema,
    outbound_time: travelTimeSchema,
    outbound_transport_mode: requiredTravelText(
      "Moda keberangkatan wajib diisi dan maksimal 50 karakter.",
      50,
    ),
    outbound_transport_number: optionalTransportNumber,
    outbound_origin: requiredTravelText(
      "Asal keberangkatan wajib diisi dan maksimal 150 karakter.",
      150,
    ),
    outbound_destination: requiredTravelText(
      "Tujuan keberangkatan wajib diisi dan maksimal 150 karakter.",
      150,
    ),
    return_date: travelDateSchema,
    return_time: travelTimeSchema,
    return_transport_mode: requiredTravelText(
      "Moda kepulangan wajib diisi dan maksimal 50 karakter.",
      50,
    ),
    return_transport_number: optionalTransportNumber,
    return_destination: requiredTravelText(
      "Tujuan kepulangan wajib diisi dan maksimal 150 karakter.",
      150,
    ),
    extend_stay: z.boolean({ error: fieldMessages.extend_stay }),
  })
  .superRefine((data, context) => {
    if (data.return_date < data.outbound_date) {
      context.addIssue({
        code: "custom",
        path: ["return_date"],
        message: "Tanggal kepulangan tidak boleh sebelum keberangkatan.",
      });
    }
  });

export type NormalizedTravelData = z.output<typeof travelSchema>;

export type TravelFieldErrors = Partial<Record<TravelField, string>>;

export function getTravelFieldErrors(error: z.ZodError): TravelFieldErrors {
  const fieldErrors: TravelFieldErrors = {};

  for (const issue of error.issues) {
    const field = issue.path[0];

    if (
      typeof field === "string" &&
      field in fieldMessages &&
      !fieldErrors[field as TravelField]
    ) {
      fieldErrors[field as TravelField] = issue.message;
    }
  }

  return fieldErrors;
}
