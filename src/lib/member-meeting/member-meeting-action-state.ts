import type { MemberMeetingFieldErrors } from "@/lib/validation/member-meeting";

export type MemberMeetingActionStatus =
  | "idle"
  | "validation-error"
  | "general-error"
  | "saved";

export type MemberMeetingActionState = {
  status: MemberMeetingActionStatus;
  fieldErrors: MemberMeetingFieldErrors;
  generalError?: string;
};

export const initialMemberMeetingActionState: MemberMeetingActionState = {
  status: "idle",
  fieldErrors: {},
};
