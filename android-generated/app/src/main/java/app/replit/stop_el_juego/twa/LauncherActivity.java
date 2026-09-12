package app.replit.stop_el_juego.twa;

import android.content.pm.ActivityInfo;
import android.os.Build;
import android.os.Bundle;

/**
 * Minimal TWA launcher used to isolate native startup crashes.
 * No AdMob or PostMessage code runs during launcher startup.
 */
public class LauncherActivity extends com.google.androidbrowserhelper.trusted.LauncherActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (Build.VERSION.SDK_INT > Build.VERSION_CODES.O) {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_USER_PORTRAIT);
        } else {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
        }
    }
}
