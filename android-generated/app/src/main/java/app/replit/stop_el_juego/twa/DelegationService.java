package app.replit.stop_el_juego.twa;

import android.util.Log;

import com.google.androidbrowserhelper.playbilling.digitalgoods.DigitalGoodsRequestHandler;

/**
 * Trusted Web Activity delegation service with Google Play Digital Goods support.
 */
public class DelegationService extends com.google.androidbrowserhelper.trusted.DelegationService {
    private static final String TAG = "STOP_PLAY_BILLING";

    @Override
    public void onCreate() {
        super.onCreate();
        registerExtraCommandHandler(new DigitalGoodsRequestHandler(getApplicationContext()));
        Log.d(TAG, "Play Billing Digital Goods handler registered");
    }
}
