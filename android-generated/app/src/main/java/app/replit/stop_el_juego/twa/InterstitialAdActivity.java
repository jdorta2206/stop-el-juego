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
    // An unavailable ad must never hold the player in a diagnostic screen.
    private static final long INITIALIZATION_TIMEOUT_MS = 10_000L;
    private static final long LOAD_TIMEOUT_MS = 10_000L;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private boolean finished;
    private boolean showing;
    private boolean loadFinished;

    private final Runnable initializationTimeout = () -> {
        if (!finished && !showing) {
            Log.w(TAG, "Mobile Ads initialization timed out; skipping interstitial");
            finishSafely();
        }
    };

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (!AdsPolicy.isEnabled()) { finish(); return; }

        Uri data = getIntent().getData();
        String origin = data == null ? null : data.getQueryParameter("origin");
        if (!isAllowedOrigin(origin)) { finish(); return; }

        handler.postDelayed(initializationTimeout, INITIALIZATION_TIMEOUT_MS);
        MobileAds.initialize(this, status -> {
            handler.removeCallbacks(initializationTimeout);
            if (!finished && !isFinishing()) showPreloadedOrLoad();
        });
    }

    private void showPreloadedOrLoad() {
        if (finished || isFinishing()) return;
        InterstitialAd preloaded = InterstitialAdStore.take();
        if (preloaded != null) {
            Log.d(TAG, "Using preloaded production interstitial");
            showInterstitial(preloaded);
            return;
        }
        Log.d(TAG, "No preloaded interstitial; loading on demand");
        loadAndShow();
    }

    private void loadAndShow() {
        InterstitialAd.load(this, "ca-app-pub-4807272408824742/7242069847",
                new AdRequest.Builder().build(),
                new InterstitialAdLoadCallback() {
                    @Override
                    public void onAdLoaded(@NonNull InterstitialAd ad) {
                        if (loadFinished || finished || isFinishing()) return;
                        loadFinished = true;
                        handler.removeCallbacks(loadTimeout);
                        Log.d(TAG, "Production interstitial loaded. response=" + ad.getResponseInfo());
                        showInterstitial(ad);
                    }

                    @Override
                    public void onAdFailedToLoad(@NonNull LoadAdError error) {
                        if (loadFinished) return;
                        loadFinished = true;
                        handler.removeCallbacks(loadTimeout);
                        Log.e(TAG, "Interstitial load failed; continuing without ad: code="
                                + error.getCode() + " domain=" + error.getDomain()
                                + " message=" + error.getMessage()
                                + " response=" + error.getResponseInfo());
                        finishSafely();
                    }
                });

        handler.postDelayed(loadTimeout, LOAD_TIMEOUT_MS);
    }

    private final Runnable loadTimeout = () -> {
        if (!loadFinished && !showing && !finished) {
            loadFinished = true;
            Log.w(TAG, "Interstitial load timed out; continuing without ad");
            finishSafely();
        }
    };

    private void showInterstitial(@NonNull InterstitialAd ad) {
        if (finished || isFinishing()) return;
        showing = true;
        ad.setFullScreenContentCallback(new FullScreenContentCallback() {
            @Override public void onAdShowedFullScreenContent() {
                Log.d(TAG, "Interstitial shown");
                setResult(Activity.RESULT_OK);
            }

            @Override public void onAdDismissedFullScreenContent() {
                Log.d(TAG, "Interstitial dismissed");
                finishSafely();
            }

            @Override public void onAdFailedToShowFullScreenContent(@NonNull AdError error) {
                Log.e(TAG, "Interstitial show failed; continuing without ad: code="
                        + error.getCode() + " domain=" + error.getDomain()
                        + " message=" + error.getMessage());
                finishSafely();
            }
        });
        try {
            ad.show(this);
        } catch (RuntimeException error) {
            Log.e(TAG, "Interstitial show exception; continuing without ad", error);
            finishSafely();
        }
    }

    private void finishSafely() {
        if (finished) return;
        finished = true;
        handler.removeCallbacksAndMessages(null);
        runOnUiThread(this::finish);
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        super.onDestroy();
    }

    private static boolean isAllowedOrigin(@Nullable String value) {
        return "https://stopjuegodepalabras.com".equals(value)
                || "https://www.stopjuegodepalabras.com".equals(value);
    }
}
