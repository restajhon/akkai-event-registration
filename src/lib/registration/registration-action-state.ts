import type { RegistrationFieldErrors } from "@/lib/validation/registration";

export type RegistrationActionStatus =
  | "idle"
  | "validation-error"
  | "duplicate-email"
  | "duplicate-member-number"
  | "general-error"
  | "submitted";

export type EmailDeliveryStatus = "sent" | "failed" | "not-attempted";

export type RegistrationActionState = {
  status: RegistrationActionStatus;
  fieldErrors: RegistrationFieldErrors;
  generalError?: string;
  registrationId?: string;
  emailDelivery?: EmailDeliveryStatus;
};

export const initialRegistrationState: RegistrationActionState = {
  status: "idle",
  fieldErrors: {},
  emailDelivery: "not-attempted",
};
