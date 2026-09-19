package app.replit.stop_el_juego.twa;

import android.app.Activity;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.interstitial.InterstitialAd;
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;

public class InterstitialAdActivity extends Activity {
    private static final String TAG = "STOP_INTERSTITIAL";
    private static final boolean USE_TEST_INTERSTITIAL_AD = true;
    private static final String INTERSTITIAL_TEST_ID = "ca-app-pub-3940256099942544/1033173712";
    private static final String INTERSTITIAL_REAL_ID = "ca-app-pub-4807272408824742/5841246893";
    private static final long LOAD_TIMEOUT_MS = 10_000L;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private boolean finished;
    private boolean showing;
    private boolean loadFinished;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Uri data = getIntent().getData();
        String origin = data == null ? null : data.getQueryParameter("origin");
        if (!isAllowedOrigin(origin)) { finish(); return; }

        MobileAds.initialize(this, status -> loadAndShow());
    }

    private void loadAndShow() {
        InterstitialAd.load(this, USE_TEST_INTERSTITIAL_AD ? INTERSTITIAL_TEST_ID : INTERSTITIAL_REAL_ID, new AdRequest.Builder().build(),
                new InterstitialAdLoadCallback() {
                    @Override
                    public void onAdLoaded(@NonNull InterstitialAd ad) {
                        if (loadFinished || isFinishing()) return;
                        loadFinished = true;
                        showInterstitial(ad);
                    }

                    @Override
                    public void onAdFailedToLoad(@NonNull LoadAdError error) {
                        if (loadFinished) return;
                        loadFinished = true;
                        Log.e(TAG, "Interstitial load failed: " + error.getCode() + " " + error.getMessage());
                        finishSafely();
                    }
                });

        handler.postDelayed(() -> {
            if (!loadFinished && !showing && !finished) finishSafely();
        }, LOAD_TIMEOUT_MS);
    }

    private void showInterstitial(@NonNull InterstitialAd ad) {
        showing = true;
        ad.setFullScreenContentCallback(new FullScreenContentCallback() {
            @Override public void onAdShowedFullScreenContent() {
                Log.d(TAG, "Interstitial shown");
            }

            @Override public void onAdDismissedFullScreenContent() {
                Log.d(TAG, "Interstitial dismissed");
                finishSafely();
            }

            @Override public void onAdFailedToShowFullScreenContent(@NonNull AdError error) {
                Log.e(TAG, "Interstitial show failed: " + error.getCode() + " " + error.getMessage());
                finishSafely();
            }
        });
        try { ad.show(this); }
        catch (RuntimeException error) {
            Log.e(TAG, "Interstitial show exception", error);
            finishSafely();
        }
    }

    private void finishSafely() {
        if (finished) return;
        finished = true;
        handler.post(() -> finish());
    }

    @Override protected void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        super.onDestroy();
    }

    private static boolean isAllowedOrigin(@Nullable String value) {
        return "https://stopjuegodepalabras.com".equals(value)
                || "https://www.stopjuegodepalabras.com".equals(value);
    }
}
