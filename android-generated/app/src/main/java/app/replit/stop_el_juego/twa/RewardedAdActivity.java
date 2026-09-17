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
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.rewarded.RewardedAd;
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback;
import com.google.android.gms.ads.rewarded.ServerSideVerificationOptions;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

public class RewardedAdActivity extends Activity {
    private static final String TAG = "STOP_REWARDED";
    private static final String REAL_REWARDED_ID = "ca-app-pub-4807272408824742/3559554716";
    private static final long LOAD_TIMEOUT_MS = 10_000L;
    private static final long GLOBAL_WATCHDOG_MS = 20_000L;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private String requestId;
    private String playerId;
    private String origin;
    private String placement;
    private boolean resultSent;
    private boolean rewardEarned;
    private boolean showing;
    private boolean loadFinished;
    private Runnable loadTimeout;

    private final Runnable globalWatchdog = () -> {
        if (!showing && !resultSent) {
            Log.e(TAG, "Global watchdog fired");
            sendClientResult("dismissed");
            finish();
        }
    };

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Uri data = getIntent().getData();
        requestId = data == null ? null : data.getQueryParameter("requestId");
        playerId = data == null ? null : data.getQueryParameter("playerId");
        origin = data == null ? null : data.getQueryParameter("origin");
        placement = data == null ? null : data.getQueryParameter("placement");

        if (requestId == null || requestId.isEmpty()) {
            Log.e(TAG, "Missing requestId in rewarded deep link: " + data);
            finish();
            return;
        }

        if (playerId == null || playerId.isEmpty()) playerId = "guest";

        if (!isAllowedOrigin(origin)) {
            Log.e(TAG, "Rejected invalid rewarded origin: " + origin);
            sendClientResult("dismissed");
            finish();
            return;
        }

        handler.postDelayed(globalWatchdog, GLOBAL_WATCHDOG_MS);

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
                if (loadTimeout != null) handler.removeCallbacks(loadTimeout);
                showRewarded(ad);
            }

            @Override
            public void onAdFailedToLoad(@NonNull LoadAdError error) {
                if (loadFinished) return;
                loadFinished = true;
                if (loadTimeout != null) handler.removeCallbacks(loadTimeout);
                Log.e(TAG, "Rewarded load failed: code=" + error.getCode()
                        + " domain=" + error.getDomain()
                        + " message=" + error.getMessage());
                sendClientResult("dismissed");
                finish();
            }
        });

        loadTimeout = () -> {
            if (loadFinished || showing || resultSent) return;
            loadFinished = true;
            Log.e(TAG, "Rewarded load timeout after " + LOAD_TIMEOUT_MS + "ms");
            sendClientResult("dismissed");
            finish();
        };
        handler.postDelayed(loadTimeout, LOAD_TIMEOUT_MS);
    }

    private void showRewarded(@NonNull RewardedAd ad) {
        showing = true;
        handler.removeCallbacks(globalWatchdog);

        try {
            JSONObject customData = new JSONObject();
            customData.put("requestId", requestId);
            customData.put("playerId", playerId);
            if (placement != null) customData.put("placement", placement);

            ServerSideVerificationOptions options =
                    new ServerSideVerificationOptions.Builder()
                            .setCustomData(customData.toString())
                            .build();
            ad.setServerSideVerificationOptions(options);
        } catch (Exception error) {
            Log.e(TAG, "Unable to configure SSV custom data", error);
            sendClientResult("dismissed");
            Application.preloadRewardedAd();
            finish();
            return;
        }

        ad.setFullScreenContentCallback(new FullScreenContentCallback() {
            @Override
            public void onAdShowedFullScreenContent() {
                Log.d(TAG, "Rewarded ad shown requestId=" + requestId);
            }

            @Override
            public void onAdDismissedFullScreenContent() {
                if (!rewardEarned) sendClientResult("dismissed");
                Application.preloadRewardedAd();
                finish();
            }

            @Override
            public void onAdFailedToShowFullScreenContent(@NonNull AdError error) {
                Log.e(TAG, "Rewarded show failed: " + error.getCode() + " " + error.getMessage());
                sendClientResult("dismissed");
                Application.preloadRewardedAd();
                finish();
            }
        });

        try {
            ad.show(this, rewardItem -> {
                rewardEarned = true;
                Log.d(TAG, "Reward earned amount=" + rewardItem.getAmount());
                // Client callbacks never grant the reward. AdMob SSV is the trusted source.
                sendClientResult("earned");
            });
        } catch (RuntimeException error) {
            Log.e(TAG, "Rewarded show exception", error);
            sendClientResult("dismissed");
            Application.preloadRewardedAd();
            finish();
        }
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacks(globalWatchdog);
        if (loadTimeout != null) handler.removeCallbacks(loadTimeout);
        super.onDestroy();
    }

    private void sendClientResult(String clientState) {
        if (resultSent) return;
        resultSent = true;

        final String id = requestId;
        final String currentPlayerId = playerId == null ? "guest" : playerId;
        final String currentOrigin = origin;
        final String currentPlacement = placement == null ? "" : placement;
        new Thread(() -> {
            HttpURLConnection connection = null;
            try {
                URL url = new URL(currentOrigin + "/api/rewards/admob-result");
                connection = (HttpURLConnection) url.openConnection();
                connection.setRequestMethod("POST");
                connection.setConnectTimeout(5000);
                connection.setReadTimeout(5000);
                connection.setDoOutput(true);
                connection.setRequestProperty("Content-Type", "application/json");

                JSONObject body = new JSONObject();
                body.put("requestId", id);
                body.put("rewarded", false);
                body.put("clientState", clientState);
                body.put("playerId", currentPlayerId);
                body.put("origin", currentOrigin);
                body.put("placement", currentPlacement);

                byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8);
                try (OutputStream output = connection.getOutputStream()) {
                    output.write(bytes);
                }
                Log.d(TAG, "Client rewarded result sent http=" + connection.getResponseCode()
                        + " state=" + clientState);
            } catch (Exception error) {
                Log.e(TAG, "Unable to send rewarded result", error);
            } finally {
                if (connection != null) connection.disconnect();
            }
        }).start();
    }

    private static boolean isAllowedOrigin(@Nullable String value) {
        if (value == null) return false;
        return "https://stopjuegodepalabras.com".equals(value)
                || "https://www.stopjuegodepalabras.com".equals(value);
    }
}
