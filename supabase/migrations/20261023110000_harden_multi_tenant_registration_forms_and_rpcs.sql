-- Correct the first CMS tenancy migration without rebuilding existing
-- submission answers from mutable participant columns. Legacy cohort
-- classification uses the explicit ledger captured by the main migration.
-- Prerequisites: 20261022110000_add_company_event_tenancy_and_registration_forms.sql
-- creates the CMS tables, immutable-submission trigger, V7/V8 entry points, and
-- revokes direct V5/V6 access; 20261004100000_fix_collective_registration_travel_constraint_target.sql
-- provides the latest V6 implementation delegated to by V8 (which delegates to V5).

ALTER TABLE public.registration_form_versions
  ADD COLUMN version_kind text NOT NULL DEFAULT 'PUBLISHED';

ALTER TABLE public.registration_form_versions
  DROP CONSTRAINT registration_form_versions_number_valid,
  ADD CONSTRAINT registration_form_versions_kind_valid
    CHECK (version_kind IN ('PUBLISHED', 'LEGACY_BACKFILL')),
  ADD CONSTRAINT registration_form_versions_number_valid
    CHECK (
      (version_kind = 'PUBLISHED' AND version_number > 0)
      OR (version_kind = 'LEGACY_BACKFILL' AND version_number = 0)
    );

COMMENT ON COLUMN public.registration_form_versions.version_kind IS
  'PUBLISHED versions are public CMS releases; LEGACY_BACKFILL is an immutable historical answer contract and is never published.';

DO $$
BEGIN
  IF to_regclass('public.registration_legacy_participant_backfill') IS NULL THEN
    RAISE EXCEPTION 'Cannot classify historical registration submissions: the main migration cohort ledger is missing; refusing timestamp-based inference.';
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
      AND (
        jsonb_typeof(submission.answers->'attends_pai_congress') = 'boolean'
        OR submission.idempotency_key = 'legacy:' || submission.participant_id::text
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.registration_legacy_participant_backfill AS legacy
        WHERE legacy.participant_id = submission.participant_id
          AND legacy.event_id = submission.event_id
      )
  ) THEN
    RAISE EXCEPTION 'Cannot classify a legacy-shaped AKKAI submission because its participant is absent from the captured cohort ledger.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.registration_legacy_participant_backfill AS legacy
    JOIN public.registration_form_submissions AS submission
      ON submission.participant_id = legacy.participant_id
     AND submission.event_id = legacy.event_id
    JOIN public.registration_forms AS form ON form.event_id = legacy.event_id
    JOIN public.registration_form_versions AS original_version
      ON original_version.id = form.published_version_id
    WHERE submission.idempotency_key = 'legacy:' || legacy.participant_id::text
      AND submission.form_version_id IS DISTINCT FROM original_version.id
  ) THEN
    RAISE EXCEPTION 'A marked historical AKKAI submission is linked to an unexpected form version; refusing to guess its provenance.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.registration_legacy_participant_backfill AS legacy
    JOIN public.events AS event ON event.id = legacy.event_id
    JOIN public.companies AS company ON company.id = event.company_id
    LEFT JOIN public.registration_forms AS form ON form.event_id = legacy.event_id
    LEFT JOIN public.registration_form_versions AS original_version
      ON original_version.id = form.published_version_id
     AND original_version.version_number = 1
     AND original_version.version_kind = 'PUBLISHED'
    WHERE company.slug = 'akkai'
      AND event.slug = 'akkai-2026'
      AND original_version.id IS NULL
  ) THEN
    RAISE EXCEPTION 'The captured AKKAI legacy cohort has no published version-1 form to reconcile.';
  END IF;
END;
$$;

-- Only the postgres migration session may perform the narrowly-scoped repair
-- below. Service-role and authenticated callers remain unable to mutate rows.
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

CREATE TEMP TABLE registration_legacy_form_events ON COMMIT DROP AS
SELECT DISTINCT
  form.id AS form_id,
  legacy.event_id,
  original_version.id AS original_version_id
FROM public.registration_legacy_participant_backfill AS legacy
JOIN public.events AS event ON event.id = legacy.event_id
JOIN public.companies AS company ON company.id = event.company_id
JOIN public.registration_forms AS form ON form.event_id = legacy.event_id
JOIN public.registration_form_versions AS original_version
  ON original_version.form_id = form.id
 AND original_version.event_id = legacy.event_id
 AND original_version.version_number = 1
 AND original_version.version_kind = 'PUBLISHED'
