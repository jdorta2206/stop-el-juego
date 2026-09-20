package app.replit.stop_el_juego.twa;

import android.content.Context;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.interstitial.InterstitialAd;
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback;

public final class InterstitialAdStore {
    private static final String TAG = "STOP_INTERSTITIAL";
    private static final String INTERSTITIAL_ID = "ca-app-pub-4807272408824742/5841246893";

    private static Context appContext;
    private static InterstitialAd preloadedAd;
    private static boolean initializing;
    private static boolean loading;

    private InterstitialAdStore() {}

    public static synchronized void initialize(Context context) {
        if (context == null) return;
        appContext = context.getApplicationContext();
        if (initializing) return;
        initializing = true;
        MobileAds.initialize(appContext, status -> {
            synchronized (InterstitialAdStore.class) {
                initializing = false;
            }
            Log.d(TAG, "Mobile Ads initialized; preloading interstitial");
            preload();
        });
    }

    public static synchronized void preload() {
        if (appContext == null || loading || preloadedAd != null) return;
        loading = true;
        Log.d(TAG, "Preloading production interstitial");
        InterstitialAd.load(appContext, INTERSTITIAL_ID, new AdRequest.Builder().build(),
                new InterstitialAdLoadCallback() {
                    @Override
                    public void onAdLoaded(@NonNull InterstitialAd ad) {
                        synchronized (InterstitialAdStore.class) {
                            loading = false;
                            preloadedAd = ad;
                        }
                        Log.d(TAG, "Production interstitial preloaded");
                    }

                    @Override
                    public void onAdFailedToLoad(@NonNull LoadAdError error) {
                        synchronized (InterstitialAdStore.class) {
                            loading = false;
                        }
                        Log.e(TAG, "Production interstitial preload failed: code="
                                + error.getCode() + " domain=" + error.getDomain()
                                + " message=" + error.getMessage()
                                + " response=" + error.getResponseInfo());
                    }
                });
    }

    @Nullable
    public static synchronized InterstitialAd take() {
        InterstitialAd ad = preloadedAd;
        preloadedAd = null;
        if (ad != null) preload();
        return ad;
    }
}
