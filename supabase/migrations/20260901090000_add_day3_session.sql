INSERT INTO public.sessions (code, name, event_date, status)
VALUES (
  'DAY3',
  'Registrasi Day 3',
  DATE '2026-10-21',
  'CLOSED'
)
ON CONFLICT (code) DO NOTHING;
