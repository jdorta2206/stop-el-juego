package app.replit.stop_el_juego.twa;

import android.app.Activity;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.Gravity;
import android.widget.TextView;

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
    private static final long LOAD_TIMEOUT_MS = 30_000L;
    private static final long DIAGNOSTIC_SCREEN_MS = 15_000L;

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

        MobileAds.initialize(this, status -> showPreloadedOrLoad());
    }

    private void showPreloadedOrLoad() {
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
        InterstitialAd.load(this, "ca-app-pub-4807272408824742/5841246893",
                new AdRequest.Builder().build(),
                new InterstitialAdLoadCallback() {
                    @Override
                    public void onAdLoaded(@NonNull InterstitialAd ad) {
                        if (loadFinished || isFinishing()) return;
                        loadFinished = true;
                        Log.d(TAG, "Production interstitial loaded. response=" + ad.getResponseInfo());
                        showInterstitial(ad);
                    }

                    @Override
                    public void onAdFailedToLoad(@NonNull LoadAdError error) {
                        if (loadFinished) return;
                        loadFinished = true;
                        String diagnostic = "code=" + error.getCode()
                                + "\ndomain=" + error.getDomain()
                                + "\nmessage=" + error.getMessage()
                                + "\nresponse=" + error.getResponseInfo();
                        Log.e(TAG, "Interstitial load failed: " + diagnostic);
                        showDiagnostic("NO SE HA PODIDO CARGAR EL ANUNCIO REAL", diagnostic);
                    }
                });

        handler.postDelayed(() -> {
            if (!loadFinished && !showing && !finished) {
                Log.e(TAG, "Interstitial load timed out after " + LOAD_TIMEOUT_MS + " ms");
                loadFinished = true;
                showDiagnostic("TIMEOUT CARGANDO EL ANUNCIO", "AdMob no respondió en 30 segundos.");
            }
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
                String diagnostic = "code=" + error.getCode()
                        + "\ndomain=" + error.getDomain()
                        + "\nmessage=" + error.getMessage();
                Log.e(TAG, "Interstitial show failed: " + diagnostic);
                showDiagnostic("EL ANUNCIO CARGÓ PERO NO SE PUDO MOSTRAR", diagnostic);
            }
        });
        try {
            ad.show(this);
        } catch (RuntimeException error) {
            Log.e(TAG, "Interstitial show exception", error);
            showDiagnostic("ERROR MOSTRANDO EL ANUNCIO", String.valueOf(error.getMessage()));
        }
    }

    private void showDiagnostic(String title, String details) {
        if (finished) return;
        showing = false;

        TextView view = new TextView(this);
        view.setText("STOP — DIAGNÓSTICO DE INTERSTITIAL\n\n"
                + title + "\n\n" + details
                + "\n\nEsta pantalla es temporal. Se cerrará automáticamente.");
        view.setTextSize(16);
        view.setTextColor(Color.WHITE);
        view.setGravity(Gravity.CENTER);
        view.setPadding(32, 32, 32, 32);
        view.setBackgroundColor(Color.BLACK);
        setContentView(view);

        handler.postDelayed(this::finishSafely, DIAGNOSTIC_SCREEN_MS);
    }

    private void finishSafely() {
        if (finished) return;
        finished = true;
        handler.post(() -> finish());
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
