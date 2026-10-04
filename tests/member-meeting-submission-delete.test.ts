import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthorizedProfile: vi.fn(),
  createAdminClient: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth/server", () => ({ getAuthorizedProfile: mocks.getAuthorizedProfile }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));

import { deleteMemberMeetingSubmission } from "@/app/admin/(protected)/(admin-shell)/member-meetings/actions";
import { getMemberMeetingSubmissionCounts } from "@/lib/member-meeting/metrics";

const submissionId = "00000000-0000-4000-8000-000000000001";
const submission = {
  id: submissionId,
  authorization_file_path: "submissions/00000000-0000-4000-8000-000000000002.pdf",
  attendance_type: "SELF" as const,
  cancelled_at: null,
};

function setupDeletion(rows: Array<{
  id: string;
  authorization_file_path: string | null;
  attendance_type: "SELF" | "PROXY";
  cancelled_at: string | null;
}> = [submission]) {
  const meetingRows: Array<{
    id: string;
    authorization_file_path: string | null;
    attendance_type: "SELF" | "PROXY";
    cancelled_at: string | null;
  }> = rows.map((row) => ({ ...row }));
  const participants = [{ id: "participant-1", registration_status: "REGISTERED" }];
  const billing = [{ participant_id: "participant-1", status: "PAID" }];
  const tickets = [{ participant_id: "participant-1", qr_token: "ticket-qr" }];
  const globalSnapshot = structuredClone({ participants, billing, tickets });
  const storageRemove = vi.fn(async () => ({ data: [], error: null }));
  const from = vi.fn((table: string) => {
    if (table !== "member_meeting_submissions") throw new Error(`Unexpected table ${table}`);
    let selectedId: unknown;
    let updateValues: Record<string, unknown> | null = null;
    const query: Record<string, (...args: unknown[]) => unknown> = {
      select: () => query,
      update: (values) => {
        updateValues = values as Record<string, unknown>;
        return query;
      },
      eq: (_column, id) => {
        selectedId = id;
        return query;
      },
      is: () => query,
      maybeSingle: async () => {
        if (updateValues) {
          const target = meetingRows.find((row) => row.id === selectedId && row.cancelled_at === null) ?? null;
          if (target) Object.assign(target, updateValues);
          return { data: target ? { id: target.id } : null, error: null };
        }
        return { data: meetingRows.find((row) => row.id === selectedId) ?? null, error: null };
      },
    };
    return query;
  });
  mocks.createAdminClient.mockReturnValue({
    from,
    storage: { from: vi.fn(() => ({ remove: storageRemove })) },
  });
  return { meetingRows, participants, billing, tickets, globalSnapshot, from, storageRemove };
}

function formData(id = submissionId) {
  const data = new FormData();
  data.set("submissionId", id);
  return data;
}

beforeEach(() => {
  mocks.getAuthorizedProfile.mockReset();
  mocks.createAdminClient.mockReset();
  mocks.revalidatePath.mockReset();
});

describe("Rapat Anggota submission deletion", () => {
  it("decreases total and attendance category counts for only the chosen submission", async () => {
    mocks.getAuthorizedProfile.mockResolvedValue({ id: "admin", role: "ADMIN", is_active: true });
    const target = { ...submission, attendance_type: "SELF" as const };
    const other = { ...submission, id: "00000000-0000-4000-8000-000000000002", authorization_file_path: null, attendance_type: "PROXY" as const };
    const db = setupDeletion([target, other]);

    expect(getMemberMeetingSubmissionCounts(db.meetingRows)).toEqual({ total: 2, self: 1, proxy: 1 });
    const result = await deleteMemberMeetingSubmission({ status: "idle" }, formData());

    expect(result).toEqual({ status: "success", message: "Submission Rapat Anggota berhasil dihapus dari daftar aktif." });
    expect(getMemberMeetingSubmissionCounts(db.meetingRows)).toEqual({ total: 1, self: 0, proxy: 1 });
    expect(db.meetingRows).toHaveLength(2);
    expect(db.meetingRows[0]?.cancelled_at).not.toBeNull();
    expect(db.from.mock.calls).toEqual([
      ["member_meeting_submissions"],
      ["member_meeting_submissions"],
    ]);
  });

  it("keeps global participant, billing, and ticket data unchanged", async () => {
    mocks.getAuthorizedProfile.mockResolvedValue({ id: "admin", role: "ADMIN", is_active: true });
    const db = setupDeletion();

    await deleteMemberMeetingSubmission({ status: "idle" }, formData());

    expect({ participants: db.participants, billing: db.billing, tickets: db.tickets }).toEqual(db.globalSnapshot);
  });

  it.each(["OPERATOR", "OPERATIONAL", "REGISTRATION", "SCANNER"] as const)(
    "does not allow %s to delete a submission",
    async (role) => {
      mocks.getAuthorizedProfile.mockResolvedValue({ id: "user", role, is_active: true });
      const db = setupDeletion();

      const result = await deleteMemberMeetingSubmission({ status: "idle" }, formData());

      expect(result.status).toBe("error");
      expect(db.from).not.toHaveBeenCalled();
    },
  );

  it("removes only the selected submission's owned authorization file", async () => {
    mocks.getAuthorizedProfile.mockResolvedValue({ id: "admin", role: "ADMIN", is_active: true });
    const db = setupDeletion();

    const result = await deleteMemberMeetingSubmission({ status: "idle" }, formData());

    expect(result).toEqual({ status: "success", message: "Submission Rapat Anggota berhasil dihapus dari daftar aktif." });
    expect(db.storageRemove).toHaveBeenCalledExactlyOnceWith([submission.authorization_file_path]);
  });

  it("rejects malformed submission IDs before opening the database", async () => {
    mocks.getAuthorizedProfile.mockResolvedValue({ id: "admin", role: "ADMIN", is_active: true });
    const db = setupDeletion();

    const result = await deleteMemberMeetingSubmission({ status: "idle" }, formData("not-a-uuid"));

    expect(result.status).toBe("error");
    expect(db.from).not.toHaveBeenCalled();
  });
});
