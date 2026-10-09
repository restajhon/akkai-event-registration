INSERT INTO public.sessions (code, name, event_date, status)
VALUES
  (
    'DAY1_MEMBER_MEETING',
    'Day 1 — Rapat Anggota',
    DATE '2026-10-19',
    'CLOSED'
  ),
  (
    'DAY2_AKKAI_NIGHT',
    'Day 2 — Akkai Night',
    DATE '2026-10-20',
    'CLOSED'
  )
ON CONFLICT (code) DO NOTHING;
