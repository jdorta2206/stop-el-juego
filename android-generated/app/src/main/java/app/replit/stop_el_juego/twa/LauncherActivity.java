package app.replit.stop_el_juego.twa;

import android.app.Activity;
import android.content.pm.ActivityInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
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

import org.json.JSONException;
import org.json.JSONObject;

import java.lang.reflect.Field;

/** STOP TWA native bridge for Google Mobile Ads rewarded video. */
public class LauncherActivity extends com.google.androidbrowserhelper.trusted.LauncherActivity {
    private static final String TAG = "STOP_AD_BRIDGE";
    private static final Uri ORIGIN = Uri.parse("https://www.stopjuegodepalabras.com");

    // Keep the official Google test unit until the native flow is proven on the
    // test APK. This isolates TWA/bridge problems from production ad inventory.
    private static final boolean USE_TEST_REWARDED_ADS = true;
    private static final String REWARDED_TEST_ID = "ca-app-pub-3940256099942544/5224354917";
    private static final String REWARDED_REAL_ID = "ca-app-pub-4807272408824742/3559554716";

    private boolean relationshipValidated;
    private boolean messageChannelReady;
    private RewardedAd rewardedAd;
    private boolean rewardedAdLoading;
    private boolean rewardGrantedForCurrentAd;
    private String activeRequestId;
    private String activePlacement;
    private boolean channelRequestInFlight;
    private int channelRequestAttempts;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        MobileAds.initialize(this, status -> {
            Log.d(TAG, "MobileAds initialized");
        });
        if (Build.VERSION.SDK_INT > Build.VERSION_CODES.O) {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_USER_PORTRAIT);
        } else {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
        }
        preloadRewardedAd();
    }

    @Override
    protected CustomTabsCallback getCustomTabsCallback() {
        return new CustomTabsCallback() {
            @Override
            public void onRelationshipValidationResult(int relation, @NonNull Uri requestedOrigin,
                    boolean result, @Nullable Bundle extras) {
                relationshipValidated = result && ORIGIN.equals(requestedOrigin);
                Log.d(TAG, "use_as_origin validation=" + result + " origin=" + requestedOrigin);
                requestMessageChannelWithRetry();
            }

            @Override
            public void onNavigationEvent(int navigationEvent, @Nullable Bundle extras) {
                if (navigationEvent == NAVIGATION_FINISHED) {
                    // Chromium can deliver NAVIGATION_FINISHED before the web
                    // document is ready for postMessage. Retry briefly instead
                    // of making the first launch depend on timing.
                    requestMessageChannelWithRetry();
                }
            }

            @Override
            public void onMessageChannelReady(@Nullable Bundle extras) {
                messageChannelReady = true;
                channelRequestInFlight = false;
                channelRequestAttempts = 0;
                sendMessage(newMessage("STOP_AD_BRIDGE_READY"));
                Log.d(TAG, "TWA message channel ready");
            }

            @Override
            public void onPostMessage(@NonNull String message, @Nullable Bundle extras) {
                handleWebMessage(message);
            }
        };
    }

    private void requestMessageChannelWithRetry() {
        if (messageChannelReady || !relationshipValidated || channelRequestInFlight) return;
        channelRequestInFlight = true;
        channelRequestAttempts = 0;
        requestMessageChannelAttempt();
    }

    private void requestMessageChannelAttempt() {
        if (messageChannelReady || !relationshipValidated) {
            channelRequestInFlight = false;
            return;
        }

        CustomTabsSession session = getInternalCustomTabsSession();
        if (session == null) {
            retryMessageChannel();
            return;
        }

        channelRequestAttempts++;
        try {
            boolean requested = session.requestPostMessageChannel(ORIGIN, ORIGIN, new Bundle());
            Log.d(TAG, "requestPostMessageChannel attempt=" + channelRequestAttempts + " accepted=" + requested);
            if (requested) {
                channelRequestInFlight = false;
                return;
            }
        } catch (RuntimeException error) {
            Log.w(TAG, "requestPostMessageChannel failed", error);
        }
        retryMessageChannel();
    }

    private void retryMessageChannel() {
        if (channelRequestAttempts >= 12 || messageChannelReady) {
            channelRequestInFlight = false;
            Log.w(TAG, "TWA postMessage channel could not be established after " + channelRequestAttempts + " attempts");
            return;
        }
        getWindow().getDecorView().postDelayed(this::requestMessageChannelAttempt, 300L);
    }

    @Nullable
    private CustomTabsSession getInternalCustomTabsSession() {
        try {
            // android-browser-helper 2.7.3 keeps the session private. Do not
            // assume the exact declaring class: generated/library versions can
            // move these fields between LauncherActivity/TwaLauncher. Walk the
            // hierarchy so a harmless library refactor does not silently break
            // the rewarded bridge.
            Field launcherField = findField(com.google.androidbrowserhelper.trusted.LauncherActivity.class, "mTwaLauncher");
            if (launcherField == null) return null;
            launcherField.setAccessible(true);
            Object launcher = launcherField.get(this);
            if (launcher == null) return null;

            Field sessionField = findField(launcher.getClass(), "mSession");
            if (sessionField == null) return null;
            sessionField.setAccessible(true);
            Object session = sessionField.get(launcher);
            return session instanceof CustomTabsSession ? (CustomTabsSession) session : null;
        } catch (ReflectiveOperationException | SecurityException error) {
            Log.w(TAG, "Unable to access TWA CustomTabsSession", error);
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
            showRewardedAdWhenReady();
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

    private String rewardedUnitId() {
        return USE_TEST_REWARDED_ADS ? REWARDED_TEST_ID : REWARDED_REAL_ID;
    }

    private void preloadRewardedAd() {
        if (rewardedAd != null || rewardedAdLoading) return;
        rewardedAdLoading = true;
        RewardedAd.load(this, rewardedUnitId(), new AdRequest.Builder().build(),
                new RewardedAdLoadCallback() {
                    @Override
                    public void onAdLoaded(@NonNull RewardedAd ad) {
                        rewardedAdLoading = false;
                        rewardedAd = ad;
                        Log.d(TAG, "Rewarded loaded");
                        if (activeRequestId != null) showRewardedAd();
                    }

                    @Override
                    public void onAdFailedToLoad(@NonNull LoadAdError error) {
                        rewardedAdLoading = false;
                        rewardedAd = null;
                        Log.w(TAG, "Rewarded load failed: code=" + error.getCode()
                                + " domain=" + error.getDomain() + " message=" + error.getMessage());
                        if (activeRequestId != null) sendResult(false, "error");
                    }
                });
    }

    private void showRewardedAdWhenReady() {
        if (rewardedAd != null) {
            showRewardedAd();
            return;
        }
        preloadRewardedAd();
    }

    private void showRewardedAd() {
        if (activeRequestId == null || rewardedAd == null) return;

        RewardedAd ad = rewardedAd;
        rewardedAd = null;
        ad.setFullScreenContentCallback(new FullScreenContentCallback() {
            @Override
            public void onAdDismissedFullScreenContent() {
                if (!rewardGrantedForCurrentAd) sendResult(false, "skipped");
                preloadRewardedAd();
            }

            @Override
            public void onAdFailedToShowFullScreenContent(@NonNull AdError error) {
                Log.w(TAG, "Rewarded show failed: code=" + error.getCode()
                        + " domain=" + error.getDomain() + " message=" + error.getMessage());
                sendResult(false, "error");
                preloadRewardedAd();
            }
        });

        try {
            ad.show(this, rewardItem -> {
                // This is the ONLY successful reward path. No timer/web
                // fallback is allowed to grant the game benefit.
                rewardGrantedForCurrentAd = true;
                sendResult(true, "admob");
            });
        } catch (RuntimeException error) {
            Log.w(TAG, "Rewarded show threw", error);
            sendResult(false, "error");
            preloadRewardedAd();
        }
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
        CustomTabsSession session = getInternalCustomTabsSession();
        if (session == null || !messageChannelReady) return;
        try {
            int result = session.postMessage(message.toString(), null);
            Log.d(TAG, "postMessage result=" + result + " message=" + message.optString("type"));
        } catch (RuntimeException error) {
            Log.w(TAG, "postMessage failed", error);
        }
    }
}
