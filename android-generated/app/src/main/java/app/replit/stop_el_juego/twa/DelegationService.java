package app.replit.stop_el_juego.twa;

import android.app.Notification;
import android.util.Log;

import androidx.annotation.NonNull;

import com.google.androidbrowserhelper.playbilling.digitalgoods.DigitalGoodsRequestHandler;

/**
 * Trusted Web Activity delegation service with Google Play Digital Goods support.
 */
public class DelegationService extends com.google.androidbrowserhelper.trusted.DelegationService {
    private static final String TAG = "STOP_PLAY_BILLING";
    private static final String NOTIFICATION_TAG = "STOP_TWA_NOTIFICATIONS";

    @Override
    public void onCreate() {
        super.onCreate();
        registerExtraCommandHandler(new DigitalGoodsRequestHandler(getApplicationContext()));
        Log.d(TAG, "Play Billing Digital Goods handler registered");
        Log.i(NOTIFICATION_TAG, "Trusted Web Activity notification delegation service ready");
    }

    @Override
    public boolean onAreNotificationsEnabled(@NonNull String channelName) {
        boolean enabled = super.onAreNotificationsEnabled(channelName);
        Log.i(NOTIFICATION_TAG, "App notification channel enabled=" + enabled + " channel=" + channelName);
        return enabled;
    }

    @Override
    public boolean onNotifyNotificationWithChannel(
            @NonNull String platformTag,
            int platformId,
            @NonNull Notification notification,
            @NonNull String channelName) {
        boolean displayed = super.onNotifyNotificationWithChannel(
                platformTag, platformId, notification, channelName);
        Log.i(NOTIFICATION_TAG, "Chrome delegated notification to STOP; channel="
                + channelName + " displayed=" + displayed);
        return displayed;
    }
}
