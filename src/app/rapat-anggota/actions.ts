"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { participantEmailSchema } from "@/lib/validation/email";
import { consumeMemberMeetingRateLimit } from "@/lib/member-meeting/member-meeting-rate-limit";
import { MEMBER_MEETING_BUCKET } from "@/lib/member-meeting/storage";
import type { MemberMeetingActionState } from "@/lib/member-meeting/member-meeting-action-state";
import {
  getMemberMeetingFieldErrors,
  getMemberMeetingFileExtension,
  hasExpectedAuthorizationFileSignature,
  memberMeetingDetailsSchema,
  memberMeetingUploadMetadataSchema,
  validateAuthorizationFileMetadata,
  MEMBER_MEETING_MAX_FILE_SIZE,
  type MemberMeetingFormValues,
} from "@/lib/validation/member-meeting";

const GENERAL_ERROR =
  "Terjadi kendala saat menyimpan formulir. Silakan coba kembali.";
const RATE_LIMIT_ERROR =
  "Terlalu banyak percobaan. Silakan coba kembali beberapa saat lagi.";
const UPLOAD_ERROR =
  "Surat Kuasa belum dapat diunggah. Silakan coba kembali.";

type UploadPreparationState =
  | {
      status: "ready";
      intentId: string;
      path: string;
      token: string;
    }
  | { status: "error"; message: string };

type UploadIntent = {
  id: string;
  email: string;
  storage_path: string;
  file_name: string;
  file_mime: string;
  file_size: number;
  status: "PENDING" | "CONSUMED";
  expires_at: string;
};

function getFormValue(formData: FormData, field: string) {
  const value = formData.get(field);
  return typeof value === "string" ? value : "";
}

function getFormValues(formData: FormData): MemberMeetingFormValues {
  return {
    name: getFormValue(formData, "name"),
    consulting_firm: getFormValue(formData, "consulting_firm"),
    position: getFormValue(formData, "position"),
    phone: getFormValue(formData, "phone"),
    email: getFormValue(formData, "email"),
    attendance_type: getFormValue(formData, "attendance_type"),
    proxy_name: getFormValue(formData, "proxy_name"),
    proxy_position: getFormValue(formData, "proxy_position"),
    authorization_file: null,
  };
}

function errorState(
  status: Extract<
    MemberMeetingActionState["status"],
    "general-error" | "validation-error"
  >,
  generalError?: string,
  fieldErrors: MemberMeetingActionState["fieldErrors"] = {},
): MemberMeetingActionState {
  return { status, fieldErrors, generalError };
}

function getSafeFileName(fileName: string) {
  const baseName = fileName.split(/[\\/]/).pop() ?? "surat-kuasa";
  const cleanName = baseName.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return cleanName.slice(0, 255) || "surat-kuasa";
}

function isNonEmptyFile(value: FormDataEntryValue | null) {
  return (
    typeof File !== "undefined" &&
    value instanceof File &&
    value.size > 0
  );
}

