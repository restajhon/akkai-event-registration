-- Reconcile only the pre-CMS participant cohort frozen by the main CMS
-- migration. The cohort ledger and its copied participant-column values are
-- the reliable source marker; created_at is not a cohort cutoff. Existing
-- answers are normalized from submission.answers, and a missing submission is
-- synthesized only when the captured historical participant has no submission.
-- Prerequisites include the participant/form/upload tables from
-- 20260908100000_add_registration_certificate_billing.sql, the batch and
-- V5 idempotency support from 20260916100000_allow_shared_participant_emails.sql,
-- the batch and V6/V5 chain from 20260917100000_add_registration_batches.sql,
-- 20261004100000_fix_collective_registration_travel_constraint_target.sql,
-- and the CMS tables/immutability trigger from
-- 20261022110000_add_company_event_tenancy_and_registration_forms.sql.
-- This follows 20261023110000_harden_multi_tenant_registration_forms_and_rpcs.sql,
-- which adds version_kind and normalizes existing snapshots without replacing
-- their contents from mutable participant columns.

DO $$
BEGIN
  IF to_regclass('public.registration_legacy_participant_backfill') IS NULL
     OR to_regprocedure('public.normalize_legacy_registration_submission_snapshot_20261023(jsonb)') IS NULL THEN
    RAISE EXCEPTION 'Cannot reconcile historical registration data: the captured cohort ledger or snapshot normalizer is missing; refusing to infer provenance.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.registration_legacy_participant_backfill AS legacy
    JOIN public.events AS event ON event.id = legacy.event_id
    JOIN public.companies AS company ON company.id = event.company_id
    WHERE company.slug <> 'akkai' OR event.slug <> 'akkai-2026'
  ) THEN
    RAISE EXCEPTION 'The historical registration cohort ledger contains a participant outside the original AKKAI event.';
  END IF;
END;
$$;

CREATE TEMP TABLE registration_legacy_submission_repairs ON COMMIT DROP AS
SELECT
  submission.id AS submission_id,
  legacy.participant_id,
  legacy.event_id,
  form.id AS form_id,
  original_version.id AS original_version_id
FROM public.registration_legacy_participant_backfill AS legacy
JOIN public.registration_form_submissions AS submission
  ON submission.participant_id = legacy.participant_id
 AND submission.event_id = legacy.event_id
 AND submission.idempotency_key = 'legacy:' || legacy.participant_id::text
JOIN public.registration_forms AS form
  ON form.event_id = legacy.event_id
JOIN public.events AS event
  ON event.id = legacy.event_id
JOIN public.companies AS company
  ON company.id = event.company_id
JOIN public.registration_form_versions AS original_version
  ON original_version.form_id = form.id
 AND original_version.event_id = legacy.event_id
 AND original_version.version_number = 1
 AND original_version.version_kind = 'PUBLISHED'
WHERE company.slug = 'akkai'
  AND event.slug = 'akkai-2026'
  AND submission.form_version_id = original_version.id;

CREATE TEMP TABLE registration_legacy_missing_submissions ON COMMIT DROP AS
SELECT
  legacy.participant_id,
  legacy.event_id,
  legacy.source_created_at,
  legacy.full_name,
  legacy.email,
  legacy.phone_number,
  legacy.kka_name,
  legacy.position,
  legacy.polo_size,
  legacy.polo_model,
  legacy.package_type,
  legacy.participation_scope,
  legacy.actuarial_consultant_status,
  legacy.attends_pai_congress,
  legacy.privacy_consent_at,
  'legacy:' || legacy.participant_id::text AS idempotency_key,
  form.id AS form_id,
  original_version.id AS original_version_id
FROM public.registration_legacy_participant_backfill AS legacy
JOIN public.registration_forms AS form
  ON form.event_id = legacy.event_id
JOIN public.events AS event
  ON event.id = legacy.event_id
JOIN public.companies AS company
  ON company.id = event.company_id
JOIN public.registration_form_versions AS original_version
  ON original_version.form_id = form.id
 AND original_version.event_id = legacy.event_id
 AND original_version.version_number = 1
 AND original_version.version_kind = 'PUBLISHED'
WHERE company.slug = 'akkai'
  AND event.slug = 'akkai-2026'
  AND NOT EXISTS (
    SELECT 1
    FROM public.registration_form_submissions AS submission
    WHERE submission.participant_id = legacy.participant_id
      AND submission.event_id = legacy.event_id
  );

CREATE TEMP TABLE registration_legacy_form_events ON COMMIT DROP AS
SELECT DISTINCT form_id, event_id, original_version_id
FROM (
  SELECT form_id, event_id, original_version_id
  FROM registration_legacy_submission_repairs
  UNION ALL
  SELECT form_id, event_id, original_version_id
  FROM registration_legacy_missing_submissions
) AS legacy_form;

