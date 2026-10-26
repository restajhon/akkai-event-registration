-- Drafts and published versions are separate; existing versions and submissions are immutable.
-- Allow per-event forms to remove or reshape the AKKAI template while retaining stable field keys.
CREATE OR REPLACE FUNCTION public.is_valid_registration_form_config(p_config jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN jsonb_typeof(p_config) <> 'object'
      OR p_config->>'schemaVersion' <> '1'
      OR jsonb_typeof(p_config->'title') <> 'string'
      OR char_length(btrim(p_config->>'title')) NOT BETWEEN 1 AND 200
      OR (p_config->>'title') ~ '[<>]'
      OR lower(p_config->>'title') ~ 'javascript[[:space:]]*:'
      OR jsonb_typeof(p_config->'instructions') <> 'string'
      OR char_length(p_config->>'instructions') > 2000
      OR (p_config->>'instructions') ~ '[<>]'
      OR lower(p_config->>'instructions') ~ 'javascript[[:space:]]*:'
      OR jsonb_typeof(p_config->'sections') <> 'array'
      OR jsonb_array_length(p_config->'sections') NOT BETWEEN 1 AND 30
      OR jsonb_typeof(p_config->'fields') <> 'array'
      OR jsonb_array_length(p_config->'fields') NOT BETWEEN 1 AND 100
    THEN false
    WHEN EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_config->'sections') AS section
      WHERE jsonb_typeof(section->'id') <> 'string'
        OR (section->>'id') !~ '^[a-z][a-z0-9_-]{0,39}$'
        OR jsonb_typeof(section->'title') <> 'string'
        OR char_length(btrim(section->>'title')) NOT BETWEEN 1 AND 120
        OR (section->>'title') ~ '[<>]'
        OR lower(section->>'title') ~ 'javascript[[:space:]]*:'
        OR jsonb_typeof(section->'position') <> 'number'
        OR (section->>'position')::numeric < 0
        OR (section->>'position')::numeric > 1000
        OR (section ? 'description' AND (
          jsonb_typeof(section->'description') <> 'string'
          OR char_length(section->>'description') > 500
          OR (section->>'description') ~ '[<>]'
          OR lower(section->>'description') ~ 'javascript[[:space:]]*:'
        ))
    ) THEN false
    WHEN EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_config->'fields') AS field
      WHERE jsonb_typeof(field->'id') <> 'string'
        OR (field->>'id') !~ '^[a-z][a-z0-9_-]{0,59}$'
        OR jsonb_typeof(field->'key') <> 'string'
        OR (field->>'key') !~ '^[a-z][a-z0-9_]{0,59}$'
        OR jsonb_typeof(field->'type') <> 'string'
        OR field->>'type' NOT IN ('text', 'email', 'tel', 'number', 'textarea', 'date', 'select', 'radio', 'checkbox', 'file')
        OR jsonb_typeof(field->'label') <> 'string'
        OR char_length(btrim(field->>'label')) NOT BETWEEN 1 AND 160
        OR (field->>'label') ~ '[<>]'
        OR lower(field->>'label') ~ 'javascript[[:space:]]*:'
        OR jsonb_typeof(field->'required') <> 'boolean'
        OR jsonb_typeof(field->'sectionId') <> 'string'
        OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_config->'sections') AS section WHERE section->>'id' = field->>'sectionId')
        OR jsonb_typeof(field->'position') <> 'number'
        OR (field->>'position')::numeric < 0
        OR (field->>'position')::numeric > 1000
        OR (field ? 'placeholder' AND (
          jsonb_typeof(field->'placeholder') <> 'string'
          OR char_length(field->>'placeholder') > 200
          OR (field->>'placeholder') ~ '[<>]'
          OR lower(field->>'placeholder') ~ 'javascript[[:space:]]*:'
        ))
        OR (field ? 'instructions' AND (
          jsonb_typeof(field->'instructions') <> 'string'
          OR char_length(field->>'instructions') > 500
          OR (field->>'instructions') ~ '[<>]'
          OR lower(field->>'instructions') ~ 'javascript[[:space:]]*:'
        ))
        OR (field->>'type' IN ('select', 'radio') AND (jsonb_typeof(field->'options') <> 'array' OR jsonb_array_length(field->'options') NOT BETWEEN 1 AND 30))
        OR (field ? 'options' AND jsonb_typeof(field->'options') = 'array' AND EXISTS (
          SELECT 1 FROM jsonb_array_elements(field->'options') AS option_value
          WHERE jsonb_typeof(option_value) <> 'string'
            OR char_length(btrim(option_value #>> '{}')) NOT BETWEEN 1 AND 100
            OR (option_value #>> '{}') ~ '[<>]'
            OR lower(option_value #>> '{}') ~ 'javascript[[:space:]]*:'
        ))
        OR (field->>'type' = 'file' AND field->>'key' <> 'certificate_file')
        OR (field->>'type' = 'file' AND field->>'required' = 'true')
        OR (field ? 'system' AND jsonb_typeof(field->'system') <> 'boolean')
        OR EXISTS (
          SELECT 1 FROM jsonb_each(field) AS property(key, value)
          WHERE property.key NOT IN ('id', 'key', 'type', 'label', 'placeholder', 'instructions', 'required', 'options', 'sectionId', 'position', 'system')
        )
    ) THEN false
    WHEN (SELECT count(*) FROM jsonb_array_elements(p_config->'fields') AS field) <>
         (SELECT count(DISTINCT field->>'key') FROM jsonb_array_elements(p_config->'fields') AS field) THEN false
    WHEN (SELECT count(*) FROM jsonb_array_elements(p_config->'fields') AS field) <>
         (SELECT count(DISTINCT field->>'id') FROM jsonb_array_elements(p_config->'fields') AS field) THEN false
    WHEN (SELECT count(*) FROM jsonb_array_elements(p_config->'sections') AS section) <>
         (SELECT count(DISTINCT section->>'id') FROM jsonb_array_elements(p_config->'sections') AS section) THEN false
    ELSE true
  END;
$$;

REVOKE ALL ON FUNCTION public.is_valid_registration_form_config(jsonb) FROM PUBLIC, anon, authenticated, service_role;