async function loadUploadIntent(
  supabase: ReturnType<typeof createAdminClient>,
  intentId: string,
): Promise<UploadIntent | null> {
  const { data, error } = await supabase
    .from("member_meeting_upload_intents")
    .select("id, email, storage_path, file_name, file_mime, file_size, status, expires_at")
    .eq("id", intentId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as UploadIntent;
}

async function cleanupUploadIntent(
  supabase: ReturnType<typeof createAdminClient>,
  intentId: string,
  knownPath?: string,
) {
  const intent = await loadUploadIntent(supabase, intentId);

  if (!intent || intent.status !== "PENDING") {
    return;
  }

  const storagePath = knownPath ?? intent.storage_path;
  if (storagePath) {
    await supabase.storage.from(MEMBER_MEETING_BUCKET).remove([
      storagePath,
    ]);
  }

  await supabase
    .from("member_meeting_upload_intents")
    .delete()
    .eq("id", intentId);
}

export async function prepareMemberMeetingUpload(
  formData: FormData,
): Promise<UploadPreparationState> {
  if (getFormValue(formData, "website").trim() !== "") {
    return { status: "error", message: GENERAL_ERROR };
  }

  if (isNonEmptyFile(formData.get("authorization_file"))) {
    return { status: "error", message: UPLOAD_ERROR };
  }

  const metadata = memberMeetingUploadMetadataSchema.safeParse({
    file_name: getFormValue(formData, "file_name"),
    file_type: getFormValue(formData, "file_type"),
    file_size: Number(getFormValue(formData, "file_size")),
  });

  const parsedEmail = participantEmailSchema.safeParse(
    getFormValue(formData, "email"),
  );
  if (!metadata.success || !parsedEmail.success) {
    return { status: "error", message: UPLOAD_ERROR };
  }

  const email = parsedEmail.data;

  try {
    const supabase = createAdminClient();
    const rateLimitResult = await consumeMemberMeetingRateLimit(supabase, email);

    if (rateLimitResult === "limited") {
      return { status: "error", message: RATE_LIMIT_ERROR };
    }

    if (rateLimitResult === "unavailable") {
      return { status: "error", message: GENERAL_ERROR };
    }

    const extension = getMemberMeetingFileExtension(metadata.data.file_name);
    const path = `submissions/${crypto.randomUUID()}.${extension}`;
    const { data: intent, error: intentError } = await supabase
      .from("member_meeting_upload_intents")
      .insert({
        email,
        storage_path: path,
        file_name: getSafeFileName(metadata.data.file_name),
        file_mime: metadata.data.file_type,
        file_size: metadata.data.file_size,
      })
      .select("id")
      .single();

    if (intentError || !intent) {
      return { status: "error", message: GENERAL_ERROR };
    }

    const { data: signedUpload, error: signedUploadError } = await supabase.storage
      .from(MEMBER_MEETING_BUCKET)
      .createSignedUploadUrl(path, { upsert: false });

    if (signedUploadError || !signedUpload) {
      await cleanupUploadIntent(supabase, intent.id, path);
      return { status: "error", message: GENERAL_ERROR };
    }

    return {
      status: "ready",
      intentId: intent.id,
      path: signedUpload.path,
      token: signedUpload.token,
    };
  } catch {
    return { status: "error", message: GENERAL_ERROR };
  }
}

export async function cancelMemberMeetingUpload(intentId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(intentId)) {
    return;
  }

  try {
    await cleanupUploadIntent(createAdminClient(), intentId);
  } catch {
    // Cleanup is best effort; the intent expiry prevents indefinite reuse.
  }
}

