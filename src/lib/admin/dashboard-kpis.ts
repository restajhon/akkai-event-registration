export type DashboardParticipant = {
  id: string;
  registrationId: string;
  fullName: string;
  packageType: string | null;
  participationScope: string | null;
  actuarialConsultantStatus: string | null;
  poloModel: string | null;
  poloSize: string | null;
  createdAt: string;
};

export type DashboardBilling = {
  participantId: string;
  paymentStatus: "PAID" | "UNPAID";
};

export type DashboardTravel = {
  participantId: string;
  outboundDate: string;
  outboundTime: string;
  returnDate: string;
  returnTime: string;
};

export type DashboardAttendance = {
  participantId: string;
  sessionCode: "ARRIVAL" | "SEMINAR" | "DAY3";
};

export type DashboardKpis = {
  totalParticipants: number;
  paidCount: number;
  unpaidCount: number;
  paymentPercentage: number;
  packageDistribution: Record<string, number>;
  participationDistribution: Record<string, number>;
  ciacDistribution: Record<string, number>;
  poloDistribution: Record<string, number>;
  travel: {
    arrivalComplete: number;
    arrivalIncomplete: number;
    departureComplete: number;
    departureIncomplete: number;
  };
  certificateCount: number;
  attendanceBySession: Record<"ARRIVAL" | "SEMINAR" | "DAY3", number>;
};

function increment(map: Record<string, number>, key: string | null) {
  const label = key || "Belum diisi";
  map[label] = (map[label] ?? 0) + 1;
}

function hasArrivalTravel(travel: DashboardTravel | undefined) {
  return Boolean(travel?.outboundDate && travel.outboundTime);
}

function hasDepartureTravel(travel: DashboardTravel | undefined) {
  return Boolean(travel?.returnDate && travel.returnTime);
}

export function calculateDashboardKpis(
  participants: DashboardParticipant[],
  billings: DashboardBilling[],
  travels: DashboardTravel[],
  certificateParticipantIds: string[],
  attendance: DashboardAttendance[],
): DashboardKpis {
  const participantIds = new Set(participants.map((participant) => participant.id));
  const billingByParticipant = new Map(
    billings.map((billing) => [billing.participantId, billing.paymentStatus]),
  );
  const travelByParticipant = new Map(
    travels.map((travel) => [travel.participantId, travel]),
  );
  const attendanceBySession = { ARRIVAL: 0, SEMINAR: 0, DAY3: 0 };
  const seenAttendance = new Set<string>();
  const packageDistribution: Record<string, number> = {};
  const participationDistribution: Record<string, number> = {};
  const ciacDistribution: Record<string, number> = {};
  const poloDistribution: Record<string, number> = {};

  let paidCount = 0;
  let unpaidCount = 0;
  let arrivalComplete = 0;
  let departureComplete = 0;

  for (const participant of participants) {
    const paymentStatus = billingByParticipant.get(participant.id);
    if (paymentStatus === "PAID") paidCount += 1;
    if (paymentStatus === "UNPAID") unpaidCount += 1;

    increment(packageDistribution, participant.packageType);
    increment(participationDistribution, participant.participationScope);
    increment(ciacDistribution, participant.actuarialConsultantStatus);
    increment(
      poloDistribution,
      participant.poloModel && participant.poloSize
        ? `${participant.poloModel} / ${participant.poloSize}`
        : participant.poloModel ?? participant.poloSize,
    );

    const travel = travelByParticipant.get(participant.id);
    if (hasArrivalTravel(travel)) arrivalComplete += 1;
    if (hasDepartureTravel(travel)) departureComplete += 1;
  }

  for (const row of attendance) {
    if (!participantIds.has(row.participantId)) continue;
    const key = `${row.participantId}:${row.sessionCode}`;
    if (seenAttendance.has(key)) continue;
    seenAttendance.add(key);
    attendanceBySession[row.sessionCode] += 1;
  }

  const totalParticipants = participants.length;
  const paymentCount = paidCount + unpaidCount;

  return {
    totalParticipants,
    paidCount,
    unpaidCount,
    paymentPercentage:
      paymentCount === 0 ? 0 : Math.round((paidCount / paymentCount) * 100),
    packageDistribution,
    participationDistribution,
    ciacDistribution,
    poloDistribution,
    travel: {
      arrivalComplete,
      arrivalIncomplete: totalParticipants - arrivalComplete,
      departureComplete,
      departureIncomplete: totalParticipants - departureComplete,
    },
    certificateCount: certificateParticipantIds.filter((id) => participantIds.has(id)).length,
    attendanceBySession,
  };
}
