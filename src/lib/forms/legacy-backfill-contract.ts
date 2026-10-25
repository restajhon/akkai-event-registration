/**
 * Executable specification for the SQL legacy-registration backfill. Keep
 * these predicates and transformations in sync with the ordered migration.
 * The SQL migration uses a captured cohort ledger and deterministic legacy key;
 * existing submissions are normalized from their own answers snapshot.
 */
export type LegacyBackfillCandidate = {
  isSeedEvent: boolean;
  isCapturedLegacyParticipant: boolean;
  participantId: string;
  idempotencyKey: string;
  formVersionNumber: number;
  formVersionKind: "PUBLISHED" | "LEGACY_BACKFILL";
  answers: Record<string, unknown>;
};

export function isLegacyBackfillCandidate(row: LegacyBackfillCandidate) {
  return row.isSeedEvent
    && row.isCapturedLegacyParticipant
    && row.formVersionKind === "PUBLISHED"
    && row.formVersionNumber === 1
    && row.idempotencyKey === `legacy:${row.participantId}`;
}

export function normalizeLegacySubmissionSnapshot(
  answers: Record<string, unknown>,
) {
  const normalized: Record<string, unknown> = { ...answers };
  if (typeof normalized.attends_pai_congress === "boolean") {
    normalized.attends_pai_congress = String(normalized.attends_pai_congress);
  }

  return normalized;
}

export type MissingLegacyParticipant = {
  full_name: string | null;
  email: string | null;
  phone_number: string | null;
  kka_name: string | null;
  position: string | null;
  polo_size: string | null;
  polo_model: string | null;
  package_type: string | null;
  participation_scope: string | null;
  actuarial_consultant_status: string | null;
  attends_pai_congress: boolean | null;
  privacy_consent_at: string | null;
};

/** Fallback answer construction is only for a participant with no submission. */
export function buildMissingLegacySubmissionSnapshot(participant: MissingLegacyParticipant) {
  const candidate: Record<string, unknown> = {
    full_name: participant.full_name,
    email: participant.email,
    phone_number: participant.phone_number,
    kka_name: participant.kka_name,
    position: participant.position,
    polo_size: participant.polo_size,
    polo_model: participant.polo_model,
    package_type: participant.package_type,
    participation_scope: participant.participation_scope,
    actuarial_consultant_status: participant.actuarial_consultant_status,
    attends_pai_congress: participant.attends_pai_congress === null
      ? null
      : String(participant.attends_pai_congress),
    privacy_consent: participant.privacy_consent_at === null ? null : true,
  };

  return Object.fromEntries(
    Object.entries(candidate).filter(([, value]) => value !== null && value !== undefined),
  );
}

export function shouldCreateMissingLegacySubmission(
  isCapturedLegacyParticipant: boolean,
  hasParticipantSubmission: boolean,
) {
  return isCapturedLegacyParticipant && !hasParticipantSubmission;
}
