# Future Cleanup

## Dead Database Columns

`game_session_headlines.self_story_connection_level` and `game_session_headlines.self_story_score` are unused.

They were intended for scoring a headline's connection to the player's own previous submissions, but were never implemented. Both are always written as `NULL` / `0` in `backend/src/game/scoringService.ts`. Write a migration to drop them.
