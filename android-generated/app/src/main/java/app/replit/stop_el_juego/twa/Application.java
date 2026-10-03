/*
 * Copyright 2020 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */
package app.replit.stop_el_juego.twa;

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

public class Application extends android.app.Application {
    private static boolean adsTemporarilySuspended() {
        return System.currentTimeMillis() < 1793491200000L; // 1 Nov 2026 00:00 UTC
    }
    private static final String TAG = "STOP_REWARDED";
    private static final String REAL_REWARDED_ID = "ca-app-pub-4807272408824742/3559554716";
    private static final long RETRY_DELAY_MS = 2000L;
    // Google documents that manually preloaded rewarded ads expire after one hour.
    // Refresh slightly before the hard expiry so a cached object is never shown stale.
    private static final long PRELOADED_AD_TTL_MS = 55 * 60 * 1000L;

    private static volatile RewardedAd preloadedRewardedAd;
    private static volatile boolean loadingRewardedAd;
    private static volatile long preloadedRewardedAdAt;
    private static Application instance;
    private final Handler handler = new Handler(Looper.getMainLooper());

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        MobileAds.initialize(this, status -> {
            if (!adsTemporarilySuspended()) preloadRewardedAd();
            else Log.d(TAG, "AdMob runtime gate active through 31 Oct 2026; rewarded preload disabled");
        });
    }

    public static synchronized void preloadRewardedAd() {
        if (adsTemporarilySuspended() || loadingRewardedAd || preloadedRewardedAd != null || instance == null) return;
        loadingRewardedAd = true;
        RewardedAd.load(instance, REAL_REWARDED_ID, new AdRequest.Builder().build(), new RewardedAdLoadCallback() {
            @Override
            public void onAdLoaded(@NonNull RewardedAd ad) {
                preloadedRewardedAd = ad;
                preloadedRewardedAdAt = System.currentTimeMillis();
                loadingRewardedAd = false;
                Log.d(TAG, "Rewarded ad preloaded");
                instance.handler.postDelayed(Application::expirePreloadedRewardedAd, PRELOADED_AD_TTL_MS);
            }

            @Override
            public void onAdFailedToLoad(@NonNull LoadAdError error) {
                loadingRewardedAd = false;
                Log.e(TAG, "Rewarded preload failed: code=" + error.getCode()
                        + " domain=" + error.getDomain()
                        + " message=" + error.getMessage());
                if (instance != null && !adsTemporarilySuspended()) {
                    instance.handler.postDelayed(Application::preloadRewardedAd, RETRY_DELAY_MS);
                }
            }
        });
    }

    private static synchronized void expirePreloadedRewardedAd() {
        if (adsTemporarilySuspended() || preloadedRewardedAd == null || instance == null) return;
        if (System.currentTimeMillis() - preloadedRewardedAdAt < PRELOADED_AD_TTL_MS) return;
        preloadedRewardedAd = null;
        preloadedRewardedAdAt = 0L;
        Log.d(TAG, "Preloaded rewarded ad expired; reloading");
        preloadRewardedAd();
    }

    @Nullable
    public static synchronized RewardedAd takePreloadedRewardedAd() {
        if (adsTemporarilySuspended()) {
            preloadedRewardedAd = null;
            preloadedRewardedAdAt = 0L;
            return null;
        }
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
