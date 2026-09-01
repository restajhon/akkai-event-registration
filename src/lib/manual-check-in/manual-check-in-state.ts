export type ManualParticipant = {
  registrationId: string;
  fullName: string;
  institution: string | null;
  participantCategory: string;
  registrationStatus: "REGISTERED" | "CANCELLED";
  alreadyCheckedIn: boolean;
  checkedInAt: string | null;
};

export type ManualSession = {
  code: string;
  name: string;
};

export type ManualSearchState = {
  status: "idle" | "success" | "error";
  message: string | null;
  results: ManualParticipant[];
};

export const initialManualSearchState: ManualSearchState = {
  status: "idle",
  message: null,
  results: [],
};

export type ManualCheckInErrorCode =
  | "unauthorized-operator"
  | "invalid-station"
  | "station-not-paired"
  | "station-owned-by-other-operator"
  | "closed-session"
  | "participant-not-found"
  | "invalid-request"
  | "internal-error";

export type ManualCheckInState = {
  status:
    | "idle"
    | "success"
    | "success-with-warning"
    | "already-checked-in"
    | "cancelled-participant"
    | "error";
  message: string | null;
  errorCode: ManualCheckInErrorCode | null;
  participant: ManualParticipant | null;
  session: ManualSession | null;
  checkedAt: string | null;
};

export const initialManualCheckInState: ManualCheckInState = {
  status: "idle",
  message: null,
  errorCode: null,
  participant: null,
  session: null,
  checkedAt: null,
};
