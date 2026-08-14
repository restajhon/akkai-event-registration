export type StationAction = "create" | "reset" | "close";

export type StationActionState = {
  status: "idle" | "success" | "error";
  message: string | null;
  action?: StationAction;
  stationId?: string;
  stationName?: string;
  pairingCode?: string;
  pairingExpiresAt?: string;
};

export const initialStationActionState: StationActionState = {
  status: "idle",
  message: null,
};
