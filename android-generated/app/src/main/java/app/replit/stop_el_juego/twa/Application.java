/*
 * Copyright 2020 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package app.replit.stop_el_juego.twa;

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

    private static volatile RewardedAd preloadedRewardedAd;
    private static volatile boolean loadingRewardedAd;
    private static Application instance;

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        MobileAds.initialize(this, status -> preloadRewardedAd());
    }

    public static synchronized void preloadRewardedAd() {
        if (loadingRewardedAd || preloadedRewardedAd != null || instance == null) return;
        loadingRewardedAd = true;
        RewardedAd.load(
                instance,
                REAL_REWARDED_ID,
                new AdRequest.Builder().build(),
                new RewardedAdLoadCallback() {
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
