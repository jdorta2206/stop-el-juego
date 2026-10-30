-- Isolated PostgreSQL regression test for STOP funnel event ordering.
-- Uses a temporary table and synthetic rows only; never touches application tables.

BEGIN;

CREATE TEMP TABLE funnel_test_events (
  event_id text NOT NULL,
  event_name text NOT NULL,
  session_id text NOT NULL,
  trusted boolean NOT NULL,
  created_at timestamptz NOT NULL
);

INSERT INTO funnel_test_events (event_id, event_name, session_id, trusted, created_at) VALUES
  ('lobby-before-start', 'game_lobby_view', 'session-a', true,  '2026-01-01T00:00:02Z'),
  ('start-before-lobby', 'game_start',      'session-a', true,  '2026-01-01T00:00:01Z'),
  ('lobby-equal-start',  'game_lobby_view', 'session-b', true,  '2026-01-01T00:00:03Z'),
  ('start-equal-lobby',  'game_start',      'session-b', true,  '2026-01-01T00:00:03Z'),
  ('lobby-before-good',  'game_lobby_view', 'session-c', true,  '2026-01-01T00:00:04Z'),
  ('good-start',         'game_start',      'session-c', true,  '2026-01-01T00:00:05Z'),
  ('start-before-end',   'game_start',      'session-d', true,  '2026-01-01T00:00:06Z'),
  ('end-too-early',      'game_complete',   'session-d', true,  '2026-01-01T00:00:05Z'),
  ('start-before-good-end','game_start',    'session-e', true,  '2026-01-01T00:00:07Z'),
  ('good-end',           'game_complete',   'session-e', true,  '2026-01-01T00:00:08Z'),
  ('lobby-other-session','game_lobby_view', 'session-f', true,  '2026-01-01T00:00:09Z'),
  ('start-other-session','game_start',      'session-z', true,  '2026-01-01T00:00:10Z'),
  ('lobby-untrusted',    'game_lobby_view', 'session-g', true,  '2026-01-01T00:00:11Z'),
  ('start-untrusted',    'game_start',      'session-g', false, '2026-01-01T00:00:12Z'),
  ('lobby-untrusted-event', 'game_lobby_view', 'session-h', false, '2026-01-01T00:00:13Z');

DO $$
DECLARE
  lobby_without_start integer;
  started_without_complete integer;
BEGIN
  SELECT COUNT(*) INTO lobby_without_start
  FROM funnel_test_events lobby
  WHERE lobby.trusted = TRUE
    AND lobby.event_name = 'game_lobby_view'
    AND NOT EXISTS (
      SELECT 1 FROM funnel_test_events gs
      WHERE gs.trusted = TRUE
        AND gs.event_name = 'game_start'
        AND gs.session_id = lobby.session_id
        AND gs.created_at >= lobby.created_at
    );

  IF lobby_without_start <> 3 THEN
    RAISE EXCEPTION 'Expected 3 lobby sessions without a valid later start, got %', lobby_without_start;
  END IF;

  SELECT COUNT(*) INTO started_without_complete
  FROM funnel_test_events start_event
  WHERE start_event.trusted = TRUE
    AND start_event.event_name = 'game_start'
    AND NOT EXISTS (
      SELECT 1 FROM funnel_test_events gc
      WHERE gc.trusted = TRUE
        AND gc.event_name = 'game_complete'
        AND gc.session_id = start_event.session_id
        AND gc.created_at >= start_event.created_at
    );

  IF started_without_complete <> 4 THEN
    RAISE EXCEPTION 'Expected 4 trusted starts without a valid later completion, got %', started_without_complete;
  END IF;
END $$;

ROLLBACK;
