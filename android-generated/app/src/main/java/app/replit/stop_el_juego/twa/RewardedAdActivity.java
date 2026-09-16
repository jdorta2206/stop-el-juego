package app.replit.stop_el_juego.twa;

import android.app.Activity;
import android.os.Bundle;
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

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/** Native foreground host for rewarded ads launched by an explicit user gesture in the TWA. */
public class RewardedAdActivity extends Activity {
    private static final String TAG = "STOP_REWARDED";
    private static final String TEST_REWARDED_ID = "ca-app-pub-3940256099942544/5224354917";
    private static final String RESULT_ENDPOINT = "https://www.stopjuegodepalabras.com/api/rewards/admob-result";

    private String requestId;
    private boolean resultSent;
    private boolean rewardEarned;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestId = getIntent().getStringExtra("requestId");
        if (requestId == null || requestId.isEmpty()) {
            finish();
            return;
        }
        MobileAds.initialize(this, status -> loadAndShow());
    }

    private void loadAndShow() {
        RewardedAd.load(this, TEST_REWARDED_ID, new AdRequest.Builder().build(), new RewardedAdLoadCallback() {
            @Override
            public void onAdLoaded(@NonNull RewardedAd ad) {
                ad.setFullScreenContentCallback(new FullScreenContentCallback() {
                    @Override
                    public void onAdShowedFullScreenContent() {
                        Log.d(TAG, "Rewarded ad shown requestId=" + requestId);
                    }

                    @Override
                    public void onAdDismissedFullScreenContent() {
                        if (!rewardEarned) sendResult(false);
                        finish();
                    }

                    @Override
                    public void onAdFailedToShowFullScreenContent(@NonNull AdError error) {
                        Log.e(TAG, "Rewarded show failed: " + error.getCode() + " " + error.getMessage());
                        sendResult(false);
                        finish();
                    }
                });
                try {
                    ad.show(RewardedAdActivity.this, rewardItem -> {
                        rewardEarned = true;
                        Log.d(TAG, "Reward earned amount=" + rewardItem.getAmount());
                        sendResult(true);
                    });
                } catch (RuntimeException error) {
                    Log.e(TAG, "Rewarded show exception", error);
                    sendResult(false);
                    finish();
                }
            }

            @Override
            public void onAdFailedToLoad(@NonNull LoadAdError error) {
                Log.e(TAG, "Rewarded load failed: code=" + error.getCode() + " domain="
                        + error.getDomain() + " message=" + error.getMessage());
                sendResult(false);
                finish();
            }
        });
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
                try (OutputStream output = connection.getOutputStream()) {
                    output.write(bytes);
                }
                Log.d(TAG, "Result sent http=" + connection.getResponseCode() + " rewarded=" + rewarded);
            } catch (Exception error) {
                Log.e(TAG, "Unable to send rewarded result", error);
            } finally {
                if (connection != null) connection.disconnect();
            }
        }).start();
    }
}
