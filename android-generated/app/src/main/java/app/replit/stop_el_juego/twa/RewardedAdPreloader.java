package app.replit.stop_el_juego.twa;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.google.android.gms.ads.AdRequest;

import java.util.ArrayList;
import java.util.List;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.rewarded.RewardedAd;
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback;

/** Process-wide preloader for the native rewarded AdMob Activity. */
public final class RewardedAdPreloader {
    private static final String TAG = "STOP_REWARDED";
    private static final String REWARDED_UNIT_ID = "ca-app-pub-4807272408824742/3559554716";
    private static final long RETRY_DELAY_MS = 2_000L;
    private static final long AD_TTL_MS = 55 * 60 * 1_000L;

    private static final Handler HANDLER = new Handler(Looper.getMainLooper());
    private static Context appContext;
    private static RewardedAd preloadedAd;
    private static boolean loading;
    private static boolean initialized;
    private static boolean initializationComplete;
    private static final List<InitializationListener> initializationListeners = new ArrayList<>();
    private static long loadedAt;

    private RewardedAdPreloader() {}

    public interface InitializationListener {
        void onInitialized();
    }

    public static void initialize(@NonNull Context context) {
        initialize(context, null);
    }

    public static void initialize(@NonNull Context context, @Nullable InitializationListener listener) {
        final Context applicationContext = context.getApplicationContext();
        final boolean startInitialization;
        synchronized (RewardedAdPreloader.class) {
            appContext = applicationContext;
            if (!AdsPolicy.isEnabled()) return;
            if (listener != null) {
                if (initializationComplete) {
                    HANDLER.post(() -> listener.onInitialized());
                    return;
                }
                initializationListeners.add(listener);
            }
            startInitialization = !initialized;
            if (startInitialization) initialized = true;
        }
        if (!startInitialization) return;
        MobileAds.initialize(applicationContext, status -> {
            List<InitializationListener> listeners;
            synchronized (RewardedAdPreloader.class) {
                initializationComplete = true;
                listeners = new ArrayList<>(initializationListeners);
                initializationListeners.clear();
            }
            preloadRewardedAd();
            for (InitializationListener callback : listeners) {
                try {
                    callback.onInitialized();
                } catch (RuntimeException error) {
                    Log.e(TAG, "AdMob initialization listener failed", error);
                }
            }
        });
    }

    public static synchronized boolean isInitialized() {
        return initializationComplete;
    }

    public static synchronized void preloadRewardedAd() {
        if (!AdsPolicy.isEnabled() || loading || preloadedAd != null || appContext == null) return;
        loading = true;
        RewardedAd.load(appContext, REWARDED_UNIT_ID, new AdRequest.Builder().build(),
                new RewardedAdLoadCallback() {
                    @Override
                    public void onAdLoaded(@NonNull RewardedAd ad) {
                        synchronized (RewardedAdPreloader.class) {
                            preloadedAd = ad;
                            loadedAt = System.currentTimeMillis();
                            loading = false;
                        }
                        Log.i(TAG, "Rewarded ad preloaded");
                        HANDLER.postDelayed(RewardedAdPreloader::expireAndReload, AD_TTL_MS);
                    }

                    @Override
                    public void onAdFailedToLoad(@NonNull LoadAdError error) {
                        synchronized (RewardedAdPreloader.class) { loading = false; }
                        Log.e(TAG, "Rewarded preload failed: code=" + error.getCode()
                                + " domain=" + error.getDomain()
                                + " message=" + error.getMessage());
                        HANDLER.postDelayed(RewardedAdPreloader::preloadRewardedAd, RETRY_DELAY_MS);
                    }
                });
    }

    private static synchronized void expireAndReload() {
        if (preloadedAd == null || System.currentTimeMillis() - loadedAt < AD_TTL_MS) return;
        preloadedAd = null;
        loadedAt = 0L;
        preloadRewardedAd();
    }

    @Nullable
    public static synchronized RewardedAd takePreloadedRewardedAd() {
        if (!AdsPolicy.isEnabled()) return null;
        if (preloadedAd != null && System.currentTimeMillis() - loadedAt >= AD_TTL_MS) {
            preloadedAd = null;
            loadedAt = 0L;
        }
        RewardedAd ad = preloadedAd;
        preloadedAd = null;
        loadedAt = 0L;
        if (ad == null) preloadRewardedAd();
        return ad;
    }
}
