package app.replit.stop_el_juego.twa;

import android.os.Bundle;

/**
 * Minimal TWA isolation test.
 * No AdMob, Billing, PostMessage bridge, reflection, or custom callbacks.
 */
public class LauncherActivity extends com.google.androidbrowserhelper.trusted.LauncherActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
    }
}
