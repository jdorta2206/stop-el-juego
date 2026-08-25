ALTER TABLE player_scores
ADD COLUMN IF NOT EXISTS ai_easy_games integer NOT NULL DEFAULT 0;

ALTER TABLE player_scores
ADD COLUMN IF NOT EXISTS ai_expert_games integer NOT NULL DEFAULT 0;
