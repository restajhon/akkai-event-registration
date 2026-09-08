import "server-only";

import { Resend } from "resend";

import {
  createBillingEmailTemplate,
  type BillingEmailTemplateInput,
} from "./billing-email-template";

export type BillingEmailResult =
  | { success: true; providerMessageId: string }
  | { success: false; errorMessage: string };

export async function sendBillingEmail(
  input: BillingEmailTemplateInput & {
    recipientEmail: string;
    idempotencyKey: string;
  },
): Promise<BillingEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !fromEmail) {
    return { success: false, errorMessage: "CONFIGURATION_ERROR" };
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
      return { success: false, errorMessage: "PROVIDER_ERROR" };
    }

    return { success: true, providerMessageId: data.id };
  } catch {
    return { success: false, errorMessage: "PROVIDER_ERROR" };
  }
}
