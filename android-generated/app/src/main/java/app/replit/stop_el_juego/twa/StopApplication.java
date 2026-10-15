package app.replit.stop_el_juego.twa;

import android.app.Application;
import android.util.Log;

import com.google.android.gms.games.PlayGamesSdk;

/**
 * Initializes Play Games Services before the TWA activity is created.
 * Keeps initialization failures non-fatal so STOP remains playable.
 */
public final class StopApplication extends Application {
    private static boolean playGamesInitialized;

    @Override
    public void onCreate() {
        super.onCreate();
        try {
            PlayGamesSdk.initialize(this);
            playGamesInitialized = true;
            Log.i("STOP_PLAY_GAMES", "Play Games SDK initialized in Application.onCreate");
        } catch (RuntimeException error) {
            playGamesInitialized = false;
            Log.w("STOP_PLAY_GAMES", "Play Games SDK initialization failed; STOP continues normally", error);
        }
    }

    public static boolean isPlayGamesInitialized() {
        return playGamesInitialized;
    }
}
