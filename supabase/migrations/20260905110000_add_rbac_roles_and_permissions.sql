-- Add the H3D7 RBAC roles while retaining ADMIN and OPERATOR compatibility.
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'REGISTRATION';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'OPERATIONAL';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'SCANNER';

-- RLS controls which profile rows are visible; these grants allow the SSR
-- profile lookup and the server-only access-management screen to reach RLS.
GRANT SELECT ON TABLE
  public.profiles,
  public.sessions
TO authenticated, service_role;

GRANT SELECT, UPDATE ON TABLE
  public.profiles,
  public.participants,
  public.sessions
TO service_role;

GRANT SELECT, INSERT, UPDATE ON TABLE
  public.scanner_stations
TO service_role;

GRANT SELECT, INSERT, UPDATE ON TABLE
  public.attendance,
  public.scan_events
TO service_role;

-- Keep the database authorization boundary aligned with the application
-- permission matrix. Role comparisons use text so this helper is easy to
-- evolve without relying on enum ordering.
CREATE OR REPLACE FUNCTION public.has_permission(
  p_profile_id uuid,
  p_permission text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS profile
    WHERE profile.id = p_profile_id
      AND profile.is_active = true
      AND CASE profile.role::text
        WHEN 'ADMIN' THEN true
        WHEN 'SUPER_ADMIN' THEN true
        WHEN 'OPERATOR' THEN p_permission IN (
          'scanner.pair',
          'scanner.checkin',
          'display.view'
        )
        WHEN 'REGISTRATION' THEN p_permission IN (
          'dashboard.view',
          'participants.view',
          'participants.manage',
          'participants.email',
          'participants.export',
          'attendance.view'
        )
        WHEN 'OPERATIONAL' THEN p_permission IN (
          'dashboard.view',
          'rooms.view',
          'rooms.manage',
          'rooms.export',
          'pickup.view',
          'pickup.manage',
          'pickup.export',
          'attendance.view',
          'attendance.export',
          'display.view'
        )
        WHEN 'SCANNER' THEN p_permission IN (
          'scanner.pair',
          'scanner.checkin',
          'display.view'
        )
        ELSE false
      END
  );
$$;

REVOKE ALL ON FUNCTION public.has_permission(uuid, text)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text)
TO authenticated, service_role;

-- Access management is kept behind a privileged RPC so the actor check cannot
-- be bypassed by a future server route that uses the service client.
CREATE OR REPLACE FUNCTION public.update_profile_access(
  p_actor_id uuid,
  p_target_id uuid,
  p_role public.user_role,
  p_is_active boolean
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_target public.profiles%ROWTYPE;
BEGIN
  IF NOT public.has_permission(p_actor_id, 'access.manage') THEN
    RETURN 'UNAUTHORIZED';
  END IF;

  SELECT profile.*
  INTO v_target
  FROM public.profiles AS profile
  WHERE profile.id = p_target_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'NOT_FOUND';
  END IF;

  IF p_actor_id = p_target_id AND p_is_active = false THEN
    RETURN 'SELF_DEACTIVATE';
  END IF;

  IF p_actor_id = p_target_id
     AND p_role::text NOT IN ('ADMIN', 'SUPER_ADMIN') THEN
    RETURN 'SELF_LOCKOUT';
  END IF;

  IF public.has_permission(v_target.id, 'access.manage')
     AND (
       p_is_active = false
       OR p_role::text NOT IN ('ADMIN', 'SUPER_ADMIN')
     )
     AND NOT EXISTS (
       SELECT 1
       FROM public.profiles AS other_profile
       WHERE other_profile.id <> v_target.id
         AND other_profile.is_active = true
         AND public.has_permission(other_profile.id, 'access.manage')
     ) THEN
    RETURN 'LAST_ACCESS_ADMIN';
  END IF;

  UPDATE public.profiles
  SET role = p_role,
      is_active = p_is_active,
      updated_at = now()
  WHERE id = p_target_id;

  RETURN 'UPDATED';
END;
$$;

REVOKE ALL ON FUNCTION public.update_profile_access(uuid, uuid, public.user_role, boolean)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.update_profile_access(uuid, uuid, public.user_role, boolean)
TO service_role;

-- Re-apply the database role checks from the latest definitions without
-- duplicating their long operational bodies in this migration.
DO $$
DECLARE
  v_definition text;
BEGIN
  SELECT pg_get_functiondef(p.oid)
  INTO v_definition
  FROM pg_proc AS p
  INNER JOIN pg_namespace AS n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'pair_scanner_station';
  v_definition := regexp_replace(
    v_definition,
    'v_profile\.role NOT IN\s*\(\s*''ADMIN''::public\.user_role,\s*''OPERATOR''::public\.user_role\s*\)',
    'NOT public.has_permission(v_profile.id, ''scanner.pair'')',
    'g'
  );
  EXECUTE v_definition;

  FOREACH v_definition IN ARRAY ARRAY['process_qr_scan', 'process_manual_check_in']
  LOOP
    SELECT pg_get_functiondef(p.oid)
    INTO v_definition
    FROM pg_proc AS p
    INNER JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = v_definition;
    v_definition := regexp_replace(
      v_definition,
      'v_operator\.role NOT IN\s*\(\s*''ADMIN''::public\.user_role,\s*''OPERATOR''::public\.user_role\s*\)',
      'NOT public.has_permission(v_operator.id, ''scanner.checkin'')',
      'g'
    );
    EXECUTE v_definition;
  END LOOP;

  FOREACH v_definition IN ARRAY ARRAY[
    'upsert_participant_room_assignment',
    'upsert_participant_pickup_assignment'
  ]
  LOOP
    SELECT pg_get_functiondef(p.oid)
    INTO v_definition
    FROM pg_proc AS p
    INNER JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = v_definition;
    v_definition := regexp_replace(
      v_definition,
      'v_actor\.role <> ''ADMIN''::public\.user_role',
      CASE
        WHEN v_definition LIKE '%upsert_participant_room_assignment%' THEN
          'NOT public.has_permission(v_actor.id, ''rooms.manage'')'
        ELSE
          'NOT public.has_permission(v_actor.id, ''pickup.manage'')'
      END,
      'g'
    );
    EXECUTE v_definition;
  END LOOP;

  SELECT pg_get_functiondef(p.oid)
  INTO v_definition
  FROM pg_proc AS p
  INNER JOIN pg_namespace AS n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'correct_participant_email';
  v_definition := regexp_replace(
    v_definition,
    'AND role = ''ADMIN''::public\.user_role',
    'AND public.has_permission(p_changed_by, ''participants.email'')',
    'g'
  );
  EXECUTE v_definition;
END;
$$;

DROP POLICY IF EXISTS live_display_broadcast_select ON realtime.messages;

CREATE POLICY live_display_broadcast_select
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.messages.extension = 'broadcast'
  AND (
    realtime.topic() LIKE 'akkai:dashboard:%'
    OR realtime.topic() LIKE 'akkai:display:station:%'
  )
  AND public.has_permission((SELECT auth.uid()), 'display.view')
);
