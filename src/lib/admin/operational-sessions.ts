export const ARRIVAL_SESSION_CODE = "ARRIVAL" as const;

export const OPERATIONAL_SESSION_CODES = [
  ARRIVAL_SESSION_CODE,
  "DAY1_MEMBER_MEETING",
  "SEMINAR",
  "DAY2_AKKAI_NIGHT",
  "DAY3",
] as const;

export type OperationalSessionCode = (typeof OPERATIONAL_SESSION_CODES)[number];
