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
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        try {
            PlayGames.getAchievementsClient(this).getAchievementsIntent()
                    .addOnSuccessListener(intent -> {
                        try {
                            startActivity(intent);
                        } catch (RuntimeException error) {
                            Log.w("STOP_PLAY_GAMES", "Unable to open achievements UI", error);
                        } finally {
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
}
