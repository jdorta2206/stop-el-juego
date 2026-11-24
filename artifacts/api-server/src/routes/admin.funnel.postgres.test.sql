-- Isolated PostgreSQL regression test for STOP activity telemetry.
-- Counts sessions, event totals, and distinct actors independently. It deliberately
-- does not infer a per-game completion or abandonment from session/player identity.

BEGIN;

CREATE TEMP TABLE funnel_test_events (
  event_id text NOT NULL,
  event_name text NOT NULL,
  session_id text,
  player_id text,
  trusted boolean NOT NULL
);

INSERT INTO funnel_test_events (event_id, event_name, session_id, player_id, trusted) VALUES
  ('session-1', 'session_start', 'session-a', 'player-a', true),
  ('lobby-1',   'game_lobby_view', 'session-a', 'player-a', true),
  ('start-1',   'game_start', 'session-a', 'player-a', true),
  ('start-2',   'game_start', 'session-b', 'player-a', true),
  -- A final from a different session remains a separate event; it is not
  -- paired with either start because this fixture has no game identifier.
  ('final-1',   'game_complete', 'session-c', 'player-a', true),
  ('session-2', 'session_start', 'session-b', NULL, true),
  ('lobby-2',   'game_lobby_view', 'session-b', NULL, true),
  ('start-3',   'game_start', 'session-d', NULL, true),
  ('final-untrusted', 'game_complete', 'session-e', 'player-b', false);

DO $$
DECLARE
  session_total integer;
  lobby_total integer;
  start_events integer;
  final_events integer;
  start_actors integer;
  final_actors integer;
BEGIN
  SELECT COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'session_start'),
         COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'game_lobby_view'),
         COUNT(*) FILTER (WHERE event_name = 'game_start'),
         COUNT(*) FILTER (WHERE event_name = 'game_complete'),
         COUNT(DISTINCT COALESCE('player:' || player_id, 'session:' || session_id)) FILTER (WHERE event_name = 'game_start'),
         COUNT(DISTINCT COALESCE('player:' || player_id, 'session:' || session_id)) FILTER (WHERE event_name = 'game_complete')
    INTO session_total, lobby_total, start_events, final_events, start_actors, final_actors
  FROM funnel_test_events
  WHERE trusted = TRUE;

  IF session_total <> 2 OR lobby_total <> 2 THEN
    RAISE EXCEPTION 'Expected 2 sessions and 2 lobby sessions; got % and %', session_total, lobby_total;
  END IF;
  IF start_events <> 3 OR final_events <> 1 THEN
    RAISE EXCEPTION 'Expected 3 starts and 1 final event; got % and %', start_events, final_events;
  END IF;
  IF start_actors <> 2 OR final_actors <> 1 THEN
    RAISE EXCEPTION 'Expected 2 start actors and 1 final actor; got % and %', start_actors, final_actors;
  END IF;
END $$;

ROLLBACK;
