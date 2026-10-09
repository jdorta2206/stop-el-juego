package app.replit.stop_el_juego.twa;

import android.app.Activity;
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
                || !"stoppgs".equals(getIntent().getData().getScheme())
                || !"achievements".equals(getIntent().getData().getHost())) {
            finish();
            return;
        }

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
    protected void onActivityResult(int requestCode, int resultCode, android.content.Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == RC_ACHIEVEMENTS_UI) finish();
    }
}