export async function submitMemberMeeting(
  previousState: MemberMeetingActionState,
  formData: FormData,
): Promise<MemberMeetingActionState> {
  void previousState;

  if (getFormValue(formData, "website").trim() !== "") {
    return errorState("general-error", GENERAL_ERROR);
  }

  if (isNonEmptyFile(formData.get("authorization_file"))) {
    return errorState("general-error", UPLOAD_ERROR);
  }

  const details = memberMeetingDetailsSchema.safeParse(getFormValues(formData));
  const intentId = getFormValue(formData, "upload_intent_id");

  if (!details.success) {
    if (intentId) {
      try {
        await cleanupUploadIntent(createAdminClient(), intentId);
      } catch {
        // Preserve the validation response if cleanup also fails.
      }
    }

    return errorState(
      "validation-error",
      undefined,
      getMemberMeetingFieldErrors(details.error),
    );
  }

  let intent: UploadIntent | null = null;
  let submissionId: string | null = null;

  try {
    const supabase = createAdminClient();

    if (details.data.attendance_type === "SELF") {
      const rateLimitResult = await consumeMemberMeetingRateLimit(
        supabase,
        details.data.email,
      );

      if (rateLimitResult === "limited") {
        return errorState("general-error", RATE_LIMIT_ERROR);
      }

      if (rateLimitResult === "unavailable") {
        return errorState("general-error", GENERAL_ERROR);
      }
    } else {
      if (!/^[0-9a-f-]{36}$/i.test(intentId)) {
        return errorState("general-error", UPLOAD_ERROR);
      }

      intent = await loadUploadIntent(supabase, intentId);
      if (
        !intent ||
        intent.status !== "PENDING" ||
        intent.email !== details.data.email ||
        new Date(intent.expires_at).getTime() <= Date.now()
      ) {
        if (intent?.status === "PENDING") {
          await cleanupUploadIntent(supabase, intent.id, intent.storage_path);
        }
        return errorState("general-error", UPLOAD_ERROR);
      }

      const { data: downloadedFile, error: downloadError } = await supabase.storage
        .from(MEMBER_MEETING_BUCKET)
        .download(intent.storage_path);

      if (downloadError || !downloadedFile || downloadedFile.type !== intent.file_mime) {
        await cleanupUploadIntent(supabase, intent.id, intent.storage_path);
        return errorState("general-error", UPLOAD_ERROR);
      }

      const bytes = new Uint8Array(await downloadedFile.arrayBuffer());
      const metadataError = validateAuthorizationFileMetadata({
        file_name: intent.file_name,
        file_type: downloadedFile.type,
        file_size: bytes.byteLength,
      });
      if (
        downloadedFile.size !== bytes.byteLength ||
        bytes.byteLength !== intent.file_size ||
        bytes.byteLength > MEMBER_MEETING_MAX_FILE_SIZE ||
        metadataError
      ) {
        await cleanupUploadIntent(supabase, intent.id, intent.storage_path);
        return errorState("general-error", UPLOAD_ERROR);
      }

      const extension = getMemberMeetingFileExtension(intent.file_name);
      if (!hasExpectedAuthorizationFileSignature(extension, bytes)) {
        await cleanupUploadIntent(supabase, intent.id, intent.storage_path);
        return errorState("general-error", UPLOAD_ERROR);
      }
    }

    const { data: insertedSubmission, error: insertError } = await supabase
      .from("member_meeting_submissions")
      .insert({
        name: details.data.name,
        consulting_firm: details.data.consulting_firm,
        position: details.data.position,
        phone: details.data.phone,
        email: details.data.email,
        attendance_type: details.data.attendance_type,
        proxy_name:
          details.data.attendance_type === "PROXY" ? details.data.proxy_name : null,
        proxy_position:
          details.data.attendance_type === "PROXY"
            ? details.data.proxy_position
            : null,
        authorization_file_path: intent?.storage_path ?? null,
        authorization_file_name: intent?.file_name ?? null,
        authorization_file_mime: intent?.file_mime ?? null,
        authorization_file_size: intent?.file_size ?? null,
      })
      .select("id")
      .single();

    if (insertError || !insertedSubmission) {
      if (intent) {
        await cleanupUploadIntent(supabase, intent.id, intent.storage_path);
      }
      return errorState("general-error", GENERAL_ERROR);
    }

    submissionId = insertedSubmission.id;

    if (intent) {
      const { data: consumedIntent, error: consumeError } = await supabase
        .from("member_meeting_upload_intents")
        .update({ status: "CONSUMED", consumed_at: new Date().toISOString() })
        .eq("id", intent.id)
        .eq("status", "PENDING")
        .select("id")
        .maybeSingle();

      if (consumeError || !consumedIntent) {
        await supabase
          .from("member_meeting_submissions")
          .delete()
          .eq("id", submissionId);
        await cleanupUploadIntent(supabase, intent.id, intent.storage_path);
        return errorState("general-error", GENERAL_ERROR);
      }
    }

    return { status: "saved", fieldErrors: {} };
  } catch {
    if (intent) {
      try {
        await cleanupUploadIntent(createAdminClient(), intent.id, intent.storage_path);
        if (submissionId) {
          await createAdminClient()
            .from("member_meeting_submissions")
            .delete()
            .eq("id", submissionId);
        }
      } catch {
        // Preserve the generic response if orphan cleanup also fails.
      }
    }

    return errorState("general-error", GENERAL_ERROR);
  }
}
