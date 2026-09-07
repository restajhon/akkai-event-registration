-- H-RBAC1.5: align database authorization with the final application matrix.
-- This migration intentionally leaves the previously applied RBAC migration
-- unchanged and only replaces the permission resolver definition.

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
        WHEN 'SUPER_ADMIN' THEN true
        WHEN 'ADMIN' THEN p_permission IN (
          'dashboard.view',
          'participants.view',
          'participants.manage',
          'participants.email',
          'participants.export',
          'rooms.view',
          'rooms.manage',
          'rooms.export',
          'pickup.view',
          'pickup.manage',
          'pickup.export',
          'attendance.view',
          'attendance.export',
          'sessions.view',
          'sessions.manage',
          'scanner.pair',
          'scanner.checkin',
          'display.view',
          'display.manage'
        )
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
          'participants.view',
          'participants.manage',
          'participants.email',
          'participants.export',
          'rooms.view',
          'rooms.manage',
          'rooms.export',
          'pickup.view',
          'pickup.manage',
          'pickup.export',
          'attendance.view',
          'attendance.export'
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
