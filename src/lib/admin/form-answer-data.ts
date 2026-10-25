import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";

export type RegistrationFormAnswer = {
  key: string;
  label: string;
  value: string;
  versionNumber: number;
};

type SubmissionRow = {
  participant_id: string | null;
  form_version_id: string;
  answers: Record<string, unknown>;
};

type VersionRow = {
  id: string;
  version_number: number;
  config: {
    fields?: Array<{ key?: string; label?: string; system?: boolean }>;
  };
};

function displayAnswer(value: unknown) {
  if (typeof value === "boolean") return value ? "Ya" : "Tidak";
  if (typeof value === "string" || typeof value === "number") return String(value);
  return "";
}

/** Load only additional fields from the immutable form version used at submit time. */
export async function loadRegistrationFormAnswers(
  supabase: ReturnType<typeof createAdminClient>,
  participantIds: string[],
): Promise<Map<string, RegistrationFormAnswer[]> | null> {
  const byParticipant = new Map<string, RegistrationFormAnswer[]>();
  if (participantIds.length === 0) return byParticipant;

  const submissionsResult = await supabase
    .from("registration_form_submissions")
    .select("participant_id, form_version_id, answers")
    .in("participant_id", participantIds);
  if (submissionsResult.error) return null;

  const submissions = (submissionsResult.data ?? []) as SubmissionRow[];
  const versionIds = Array.from(new Set(submissions.map((row) => row.form_version_id)));
  if (versionIds.length === 0) return byParticipant;

  const versionsResult = await supabase
    .from("registration_form_versions")
    .select("id, version_number, config")
    .in("id", versionIds);
  if (versionsResult.error) return null;

  const versions = new Map(
    ((versionsResult.data ?? []) as VersionRow[]).map((row) => [row.id, row]),
  );
  for (const submission of submissions) {
    if (!submission.participant_id) continue;
    const version = versions.get(submission.form_version_id);
    if (!version) continue;
    const fields = new Map(
      (version.config.fields ?? []).map((field) => [field.key ?? "", field]),
    );
    const answers = Object.entries(submission.answers ?? {}).flatMap(([key, value]) => {
      const field = fields.get(key);
      const displayValue = displayAnswer(value);
      if (!field || field.system === true || !displayValue) return [];
      return [{
        key,
        label: field.label || key,
        value: displayValue,
        versionNumber: version.version_number,
      }];
    });
    byParticipant.set(submission.participant_id, answers);
  }
  return byParticipant;
}
