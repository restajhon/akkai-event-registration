import { z } from "zod";

export const participantEmailSchema = z
  .string()
  .trim()
  .min(1, "Email wajib diisi.")
  .email("Format email belum sesuai.")
  .transform((value) => value.toLowerCase());

export const emailCorrectionSchema = z
  .object({
    new_email: participantEmailSchema,
    confirm_new_email: participantEmailSchema,
  })
  .superRefine((data, context) => {
    if (data.new_email !== data.confirm_new_email) {
      context.addIssue({
        code: "custom",
        path: ["confirm_new_email"],
        message: "Konfirmasi email harus sama.",
      });
    }
  });

export type EmailCorrectionField = "new_email" | "confirm_new_email";

export function getEmailCorrectionFieldErrors(
  error: z.ZodError,
): Partial<Record<EmailCorrectionField, string>> {
  const fieldErrors: Partial<Record<EmailCorrectionField, string>> = {};

  for (const issue of error.issues) {
    const field = issue.path[0];

    if (
      (field === "new_email" || field === "confirm_new_email") &&
      !fieldErrors[field]
    ) {
      fieldErrors[field] = issue.message;
    }
  }

  return fieldErrors;
}
