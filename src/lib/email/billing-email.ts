import "server-only";

import { Resend } from "resend";

import {
  getRegistrationDiagnosticError,
  type RegistrationDiagnosticDetails,
} from "@/lib/registration/diagnostics";
import {
  createBillingEmailTemplate,
  type BillingEmailTemplateInput,
} from "./billing-email-template";

export type BillingEmailResult =
  | { success: true; providerMessageId: string }
  | {
      success: false;
      errorMessage: string;
      diagnostic: RegistrationDiagnosticDetails;
    };

export async function sendBillingEmail(
  input: BillingEmailTemplateInput & {
    recipientEmail: string;
    idempotencyKey: string;
  },
): Promise<BillingEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !fromEmail) {
    const diagnostic = getRegistrationDiagnosticError(
      new Error("email provider is not configured"),
      "resend",
    );
    return {
      success: false,
      errorMessage: "CONFIGURATION_ERROR",
      diagnostic,
    };
  }

  try {
    const template = createBillingEmailTemplate(input);
    const { data, error } = await new Resend(apiKey).emails.send(
      {
        from: fromEmail,
        to: input.recipientEmail,
        subject: template.subject,
        html: template.html,
        text: template.text,
      },
      { idempotencyKey: input.idempotencyKey },
    );

    if (error || !data?.id) {
      const diagnostic = getRegistrationDiagnosticError({ data, error }, "resend");
      return {
        success: false,
        errorMessage: diagnostic.message,
        diagnostic,
      };
    }

    return { success: true, providerMessageId: data.id };
  } catch (error) {
    const diagnostic = getRegistrationDiagnosticError(error, "resend");
    return {
      success: false,
      errorMessage: diagnostic.message,
      diagnostic,
    };
  }
}