WHERE company.slug = 'akkai'
  AND event.slug = 'akkai-2026';

CREATE TEMP TABLE registration_legacy_submission_repairs ON COMMIT DROP AS
SELECT
  submission.id AS submission_id,
  legacy.participant_id,
  legacy.event_id,
  form_event.form_id,
  form_event.original_version_id
FROM public.registration_legacy_participant_backfill AS legacy
JOIN registration_legacy_form_events AS form_event
  ON form_event.event_id = legacy.event_id
JOIN public.registration_form_submissions AS submission
  ON submission.participant_id = legacy.participant_id
 AND submission.event_id = legacy.event_id
 AND submission.idempotency_key = 'legacy:' || legacy.participant_id::text
 AND submission.form_version_id = form_event.original_version_id;

INSERT INTO public.registration_form_versions (
  form_id,
  event_id,
  version_number,
  version_kind,
  config,
  published_by,
  published_at
)
SELECT DISTINCT
  form_event.form_id,
  form_event.event_id,
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
FROM registration_legacy_form_events AS form_event
JOIN public.registration_form_versions AS original_version
  ON original_version.id = form_event.original_version_id
ON CONFLICT (form_id, version_number) DO NOTHING;

SELECT set_config('app.allow_legacy_submission_repair', 'on', true);

CREATE OR REPLACE FUNCTION public.normalize_legacy_registration_submission_snapshot_20261023(
  p_answers jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_answers jsonb := p_answers;
BEGIN
  IF jsonb_typeof(v_answers->'attends_pai_congress') = 'boolean' THEN
    v_answers := jsonb_set(
      v_answers,
      '{attends_pai_congress}',
      to_jsonb(v_answers->>'attends_pai_congress'),
      true
    );
  END IF;

  -- Keep all other snapshot content verbatim, including JSON null values and
  -- absent keys. No participant-column value can be recovered from this row.
  RETURN v_answers;
END;
$$;

REVOKE ALL ON FUNCTION public.normalize_legacy_registration_submission_snapshot_20261023(jsonb)
  FROM PUBLIC, anon, authenticated, service_role;

UPDATE public.registration_form_submissions AS submission
SET form_version_id = legacy_version.id,
    answers = public.normalize_legacy_registration_submission_snapshot_20261023(submission.answers)
FROM registration_legacy_submission_repairs AS repair
JOIN public.registration_form_versions AS legacy_version
  ON legacy_version.form_id = repair.form_id
 AND legacy_version.event_id = repair.event_id
 AND legacy_version.version_number = 0
 AND legacy_version.version_kind = 'LEGACY_BACKFILL'
WHERE submission.id = repair.submission_id;

SELECT set_config('app.allow_legacy_submission_repair', 'off', true);

-- The initial CMS validator accidentally allowed only non-system keys in its
-- top-level key check, rejecting core answers (and therefore legacy rows).
-- Match the application contract: accept declared non-file system/custom
-- fields, and reject unknown keys and file payloads.
CREATE OR REPLACE FUNCTION public.validate_registration_form_answers(
  p_form_version_id uuid,
  p_answers jsonb
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_fields jsonb;
  v_field jsonb;
  v_key text;
  v_type text;
  v_value jsonb;
BEGIN
  IF p_answers IS NULL OR jsonb_typeof(p_answers) <> 'object' THEN
    RETURN false;
  END IF;

  SELECT version.config->'fields' INTO v_fields
  FROM public.registration_form_versions AS version
  WHERE version.id = p_form_version_id;
  IF v_fields IS NULL OR jsonb_typeof(v_fields) <> 'array' THEN
    RETURN false;
  END IF;

  FOR v_key IN SELECT jsonb_object_keys(p_answers) LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(v_fields) AS field
      WHERE field->>'key' = v_key
        AND field->>'type' <> 'file'
    ) THEN
      RETURN false;
    END IF;
  END LOOP;

  FOR v_field IN SELECT value FROM jsonb_array_elements(v_fields) LOOP
    v_key := v_field->>'key';
    v_type := v_field->>'type';
    v_value := p_answers->v_key;

    IF coalesce((v_field->>'required')::boolean, false)
       AND (v_value IS NULL OR v_value = 'null'::jsonb OR v_value = '""'::jsonb OR v_value = 'false'::jsonb) THEN
      RETURN false;
    END IF;
    IF v_value IS NULL OR v_value = 'null'::jsonb THEN
      CONTINUE;
    END IF;

    IF v_type IN ('text', 'email', 'tel', 'textarea', 'date', 'select', 'radio') THEN
      IF jsonb_typeof(v_value) <> 'string' THEN RETURN false; END IF;
      IF v_type IN ('select', 'radio') AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(coalesce(v_field->'options', '[]'::jsonb)) AS option_value
        WHERE option_value = v_value #>> '{}'
      ) THEN RETURN false; END IF;
      IF v_type = 'email' AND (v_value #>> '{}') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RETURN false; END IF;
      IF v_type = 'date' AND (v_value #>> '{}') !~ '^\d{4}-\d{2}-\d{2}$' THEN RETURN false; END IF;
    ELSIF v_type = 'number' THEN
      IF jsonb_typeof(v_value) <> 'number' THEN RETURN false; END IF;
    ELSIF v_type = 'checkbox' THEN
      IF jsonb_typeof(v_value) <> 'boolean' THEN RETURN false; END IF;
    ELSE
      RETURN false;
    END IF;
  END LOOP;

  RETURN true;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.registration_form_submissions AS submission
    JOIN public.registration_form_versions AS version
      ON version.id = submission.form_version_id
    AND version.event_id = submission.event_id
    WHERE version.version_kind = 'LEGACY_BACKFILL'
      AND NOT public.validate_registration_form_answers(version.id, submission.answers)
  ) THEN
    RAISE EXCEPTION 'Legacy registration form backfill failed answer validation.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM registration_legacy_submission_repairs AS repair
    JOIN public.registration_form_submissions AS submission
      ON submission.id = repair.submission_id
    JOIN public.registration_form_versions AS legacy_version
      ON legacy_version.form_id = repair.form_id
     AND legacy_version.event_id = repair.event_id
     AND legacy_version.version_number = 0
     AND legacy_version.version_kind = 'LEGACY_BACKFILL'
    WHERE submission.form_version_id IS DISTINCT FROM legacy_version.id
  ) THEN
    RAISE EXCEPTION 'A captured legacy submission was not assigned to its immutable LEGACY_BACKFILL version.';
  END IF;
