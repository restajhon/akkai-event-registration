import type { TravelFieldErrors } from "@/lib/validation/travel";

export type TravelActionStatus =
  | "idle"
  | "validation-error"
  | "general-error"
  | "rate-limited"
  | "saved";

export type TravelActionState = {
  status: TravelActionStatus;
  fieldErrors: TravelFieldErrors;
  generalError?: string;
};

export const initialTravelActionState: TravelActionState = {
  status: "idle",
  fieldErrors: {},
};
