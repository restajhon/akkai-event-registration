-- The operational loader runs through the privileged server client. Explicit
-- grants are required because new Data API entities are not auto-exposed.
GRANT SELECT ON TABLE
  public.participants,
  public.participant_room_assignments,
  public.participant_pickup_assignments,
  public.participant_travel,
  public.sessions,
  public.attendance
TO service_role;
