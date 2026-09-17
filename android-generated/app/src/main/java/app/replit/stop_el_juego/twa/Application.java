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
    private static final String TAG = "STOP_REWARDED";
    private static final String REAL_REWARDED_ID = "ca-app-pub-4807272408824742/3559554716";
    private static final long RETRY_DELAY_MS = 2000L;

    private static volatile RewardedAd preloadedRewardedAd;
    private static volatile boolean loadingRewardedAd;
    private static Application instance;
    private final Handler handler = new Handler(Looper.getMainLooper());

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        MobileAds.initialize(this, status -> preloadRewardedAd());
    }

    public static synchronized void preloadRewardedAd() {
        if (loadingRewardedAd || preloadedRewardedAd != null || instance == null) return;
        loadingRewardedAd = true;
        RewardedAd.load(instance, REAL_REWARDED_ID, new AdRequest.Builder().build(), new RewardedAdLoadCallback() {
            @Override
            public void onAdLoaded(@NonNull RewardedAd ad) {
                preloadedRewardedAd = ad;
                loadingRewardedAd = false;
                Log.d(TAG, "Rewarded ad preloaded");
            }

            @Override
            public void onAdFailedToLoad(@NonNull LoadAdError error) {
                loadingRewardedAd = false;
                Log.e(TAG, "Rewarded preload failed: code=" + error.getCode()
                        + " domain=" + error.getDomain()
                        + " message=" + error.getMessage());
                if (instance != null) {
                    instance.handler.postDelayed(Application::preloadRewardedAd, RETRY_DELAY_MS);
                }
            }
        });
    }

    @Nullable
    public static synchronized RewardedAd takePreloadedRewardedAd() {
        RewardedAd ad = preloadedRewardedAd;
        preloadedRewardedAd = null;
        if (ad == null) preloadRewardedAd();
        return ad;
    }
}
