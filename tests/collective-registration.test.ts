import { beforeEach, describe, expect, it, vi } from "vitest";

import { getRegistrationPackagePrice } from "@/lib/billing/pricing";
import {
  collectiveRegistrationPayloadSchema,
  collectiveParticipantSchema,
} from "@/lib/validation/registration";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  rpc: vi.fn(),
  generateParticipantQrPng: vi.fn(),
  sendRegistrationEmail: vi.fn(),
  sendBillingEmail: vi.fn(),
  loadPublishedEventFormById: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/qr/participant-qr", () => ({ generateParticipantQrPng: mocks.generateParticipantQrPng }));
vi.mock("@/lib/email/registration-email", () => ({ sendRegistrationEmail: mocks.sendRegistrationEmail }));
vi.mock("@/lib/email/billing-email", () => ({ sendBillingEmail: mocks.sendBillingEmail }));
vi.mock("@/lib/tenant/public-events", () => ({
  loadPublishedEventFormById: mocks.loadPublishedEventFormById,
  loadPublishedEventForm: vi.fn(),
}));

import {
  cancelRegistrationCertificateUpload,
  prepareRegistrationCertificateUpload,
  submitCollectiveRegistration,
} from "@/app/register/actions";
import { AKKAI_DEFAULT_REGISTRATION_FORM } from "@/lib/forms/akkai-default-form";

const eventId = "00000000-0000-4000-8000-00000000000a";
const formVersionId = "00000000-0000-4000-8000-00000000000b";
type ParticipantTestData = Omit<ReturnType<typeof participant>, "travel"> & { travel: unknown };

function withFormAnswers<T extends ParticipantTestData>(item: T) {
  return {
    ...item,
    form_answers: {
      full_name: item.full_name,
      email: item.email,
      phone_number: item.phone_number,
      kka_name: item.kka_name,
      position: item.position,
      polo_size: item.polo_size,
      polo_model: item.polo_model,
      package_type: item.package_type,
      participation_scope: item.participation_scope,
      actuarial_consultant_status: item.actuarial_consultant_status,
      attends_pai_congress: item.attends_pai_congress,
      privacy_consent: item.privacy_consent,
    },
  };
}

function payload<T extends ParticipantTestData>(key: string, participants: T[]) {
  return JSON.stringify({
    idempotency_key: key,
    event_id: eventId,
    form_version_id: formVersionId,
    participants: participants.map(withFormAnswers),
  });
}

function participant(index: number, packageType = index % 2 === 0 ? "Twin Share" : "Single") {
  return {
    full_name: `Peserta Kolektif ${index}`,
    email: `peserta-${index}@example.com`,
    phone_number: `0812345678${String(index).padStart(2, "0")}`,
    kka_name: "KKA Maju",
    position: "Konsultan",
    polo_size: "L",
    polo_model: "Lengan Panjang",
    package_type: packageType,
    participation_scope: "Seluruh acara",
    actuarial_consultant_status: "Penerima Grandfathering CIAC",
    attends_pai_congress: "true",
    privacy_consent: true,
    certificate_upload_id: "",
    member_number: "",
    institution: "",
    include_travel: false,
    travel: null,
  };
}

describe("collective registration contract", () => {
  it("validates five independent cards, allows duplicate emails, and preserves package pricing", () => {
    const cards = Array.from({ length: 5 }, (_, index) => participant(index + 1));
    cards[1].email = cards[0].email;
    const parsed = collectiveRegistrationPayloadSchema.safeParse({
      idempotency_key: "00000000-0000-4000-8000-000000000001",
      event_id: eventId,
      form_version_id: formVersionId,
      participants: cards,
    });

    expect(parsed.success).toBe(true);
    expect(getRegistrationPackagePrice("Twin Share")).toBe(6_000_000);
    expect(getRegistrationPackagePrice("Single")).toBe(7_000_000);
    expect(collectiveParticipantSchema.safeParse(cards[0]).success).toBe(true);
  });

  it("accepts a collective card without CIAC status and normalizes it to null", () => {
    const card = participant(1);
    card.actuarial_consultant_status = "";
    const result = collectiveParticipantSchema.safeParse(card);

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.actuarial_consultant_status).toBeNull();
  });

  it("rejects a card with missing required data before submission", () => {
    const result = collectiveParticipantSchema.safeParse({ ...participant(1), full_name: "" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.some((issue) => issue.path[0] === "full_name")).toBe(true);
  });
});

