---
name: Streak source of truth
description: Player streaks are authoritative on the server; client display must read the server, not localStorage.
---

# Streaks: the server (player_scores) is authoritative — display from it, not localStorage

The backend already tracks streaks per player in `player_scores`
(`current_streak`, `longest_streak`, `streak_days_json`, `last_played_date`) and
updates them on `POST /api/ranking/scores`. The calendar/profile/ranking UIs read
the server. So the server — not the browser — is the source of truth.

**Why this matters:** a localStorage-only streak (the old `useStreak` hook) diverges
across devices and is wiped on cache clear, so users "lose their racha" and churn —
the exact retention leak the growth plan flagged. It also disagreed with the streak
calendar (which reads the server), confusing users.

**How to apply:**
- For DISPLAY, read the authoritative streak via `useGetStreakCalendar(playerId)`
  (returns `currentStreak`, `longestStreak`, `lastPlayedDate`, and
  `days[].{date,played,isToday}`); derive `playedToday` from `days.find(isToday).played`.
  `useDisplayStreak()` wraps this and falls back to localStorage `useStreak` only for
  guests / offline / while the request is in flight (avoids a 0-flicker).
- The streak calendar query key is `["/api/ranking/streak/calendar", playerId]` and
  must be invalidated after a score submit so Home/Daily refresh promptly.
- `recordPlay()` (localStorage) is now only a guest/offline fallback; identified
  users' streaks advance server-side on score submit.

**Context that surprised me:** when the user pasted a "fix retention" plan, MOST of it
(daily challenge, streaks, leaderboard, FTUE onboarding/tutorial, Farol mode, season
missions) was ALREADY built — the plan was written against the lagging GitHub mirror.
The only real gap was this streak display source. Verify current code before
"implementing" pasted plans for this project.
