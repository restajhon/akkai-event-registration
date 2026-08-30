export type ParticipantActionState = {
  status: "idle" | "success" | "info" | "error";
  message: string | null;
  requiresStalePendingConfirmation?: boolean;
};

export const initialParticipantActionState: ParticipantActionState = {
  status: "idle",
  message: null,
};
