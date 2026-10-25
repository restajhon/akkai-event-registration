import { describe, expect, it } from "vitest";

import {
  buildMissingLegacySubmissionSnapshot,
  isLegacyBackfillCandidate,
  normalizeLegacySubmissionSnapshot,
  shouldCreateMissingLegacySubmission,
} from "@/lib/forms/legacy-backfill-contract";

const originalVersion = {
  isSeedEvent: true,
  isCapturedLegacyParticipant: true,
  participantId: "participant-1",
  idempotencyKey: "legacy:participant-1",
  formVersionNumber: 1,
  formVersionKind: "PUBLISHED" as const,
};

describe("legacy registration backfill contract", () => {
  it("classifies only captured cohort rows with their deterministic legacy key", () => {
    expect(isLegacyBackfillCandidate({
      ...originalVersion,
      answers: { attends_pai_congress: "false" },
    })).toBe(true);

    expect(isLegacyBackfillCandidate({
      ...originalVersion,
      isCapturedLegacyParticipant: false,
      answers: { attends_pai_congress: false },
    })).toBe(false);

    expect(isLegacyBackfillCandidate({
      ...originalVersion,
      idempotencyKey: "another-key",
      answers: { attends_pai_congress: false },
    })).toBe(false);
  });

  it("normalizes the stored answer object without taking mutable participant answers", () => {
    const submittedAnswersAtMainMigration = {
      full_name: "Nama pada submission",
      attends_pai_congress: false,
      optional_answer: null,
      privacy_consent: true,
    };
    const storedSubmission = { answers: structuredClone(submittedAnswersAtMainMigration) };
    const participantChangedBetweenMigrations = {
      full_name: "Nama setelah diedit admin",
      attends_pai_congress: true,
    };

    const normalized = normalizeLegacySubmissionSnapshot(storedSubmission.answers);

    expect(normalized).toEqual({
      full_name: "Nama pada submission",
      attends_pai_congress: "false",
      optional_answer: null,
      privacy_consent: true,
    });
    expect(normalized.full_name).not.toBe(participantChangedBetweenMigrations.full_name);
    expect(normalized.attends_pai_congress).not.toBe(participantChangedBetweenMigrations.attends_pai_congress);
    expect(storedSubmission.answers).toEqual(submittedAnswersAtMainMigration);
    expect(Object.hasOwn(normalized, "missing_answer")).toBe(false);
  });

  it("does not turn a missing or null historical value into an answer", () => {
    expect(normalizeLegacySubmissionSnapshot({ optional_answer: null })).toEqual({
      optional_answer: null,
    });
    expect(normalizeLegacySubmissionSnapshot({ privacy_consent: true })).toEqual({ privacy_consent: true });
    expect(Object.hasOwn(normalizeLegacySubmissionSnapshot({}), "missing_answer")).toBe(false);
  });

  it("builds a fallback snapshot only from an absent submission and available participant values", () => {
    expect(shouldCreateMissingLegacySubmission(true, false)).toBe(true);
    expect(shouldCreateMissingLegacySubmission(true, true)).toBe(false);
    expect(shouldCreateMissingLegacySubmission(false, false)).toBe(false);

    expect(buildMissingLegacySubmissionSnapshot({
      full_name: "Legacy name",
      email: "legacy@example.test",
      phone_number: null,
      kka_name: null,
      position: null,
      polo_size: null,
      polo_model: null,
      package_type: null,
      participation_scope: null,
      actuarial_consultant_status: null,
      attends_pai_congress: null,
      privacy_consent_at: null,
    })).toEqual({
      full_name: "Legacy name",
      email: "legacy@example.test",
    });
  });
});
