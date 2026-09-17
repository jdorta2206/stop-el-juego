package app.replit.stop_el_juego.twa;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.Window;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.rewarded.RewardedAd;
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

public class RewardedAdActivity extends Activity {
    private static final String TAG = "STOP_REWARDED";
    private static final String REAL_REWARDED_ID = "ca-app-pub-4807272408824742/3559554716";
    private static final String RESULT_ENDPOINT = "https://www.stopjuegodepalabras.com/api/rewards/admob-result";
    private static final long LOAD_TIMEOUT_MS = 10_000L;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private String requestId;
    private boolean resultSent;
    private boolean rewardEarned;
    private boolean showing;
    private boolean loadFinished;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Never show a white/blank native Activity while AdMob is loading.
        // The STOP game remains visible underneath. If no ad is available,
        // the Activity sends a failed result and finishes without consuming time.
        Window window = getWindow();
        window.setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
        window.setDimAmount(0f);
        window.clearFlags(android.view.WindowManager.LayoutParams.FLAG_DIM_BEHIND);

        Uri data = getIntent().getData();
        requestId = data == null ? null : data.getQueryParameter("requestId");
        if (requestId == null || requestId.isEmpty()) {
            Log.e(TAG, "Missing requestId in rewarded deep link: " + data);
            finish();
            return;
        }
        MobileAds.initialize(this, status -> {
            RewardedAd preloaded = Application.takePreloadedRewardedAd();
            if (preloaded != null) {
                Log.d(TAG, "Using preloaded rewarded ad requestId=" + requestId);
                showRewarded(preloaded);
            } else {
                Log.d(TAG, "No preloaded rewarded ad; loading on demand requestId=" + requestId);
                loadAndShow();
            }
        });
    }

    private void loadAndShow() {
        loadFinished = false;
        RewardedAd.load(this, REAL_REWARDED_ID, new AdRequest.Builder().build(), new RewardedAdLoadCallback() {
            @Override
            public void onAdLoaded(@NonNull RewardedAd ad) {
                if (loadFinished || isFinishing()) return;
                loadFinished = true;
                handler.removeCallbacksAndMessages(null);
                showRewarded(ad);
            }

            @Override
            public void onAdFailedToLoad(@NonNull LoadAdError error) {
                if (loadFinished) return;
                loadFinished = true;
                handler.removeCallbacksAndMessages(null);
                Log.e(TAG, "Rewarded load failed: code=" + error.getCode() + " domain="
                        + error.getDomain() + " message=" + error.getMessage());
                sendResult(false);
                finish();
            }
        });
        handler.postDelayed(() -> {
            if (loadFinished || showing || resultSent) return;
            loadFinished = true;
            Log.e(TAG, "Rewarded load timeout after " + LOAD_TIMEOUT_MS + "ms");
            sendResult(false);
            finish();
        }, LOAD_TIMEOUT_MS);
    }

    private void showRewarded(@NonNull RewardedAd ad) {
        showing = true;
        ad.setFullScreenContentCallback(new FullScreenContentCallback() {
            @Override
            public void onAdShowedFullScreenContent() {
                Log.d(TAG, "Rewarded ad shown requestId=" + requestId);
            }

            @Override
            public void onAdDismissedFullScreenContent() {
                if (!rewardEarned) sendResult(false);
                Application.preloadRewardedAd();
                finish();
            }

            @Override
            public void onAdFailedToShowFullScreenContent(@NonNull AdError error) {
                Log.e(TAG, "Rewarded show failed: " + error.getCode() + " " + error.getMessage());
                sendResult(false);
                Application.preloadRewardedAd();
                finish();
            }
        });
        try {
            ad.show(this, rewardItem -> {
                rewardEarned = true;
                Log.d(TAG, "Reward earned amount=" + rewardItem.getAmount());
                sendResult(true);
            });
        } catch (RuntimeException error) {
            Log.e(TAG, "Rewarded show exception", error);
            sendResult(false);
            Application.preloadRewardedAd();
            finish();
        }
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        super.onDestroy();
    }

    private void sendResult(boolean rewarded) {
        if (resultSent) return;
        resultSent = true;
        final String id = requestId;
        new Thread(() -> {
            HttpURLConnection connection = null;
            try {
                URL url = new URL(RESULT_ENDPOINT);
                connection = (HttpURLConnection) url.openConnection();
                connection.setRequestMethod("POST");
                connection.setConnectTimeout(5000);
                connection.setReadTimeout(5000);
                connection.setDoOutput(true);
                connection.setRequestProperty("Content-Type", "application/json");
                JSONObject body = new JSONObject();
                body.put("requestId", id);
                body.put("rewarded", rewarded);
                byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8);
                try (OutputStream output = connection.getOutputStream()) { output.write(bytes); }
                Log.d(TAG, "Result sent http=" + connection.getResponseCode() + " rewarded=" + rewarded);
            } catch (Exception error) {
                Log.e(TAG, "Unable to send rewarded result", error);
            } finally {
                if (connection != null) connection.disconnect();
            }
        }).start();
    }
}
