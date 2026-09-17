package app.replit.stop_el_juego.twa;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;
import android.view.Window;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.rewarded.RewardedAd;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

public class RewardedAdActivity extends Activity {
    private static final String TAG = "STOP_REWARDED";
    private static final String RESULT_ENDPOINT = "https://www.stopjuegodepalabras.com/api/rewards/admob-result";

    private String requestId;
    private boolean resultSent;
    private boolean rewardEarned;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Transparent host: the STOP game remains visible underneath. The
        // player must never wait here for a network ad load.
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

        // Application owns the preload lifecycle. Never call MobileAds.initialize
        // or RewardedAd.load here: both can introduce a visible delay after a tap.
        RewardedAd preloaded = Application.takePreloadedRewardedAd();
        if (preloaded == null) {
            Log.d(TAG, "No rewarded ad preloaded; fail immediately requestId=" + requestId);
            sendResult(false);
            finish();
            return;
        }

        Log.d(TAG, "Using preloaded rewarded ad requestId=" + requestId);
        showRewarded(preloaded);
    }

    private void showRewarded(@NonNull RewardedAd ad) {
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
                connection.setConnectTimeout(3000);
                connection.setReadTimeout(3000);
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