describe("collective registration delivery isolation", () => {
  beforeEach(() => {
    mocks.createAdminClient.mockReset();
    mocks.rpc.mockReset();
    mocks.generateParticipantQrPng.mockClear();
    mocks.sendRegistrationEmail.mockClear();
    mocks.sendBillingEmail.mockClear();
    mocks.generateParticipantQrPng.mockResolvedValue(Buffer.from("qr"));
    mocks.sendRegistrationEmail.mockImplementation(async ({ recipientEmail }: { recipientEmail: string }) =>
      recipientEmail === "peserta-1@example.com"
        ? { success: false, errorCategory: "PROVIDER_ERROR", errorMessage: "provider failed", diagnostic: { message: "provider failed" } }
        : { success: true, providerMessageId: `registration-${recipientEmail}` },
    );
    mocks.sendBillingEmail.mockResolvedValue({ success: true, providerMessageId: "billing" });
    mocks.loadPublishedEventFormById.mockResolvedValue({
      eventId,
      companyId: "00000000-0000-4000-8000-00000000000c",
      eventSlug: "akkai-2026",
      eventCode: "AKKAI26",
      eventName: "AKKAI 2026",
      versionId: formVersionId,
      versionNumber: 1,
      config: AKKAI_DEFAULT_REGISTRATION_FORM,
    });

    const reservations = Array.from({ length: 5 }, (_, index) => {
      const item = participant(index + 1);
      return {
        result_code: "CREATED",
        participant_id: `participant-${index + 1}`,
        registration_id: `AKKAI26-00000${index + 1}`,
        full_name: item.full_name,
        email: item.email,
        qr_token: String.fromCharCode(97 + index).repeat(64),
        email_log_id: `email-log-${index + 1}`,
        email_generation: 0,
        billing_id: `billing-${index + 1}`,
        billing_number: `INV-AKKAI26-00000${index + 1}`,
        billing_amount: index % 2 === 0 ? 6_000_000 : 7_000_000,
        billing_created_at: "2026-09-08T00:00:00.000Z",
      };
    });
    let reservationIndex = 0;
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === "create_participant_with_registration_reservation_v8") {
        return { data: reservations[reservationIndex++], error: null };
      }
      return { data: [{ result_code: "CURRENT_GENERATION" }], error: null };
    });
    const from = vi.fn().mockImplementation((table: string) => {
      let selectedId = "";
      const query = {
        upsert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockImplementation((_column: string, value: string) => {
          selectedId = value;
          return query;
        }),
        single: vi.fn().mockResolvedValue(table === "registration_batches" ? { data: { id: "batch-1", batch_code: "BATCH-ABCDEFGHIJ" }, error: null } : { data: null, error: null }),
        maybeSingle: vi.fn().mockImplementation(async () => {
          if (table === "email_logs") {
            const index = Number(selectedId.split("-").pop()) - 1;
            return { data: { participant_id: `participant-${index + 1}`, recipient_email: `peserta-${index + 1}@example.com`, email_generation: 0, status: "PENDING" }, error: null };
          }
          return { data: { status: "PENDING" }, error: null };
        }),
      };
      return query;
    });
    mocks.createAdminClient.mockReturnValue({ rpc: mocks.rpc, from });
  });

  it("keeps all five participants independent when one registration email fails", async () => {
    const formData = new FormData();
    formData.set("payload", payload("00000000-0000-4000-8000-000000000002", Array.from({ length: 5 }, (_, index) => participant(index + 1))));

    const result = await submitCollectiveRegistration({ status: "idle", fieldErrors: [], participants: [] }, formData);
    expect(result.status).toBe("submitted");
    expect(result.batchCode).toBe("BATCH-ABCDEFGHIJ");
    expect(result.participants).toHaveLength(5);
    expect(result.participants[0].status).toBe("created-email-failed");
    expect(result.participants.slice(1).every((item) => item.status === "created-email-sent")).toBe(true);
    expect(new Set(result.participants.map((item) => item.registrationId)).size).toBe(5);
    expect(new Set(result.participants.map((item) => item.billingNumber)).size).toBe(5);
    expect(mocks.sendRegistrationEmail).toHaveBeenCalledTimes(5);
    expect(mocks.sendBillingEmail).toHaveBeenCalledTimes(5);
    expect(mocks.sendRegistrationEmail.mock.calls.map(([input]) => input.recipientEmail).sort()).toEqual(
      Array.from({ length: 5 }, (_, index) => `peserta-${index + 1}@example.com`).sort(),
    );
    expect(mocks.rpc).toHaveBeenCalledWith(
      "create_participant_with_registration_reservation_v8",
      expect.objectContaining({
        p_actuarial_consultant_status: "Penerima Grandfathering CIAC",
      }),
    );
  });

  it("creates two independent participants with separate billing and idempotency keys", async () => {
    const batchKey = "00000000-0000-4000-8000-000000000004";
    const formData = new FormData();
    const meetingParticipants = [participant(1), participant(2)];
    meetingParticipants[0].participation_scope = "Rapat Anggota AKKAI 2026";
    meetingParticipants[1].participation_scope = "Seluruh acara";
    formData.set("payload", payload(batchKey, meetingParticipants));

    const result = await submitCollectiveRegistration({ status: "idle", fieldErrors: [], participants: [] }, formData);

    expect(result.status).toBe("submitted");
    expect(result.participants).toHaveLength(2);
    expect(result.participants.map((item) => item.registrationId)).toEqual([
      "AKKAI26-000001",
      "AKKAI26-000002",
    ]);
    expect(result.participants.map((item) => item.billingNumber)).toEqual([
      "INV-AKKAI26-000001",
      "INV-AKKAI26-000002",
    ]);
    expect(result.participants.map((item) => item.status)).toEqual([
      "created-email-failed",
      "created-email-sent",
    ]);
    expect(new Set(result.participants.map((item) => item.registrationId)).size).toBe(2);
    expect(new Set(result.participants.map((item) => item.billingNumber)).size).toBe(2);
    expect(mocks.generateParticipantQrPng).toHaveBeenCalledTimes(2);

    const participantReservationCalls = (
      mocks.rpc.mock.calls as Array<[string, { p_idempotency_key: string; p_participation_scope: string }]>
    ).filter(([name]) => name === "create_participant_with_registration_reservation_v8");
    expect(participantReservationCalls.map(([, args]) => args.p_idempotency_key)).toEqual([
      `collective:${batchKey}:1`,
      `collective:${batchKey}:2`,
    ]);
    expect(participantReservationCalls.map(([, args]) => args.p_participation_scope)).toEqual([
      "Rapat Anggota AKKAI 2026",
      "Seluruh acara",
    ]);
    expect(mocks.sendRegistrationEmail).toHaveBeenCalledTimes(2);
    expect(mocks.sendBillingEmail).toHaveBeenCalledTimes(2);
  });

  it("creates exactly two participants with distinct identifiers and persists each travel payload", async () => {
    mocks.sendRegistrationEmail.mockResolvedValue({
      success: true,
      providerMessageId: "registration-accepted",
    });

    const batchKey = "00000000-0000-4000-8000-000000000005";
    const travel = {
      outbound_date: "2026-11-10",
      outbound_time: "08:30",
      outbound_transport_mode: "Pesawat",
      outbound_transport_number: "AB123",
      outbound_origin: "Jakarta",
      outbound_destination: "Semarang",
      return_date: "2026-11-13",
      return_time: "17:00",
      return_transport_mode: "Kereta",
      return_transport_number: "CD456",
      return_destination: "Jakarta",
      extend_stay: false,
    };
    const participants = [participant(1), participant(2)].map((item) => ({
      ...item,
      include_travel: true,
      travel,
    }));
    const formData = new FormData();
    formData.set("payload", payload(batchKey, participants));

    const result = await submitCollectiveRegistration(
      { status: "idle", fieldErrors: [], participants: [] },
      formData,
    );

    expect(result.status).toBe("submitted");
    expect(result.participants).toHaveLength(2);
    expect(result.participants.every((item) => item.status === "created-email-sent")).toBe(true);
    expect(new Set(result.participants.map((item) => item.registrationId)).size).toBe(2);
    expect(new Set(result.participants.map((item) => item.billingNumber)).size).toBe(2);

    const reservations = mocks.rpc.mock.calls.filter(
      ([name]) => name === "create_participant_with_registration_reservation_v8",
    );
    expect(reservations).toHaveLength(2);
    expect(reservations.map(([, args]) => args.p_idempotency_key)).toEqual([
      `collective:${batchKey}:1`,
      `collective:${batchKey}:2`,
    ]);
    expect(reservations.map(([, args]) => args.p_travel)).toEqual([travel, travel]);
  });

  it("keeps a successful participant successful when another participant RPC fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    let reservationIndex = 0;
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === "create_participant_with_registration_reservation_v8") {
        if (reservationIndex++ === 0) {
          return {
            data: null,
            error: {
              code: "42702",
              message: 'column reference "participant_id" is ambiguous',
              details: "It could refer to either a PL/pgSQL variable or a table column.",
            },
          };
        }
        return {
          data: {
            result_code: "CREATED",
            participant_id: "participant-2",
            registration_id: "AKKAI26-000002",
            full_name: "Peserta Kolektif 2",
            email: "peserta-2@example.com",
            qr_token: "b".repeat(64),
            email_log_id: "email-log-2",
            email_generation: 0,
            billing_id: "billing-2",
            billing_number: "INV-AKKAI26-000002",
            billing_amount: 7_000_000,
            billing_created_at: "2026-09-08T00:00:00.000Z",
          },
          error: null,
        };
      }
      return { data: [{ result_code: "CURRENT_GENERATION" }], error: null };
    });

    const travel = {
      outbound_date: "2026-11-10",
      outbound_time: "08:30",
      outbound_transport_mode: "Pesawat",
      outbound_transport_number: "AB123",
      outbound_origin: "Jakarta",
      outbound_destination: "Semarang",
      return_date: "2026-11-13",
      return_time: "17:00",
      return_transport_mode: "Kereta",
      return_transport_number: "CD456",
      return_destination: "Jakarta",
      extend_stay: false,
    };
    const participants = [participant(1), participant(2)].map((item) => ({
      ...item,
      include_travel: true,
      travel,
    }));
    const formData = new FormData();
    formData.set("payload", payload("00000000-0000-4000-8000-000000000006", participants));

    const result = await submitCollectiveRegistration(
      { status: "idle", fieldErrors: [], participants: [] },
      formData,
    );

    expect(result.status).toBe("submitted");
    expect(result.participants.map((item) => item.status)).toEqual([
      "failed",
      "created-email-sent",
    ]);
    expect(result.participants[0].message).toBe("Peserta gagal dibuat karena error sistem.");
    expect(result.participants[1].registrationId).toBe("AKKAI26-000002");
    expect(result.participants[1].billingNumber).toBe("INV-AKKAI26-000002");
    expect(result.participants[1].amount).toBe(7_000_000);
    expect(mocks.sendRegistrationEmail).toHaveBeenCalledTimes(1);
    expect(mocks.sendBillingEmail).toHaveBeenCalledTimes(1);
    const reservationCalls = mocks.rpc.mock.calls.filter(
      ([name]) => name === "create_participant_with_registration_reservation_v8",
    );
    expect(reservationCalls).toHaveLength(2);
    expect(reservationCalls.map(([, args]) => args.p_travel)).toEqual([travel, travel]);
    expect(errorSpy).toHaveBeenCalledWith("Registration stage failed", expect.objectContaining({
      stage: "rpc-v8",
      sqlState: "42702",
      functionName: "create_participant_with_registration_reservation_v8",
      details: "It could refer to either a PL/pgSQL variable or a table column.",
      message: 'column reference "participant_id" is ambiguous',
    }));
    errorSpy.mockRestore();
  });

  it("submits a collective participant without CIAC status and sends null to the RPC", async () => {
    const card = participant(1);
    card.actuarial_consultant_status = "";
    const formData = new FormData();
    formData.set("payload", payload("00000000-0000-4000-8000-000000000003", [card]));

    const result = await submitCollectiveRegistration({ status: "idle", fieldErrors: [], participants: [] }, formData);

    expect(result.status).toBe("submitted");
    expect(mocks.rpc).toHaveBeenCalledWith(
      "create_participant_with_registration_reservation_v8",
      expect.objectContaining({ p_actuarial_consultant_status: null }),
    );
  });

  it.each([
    {
      reason: "signature",
      content: "<html>not a pdf</html>",
      fileMime: "application/pdf",
      blobMime: "application/pdf",
      sizeOffset: 0,
    },
    {
      reason: "MIME",
      content: "%PDF-1.7\nvalid test fixture",
      fileMime: "image/png",
      blobMime: "image/png",
      sizeOffset: 0,
    },
    {
      reason: "size",
      content: "%PDF-1.7\nvalid test fixture",
      fileMime: "application/pdf",
      blobMime: "application/pdf",
      sizeOffset: 1,
    },
    {
      reason: "actual maximum size",
      content: `%PDF-1.7\n${"x".repeat(2 * 1024 * 1024)}`,
      fileMime: "application/pdf",
      blobMime: "application/pdf",
      sizeOffset: 0,
    },
  ])("rejects collective certificate with forged $reason metadata based on stored bytes", async ({
    content,
    fileMime,
    blobMime,
    sizeOffset,
  }) => {
    const card = participant(1);
    card.actuarial_consultant_status = "Peserta Baru";
    card.certificate_upload_id = "00000000-0000-4000-8000-00000000000d";
    const actualSize = new TextEncoder().encode(content).byteLength;
    const intent = {
      id: card.certificate_upload_id,
      event_id: eventId,
      email: card.email,
      storage_path: "certificates/00000000-0000-4000-8000-00000000000e.pdf",
      file_name: "certificate.pdf",
      file_mime: fileMime,
      file_size: actualSize + sizeOffset,
      status: "PENDING",
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    };
    const batchQuery = {
      upsert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: "batch-1", batch_code: "BATCH-ABCDEFGHIJ" }, error: null }),
    };
    const intentQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: intent, error: null }),
      delete: vi.fn().mockReturnThis(),
    };
    const rpc = vi.fn();
    const download = vi.fn().mockResolvedValue({
      data: new Blob([content], { type: blobMime }),
      error: null,
    });
    const remove = vi.fn().mockResolvedValue({ error: null });
    mocks.createAdminClient.mockReturnValue({
      rpc,
      from: vi.fn((table: string) => table === "registration_batches" ? batchQuery : intentQuery),
      storage: { from: vi.fn(() => ({ download, remove })) },
    });

    const formData = new FormData();
    formData.set("payload", payload("00000000-0000-4000-8000-000000000007", [card]));
    const result = await submitCollectiveRegistration(
      { status: "idle", fieldErrors: [], participants: [] },
      formData,
    );

    expect(result.status).toBe("submitted");
    if (result.status === "submitted") expect(result.participants[0].status).toBe("failed");
    expect(download).toHaveBeenCalledWith(intent.storage_path);
    expect(rpc).not.toHaveBeenCalledWith(
      "create_participant_with_registration_reservation_v8",
      expect.anything(),
    );
  });

  it("rejects a collective upload intent owned by another event before downloading or reserving", async () => {
    const card = participant(1);
    card.actuarial_consultant_status = "Peserta Baru";
    card.certificate_upload_id = "00000000-0000-4000-8000-00000000000d";
    const intent = {
      id: card.certificate_upload_id,
      event_id: "00000000-0000-4000-8000-00000000000f",
      email: card.email,
      storage_path: "certificates/foreign.pdf",
      file_name: "certificate.pdf",
      file_mime: "application/pdf",
      file_size: 15,
      status: "PENDING",
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    };
    const batchQuery = {
      upsert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: "batch-1", batch_code: "BATCH-ABCDEFGHIJ" }, error: null }),
    };
    const intentQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: intent, error: null }),
      delete: vi.fn().mockReturnThis(),
    };
    const download = vi.fn();
    const rpc = vi.fn();
    mocks.createAdminClient.mockReturnValue({
      rpc,
      from: vi.fn((table: string) => table === "registration_batches" ? batchQuery : intentQuery),
      storage: { from: vi.fn(() => ({ download, remove: vi.fn() })) },
    });

    const formData = new FormData();
    formData.set("payload", payload("00000000-0000-4000-8000-000000000008", [card]));
    const result = await submitCollectiveRegistration(
      { status: "idle", fieldErrors: [], participants: [] },
      formData,
    );

    expect(result.status).toBe("submitted");
    if (result.status === "submitted") expect(result.participants[0].status).toBe("failed");
    expect(download).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalledWith(
      "create_participant_with_registration_reservation_v8",
      expect.anything(),
    );
  });

  it("does not prepare an upload from an outdated published form version", async () => {
    mocks.loadPublishedEventFormById.mockResolvedValueOnce(null);
    const formData = new FormData();
    formData.set("event_id", eventId);
    formData.set("form_version_id", formVersionId);
    formData.set("file_name", "certificate.pdf");
    formData.set("file_type", "application/pdf");
    formData.set("file_size", "128");
    formData.set("email", "peserta@example.com");

    const result = await prepareRegistrationCertificateUpload(formData);

    expect(result.status).toBe("error");
    expect(mocks.loadPublishedEventFormById).toHaveBeenCalledWith(eventId, formVersionId);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("claims and removes only the same-event pending upload after a stale-form rejection", async () => {
    const card = participant(1);
    card.actuarial_consultant_status = "Peserta Baru";
    card.certificate_upload_id = "00000000-0000-4000-8000-00000000000d";
    mocks.loadPublishedEventFormById.mockResolvedValueOnce(null);

    const remove = vi.fn().mockResolvedValue({ data: [], error: null });
    const cleanupQuery = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    };
    const rpc = vi.fn().mockResolvedValue({
      data: [{ storage_path: "certificates/pending-certificate.pdf" }],
      error: null,
    });
    mocks.createAdminClient.mockReturnValue({
      rpc,
      from: vi.fn(() => cleanupQuery),
      storage: { from: vi.fn(() => ({ remove })) },
    });

    const formData = new FormData();
    formData.set("payload", payload("00000000-0000-4000-8000-000000000009", [card]));
    const result = await submitCollectiveRegistration(
      { status: "idle", fieldErrors: [], participants: [] },
      formData,
    );

    expect(result.status).toBe("general-error");
    expect(mocks.createAdminClient).toHaveBeenCalledWith({ scope: "public-event-cleanup", eventId });
    expect(rpc).toHaveBeenCalledWith("claim_registration_certificate_upload_cleanup", {
      p_event_id: eventId,
      p_intent_id: card.certificate_upload_id,
    });
    expect(remove).toHaveBeenCalledWith(["certificates/pending-certificate.pdf"]);
    expect(cleanupQuery.delete).toHaveBeenCalledOnce();
    expect(cleanupQuery.eq).toHaveBeenCalledWith("id", card.certificate_upload_id);
    expect(cleanupQuery.eq).toHaveBeenCalledWith("status", "CLEANING");
  });

  it("does not remove an upload when the atomic cleanup claim says it was consumed", async () => {
    const remove = vi.fn();
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    mocks.createAdminClient.mockReturnValue({
      rpc,
      from: vi.fn(),
      storage: { from: vi.fn(() => ({ remove })) },
    });

    await cancelRegistrationCertificateUpload(
      "00000000-0000-4000-8000-00000000000d",
      eventId,
      "00000000-0000-4000-8000-00000000000b",
    );

    expect(rpc).toHaveBeenCalledWith("claim_registration_certificate_upload_cleanup", {
      p_event_id: eventId,
      p_intent_id: "00000000-0000-4000-8000-00000000000d",
    });
    expect(remove).not.toHaveBeenCalled();
  });

  it("cleans same-event pending uploads when batch creation fails", async () => {
    const card = participant(1);
    card.actuarial_consultant_status = "Peserta Baru";
    card.certificate_upload_id = "00000000-0000-4000-8000-00000000000d";
    const batchQuery = {
      upsert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: new Error("batch insert failed") }),
    };
    const remove = vi.fn().mockResolvedValue({ data: [], error: null });
    const cleanupQuery = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    };
    const cleanupRpc = vi.fn().mockResolvedValue({
      data: [{ storage_path: "certificates/batch-failure.pdf" }],
      error: null,
    });
    const cleanupClient = {
      rpc: cleanupRpc,
      from: vi.fn(() => cleanupQuery),
      storage: { from: vi.fn(() => ({ remove })) },
    };
    mocks.createAdminClient.mockImplementation((options: { scope?: string }) =>
      options.scope === "public-event-cleanup"
        ? cleanupClient
        : { from: vi.fn(() => batchQuery) },
    );

    const formData = new FormData();
    formData.set("payload", payload("00000000-0000-4000-8000-000000000010", [card]));
    const result = await submitCollectiveRegistration(
      { status: "idle", fieldErrors: [], participants: [] },
      formData,
    );

    expect(result.status).toBe("general-error");
    expect(cleanupRpc).toHaveBeenCalledWith("claim_registration_certificate_upload_cleanup", {
      p_event_id: eventId,
      p_intent_id: card.certificate_upload_id,
    });
    expect(remove).toHaveBeenCalledWith(["certificates/batch-failure.pdf"]);
  });

  it("cleans same-event uploads when the collective batch action throws before processing", async () => {
    const card = participant(1);
    card.actuarial_consultant_status = "Peserta Baru";
    card.certificate_upload_id = "00000000-0000-4000-8000-00000000000d";
    const remove = vi.fn().mockResolvedValue({ data: [], error: null });
    const cleanupQuery = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    };
    const cleanupRpc = vi.fn().mockResolvedValue({
      data: [{ storage_path: "certificates/batch-catch.pdf" }],
      error: null,
    });
    const cleanupClient = {
      rpc: cleanupRpc,
      from: vi.fn(() => cleanupQuery),
      storage: { from: vi.fn(() => ({ remove })) },
    };
    mocks.createAdminClient.mockImplementation((options: { scope?: string }) => {
      if (options.scope === "public-event-cleanup") return cleanupClient;
      throw new Error("event client creation failed");
    });

    const formData = new FormData();
    formData.set("payload", payload("00000000-0000-4000-8000-000000000011", [card]));
    const result = await submitCollectiveRegistration(
      { status: "idle", fieldErrors: [], participants: [] },
      formData,
    );

    expect(result.status).toBe("general-error");
    expect(cleanupRpc).toHaveBeenCalledWith("claim_registration_certificate_upload_cleanup", {
      p_event_id: eventId,
      p_intent_id: card.certificate_upload_id,
    });
    expect(remove).toHaveBeenCalledWith(["certificates/batch-catch.pdf"]);
  });
});
