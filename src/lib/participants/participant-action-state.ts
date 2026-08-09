export type ParticipantActionState = {
  status: "idle" | "success" | "info" | "error";
  message: string | null;
};

export const initialParticipantActionState: ParticipantActionState = {
  status: "idle",
  message: null,
};
