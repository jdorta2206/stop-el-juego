package app.replit.stop_el_juego.twa;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.util.Log;

import com.google.android.gms.games.PlayGames;

/**
 * Opens the official Google Play Games achievements UI from an explicit user action.
 * This activity never changes STOP progress, XP, coins, or match results.
 */
public final class PlayGamesAchievementsActivity extends Activity {
    private static final int RC_ACHIEVEMENTS_UI = 9003;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (!"android.intent.action.VIEW".equals(getIntent().getAction())
                || getIntent().getData() == null
                || !"stoppgs".equals(getIntent().getData().getScheme())) {
            finish();
            return;
        }

        String host = getIntent().getData().getHost();
        if ("unlock".equals(host)) {
            handleAchievementUnlock();
            return;
        }
        if (!"achievements".equals(host)) {
            finish();
            return;
        }

        try {
            // Sign-in is attempted only after the player explicitly asks to view
            // achievements. A cancellation/failure never blocks STOP gameplay.
            PlayGames.getGamesSignInClient(this).signIn()
                    .addOnSuccessListener(ignored -> openAchievements())
                    .addOnFailureListener(error -> {
                        Log.w("STOP_PLAY_GAMES", "Sign-in unavailable; cannot show PGS achievements", error);
                        finish();
                    });
        } catch (RuntimeException error) {
            Log.w("STOP_PLAY_GAMES", "Play Games sign-in unavailable", error);
            finish();
        }
    }

    /**
     * Receives a fixed-key unlock request from the web game's registered custom
     * scheme. The caller cannot supply arbitrary Play Console achievement IDs.
     * PGS is best-effort and this short-lived activity always returns to STOP.
     */
    private void handleAchievementUnlock() {
        String origin = getIntent().getData().getQueryParameter("origin");
        String key = getIntent().getData().getQueryParameter("achievementKey");
        if (!"https://www.stopjuegodepalabras.com".equals(origin)
                && !"https://stopjuegodepalabras.com".equals(origin)) {
            Log.w("STOP_PLAY_GAMES", "Rejected unlock deep link with invalid origin");
            finish();
            return;
        }

        String achievementId = achievementIdForKey(key);
        if (achievementId == null) {
            Log.w("STOP_PLAY_GAMES", "Rejected unknown achievement key=" + key);
            finish();
            return;
        }

        try {
            PlayGames.getGamesSignInClient(this).isAuthenticated()
                    .addOnCompleteListener(task -> {
                        if (!task.isSuccessful() || task.getResult() == null
                                || !task.getResult().isAuthenticated()) {
                            Log.i("STOP_PLAY_GAMES", "Unlock skipped: player is not authenticated");
                            finish();
                            return;
                        }
                        try {
                            PlayGames.getAchievementsClient(this).unlock(achievementId)
                                    .addOnSuccessListener(ignored ->
                                            Log.i("STOP_PLAY_GAMES", "Achievement unlock requested: " + key))
                                    .addOnFailureListener(error ->
                                            Log.w("STOP_PLAY_GAMES", "Achievement unlock failed", error))
                                    .addOnCompleteListener(ignored -> finish());
                        } catch (RuntimeException error) {
                            Log.w("STOP_PLAY_GAMES", "Achievement unlock unavailable", error);
                            finish();
                        }
                    });
        } catch (RuntimeException error) {
            Log.w("STOP_PLAY_GAMES", "Play Games unavailable for unlock", error);
            finish();
        }
    }

    private static String achievementIdForKey(String key) {
        if (key == null) return null;
        switch (key) {
            case "first_win": return "CgkIlrPSvaAaEAIQAQ";
            case "combo3": return "CgkIlrPSvaAaEAIQGg";
            case "speed_demon": return "CgkIlrPSvaAaEAIQEw";
            case "chaos_master": return "CgkIlrPSvaAaEAIQEQ";
            case "wordsmith": return "CgkIlrPSvaAaEAIQGA";
            case "veteran": return "CgkIlrPSvaAaEAIQHA";
            case "champion": return "CgkIlrPSvaAaEAIQGw";
            case "unstoppable": return "CgkIlrPSvaAaEAIQEA";
            case "streak_3": return "CgkIlrPSvaAaEAIQFQ";
            case "streak_7": return "CgkIlrPSvaAaEAIQEg";
            case "streak_14": return "CgkIlrPSvaAaEAIQGQ";
            case "streak_30": return "CgkIlrPSvaAaEAIQFw";
            case "creator": return "CgkIlrPSvaAaEAIQFg";
            case "viral": return "CgkIlrPSvaAaEAIQFA";
            case "shutout": return "CgkIlrPSvaAaEAIQHQ";
            default: return null;
        }
    }

    private void openAchievements() {
        try {
            PlayGames.getAchievementsClient(this).getAchievementsIntent()
                    .addOnSuccessListener(intent -> {
                        try {
                            // PGS requires startActivityForResult so it can establish
                            // the identity of the calling package for the UI.
                            startActivityForResult(intent, RC_ACHIEVEMENTS_UI);
                        } catch (RuntimeException error) {
                            Log.w("STOP_PLAY_GAMES", "Unable to open achievements UI", error);
                            finish();
                        }
                    })
                    .addOnFailureListener(error -> {
                        Log.w("STOP_PLAY_GAMES", "Achievements UI unavailable; check PGS configuration", error);
                        finish();
                    });
        } catch (RuntimeException error) {
            Log.w("STOP_PLAY_GAMES", "Play Games achievements unavailable", error);
            finish();
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == RC_ACHIEVEMENTS_UI) finish();
    }
}
