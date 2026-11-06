package app.replit.stop_el_juego.twa;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.rewarded.RewardedAd;
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback;

/** App-scoped preloader for the rewarded AdMob Activity. */
public final class RewardedAdPreloader {
    private static final String TAG = "STOP_REWARDED";
    private static final String REAL_REWARDED_ID = "ca-app-pub-4807272408824742/3559554716";
    private static final long RETRY_DELAY_MS = 2000L;
    // AdMob rewarded objects expire after one hour; refresh before the hard expiry.
    private static final long PRELOADED_AD_TTL_MS = 55 * 60 * 1000L;

    private static final Handler HANDLER = new Handler(Looper.getMainLooper());
    private static volatile Context appContext;
    private static volatile RewardedAd preloadedRewardedAd;
    private static volatile boolean loadingRewardedAd;
    private static volatile boolean initializationStarted;
    private static volatile long preloadedRewardedAdAt;

    private RewardedAdPreloader() {}

    public static synchronized void initialize(@NonNull Context context) {
        appContext = context.getApplicationContext();
        if (!AdsPolicy.isEnabled() || initializationStarted) return;
        initializationStarted = true;
        MobileAds.initialize(appContext, status -> preloadRewardedAd());
    }

    public static synchronized void preloadRewardedAd() {
        Context context = appContext;
        if (!AdsPolicy.isEnabled() || loadingRewardedAd || preloadedRewardedAd != null || context == null) return;
        loadingRewardedAd = true;
        RewardedAd.load(context, REAL_REWARDED_ID, new AdRequest.Builder().build(), new RewardedAdLoadCallback() {
            @Override
            public void onAdLoaded(@NonNull RewardedAd ad) {
                preloadedRewardedAd = ad;
                preloadedRewardedAdAt = System.currentTimeMillis();
                loadingRewardedAd = false;
                Log.d(TAG, "Rewarded ad preloaded by StopApplication");
                HANDLER.postDelayed(RewardedAdPreloader::expirePreloadedRewardedAd, PRELOADED_AD_TTL_MS);
            }

            @Override
            public void onAdFailedToLoad(@NonNull LoadAdError error) {
                loadingRewardedAd = false;
                Log.e(TAG, "Rewarded preload failed: code=" + error.getCode()
                        + " domain=" + error.getDomain()
                        + " message=" + error.getMessage());
                HANDLER.postDelayed(RewardedAdPreloader::preloadRewardedAd, RETRY_DELAY_MS);
            }
        });
    }

    private static synchronized void expirePreloadedRewardedAd() {
        if (preloadedRewardedAd == null) return;
        if (System.currentTimeMillis() - preloadedRewardedAdAt < PRELOADED_AD_TTL_MS) return;
        preloadedRewardedAd = null;
        preloadedRewardedAdAt = 0L;
        Log.d(TAG, "Preloaded rewarded ad expired; reloading");
        preloadRewardedAd();
    }

    @Nullable
    public static synchronized RewardedAd takePreloadedRewardedAd() {
        if (!AdsPolicy.isEnabled()) return null;
        if (preloadedRewardedAd != null
                && System.currentTimeMillis() - preloadedRewardedAdAt >= PRELOADED_AD_TTL_MS) {
            preloadedRewardedAd = null;
            preloadedRewardedAdAt = 0L;
            Log.d(TAG, "Discarding expired preloaded rewarded ad");
        }
        RewardedAd ad = preloadedRewardedAd;
        preloadedRewardedAd = null;
        preloadedRewardedAdAt = 0L;
        if (ad == null) preloadRewardedAd();
        return ad;
    }
}