INSERT INTO public.registration_form_versions (
  form_id,
  event_id,
  version_number,
  version_kind,
  config,
  published_by,
  published_at
)
SELECT
  legacy_form.form_id,
  legacy_form.event_id,
  0,
  'LEGACY_BACKFILL',
  jsonb_set(
    original_version.config,
    '{fields}',
    (
      SELECT jsonb_agg(
        jsonb_set(
          CASE field.value->>'key'
            WHEN 'participation_scope' THEN jsonb_set(
              field.value,
              '{options}',
              '["Seluruh acara", "Rapat Anggota", "Rapat Anggota AKKAI 2026", "Seminar Profesi Konsultan Aktuaria", "Seminar Profesi Konsultan Akruaria"]'::jsonb
            )
            WHEN 'actuarial_consultant_status' THEN jsonb_set(
              field.value,
              '{options}',
              '["Peserta Baru", "Penerima Grandfathering", "Penerima Grandfathering CIAC"]'::jsonb
            )
            ELSE field.value
          END,
          '{required}',
          'false'::jsonb
        )
        ORDER BY field.ordinality
      )
      FROM jsonb_array_elements(original_version.config->'fields')
        WITH ORDINALITY AS field(value, ordinality)
    )
  ),
  NULL::uuid,
  now()
FROM registration_legacy_form_events AS legacy_form
JOIN public.registration_form_versions AS original_version
  ON original_version.id = legacy_form.original_version_id
ON CONFLICT (form_id, version_number) DO NOTHING;

CREATE OR REPLACE FUNCTION public.reject_registration_form_submission_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND current_user = 'postgres'
     AND current_setting('app.allow_legacy_submission_repair', true) = 'on' THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Registration form submissions are immutable.' USING ERRCODE = '55000';
END;
$$;

SELECT set_config('app.allow_legacy_submission_repair', 'on', true);

UPDATE public.registration_form_submissions AS submission
SET form_version_id = legacy_version.id,
    answers = public.normalize_legacy_registration_submission_snapshot_20261023(
      submission.answers
    )
FROM registration_legacy_submission_repairs AS repair
JOIN public.registration_form_versions AS legacy_version
  ON legacy_version.form_id = repair.form_id
 AND legacy_version.event_id = repair.event_id
 AND legacy_version.version_number = 0
 AND legacy_version.version_kind = 'LEGACY_BACKFILL'
WHERE submission.id = repair.submission_id;

SELECT set_config('app.allow_legacy_submission_repair', 'off', true);

-- No original answers payload exists for these omissions. Use only the
-- participant-column values frozen by the main migration; this is a best
-- available source snapshot, not proof of the exact answers originally typed.
-- source_created_at is used as an approximate submitted_at because no
-- submission-time source was retained. Nullable values are omitted, and a
-- consent answer is included only when its persisted consent timestamp exists.
INSERT INTO public.registration_form_submissions (
  event_id,
  form_version_id,
  participant_id,
  idempotency_key,
  answers,
  submitted_at
)
SELECT
  missing.event_id,
  legacy_version.id,
  missing.participant_id,
  missing.idempotency_key,
  jsonb_strip_nulls(jsonb_build_object(
    'full_name', missing.full_name,
    'email', missing.email,
    'phone_number', missing.phone_number,
    'kka_name', missing.kka_name,
    'position', missing.position,
    'polo_size', missing.polo_size,
    'polo_model', missing.polo_model,
    'package_type', missing.package_type,
    'participation_scope', missing.participation_scope,
    'actuarial_consultant_status', missing.actuarial_consultant_status,
    'attends_pai_congress', CASE
      WHEN missing.attends_pai_congress IS TRUE THEN to_jsonb('true'::text)
      WHEN missing.attends_pai_congress IS FALSE THEN to_jsonb('false'::text)
      ELSE NULL::jsonb
    END,
    'privacy_consent', CASE
      WHEN missing.privacy_consent_at IS NOT NULL THEN to_jsonb(true)
      ELSE NULL::jsonb
    END
  )),
  missing.source_created_at
FROM registration_legacy_missing_submissions AS missing
JOIN public.registration_form_versions AS legacy_version
  ON legacy_version.form_id = missing.form_id
 AND legacy_version.event_id = missing.event_id
 AND legacy_version.version_number = 0
 AND legacy_version.version_kind = 'LEGACY_BACKFILL'
