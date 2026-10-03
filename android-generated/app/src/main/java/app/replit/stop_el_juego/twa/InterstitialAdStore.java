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
import java.util.Calendar;

public final class InterstitialAdStore {
    private static boolean adsTemporarilySuspended() {
        return System.currentTimeMillis() < 1793491200000L; // 1 Nov 2026 00:00 UTC
    }
    private static final String TAG = "STOP_INTERSTITIAL";
    private static final String INTERSTITIAL_ID = "ca-app-pub-4807272408824742/7242069847";
    // Google documents that cached ads expire after about one hour; keep a safety margin.
    private static final long PRELOADED_AD_TTL_MS = 55 * 60 * 1000L;

    private static Context appContext;
    private static InterstitialAd preloadedAd;
    private static boolean initializing;
    private static boolean loading;
    private static long preloadedAdAt;

    private InterstitialAdStore() {}

    public static synchronized void initialize(Context context) {
        if (context == null || adsTemporarilySuspended()) return;
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
        if (adsTemporarilySuspended() || appContext == null || loading || preloadedAd != null) return;
        loading = true;
        Log.d(TAG, "Preloading production interstitial");
        InterstitialAd.load(appContext, INTERSTITIAL_ID, new AdRequest.Builder().build(),
                new InterstitialAdLoadCallback() {
                    @Override
                    public void onAdLoaded(@NonNull InterstitialAd ad) {
                        synchronized (InterstitialAdStore.class) {
                            loading = false;
                            preloadedAd = ad;
                            preloadedAdAt = System.currentTimeMillis();
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
        if (adsTemporarilySuspended()) {
            preloadedAd = null;
            preloadedAdAt = 0L;
            return null;
        }
        if (preloadedAd != null
                && System.currentTimeMillis() - preloadedAdAt >= PRELOADED_AD_TTL_MS) {
            Log.d(TAG, "Discarding expired preloaded interstitial");
            preloadedAd = null;
            preloadedAdAt = 0L;
        }

        InterstitialAd ad = preloadedAd;
        preloadedAd = null;
        preloadedAdAt = 0L;
        if (ad != null) preload();
        return ad;
    }
}
