package app.replit.stop_el_juego.twa;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;

/**
 * Native startup isolation test: bypasses Browser Helper/TWA completely
 * and opens the production web app directly in the user's browser.
 */
public class LauncherActivity extends Activity {
    private static final String START_URL = "https://www.stopjuegodepalabras.com/?source=googleplay-twa";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(START_URL));
            startActivity(intent);
        } finally {
            finish();
        }
    }
}
