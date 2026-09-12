package app.replit.stop_el_juego.twa;

import android.content.pm.ActivityInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.browser.customtabs.CustomTabsCallback;
import androidx.browser.customtabs.CustomTabsSession;

import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.rewarded.RewardedAd;
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback;

import java.lang.reflect.Field;

import org.json.JSONException;
import org.json.JSONObject;

public class LauncherActivity extends com.google.androidbrowserhelper.trusted.LauncherActivity {
    private static final String TAG = "STOP_AD_BRIDGE";
    private static final Uri ORIGIN = Uri.parse("https://www.stopjuegodepalabras.com");
    private static final String REWARDED_TEST_ID = "ca-app-pub-3940256099942544/5224354917";
    private static final String REWARDED_REAL_ID = "ca-app-pub-4807272408824742/3559554716";
    private static final int CHANNEL_RETRY_COUNT = 3;
    private static final long CHANNEL_RETRY_DELAY_MS = 250L;

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private boolean relationshipValidated;
    private boolean messageChannelReady;
    private RewardedAd rewardedAd;
    private boolean rewardedAdLoading;
    private boolean rewardGrantedForCurrentAd;
    private String activeRequestId;
    private String activePlacement;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        MobileAds.initialize(this, status -> {});
        preloadRewardedAd();
        super.onCreate(savedInstanceState);
        if (Build.VERSION.SDK_INT > Build.VERSION_CODES.O) {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_USER_PORTRAIT);
        } else {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
        }
    }

    @Override
    protected CustomTabsCallback getCustomTabsCallback() {
        return new CustomTabsCallback() {
            @Override
            public void onRelationshipValidationResult(int relation, @NonNull Uri requestedOrigin,
                    boolean result, @Nullable Bundle extras) {
                if (ORIGIN.equals(requestedOrigin)) {
                    relationshipValidated = result;
                    Log.d(TAG, "use_as_origin validation=" + result);
                }
            }

            @Override
            public void onNavigationEvent(int navigationEvent, @Nullable Bundle extras) {
                if (navigationEvent != NAVIGATION_FINISHED || !relationshipValidated) return;
                requestMessageChannelWithRetry(0);
            }

            @Override
            public void onMessageChannelReady(@Nullable Bundle extras) {
                messageChannelReady = true;
                sendMessage(newMessage("STOP_AD_BRIDGE_READY"));
            }

            @Override
            public void onPostMessage(@NonNull String message, @Nullable Bundle extras) {
                handleWebMessage(message);
            }
        };
    }

    private void requestMessageChannelWithRetry(int attempt) {
        if (messageChannelReady || !relationshipValidated) return;
        CustomTabsSession session = getCustomTabsSession();
        if (session == null) {
            if (attempt + 1 < CHANNEL_RETRY_COUNT) {
                mainHandler.postDelayed(() -> requestMessageChannelWithRetry(attempt + 1), CHANNEL_RETRY_DELAY_MS);
            }
            return;
        }

        boolean requested = session.requestPostMessageChannel(ORIGIN, ORIGIN, new Bundle());
        Log.d(TAG, "requestPostMessageChannel attempt=" + (attempt + 1) + " result=" + requested);
        if (!requested && attempt + 1 < CHANNEL_RETRY_COUNT) {
            mainHandler.postDelayed(() -> requestMessageChannelWithRetry(attempt + 1), CHANNEL_RETRY_DELAY_MS);
        }
    }

    /**
     * Browser Helper 2.7.3 does not expose LauncherActivity#getCustomTabsSession().
     * Bubblewrap keeps the live session inside LauncherActivity.mTwaLauncher.mSession.
     * This compatibility shim is isolated here so a future Browser Helper upgrade can
     * replace only this method with the public getter.
     */
    @Nullable
    private CustomTabsSession getCustomTabsSession() {
        try {
            Field twaLauncherField = findField(getClass(), "mTwaLauncher");
            if (twaLauncherField == null) {
                Log.w(TAG, "Bubblewrap mTwaLauncher field not found");
                return null;
            }
            twaLauncherField.setAccessible(true);
            Object twaLauncher = twaLauncherField.get(this);
            if (twaLauncher == null) return null;

            Field sessionField = findField(twaLauncher.getClass(), "mSession");
            if (sessionField == null) {
                Log.w(TAG, "Bubblewrap mSession field not found");
                return null;
            }
            sessionField.setAccessible(true);
            Object session = sessionField.get(twaLauncher);
            return session instanceof CustomTabsSession
                    ? (CustomTabsSession) session
                    : null;
        } catch (ReflectiveOperationException | SecurityException e) {
            Log.w(TAG, "Unable to access Bubblewrap CustomTabsSession", e);
            return null;
        }
    }

    @Nullable
    private static Field findField(Class<?> type, String name) {
        Class<?> current = type;
        while (current != null) {
            try {
                return current.getDeclaredField(name);
            } catch (NoSuchFieldException ignored) {
                current = current.getSuperclass();
            }
        }
        return null;
    }

    private void handleWebMessage(String raw) {
        try {
            JSONObject message = new JSONObject(raw);
            if (!"STOP_AD_REQUEST_REWARDED".equals(message.optString("type"))) return;
            String requestId = message.optString("requestId", "");
            String placement = message.optString("placement", "extra_time");
            if (requestId.isEmpty() || !messageChannelReady || activeRequestId != null) return;
            if (!isAllowedPlacement(placement)) return;
            activeRequestId = requestId;
            activePlacement = placement;
            rewardGrantedForCurrentAd = false;
            showRewardedAd();
        } catch (JSONException ignored) {
            Log.w(TAG, "Ignoring malformed web message");
        }
    }

    private boolean isAllowedPlacement(String placement) {
        return "extra_time".equals(placement)
                || "hint".equals(placement)
                || "double_points".equals(placement)
                || "skip_round".equals(placement)
                || "extra_pack".equals(placement);
    }

    private void preloadRewardedAd() {
        if (rewardedAd != null || rewardedAdLoading) return;
        rewardedAdLoading = true;
        String adUnitId = BuildConfig.DEBUG ? REWARDED_TEST_ID : REWARDED_REAL_ID;
        RewardedAd.load(this, adUnitId, new AdRequest.Builder().build(), new RewardedAdLoadCallback() {
            @Override
            public void onAdLoaded(@NonNull RewardedAd ad) {
                rewardedAdLoading = false;
                rewardedAd = ad;
            }

            @Override
            public void onAdFailedToLoad(@NonNull LoadAdError error) {
                rewardedAdLoading = false;
                rewardedAd = null;
                Log.w(TAG, "Rewarded load failed: " + error.getCode());
            }
        });
    }

    private void showRewardedAd() {
        if (rewardedAd == null) {
            sendResult(false, "error");
            preloadRewardedAd();
            return;
        }

        RewardedAd ad = rewardedAd;
        rewardedAd = null;
        ad.setFullScreenContentCallback(new FullScreenContentCallback() {
            @Override
            public void onAdDismissedFullScreenContent() {
                if (!rewardGrantedForCurrentAd) sendResult(false, "skipped");
                preloadRewardedAd();
            }

            @Override
            public void onAdFailedToShowFullScreenContent(@NonNull AdError adError) {
                sendResult(false, "error");
                preloadRewardedAd();
            }
        });

        ad.show(this, rewardItem -> {
            rewardGrantedForCurrentAd = true;
            sendResult(true, "admob");
        });
    }

    private void sendResult(boolean rewarded, String source) {
        if (activeRequestId == null) return;
        JSONObject result = new JSONObject();
        try {
            result.put("type", "STOP_AD_REWARDED_RESULT");
            result.put("requestId", activeRequestId);
            result.put("placement", activePlacement);
            result.put("rewarded", rewarded);
            result.put("source", source);
        } catch (JSONException ignored) {
            return;
        }
        sendMessage(result);
        activeRequestId = null;
        activePlacement = null;
        rewardGrantedForCurrentAd = false;
    }

    private JSONObject newMessage(String type) {
        JSONObject message = new JSONObject();
        try { message.put("type", type); } catch (JSONException ignored) {}
        return message;
    }

    private void sendMessage(JSONObject message) {
        CustomTabsSession session = getCustomTabsSession();
        if (session == null || !messageChannelReady) return;
        session.postMessage(message.toString(), null);
    }
}
