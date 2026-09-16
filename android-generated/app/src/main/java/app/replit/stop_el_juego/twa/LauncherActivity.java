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
import androidx.browser.customtabs.CustomTabsService;
import androidx.browser.customtabs.CustomTabsSession;

import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.rewarded.RewardedAd;
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback;
import com.google.androidbrowserhelper.trusted.QualityEnforcer;
import com.google.androidbrowserhelper.trusted.TwaLauncher;

import org.json.JSONException;
import org.json.JSONObject;

import java.lang.reflect.Field;

/** STOP TWA native bridge for Google Mobile Ads rewarded video. */
public class LauncherActivity extends com.google.androidbrowserhelper.trusted.LauncherActivity {
    private static final String TAG = "STOP_AD_BRIDGE";
    private static final Uri SOURCE_ORIGIN = Uri.parse("https://www.stopjuegodepalabras.com");
    private static final Uri TARGET_ORIGIN = Uri.parse("https://www.stopjuegodepalabras.com");
    private static final boolean USE_TEST_REWARDED_ADS = true;
    private static final String REWARDED_TEST_ID = "ca-app-pub-3940256099942544/5224354917";
    private static final String REWARDED_REAL_ID = "ca-app-pub-4807272408824742/3559554716";

    private boolean relationshipValidated;
    private boolean messageChannelReady;
    private boolean mobileAdsReady;
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
            mobileAdsReady = true;
            Log.d(TAG, "MobileAds initialized; starting rewarded preload");
            preloadRewardedAd();
        });
        if (Build.VERSION.SDK_INT > Build.VERSION_CODES.O) {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_USER_PORTRAIT);
        } else {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
        }
    }

    @Override
    protected CustomTabsCallback getCustomTabsCallback() {
        return new QualityEnforcer() {
            @Override
            public void onRelationshipValidationResult(int relation, @NonNull Uri requestedOrigin,
                    boolean result, @Nullable Bundle extras) {
                relationshipValidated = relation == CustomTabsService.RELATION_USE_AS_ORIGIN
                        && result && SOURCE_ORIGIN.equals(requestedOrigin);
                Log.d(TAG, "use_as_origin validation=" + result + " relation=" + relation + " origin=" + requestedOrigin);
                if (relationshipValidated) requestMessageChannelWithRetry(100L);
            }
            @Override
            public void onNavigationEvent(int navigationEvent, @Nullable Bundle extras) {
                super.onNavigationEvent(navigationEvent, extras);
                if (navigationEvent == NAVIGATION_FINISHED) requestMessageChannelWithRetry(250L);
            }
            @Override
            public void onMessageChannelReady(@Nullable Bundle extras) {
                messageChannelReady = true;
                channelRequestInFlight = false;
                channelRequestAttempts = 0;
                Log.d(TAG, "TWA message channel ready");
                sendReadyBurst(0);
            }
            @Override
            public void onPostMessage(@NonNull String message, @Nullable Bundle extras) {
                super.onPostMessage(message, extras);
                handleWebMessage(message);
            }
        };
    }

    private void sendReadyBurst(int attempt) {
        if (!messageChannelReady || isFinishing()) return;
        sendMessage(newMessage("STOP_AD_BRIDGE_READY"));
        if (attempt < 12) getWindow().getDecorView().postDelayed(() -> sendReadyBurst(attempt + 1), 500L);
    }
    private void requestMessageChannelWithRetry(long initialDelayMs) {
        if (messageChannelReady || channelRequestInFlight) return;
        channelRequestInFlight = true;
        channelRequestAttempts = 0;
        getWindow().getDecorView().postDelayed(this::requestMessageChannelAttempt, initialDelayMs);
    }
    private void requestMessageChannelAttempt() {
        if (messageChannelReady) { channelRequestInFlight = false; return; }
        CustomTabsSession session = getTwaSession();
        if (session == null) { retryMessageChannel(); return; }
        channelRequestAttempts++;
        try {
            boolean requested = session.requestPostMessageChannel(SOURCE_ORIGIN, TARGET_ORIGIN, new Bundle());
            Log.d(TAG, "requestPostMessageChannel attempt=" + channelRequestAttempts + " accepted=" + requested);
            if (requested) { channelRequestInFlight = false; return; }
        } catch (RuntimeException error) { Log.w(TAG, "requestPostMessageChannel failed", error); }
        retryMessageChannel();
    }
    private void retryMessageChannel() {
        if (channelRequestAttempts >= 20 || messageChannelReady) { channelRequestInFlight = false; return; }
        getWindow().getDecorView().postDelayed(this::requestMessageChannelAttempt, 300L);
    }
    @Nullable private CustomTabsSession getTwaSession() {
        try {
            Object launcher = findFieldValue(this, "mTwaLauncher");
            if (!(launcher instanceof TwaLauncher)) return null;
            Object session = findFieldValue(launcher, "mSession");
            return session instanceof CustomTabsSession ? (CustomTabsSession) session : null;
        } catch (ReflectiveOperationException | ClassCastException error) {
            Log.w(TAG, "Unable to obtain TWA CustomTabsSession", error);
            return null;
        }
    }
    @Nullable private static Object findFieldValue(Object target, String fieldName) throws ReflectiveOperationException {
        Class<?> type = target.getClass();
        while (type != null) {
            try {
                Field field = type.getDeclaredField(fieldName);
                field.setAccessible(true);
                return field.get(target);
            } catch (NoSuchFieldException ignored) { type = type.getSuperclass(); }
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
        } catch (JSONException ignored) { Log.w(TAG, "Ignoring malformed web message"); }
    }
    private boolean isAllowedPlacement(String placement) {
        return "extra_time".equals(placement) || "hint".equals(placement) || "double_points".equals(placement)
                || "skip_round".equals(placement) || "extra_pack".equals(placement);
    }
    private String rewardedUnitId() { return USE_TEST_REWARDED_ADS ? REWARDED_TEST_ID : REWARDED_REAL_ID; }
    private void preloadRewardedAd() {
        if (!mobileAdsReady || rewardedAd != null || rewardedAdLoading) return;
        rewardedAdLoading = true;
        Log.d(TAG, "Rewarded load requested; unit=" + rewardedUnitId());
        RewardedAd.load(this, rewardedUnitId(), new AdRequest.Builder().build(), new RewardedAdLoadCallback() {
            @Override public void onAdLoaded(@NonNull RewardedAd ad) {
                rewardedAdLoading = false;
                rewardedAd = ad;
                Log.d(TAG, "Rewarded loaded successfully");
                if (activeRequestId != null) showRewardedAd();
            }
            @Override public void onAdFailedToLoad(@NonNull LoadAdError error) {
                rewardedAdLoading = false;
                rewardedAd = null;
                Log.e(TAG, "Rewarded load failed: code=" + error.getCode() + " domain=" + error.getDomain()
                        + " message=" + error.getMessage() + " response=" + error.getResponseInfo());
                if (activeRequestId != null) sendResult(false, "error", error.getCode(), error.getDomain(), error.getMessage());
            }
        });
    }
    private void showRewardedAdWhenReady() {
        if (rewardedAd != null) { showRewardedAd(); return; }
        if (!mobileAdsReady) { Log.w(TAG, "Rewarded requested before Mobile Ads initialization finished"); return; }
        preloadRewardedAd();
    }
    private void showRewardedAd() {
        if (activeRequestId == null || rewardedAd == null) return;
        RewardedAd ad = rewardedAd;
        rewardedAd = null;
        ad.setFullScreenContentCallback(new FullScreenContentCallback() {
            @Override public void onAdDismissedFullScreenContent() {
                Log.d(TAG, "Rewarded dismissed; earned=" + rewardGrantedForCurrentAd);
                if (!rewardGrantedForCurrentAd) sendResult(false, "skipped");
                preloadRewardedAd();
            }
            @Override public void onAdFailedToShowFullScreenContent(@NonNull AdError error) {
                Log.e(TAG, "Rewarded show failed: code=" + error.getCode() + " domain=" + error.getDomain() + " message=" + error.getMessage());
                sendResult(false, "error", error.getCode(), error.getDomain(), error.getMessage());
                preloadRewardedAd();
            }
            @Override public void onAdShowedFullScreenContent() { Log.d(TAG, "Rewarded showed fullscreen content"); }
        });
        try {
            Activity hostActivity = this;
            Log.d(TAG, "Showing rewarded ad requestId=" + activeRequestId + " placement=" + activePlacement);
            ad.show(hostActivity, rewardItem -> {
                rewardGrantedForCurrentAd = true;
                Log.d(TAG, "Reward earned type=" + rewardItem.getType() + " amount=" + rewardItem.getAmount());
                sendResult(true, "admob");
            });
        } catch (RuntimeException error) {
            Log.e(TAG, "Rewarded show threw", error);
            sendResult(false, "error", -1, "java", error.getClass().getSimpleName() + ": " + error.getMessage());
            preloadRewardedAd();
        }
    }
    private void sendResult(boolean rewarded, String source) {
        sendResult(rewarded, source, 0, "", "");
    }
    private void sendResult(boolean rewarded, String source, int errorCode, String errorDomain, String errorMessage) {
        if (activeRequestId == null) return;
        JSONObject result = new JSONObject();
        try {
            result.put("type", "STOP_AD_REWARDED_RESULT");
            result.put("requestId", activeRequestId);
            result.put("placement", activePlacement);
            result.put("rewarded", rewarded);
            result.put("source", source);
            if (!rewarded && "error".equals(source)) {
                result.put("errorCode", errorCode);
                result.put("errorDomain", errorDomain == null ? "" : errorDomain);
                result.put("errorMessage", errorMessage == null ? "" : errorMessage);
            }
        } catch (JSONException ignored) { return; }
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
        CustomTabsSession session = getTwaSession();
        if (session == null || !messageChannelReady) return;
        try {
            int result = session.postMessage(message.toString(), null);
            Log.d(TAG, "postMessage result=" + result + " message=" + message.optString("type"));
        } catch (RuntimeException error) { Log.w(TAG, "postMessage failed", error); }
    }
}