ON CONFLICT (event_id, idempotency_key) DO NOTHING;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.registration_form_submissions AS submission
    LEFT JOIN public.registration_form_versions AS version
      ON version.id = submission.form_version_id
     AND version.event_id = submission.event_id
    WHERE version.id IS NULL
       OR NOT public.validate_registration_form_answers(version.id, submission.answers)
  ) THEN
    RAISE EXCEPTION 'A registration form submission remains invalid after legacy reconciliation.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.registration_legacy_participant_backfill AS legacy
    JOIN public.registration_form_submissions AS submission
      ON submission.participant_id = legacy.participant_id
     AND submission.event_id = legacy.event_id
     AND submission.idempotency_key = 'legacy:' || legacy.participant_id::text
    JOIN public.registration_form_versions AS version
      ON version.id = submission.form_version_id
     AND version.event_id = submission.event_id
    JOIN public.events AS event ON event.id = submission.event_id
    JOIN public.companies AS company ON company.id = event.company_id
    WHERE company.slug = 'akkai'
      AND event.slug = 'akkai-2026'
      AND version.version_number = 1
      AND version.version_kind = 'PUBLISHED'
  ) THEN
    RAISE EXCEPTION 'A marked historical submission was not normalized to LEGACY_BACKFILL.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.registration_legacy_participant_backfill AS legacy
    JOIN public.events AS event ON event.id = legacy.event_id
    JOIN public.companies AS company ON company.id = event.company_id
    WHERE company.slug = 'akkai'
      AND event.slug = 'akkai-2026'
      AND NOT EXISTS (
        SELECT 1
        FROM public.registration_form_submissions AS submission
        WHERE submission.participant_id = legacy.participant_id
          AND submission.event_id = legacy.event_id
      )
  ) THEN
    RAISE EXCEPTION 'A historical AKKAI participant has no registration form submission after reconciliation.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.participants AS participant
    JOIN public.events AS event ON event.id = participant.event_id
    JOIN public.companies AS company ON company.id = event.company_id
    WHERE company.slug = 'akkai'
      AND event.slug = 'akkai-2026'
      AND NOT EXISTS (
        SELECT 1
        FROM public.registration_form_submissions AS submission
        WHERE submission.participant_id = participant.id
          AND submission.event_id = participant.event_id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.registration_legacy_participant_backfill AS legacy
        WHERE legacy.participant_id = participant.id
          AND legacy.event_id = participant.event_id
      )
  ) THEN
    RAISE EXCEPTION 'An AKKAI participant without a submission is outside the captured historical cohort; refusing to synthesize answers.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.registration_form_submissions AS submission
    JOIN public.registration_form_versions AS version
      ON version.id = submission.form_version_id
     AND version.event_id = submission.event_id
    JOIN public.events AS event ON event.id = submission.event_id
    JOIN public.companies AS company ON company.id = event.company_id
    WHERE company.slug = 'akkai'
      AND event.slug = 'akkai-2026'
      AND version.version_number = 1
      AND jsonb_typeof(submission.answers->'attends_pai_congress') = 'boolean'
  ) THEN
    RAISE EXCEPTION 'A boolean-select legacy snapshot remains unclassified; refusing to infer its historical provenance.';
  END IF;
END;
$$;

DROP TABLE pg_temp.registration_legacy_form_events;
DROP TABLE pg_temp.registration_legacy_missing_submissions;
DROP TABLE pg_temp.registration_legacy_submission_repairs;

DROP FUNCTION public.normalize_legacy_registration_submission_snapshot_20261023(jsonb);
DROP TABLE public.registration_legacy_participant_backfill;

-- A cleanup claim serializes against V4's SELECT ... FOR UPDATE. Once claimed,
-- V4 can no longer consume the intent; if V4 wins first, the cleanup returns
-- no path and a linked certificate is retained.
ALTER TABLE public.registration_certificate_upload_intents
  DROP CONSTRAINT registration_certificate_intent_status_valid,
  DROP CONSTRAINT registration_certificate_intent_consumed_at_valid,
  ADD CONSTRAINT registration_certificate_intent_status_valid
    CHECK (status IN ('PENDING', 'CLEANING', 'CONSUMED')),
  ADD CONSTRAINT registration_certificate_intent_consumed_at_valid
    CHECK (
      (status IN ('PENDING', 'CLEANING') AND consumed_at IS NULL)
      OR (status = 'CONSUMED' AND consumed_at IS NOT NULL)
    );

CREATE OR REPLACE FUNCTION public.claim_registration_certificate_upload_cleanup(
  p_event_id uuid,
  p_intent_id uuid
)
RETURNS TABLE (storage_path text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_intent public.registration_certificate_upload_intents%ROWTYPE;
BEGIN
  IF p_event_id IS NULL OR p_intent_id IS NULL THEN
    RETURN;
  END IF;

  SELECT intent.* INTO v_intent
  FROM public.registration_certificate_upload_intents AS intent
  WHERE intent.id = p_intent_id
    AND intent.event_id = p_event_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_intent.status = 'CONSUMED'
     OR v_intent.status NOT IN ('PENDING', 'CLEANING')
     OR EXISTS (
       SELECT 1
       FROM public.registration_documents AS document
       WHERE document.storage_path = v_intent.storage_path
         AND document.event_id = p_event_id
     ) THEN
    RETURN;
  END IF;

  IF v_intent.status = 'PENDING' THEN
    UPDATE public.registration_certificate_upload_intents AS intent
    SET status = 'CLEANING'
    WHERE intent.id = p_intent_id
      AND intent.event_id = p_event_id
      AND intent.status = 'PENDING';
    IF NOT FOUND THEN
      RETURN;
    END IF;
  END IF;

  RETURN QUERY SELECT v_intent.storage_path;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_registration_certificate_upload_cleanup(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_registration_certificate_upload_cleanup(uuid, uuid)
  TO service_role;
