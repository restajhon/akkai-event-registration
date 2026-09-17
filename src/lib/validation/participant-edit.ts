import { z } from "zod";

import {
  ACTUARIAL_CONSULTANT_STATUSES,
  PACKAGE_TYPES,
  PARTICIPATION_SCOPES,
  POLO_MODELS,
  POLO_SIZES,
} from "./registration";
import { participantEmailSchema } from "./email";

const optionalText = (max: number, min = 0) => z.string().trim().max(max).refine((value) => value.length === 0 || value.length >= min, `Minimal ${min} karakter.`);

export const participantEditSchema = z.object({
  registrationId: z.string().regex(/^AKKAI26-[0-9]{6}$/),
  emailGeneration: z.coerce.number().int().min(0),
  full_name: z.string().trim().min(3).max(100),
  email: participantEmailSchema,
  phone_number: z.string().trim().min(1),
  member_number: optionalText(50, 3),
  institution: optionalText(150, 2),
  position: optionalText(100, 1),
  kka_name: z.string().trim().min(1, "Nama KKA wajib diisi.").max(150),
  package_type: z.enum(PACKAGE_TYPES),
  participation_scope: z.enum(PARTICIPATION_SCOPES),
  polo_size: z.enum(POLO_SIZES),
  polo_model: z.enum(POLO_MODELS),
  actuarial_consultant_status: z.enum(ACTUARIAL_CONSULTANT_STATUSES),
  attends_pai_congress: z.enum(["true", "false"]).transform((value) => value === "true"),
  outbound_date: z.string().trim(),
  outbound_time: z.string().trim(),
  outbound_transport_mode: optionalText(50, 1),
  outbound_transport_number: optionalText(100),
  outbound_origin: optionalText(150, 1),
  outbound_destination: optionalText(150, 1),
  return_date: z.string().trim(),
  return_time: z.string().trim(),
  return_transport_mode: optionalText(50, 1),
  return_transport_number: optionalText(100),
  return_destination: optionalText(150, 1),
  extend_stay: z.enum(["true", "false"]).transform((value) => value === "true"),
});

export const participantEditDataSchema = participantEditSchema.superRefine((data, context) => {
  const travelValues = [
    data.outbound_date,
    data.outbound_time,
    data.outbound_transport_mode,
    data.outbound_transport_number,
    data.outbound_origin,
    data.outbound_destination,
    data.return_date,
    data.return_time,
    data.return_transport_mode,
    data.return_transport_number,
    data.return_destination,
  ];
  if (travelValues.some(Boolean)) {
    const requiredTravelFields = [
      ["outbound_date", data.outbound_date],
      ["outbound_time", data.outbound_time],
      ["outbound_transport_mode", data.outbound_transport_mode],
      ["outbound_origin", data.outbound_origin],
      ["outbound_destination", data.outbound_destination],
      ["return_date", data.return_date],
      ["return_time", data.return_time],
      ["return_transport_mode", data.return_transport_mode],
      ["return_destination", data.return_destination],
    ] as const;
    for (const [field, value] of requiredTravelFields) {
      if (!value) context.addIssue({ code: "custom", path: [field], message: "Lengkapi seluruh data travel atau kosongkan semuanya." });
    }
    if (data.return_date && data.outbound_date && data.return_date < data.outbound_date) {
      context.addIssue({ code: "custom", path: ["return_date"], message: "Tanggal kepulangan tidak boleh sebelum keberangkatan." });
    }
  }
});

export type ParticipantEditData = z.output<typeof participantEditDataSchema>;
