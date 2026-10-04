"use server";

import { revalidatePath } from "next/cache";

import { getAuthorizedProfile } from "@/lib/auth/server";
import { MEMBER_MEETING_BUCKET } from "@/lib/member-meeting/storage";
import { createAdminClient } from "@/lib/supabase/admin";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type DeleteMemberMeetingSubmissionState = {
  status: "idle" | "error" | "success";
  message?: string;
};

function errorState(message: string): DeleteMemberMeetingSubmissionState {
  return { status: "error", message };
}

export async function deleteMemberMeetingSubmission(
  previousState: DeleteMemberMeetingSubmissionState,
  formData: FormData,
): Promise<DeleteMemberMeetingSubmissionState> {
  void previousState;

  const profile = await getAuthorizedProfile("member_meetings.view");
  if (!profile?.is_active || (profile.role !== "SUPER_ADMIN" && profile.role !== "ADMIN")) {
    return errorState("Anda tidak memiliki izin untuk menghapus submission Rapat Anggota.");
  }

  const rawSubmissionId = formData.get("submissionId");
  const submissionId = typeof rawSubmissionId === "string" ? rawSubmissionId.trim() : "";
  if (!uuidPattern.test(submissionId)) {
    return errorState("ID submission tidak valid.");
  }

  try {
    const supabase = createAdminClient();
    const { data: submission, error: lookupError } = await supabase
      .from("member_meeting_submissions")
      .select("id, authorization_file_path, cancelled_at")
      .eq("id", submissionId)
      .maybeSingle();

    if (lookupError || !submission) {
      return errorState("Submission tidak ditemukan atau sudah dihapus.");
    }

    if (submission.cancelled_at !== null) {
      return errorState("Submission sudah dinonaktifkan.");
    }

    const { data: disabledSubmission, error: updateError } = await supabase
      .from("member_meeting_submissions")
      .update({ cancelled_at: new Date().toISOString(), cancelled_by: profile.id })
      .eq("id", submissionId)
      .is("cancelled_at", null)
      .select("id")
      .maybeSingle();

    if (updateError || !disabledSubmission) {
      return errorState("Submission belum dapat dinonaktifkan. Silakan coba kembali.");
    }

    const authorizationPath = submission.authorization_file_path;
    const ownedSubmissionFile = typeof authorizationPath === "string"
      && /^submissions\/[0-9a-f-]{36}\.(doc|docx|pdf|png|jpg|jpeg)$/i.test(authorizationPath);
    let fileCleanupFailed = false;
    if (ownedSubmissionFile) {
      try {
        const { error: storageError } = await supabase.storage
          .from(MEMBER_MEETING_BUCKET)
          .remove([authorizationPath]);
        fileCleanupFailed = Boolean(storageError);
      } catch {
        fileCleanupFailed = true;
      }
    }

    revalidatePath("/admin/member-meetings");
    return {
      status: "success",
      message: fileCleanupFailed
        ? "Submission berhasil dinonaktifkan, tetapi surat kuasa belum dapat dibersihkan dari penyimpanan."
        : "Submission Rapat Anggota berhasil dihapus dari daftar aktif.",
    };
  } catch {
    return errorState("Submission belum dapat dinonaktifkan. Silakan coba kembali.");
  }
}
