import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  consumeMemberMeetingRateLimit: vi.fn(),
  createAdminClient: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/member-meeting/member-meeting-rate-limit", () => ({
  consumeMemberMeetingRateLimit: mocks.consumeMemberMeetingRateLimit,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

import {
  prepareMemberMeetingUpload,
  submitMemberMeeting,
} from "@/app/rapat-anggota/actions";
import { initialMemberMeetingActionState } from "@/lib/member-meeting/member-meeting-action-state";
import { MEMBER_MEETING_MAX_FILE_SIZE } from "@/lib/validation/member-meeting";

const baseFields = {
  name: "Pemimpin KKA",
  consulting_firm: "Kantor Konsultan Aktuaria",
  position: "Direktur",
  phone: "081234567890",
  email: "pemimpin@example.com",
};

function formDataFor(fields: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return formData;
}

beforeEach(() => {
  mocks.consumeMemberMeetingRateLimit.mockReset();
  mocks.createAdminClient.mockReset();
  mocks.consumeMemberMeetingRateLimit.mockResolvedValue("allowed");
});

describe("member meeting submission", () => {
  it("prepares a metadata-only signed upload intent", async () => {
    const intent = { id: "00000000-0000-4000-8000-000000000001" };
    let insertedIntent: Record<string, unknown> | undefined;
    const insert = vi.fn((values: Record<string, unknown>) => {
      insertedIntent = values;
      return {
      select: vi.fn(() => ({
        single: vi.fn(async () => ({ data: intent, error: null })),
      })),
      };
    });
    const createSignedUploadUrl = vi.fn(async () => ({
      data: {
        path: "submissions/00000000-0000-4000-8000-000000000002.pdf",
        token: "signed-upload-token",
      },
      error: null,
    }));
    const client = {
      from: vi.fn(() => ({ insert })),
      storage: { from: vi.fn(() => ({ createSignedUploadUrl })) },
    };
    mocks.createAdminClient.mockReturnValue(client);

    const formData = formDataFor({
      email: baseFields.email,
      file_name: "surat-kuasa.pdf",
      file_type: "application/pdf",
      file_size: String(MEMBER_MEETING_MAX_FILE_SIZE),
      website: "",
    });

    const result = await prepareMemberMeetingUpload(formData);

    expect(result).toEqual({
      status: "ready",
      intentId: intent.id,
      path: "submissions/00000000-0000-4000-8000-000000000002.pdf",
      token: "signed-upload-token",
    });
    expect(insertedIntent).toEqual({
      email: baseFields.email,
      storage_path: expect.stringMatching(
        /^submissions\/[0-9a-f-]{36}\.pdf$/,
      ),
      file_name: "surat-kuasa.pdf",
      file_mime: "application/pdf",
      file_size: MEMBER_MEETING_MAX_FILE_SIZE,
    });
    if (typeof insertedIntent?.storage_path !== "string") {
      throw new Error("Expected a generated upload path");
    }
    expect(createSignedUploadUrl).toHaveBeenCalledWith(
      insertedIntent.storage_path,
      { upsert: false },
    );
  });

  it("saves SELF submissions without a file", async () => {
    let insertedSubmission: Record<string, unknown> | undefined;
    const insert = vi.fn((values: Record<string, unknown>) => {
      insertedSubmission = values;
      return {
      select: vi.fn(() => ({
        single: vi.fn(async () => ({ data: { id: "submission-1" }, error: null })),
      })),
      };
    });
    const client = {
      from: vi.fn((table: string) => {
        expect(table).toBe("member_meeting_submissions");
        return { insert };
      }),
      storage: { from: vi.fn() },
    };
    mocks.createAdminClient.mockReturnValue(client);

    const result = await submitMemberMeeting(
      initialMemberMeetingActionState,
      formDataFor({
        ...baseFields,
        attendance_type: "SELF",
        proxy_name: "Tidak boleh disimpan",
        proxy_position: "Tidak boleh disimpan",
      }),
    );

    expect(result.status).toBe("saved");
    expect(insertedSubmission).toMatchObject({
      attendance_type: "SELF",
      proxy_name: null,
      proxy_position: null,
      authorization_file_path: null,
      authorization_file_name: null,
      authorization_file_mime: null,
      authorization_file_size: null,
    });
    expect(mocks.consumeMemberMeetingRateLimit).toHaveBeenCalledOnce();
    expect(client.storage.from).not.toHaveBeenCalled();
  });

  it("rejects an authorization file on SELF submissions", async () => {
    const from = vi.fn();
    const client = {
      from,
      storage: { from: vi.fn() },
    };
    mocks.createAdminClient.mockReturnValue(client);

    const formData = formDataFor({ ...baseFields, attendance_type: "SELF" });
    formData.set(
      "authorization_file",
      new File(["%PDF-1.7"], "surat-kuasa.pdf", { type: "application/pdf" }),
    );

    const result = await submitMemberMeeting(
      initialMemberMeetingActionState,
      formData,
    );

    expect(result.status).toBe("general-error");
    expect(from).not.toHaveBeenCalled();
    expect(client.storage.from).not.toHaveBeenCalled();
  });

  it("verifies a PROXY file from Storage before saving metadata", async () => {
    const intent = {
      id: "00000000-0000-4000-8000-000000000001",
      email: baseFields.email,
      storage_path: "submissions/00000000-0000-4000-8000-000000000002.pdf",
      file_name: "Surat Kuasa ÄKKAI 東京.pdf",
      file_mime: "application/pdf",
       file_size: MEMBER_MEETING_MAX_FILE_SIZE,
      status: "PENDING",
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    };
    const submissionInsert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(async () => ({ data: { id: "submission-2" }, error: null })),
      })),
    }));
    const intentUpdate = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: { id: intent.id }, error: null })),
          })),
        })),
      })),
    }));
    const client = {
      from: vi.fn((table: string) => {
        if (table === "member_meeting_upload_intents") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: intent, error: null })) })),
            })),
            update: intentUpdate,
          };
        }

        return { insert: submissionInsert };
      }),
      storage: {
        from: vi.fn(() => ({
          download: vi.fn(async () => ({
             data: new Blob(
               [
                 (() => {
                   const bytes = new Uint8Array(MEMBER_MEETING_MAX_FILE_SIZE);
                   bytes.set([37, 80, 68, 70, 45, 49]);
                   return bytes;
                 })(),
               ],
               { type: "application/pdf" },
             ),
            error: null,
          })),
        })),
      },
    };
    mocks.createAdminClient.mockReturnValue(client);

    const result = await submitMemberMeeting(
      initialMemberMeetingActionState,
      formDataFor({
        ...baseFields,
        attendance_type: "PROXY",
        proxy_name: "Penerima Kuasa",
        proxy_position: "Komisaris",
        upload_intent_id: intent.id,
      }),
    );

    expect(result.status).toBe("saved");
    expect(mocks.consumeMemberMeetingRateLimit).not.toHaveBeenCalled();
    expect(client.storage.from).toHaveBeenCalledOnce();
    expect(intentUpdate).toHaveBeenCalledOnce();
  });
});
