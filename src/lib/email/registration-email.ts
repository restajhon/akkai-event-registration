import "server-only";

import { Resend } from "resend";

import {
  getRegistrationDiagnosticError,
  type RegistrationDiagnosticDetails,
} from "@/lib/registration/diagnostics";
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
      errorMessage: string;
      diagnostic: RegistrationDiagnosticDetails;
    };

type SendRegistrationEmailInput = {
  recipientEmail: string;
  fullName: string;
  registrationId: string;
  packageType: string;
  participationScope: string;
  actuarialConsultantStatus: string | null;
  attendsPaiCongress: boolean | null;
  qrPngBuffer: Buffer;
  idempotencyKey: string;
};

export async function sendRegistrationEmail({
  recipientEmail,
  fullName,
  registrationId,
  packageType,
  participationScope,
  actuarialConsultantStatus,
  attendsPaiCongress,
  qrPngBuffer,
  idempotencyKey,
}: SendRegistrationEmailInput): Promise<RegistrationEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !fromEmail) {
    const diagnostic = getRegistrationDiagnosticError(
      new Error("email provider is not configured"),
      "resend",
    );
    return {
      success: false,
      errorCategory: "CONFIGURATION_ERROR",
      errorMessage: diagnostic.message,
      diagnostic,
    };
  }

  try {
    const template = createRegistrationEmailTemplate({
      fullName,
      registrationId,
      packageType,
      participationScope,
      actuarialConsultantStatus,
      attendsPaiCongress,
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
      const diagnostic = getRegistrationDiagnosticError({ data, error }, "resend");
      return {
        success: false,
        errorCategory: "PROVIDER_ERROR",
        errorMessage: diagnostic.message,
        diagnostic,
      };
    }

    return {
      success: true,
      providerMessageId: data.id,
    };
  } catch (error) {
    const diagnostic = getRegistrationDiagnosticError(error, "resend");
    return {
      success: false,
      errorCategory: "PROVIDER_ERROR",
      errorMessage: diagnostic.message,
      diagnostic,
    };
  }
}
