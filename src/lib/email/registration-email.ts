import "server-only";

import { Resend } from "resend";

import { createRegistrationEmailTemplate } from "./registration-email-template";

export type RegistrationEmailErrorCategory =
  | "CONFIGURATION_ERROR"
  | "QR_GENERATION_ERROR"
  | "PROVIDER_ERROR"
  | "DATABASE_ERROR";

export type RegistrationEmailResult =
  | {
      success: true;
      providerMessageId: string;
    }
  | {
      success: false;
      errorCategory: RegistrationEmailErrorCategory;
    };

type SendRegistrationEmailInput = {
  recipientEmail: string;
  fullName: string;
  registrationId: string;
  qrPngBuffer: Buffer;
  idempotencyKey: string;
};

export async function sendRegistrationEmail({
  recipientEmail,
  fullName,
  registrationId,
  qrPngBuffer,
  idempotencyKey,
}: SendRegistrationEmailInput): Promise<RegistrationEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !fromEmail) {
    return {
      success: false,
      errorCategory: "CONFIGURATION_ERROR",
    };
  }

  try {
    const template = createRegistrationEmailTemplate({
      fullName,
      registrationId,
    });
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send(
      {
        from: fromEmail,
        to: recipientEmail,
        subject: template.subject,
        html: template.html,
        text: template.text,
        attachments: [
          {
            filename: `${registrationId}.png`,
            content: qrPngBuffer,
            contentType: "image/png",
            contentId: "akkai-registration-qr",
          },
        ],
      },
      { idempotencyKey },
    );

    if (error || !data?.id) {
      return {
        success: false,
        errorCategory: "PROVIDER_ERROR",
      };
    }

    return {
      success: true,
      providerMessageId: data.id,
    };
  } catch {
    return {
      success: false,
      errorCategory: "PROVIDER_ERROR",
    };
  }
}
