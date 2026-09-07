import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type MemberMeetingSubmission = {
  id: string;
  name: string;
  consulting_firm: string;
  position: string;
  phone: string;
  email: string;
  attendance_type: "SELF" | "PROXY";
  proxy_name: string | null;
  proxy_position: string | null;
  authorization_file_path: string | null;
  authorization_file_name: string | null;
  authorization_file_mime: string | null;
  authorization_file_size: number | null;
  created_at: string;
  updated_at: string;
};

const submissionColumns =
  "id, name, consulting_firm, position, phone, email, attendance_type, proxy_name, proxy_position, authorization_file_path, authorization_file_name, authorization_file_mime, authorization_file_size, created_at, updated_at";

export async function loadMemberMeetingSubmissions(): Promise<
  MemberMeetingSubmission[] | null
> {
  try {
    const { data, error } = await createAdminClient()
      .from("member_meeting_submissions")
      .select(submissionColumns)
      .order("created_at", { ascending: false });

    return error ? null : (data as MemberMeetingSubmission[]);
  } catch {
    return null;
  }
}

export async function loadMemberMeetingSubmission(id: string) {
  try {
    const { data, error } = await createAdminClient()
      .from("member_meeting_submissions")
      .select(submissionColumns)
      .eq("id", id)
      .maybeSingle();

    return error ? null : (data as MemberMeetingSubmission | null);
  } catch {
    return null;
  }
}
