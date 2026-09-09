import type {
  ParticipantTravel,
  PickupAssignment,
  PickupTransferType,
} from "./assignment-types";

export function getEffectivePickupPoint(
  transferType: PickupTransferType,
  assignment: PickupAssignment | null,
  travel: ParticipantTravel | null,
) {
  const manualPoint =
    transferType === "ARRIVAL" ? assignment?.pickupPoint : assignment?.dropoffPoint;

  if (manualPoint) {
    return { value: manualPoint, source: "MANUAL" as const };
  }

  const travelPoint =
    transferType === "ARRIVAL"
      ? travel?.outboundDestination ?? null
      : travel?.returnDestination ?? null;

  if (travelPoint) {
    return { value: travelPoint, source: "TRAVEL" as const };
  }

  return { value: null, source: "EMPTY" as const };
}
