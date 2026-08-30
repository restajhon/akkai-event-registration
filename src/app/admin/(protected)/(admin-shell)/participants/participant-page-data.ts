export type AttendanceSummary = {
  checkedIn: boolean;
  checkedInAt: string | null;
};

export type ParticipantListItem = {
  registrationId: string;
  fullName: string;
  email: string;
  institution: string;
  participantCategory: string;
  registrationStatus: "REGISTERED" | "CANCELLED";
  emailStatus: "PENDING" | "SENT" | "FAILED";
  createdAt: string;
  arrival: AttendanceSummary;
  seminar: AttendanceSummary;
};

export type ParticipantSummary = {
  registered: number;
  cancelled: number;
  emailFailed: number;
};

export type ParticipantPageData = {
  participants: ParticipantListItem[];
  summary: ParticipantSummary;
  totalCount: number;
  page: number;
  totalPages: number;
  query: string;
};