END;
$$;

DROP TABLE pg_temp.registration_legacy_submission_repairs;
DROP TABLE pg_temp.registration_legacy_form_events;

-- The v8 wrapper now rejects a certificate intent from a different event
-- before invoking v6/v5 or consuming that intent.
CREATE OR REPLACE FUNCTION public.create_participant_with_registration_reservation_v8(
  p_full_name text,
  p_email text,
  p_phone_number text,
  p_kka_name text,
  p_position text,
  p_polo_size text,
  p_polo_model text,
  p_package_type text,
  p_participation_scope text,
  p_actuarial_consultant_status text,
  p_attends_pai_congress boolean,
  p_privacy_consent_at timestamptz,
  p_certificate_upload_intent_id uuid,
  p_idempotency_key text,
  p_batch_id uuid,
  p_member_number text,
  p_institution text,
  p_travel jsonb,
  p_event_id uuid,
  p_form_version_id uuid,
  p_answers jsonb
)
RETURNS TABLE (
  result_code text,
  participant_id uuid,
  registration_id text,
  full_name text,
  email text,
  qr_token text,
  email_log_id uuid,
  email_generation bigint,
  billing_id uuid,
  billing_number text,
  billing_amount bigint,
  billing_created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result record;
  v_form_is_published boolean;
  v_batch_event_id uuid;
  v_upload_event_id uuid;
BEGIN
  SELECT form.published_version_id = p_form_version_id
  INTO v_form_is_published
  FROM public.registration_forms AS form
  JOIN public.events AS event ON event.id = form.event_id
  WHERE form.event_id = p_event_id AND event.registration_open = true;

  SELECT batch.event_id INTO v_batch_event_id
  FROM public.registration_batches AS batch
  WHERE batch.id = p_batch_id;

  IF NOT coalesce(v_form_is_published, false)
     OR v_batch_event_id IS DISTINCT FROM p_event_id
     OR NOT public.validate_registration_form_answers(p_form_version_id, p_answers) THEN
    RETURN QUERY SELECT 'INVALID_INPUT'::text, NULL::uuid, NULL::text, NULL::text,
      NULL::text, NULL::text, NULL::uuid, NULL::bigint, NULL::uuid, NULL::text,
      NULL::bigint, NULL::timestamptz;
    RETURN;
  END IF;

  IF p_certificate_upload_intent_id IS NOT NULL THEN
    SELECT intent.event_id INTO v_upload_event_id
    FROM public.registration_certificate_upload_intents AS intent
    WHERE intent.id = p_certificate_upload_intent_id
    FOR UPDATE;

    IF v_upload_event_id IS DISTINCT FROM p_event_id THEN
      RETURN QUERY SELECT 'INVALID_INPUT'::text, NULL::uuid, NULL::text, NULL::text,
        NULL::text, NULL::text, NULL::uuid, NULL::bigint, NULL::uuid, NULL::text,
        NULL::bigint, NULL::timestamptz;
      RETURN;
    END IF;
  END IF;

  PERFORM set_config('app.registration_event_id', p_event_id::text, true);
  SELECT * INTO v_result
  FROM public.create_participant_with_registration_reservation_v6(
    p_full_name, p_email, p_phone_number, p_kka_name, p_position, p_polo_size,
    p_polo_model, p_package_type, p_participation_scope,
    p_actuarial_consultant_status, p_attends_pai_congress, p_privacy_consent_at,
    p_certificate_upload_intent_id, p_idempotency_key, p_batch_id,
    p_member_number, p_institution, p_travel
  );

  IF v_result.result_code NOT IN ('CREATED', 'ALREADY_CREATED') THEN
    RETURN QUERY SELECT v_result.result_code::text, NULL::uuid, NULL::text, NULL::text,
      NULL::text, NULL::text, NULL::uuid, NULL::bigint, NULL::uuid, NULL::text,
      NULL::bigint, NULL::timestamptz;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.participants AS participant
    WHERE participant.id = v_result.participant_id
      AND participant.event_id = p_event_id
      AND participant.batch_id = p_batch_id
  ) THEN
    RETURN QUERY SELECT 'IDEMPOTENCY_CONFLICT'::text, NULL::uuid, NULL::text, NULL::text,
      NULL::text, NULL::text, NULL::uuid, NULL::bigint, NULL::uuid, NULL::text,
      NULL::bigint, NULL::timestamptz;
    RETURN;
  END IF;

  INSERT INTO public.registration_form_submissions (
    event_id, form_version_id, participant_id, idempotency_key, answers
  ) VALUES (
    p_event_id, p_form_version_id, v_result.participant_id, btrim(p_idempotency_key), p_answers
  ) ON CONFLICT (event_id, idempotency_key) DO NOTHING;

  RETURN QUERY SELECT v_result.result_code::text, v_result.participant_id::uuid,
    v_result.registration_id::text, v_result.full_name::text, v_result.email::text,
    v_result.qr_token::text, v_result.email_log_id::uuid,
    v_result.email_generation::bigint, v_result.billing_id::uuid,
    v_result.billing_number::text, v_result.billing_amount::bigint,
    v_result.billing_created_at::timestamptz;
END;
$$;

REVOKE ALL ON FUNCTION public.create_participant_with_registration_reservation_v8(
  text, text, text, text, text, text, text, text, text, text, boolean, timestamptz,
  uuid, text, uuid, text, text, jsonb, uuid, uuid, jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_participant_with_registration_reservation_v8(
  text, text, text, text, text, text, text, text, text, text, boolean, timestamptz,
  uuid, text, uuid, text, text, jsonb, uuid, uuid, jsonb
) TO service_role;

-- No application entry point uses these pre-CMS participant reservation RPCs.
-- V4 remains callable by the SECURITY DEFINER V5 implementation as its owner.
REVOKE ALL ON FUNCTION public.create_participant_with_registration_reservation(
  text, text, text, text, text, text, timestamptz
) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.create_participant_with_registration_reservation_v2(
  text, text, text, text, text, text, text, text, timestamptz
) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.create_participant_with_registration_reservation_v3(
  text, text, text, text, text, text, text, text, text, boolean, timestamptz
) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.create_participant_with_registration_reservation_v4(
  text, text, text, text, text, text, text, text, text, text, boolean, timestamptz, uuid
) FROM PUBLIC, anon, authenticated, service_role;
