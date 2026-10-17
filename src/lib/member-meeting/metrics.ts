export type MemberMeetingSubmissionMetric = {
  attendance_type: "SELF" | "PROXY";
  cancelled_at: string | null;
};

export function getMemberMeetingSubmissionCounts(
  submissions: readonly MemberMeetingSubmissionMetric[],
) {
  const activeSubmissions = submissions.filter(
    (submission) => submission.cancelled_at === null,
  );

  return {
    total: activeSubmissions.length,
    self: activeSubmissions.filter((submission) => submission.attendance_type === "SELF").length,
    proxy: activeSubmissions.filter((submission) => submission.attendance_type === "PROXY").length,
  };
}
