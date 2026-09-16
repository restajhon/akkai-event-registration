export type AttendanceSummary = {
  checkedIn: boolean;
  checkedInAt: string | null;
};

export type ParticipantBillingStatus = "PAID" | "UNPAID" | null;

export type ParticipantListItem = {
  registrationId: string;
  fullName: string;
  email: string;
  sharedEmailCount: number;
  phoneNumber: string;
  packageType: string | null;
  participationScope: string | null;
  actuarialConsultantStatus: string | null;
  attendsPaiCongress: boolean | null;
  billingStatus: ParticipantBillingStatus;
  registrationStatus: "REGISTERED" | "CANCELLED";
  emailStatus: "PENDING" | "SENT" | "FAILED";
  createdAt: string;
  arrival: AttendanceSummary;
  seminar: AttendanceSummary;
  day3: AttendanceSummary;
};

export type ParticipantSummary = {
  registered: number;
  cancelled: number;
  emailFailed: number;
  paid: number;
  unpaid: number;
};

export type ParticipantPageData = {
  participants: ParticipantListItem[];
  summary: ParticipantSummary;
  totalCount: number;
  page: number;
  totalPages: number;
  query: string;
  billingStatus: "all" | "PAID" | "UNPAID";
};
