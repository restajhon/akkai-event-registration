export type ParticipantRegistrationStatus = "REGISTERED" | "CANCELLED";

export type RoomAssignment = {
  roomNumber: string | null;
  roomType: string | null;
  checkInDate: string | null;
  checkOutDate: string | null;
  notes: string | null;
  updatedAt: string;
};

export type RoomParticipant = {
  registrationId: string;
  fullName: string;
  packageType: string | null;
  participantCategory: string | null;
  registrationStatus: ParticipantRegistrationStatus;
  assignment: RoomAssignment | null;
};

export type PickupStatus = "SCHEDULED" | "COMPLETED" | "CANCELLED";

export type PickupTransferType = "ARRIVAL" | "DEPARTURE";

export type PickupAssignment = {
  transferType: PickupTransferType;
  status: PickupStatus;
  pickupAt: string | null;
  pickupPoint: string | null;
  dropoffPoint: string | null;
  vehicleLabel: string | null;
  picDriver: string | null;
  notes: string | null;
  updatedAt: string;
};

export type ParticipantTravel = {
  outboundDate: string;
  outboundTime: string;
  outboundTransportMode: string;
  outboundTransportNumber: string | null;
  outboundOrigin: string;
  outboundDestination: string;
  returnDate: string;
  returnTime: string;
  returnTransportMode: string;
  returnTransportNumber: string | null;
  returnDestination: string;
};

export type PickupParticipant = {
  registrationId: string;
  fullName: string;
  participantCategory: string | null;
  registrationStatus: ParticipantRegistrationStatus;
  travel: ParticipantTravel | null;
  arrivalAssignment: PickupAssignment | null;
  departureAssignment: PickupAssignment | null;
};
