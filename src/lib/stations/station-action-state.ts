export type StationActionState = {
  status: "idle" | "success" | "error";
  message: string | null;
  pairingCode?: string;
  pairingExpiresAt?: string;
};

export const initialStationActionState: StationActionState = {
  status: "idle",
  message: null,
};
