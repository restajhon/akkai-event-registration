export type AssignmentActionState = {
  status: "idle" | "success" | "error";
  message: string | null;
};

export const initialAssignmentActionState: AssignmentActionState = {
  status: "idle",
  message: null,
};
