package app.replit.stop_el_juego.twa;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.graphics.Typeface;
import android.view.Gravity;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.browser.customtabs.CustomTabsCallback;
import androidx.browser.customtabs.CustomTabsService;
import androidx.browser.customtabs.CustomTabsSession;

import com.google.android.play.core.appupdate.AppUpdateInfo;
import com.google.android.play.core.appupdate.AppUpdateManager;
import com.google.android.play.core.appupdate.AppUpdateManagerFactory;
import com.google.android.play.core.install.model.UpdateAvailability;
import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.rewarded.RewardedAd;
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback;
import com.google.android.gms.games.PlayGames;
import com.google.android.gms.games.PlayGamesSdk;
import com.google.androidbrowserhelper.trusted.QualityEnforcer;

import org.json.JSONException;
import org.json.JSONObject;

/** STOP TWA native bridge for Google Mobile Ads rewarded video. */
public class LauncherActivity extends com.google.androidbrowserhelper.trusted.LauncherActivity {
    private static final String TAG = "STOP_AD_BRIDGE";
    private static final Uri SOURCE_ORIGIN = Uri.parse("https://www.stopjuegodepalabras.com");
    private static final Uri TARGET_ORIGIN = Uri.parse("https://www.stopjuegodepalabras.com");
    private static final boolean USE_TEST_REWARDED_ADS = true;
    private static final String REWARDED_TEST_ID = "ca-app-pub-3940256099942544/5224354917";
    private static final String REWARDED_REAL_ID = "ca-app-pub-4807272408824742/3559554716";

    private boolean relationshipValidated;
    private boolean originValidationRequestPending;
    private int originValidationAttempts;
    private int originValidationGeneration;
    private boolean messageChannelReady;
    private boolean mobileAdsReady;
    private RewardedAd rewardedAd;
    private boolean rewardedAdLoading;
    private boolean rewardGrantedForCurrentAd;
    private String activeInterstitialRequestId;
    private String activeRequestId;
    private String activePlacement;
    private boolean channelRequestInFlight;
    private int channelRequestAttempts;
    private static final String PLAY_STORE_PACKAGE = "app.replit.stop_el_juego.twa";
    private AppUpdateManager appUpdateManager;
    private boolean playUpdatePromptShown;
    private boolean playGamesInitialized;
    private boolean playGamesSignInInFlight;
    private boolean playGamesStartupSignInAttempted;
    private boolean twaLaunchStarted;
    private int playGamesSignInGeneration;
    // Keep the most recent PGS result until the TWA MessagePort is ready.
    @Nullable private JSONObject pendingPlayGamesStatus;
    @Nullable private AlertDialog startupWelcomeDialog;

    @Override
    protected boolean shouldLaunchImmediately() {
        // Delay launching Chrome until native Play Games sign-in has completed.
        // Otherwise Android may reject the sign-in UI because the launcher is
        // already backgrounded by the TWA.
        return false;
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        appUpdateManager = AppUpdateManagerFactory.create(this);
        // StopApplication initializes PGS before any activity. Retain an activity-level
        // fallback only if application initialization failed, without blocking gameplay.
        playGamesInitialized = StopApplication.isPlayGamesInitialized();
        if (!playGamesInitialized) {
            try {
                PlayGamesSdk.initialize(this);
                playGamesInitialized = true;
                Log.i("STOP_PLAY_GAMES", "Play Games SDK initialized by activity fallback");
            } catch (RuntimeException error) {
                Log.w("STOP_PLAY_GAMES", "Play Games SDK unavailable; app continues normally", error);
            }
        }
        // Authentication is scheduled from onResume after the activity enters the foreground.
        checkForPlayUpdate();
        if (AdsPolicy.isEnabled()) {
            MobileAds.initialize(this, status -> {
                mobileAdsReady = true;
                Log.d(TAG, "MobileAds initialized; starting rewarded + interstitial preload");
                preloadRewardedAd();
                InterstitialAdStore.initialize(this);
            });
        }
        if (Build.VERSION.SDK_INT > Build.VERSION_CODES.O) {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_USER_PORTRAIT);
        } else {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
        }
    }

    private void checkForPlayUpdate() {
        if (appUpdateManager == null || playUpdatePromptShown || isFinishing()) return;
        appUpdateManager.getAppUpdateInfo()
                .addOnSuccessListener(info -> {
                    if (info.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE) {
                        showPlayUpdateDialog();
                    }
                })
                .addOnFailureListener(error ->
                        Log.w(TAG, "Google Play update check failed; continuing normally", error));
    }

    private void showPlayUpdateDialog() {
        if (playUpdatePromptShown || isFinishing()) return;
        playUpdatePromptShown = true;
        new AlertDialog.Builder(this)
                .setTitle("Nueva actualización disponible")
                .setMessage("Hay una nueva versión de STOP disponible en Google Play. Actualiza ahora para seguir usando la versión más reciente.")
                .setPositiveButton("Actualizar", (dialog, which) -> openPlayStore())
                .setNegativeButton("Ahora no", null)
                .setCancelable(true)
                .show();
    }

    private void openPlayStore() {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW,
                    Uri.parse("market://details?id=" + PLAY_STORE_PACKAGE)));
        } catch (RuntimeException error) {
            Log.w(TAG, "Play Store app unavailable; opening web listing", error);
            try {
                startActivity(new Intent(Intent.ACTION_VIEW,
                        Uri.parse("https://play.google.com/store/apps/details?id=" + PLAY_STORE_PACKAGE)));
            } catch (RuntimeException fallbackError) {
                Log.e(TAG, "Unable to open Google Play listing", fallbackError);
            }
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        checkForPlayUpdate();
        // The TWA session may bind after Activity.onResume. Give it a fresh bounded
        // validation window on each foreground return instead of exhausting all retries
        // during the initial Custom Tabs service bind.
        if (!relationshipValidated && !originValidationRequestPending) {
            originValidationAttempts = 0;
        }
        // Authenticate while this launcher Activity is foregrounded. The TWA is
        // opened only after Play Games authentication finishes (or safely fails),
        // so Android does not block the native sign-in UI as a background launch.
        if (!twaLaunchStarted && !playGamesStartupSignInAttempted && !isFinishing()) {
            playGamesStartupSignInAttempted = true;
            Log.i("STOP_PLAY_GAMES", "Starting startup sign-in while launcher is foregrounded");
            startPlayGamesSignInIfNeeded();
        }
        if (twaLaunchStarted) {
            getWindow().getDecorView().postDelayed(this::requestUseAsOriginValidation, 1500L);
        }
    }

    private void showPlayGamesWelcomeThenLaunch() {
        if (isFinishing()) {
            launchTwaOnce();
            return;
        }
        // Native branded welcome for returning Play Games players. Google controls
        // its own sign-in UI separately; this short screen never blocks guest fallback.
        final LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setGravity(Gravity.CENTER);
        final float density = getResources().getDisplayMetrics().density;
        int horizontal = (int) (28 * density);
        int vertical = (int) (24 * density);
        content.setPadding(horizontal, vertical, horizontal, vertical);

        final TextView logo = new TextView(this);
        logo.setText("🎮");
        logo.setTextSize(42);
        logo.setGravity(Gravity.CENTER);
        content.addView(logo, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));

        final TextView heading = new TextView(this);
        heading.setText("Google Play Games");
        heading.setTextSize(21);
        heading.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        heading.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams headingParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        headingParams.topMargin = (int) (8 * density);
        content.addView(heading, headingParams);

        final TextView status = new TextView(this);
        status.setText("Preparando STOP…");
        status.setTextSize(16);
        status.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams statusParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        statusParams.topMargin = (int) (8 * density);
        content.addView(status, statusParams);

        final ProgressBar progress = new ProgressBar(this);
        LinearLayout.LayoutParams progressParams = new LinearLayout.LayoutParams(
                (int) (36 * density), (int) (36 * density));
        progressParams.gravity = Gravity.CENTER_HORIZONTAL;
        progressParams.topMargin = (int) (18 * density);
        content.addView(progress, progressParams);

        startupWelcomeDialog = new AlertDialog.Builder(this)
                .setView(content)
                .setCancelable(false)
                .create();
        try {
            startupWelcomeDialog.show();
            // Start the TWA immediately, but keep the branded dialog over the white
            // Custom Tabs startup surface until the first navigation has finished.
            launchTwaOnce();
            // Safety fallback: never leave the native dialog blocking the game forever
            // if Chrome does not deliver NAVIGATION_FINISHED on a device.
            getWindow().getDecorView().postDelayed(() -> {
                if (startupWelcomeDialog != null && startupWelcomeDialog.isShowing()) {
                    startupWelcomeDialog.dismiss();
                    startupWelcomeDialog = null;
                    Log.w("STOP_PLAY_GAMES", "Startup welcome dismissed by 8s safety timeout");
                }
            }, 8000L);
        } catch (RuntimeException error) {
            Log.w("STOP_PLAY_GAMES", "Welcome screen unavailable; continuing to the game", error);
            if (startupWelcomeDialog != null && startupWelcomeDialog.isShowing()) {
                startupWelcomeDialog.dismiss();
            }
            startupWelcomeDialog = null;
            launchTwaOnce();
        }
    }

    private void launchTwaOnce() {
        if (twaLaunchStarted || isFinishing()) return;
        twaLaunchStarted = true;
        try {
            Log.i("STOP_PLAY_GAMES", "Launching TWA after startup authentication flow");
            launchTwa();
        } catch (RuntimeException error) {
            twaLaunchStarted = false;
            Log.e("STOP_PLAY_GAMES", "Unable to launch TWA after startup authentication", error);
        }
    }

    @Override
    protected CustomTabsCallback getCustomTabsCallback() {
        return new QualityEnforcer() {
            @Override
            public void onRelationshipValidationResult(int relation, @NonNull Uri requestedOrigin,
                    boolean result, @Nullable Bundle extras) {
                originValidationRequestPending = false;
                originValidationGeneration++; // Invalidate the timeout for the completed request.
                relationshipValidated = relation == CustomTabsService.RELATION_USE_AS_ORIGIN
                        && result && SOURCE_ORIGIN.equals(requestedOrigin);
                Log.i(TAG, "BRIDGE_DIAG phase=origin_validation_callback result=" + result
                        + " relation=" + relation + " origin=" + requestedOrigin
                        + " expected=" + SOURCE_ORIGIN + " sessionAvailable=" + (getTwaSession() != null));
                if (relationshipValidated) {
                    requestMessageChannelWithRetry(100L);
                } else if (originValidationAttempts < 40 && !isFinishing()) {
                    // A negative callback can be transient (for example while Digital Asset Links
                    // is being refreshed); retry a bounded number of times before leaving PGS optional.
                    getWindow().getDecorView().postDelayed(
                            LauncherActivity.this::requestUseAsOriginValidation, 500L);
                }
            }
            @Override
            public void onNavigationEvent(int navigationEvent, @Nullable Bundle extras) {
                super.onNavigationEvent(navigationEvent, extras);
                if (navigationEvent != NAVIGATION_FINISHED) return;
                // Keep the native branded startup visible while Chrome loads the TWA.
                // Dismissing it on a fixed short timer exposes Chrome's white startup page.
                if (startupWelcomeDialog != null && startupWelcomeDialog.isShowing()) {
                    startupWelcomeDialog.dismiss();
                    startupWelcomeDialog = null;
                    Log.i("STOP_PLAY_GAMES", "Startup welcome dismissed after TWA navigation finished");
                }
                // TwaLauncher validates handle_all_urls for launching the TWA, but
                // postMessage requires the separate use_as_origin relationship.
                // Request it explicitly; otherwise this callback may never set
                // relationshipValidated and the native bridge remains disabled.
                requestUseAsOriginValidation();
                // Do not make the standalone validation callback a hard gate. Chrome's
                // postMessage-channel request performs its own origin handshake.
                requestMessageChannelWithRetry(250L);
            }
            @Override
            public void onMessageChannelReady(@Nullable Bundle extras) {
                // Chrome's MessagePort handshake is tracked separately from the standalone use_as_origin callback.
                // Native actions still require a ready channel and an exact HTTPS payload origin.
                messageChannelReady = true;
                channelRequestInFlight = false;
                channelRequestAttempts = 0;
                Log.i(TAG, "BRIDGE_DIAG phase=message_channel_ready originValidated=" + relationshipValidated
                        + " sessionAvailable=" + (getTwaSession() != null));
                flushPendingPlayGamesStatus();
                sendReadyBurst(0);
            }
            @Override
            public void onPostMessage(@NonNull String message, @Nullable Bundle extras) {
                super.onPostMessage(message, extras);
                handleWebMessage(message);
            }
        };
    }

    private void requestUseAsOriginValidation() {
        if (relationshipValidated || originValidationRequestPending || isFinishing()
                || originValidationAttempts >= 40) return;
        originValidationAttempts++;
        final int requestGeneration = ++originValidationGeneration;
        CustomTabsSession session = getTwaSession();
        Log.i(TAG, "BRIDGE_DIAG phase=origin_validation_request attempt=" + originValidationAttempts
                + " sessionAvailable=" + (session != null) + " finishing=" + isFinishing());
        if (session != null) {
            try {
                boolean requested = session.validateRelationship(
                        CustomTabsService.RELATION_USE_AS_ORIGIN, SOURCE_ORIGIN, new Bundle());
                Log.i(TAG, "BRIDGE_DIAG phase=origin_validation_requested attempt=" + originValidationAttempts
                        + " accepted=" + requested + " origin=" + SOURCE_ORIGIN);
                if (requested) {
                    originValidationRequestPending = true;
                    // Some Custom Tabs implementations can fail to deliver a validation callback.
                    // Bound the wait and retry without blocking gameplay.
                    getWindow().getDecorView().postDelayed(() -> {
                        if (requestGeneration == originValidationGeneration
                                && !relationshipValidated && originValidationRequestPending) {
                            originValidationRequestPending = false;
                            requestUseAsOriginValidation();
                        }
                    }, 1500L);
                    return;
                }
            } catch (RuntimeException error) {
                Log.w(TAG, "use_as_origin validation request failed", error);
            }
        }
        if (originValidationAttempts < 40) {
            getWindow().getDecorView().postDelayed(this::requestUseAsOriginValidation, 500L);
        }
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
        if (messageChannelReady || isFinishing()) {
            channelRequestInFlight = false;
            return;
        }
        CustomTabsSession session = getTwaSession();
        if (session == null) {
            // Count missing-session retries too, so a TWA session that never appears
            // cannot schedule retries indefinitely.
            channelRequestAttempts++;
            retryMessageChannel();
            return;
        }
        channelRequestAttempts++;
        try {
            boolean requested = session.requestPostMessageChannel(SOURCE_ORIGIN, TARGET_ORIGIN, new Bundle());
            Log.i(TAG, "BRIDGE_DIAG phase=request_message_channel attempt=" + channelRequestAttempts
                    + " accepted=" + requested + " originValidated=" + relationshipValidated);
            if (requested) {
                channelRequestInFlight = false;
                // Chrome may accept the request without delivering onMessageChannelReady.
                // Retry the handshake rather than leaving the web PGS bridge waiting forever.
                final int requestedAttempt = channelRequestAttempts;
                getWindow().getDecorView().postDelayed(() -> {
                    if (!messageChannelReady && !isFinishing()
                            && requestedAttempt == channelRequestAttempts
                            && channelRequestAttempts < 20) {
                        Log.w(TAG, "Message channel accepted but readiness callback did not arrive; retrying");
                        channelRequestInFlight = true;
                        requestMessageChannelAttempt();
                    }
                }, 2500L);
                return;
            }
        } catch (RuntimeException error) { Log.w(TAG, "requestPostMessageChannel failed", error); }
        retryMessageChannel();
    }
    private void retryMessageChannel() {
        if (isFinishing() || channelRequestAttempts >= 20 || messageChannelReady) {
            channelRequestInFlight = false;
            return;
        }
        getWindow().getDecorView().postDelayed(() -> {
            if (!isFinishing() && !messageChannelReady && channelRequestAttempts < 20) {
                requestMessageChannelAttempt();
            } else {
                channelRequestInFlight = false;
            }
        }, 300L);
    }
    @Nullable private CustomTabsSession getTwaSession() {
        // Uses the public accessor added by the pinned Android Browser Helper source revision.
        // The session is nullable until Chrome's Custom Tabs service has connected.
        return getCustomTabsSession();
    }

    private void handleWebMessage(String raw) {
        try {
            JSONObject message = new JSONObject(raw);
            String type = message.optString("type", "");
            if (type.startsWith("STOP_PGS_")) {
                String origin = message.optString("origin", "");
                if (!messageChannelReady || !isAllowedOrigin(origin)) {
                    Log.w("STOP_PLAY_GAMES", "Rejected PGS message from invalid origin/channel: " + origin);
                    sendPlayGamesStatus(false, "invalid_origin_or_channel");
                    return;
                }
                handlePlayGamesMessage(type, message);
                return;
            }
            if (!AdsPolicy.isEnabled()) return;
            if ("STOP_AD_REQUEST_INTERSTITIAL".equals(type)) {
                String requestId = message.optString("requestId", "");
                String origin = message.optString("origin", "");
                Log.d(TAG, "INTERSTITIAL REQUEST requestId=" + requestId + " origin=" + origin);
                if (requestId.isEmpty() || !messageChannelReady || activeInterstitialRequestId != null) return;
                if (!isAllowedOrigin(origin)) {
                    Log.w(TAG, "INTERSTITIAL rejected origin=" + origin);
                    sendInterstitialResult(requestId, false, "invalid_origin");
                    return;
                }
                activeInterstitialRequestId = requestId;
                showInterstitialWhenReady();
                return;
            }
            if (!"STOP_AD_REQUEST_REWARDED".equals(type)) return;
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


    private void startPlayGamesSignInIfNeeded() {
        if (!playGamesInitialized) {
            sendPlayGamesStatus(false, "sdk_unavailable");
            launchTwaOnce();
            return;
        }
        if (playGamesSignInInFlight) {
            // A manual tap can arrive while launch-time authentication is pending.
            // Reply instead of silently ignoring the tap.
            sendPlayGamesStatus(false, "sign_in_in_progress");
            return;
        }
        if (isFinishing()) return;
        playGamesSignInInFlight = true;
        final int signInGeneration = ++playGamesSignInGeneration;
        // Bound the authentication check, but do not time out the user-driven sign-in UI.
        getWindow().getDecorView().postDelayed(() -> {
            if (playGamesSignInInFlight && signInGeneration == playGamesSignInGeneration && !isFinishing()) {
                playGamesSignInInFlight = false;
                Log.e("STOP_PLAY_GAMES", "isAuthenticated check timed out after 15 seconds; check Play Games Console credentials and signing certificate");
                sendPlayGamesStatus(false, "sign_in_timeout");
                launchTwaOnce();
            }
        }, 15000L);
        try {
            PlayGames.getGamesSignInClient(this).isAuthenticated()
                    .addOnCompleteListener(task -> {
                        // The authentication check completed. Invalidate its timeout before
                        // opening signIn(), which may legitimately wait for user interaction.
                        if (signInGeneration == playGamesSignInGeneration) playGamesSignInGeneration++;
                        if (!task.isSuccessful()) {
                            Log.e("STOP_PLAY_GAMES", "isAuthenticated task failed", task.getException());
                        }
                        boolean authenticated = task.isSuccessful()
                                && task.getResult() != null
                                && task.getResult().isAuthenticated();
                        if (authenticated) {
                            playGamesSignInInFlight = false;
                            Log.i("STOP_PLAY_GAMES", "Already authenticated");
                            sendPlayGamesStatus(true, "authenticated");
                            showPlayGamesWelcomeThenLaunch();
                            return;
                        }
                        // Bound automatic sign-in too: this is startup, not a user-held dialog.
                        // If Play Games never completes (misconfigured project/network), preserve guest play.
                        final int startupSignInGeneration = ++playGamesSignInGeneration;
                        getWindow().getDecorView().postDelayed(() -> {
                            if (playGamesSignInInFlight
                                    && startupSignInGeneration == playGamesSignInGeneration
                                    && !isFinishing()) {
                                playGamesSignInGeneration++;
                                playGamesSignInInFlight = false;
                                Log.e("STOP_PLAY_GAMES", "signIn task timed out after 15 seconds; continuing as guest");
                                sendPlayGamesStatus(false, "sign_in_timeout");
                                launchTwaOnce();
                            }
                        }, 15000L);
                        try {
                            PlayGames.getGamesSignInClient(this).signIn()
                                    .addOnCompleteListener(signInTask -> {
                                        if (startupSignInGeneration != playGamesSignInGeneration || isFinishing()) {
                                            Log.w("STOP_PLAY_GAMES", "Ignoring late signIn result after timeout");
                                            return;
                                        }
                                        playGamesSignInGeneration++;
                                        if (!signInTask.isSuccessful()) {
                                            Log.e("STOP_PLAY_GAMES", "signIn task failed", signInTask.getException());
                                        }
                                        boolean signedIn = signInTask.isSuccessful()
                                                && signInTask.getResult() != null
                                                && signInTask.getResult().isAuthenticated();
                                        playGamesSignInInFlight = false;
                                        Log.i("STOP_PLAY_GAMES", signedIn
                                                ? "Native startup sign-in succeeded"
                                                : "Native startup sign-in did not complete; guest play remains available");
                                        sendPlayGamesStatus(signedIn, signedIn ? "authenticated" : "sign_in_failed");
                                        if (signedIn) {
                                            // Keep first-time sign-in consistent with returning authenticated users:
                                            // show the native STOP / Play Games welcome before opening the TWA.
                                            showPlayGamesWelcomeThenLaunch();
                                        } else {
                                            launchTwaOnce();
                                        }
                                    });
                        } catch (RuntimeException error) {
                            playGamesSignInInFlight = false;
                            Log.e("STOP_PLAY_GAMES", "Native sign-in could not start", error);
                            sendPlayGamesStatus(false, "sign_in_failed");
                            launchTwaOnce();
                        }
                    });
        } catch (RuntimeException error) {
            playGamesSignInInFlight = false;
            Log.e("STOP_PLAY_GAMES", "Authentication check failed", error);
            sendPlayGamesStatus(false, "sign_in_failed");
            launchTwaOnce();
        }
    }

    private void handlePlayGamesMessage(String type, JSONObject message) {
        if (!playGamesInitialized) {
            sendPlayGamesStatus(false, "sdk_unavailable");
            return;
        }
        if ("STOP_PGS_SIGN_IN".equals(type)) {
            startPlayGamesSignInIfNeeded();
            return;
        }
        if ("STOP_PGS_STATUS".equals(type)) {
            PlayGames.getGamesSignInClient(this).isAuthenticated()
                    .addOnCompleteListener(task -> {
                        if (!task.isSuccessful()) {
                            Log.e("STOP_PLAY_GAMES", "Status isAuthenticated task failed", task.getException());
                        }
                        boolean authenticated = task.isSuccessful()
                                && task.getResult() != null
                                && task.getResult().isAuthenticated();
                        sendPlayGamesStatus(authenticated, authenticated ? "authenticated" : "not_authenticated");
                    });
            return;
        }
        if ("STOP_PGS_SHOW_ACHIEVEMENTS".equals(type)) {
            PlayGames.getAchievementsClient(this).getAchievementsIntent()
                    .addOnSuccessListener(intent -> {
                        try { startActivityForResult(intent, 7402); sendPlayGamesStatus(true, "achievements_opened"); }
                        catch (RuntimeException error) { sendPlayGamesStatus(false, "achievements_unavailable"); }
                    })
                    .addOnFailureListener(error -> {
                        Log.e("STOP_PLAY_GAMES", "getAchievementsIntent failed", error);
                        sendPlayGamesStatus(false, "achievements_unavailable");
                    });
            return;
        }
        if ("STOP_PGS_UNLOCK_ACHIEVEMENT".equals(type)) {
            String id = message.optString("achievementId", "").trim();
            // Only accept Google Play achievement IDs, never arbitrary payloads.
            if (!id.matches("Cgk[A-Za-z0-9_-]{10,}")) {
                sendPlayGamesStatus(false, "invalid_achievement_id");
                return;
            }
            PlayGames.getGamesSignInClient(this).isAuthenticated().addOnCompleteListener(task -> {
                if (!task.isSuccessful() || task.getResult() == null || !task.getResult().isAuthenticated()) {
                    sendPlayGamesStatus(false, "not_authenticated");
                    return;
                }
                PlayGames.getAchievementsClient(this).unlockImmediate(id)
                        .addOnSuccessListener(unused ->
                                sendPlayGamesStatus(true, "achievement_unlocked"))
                        .addOnFailureListener(error -> {
                            Log.w("STOP_PLAY_GAMES", "Achievement unlock failed", error);
                            sendPlayGamesStatus(false, "achievement_unlock_failed");
                        });
            });
        }
    }

    private void sendPlayGamesStatus(boolean ok, String status) {
        JSONObject result = newMessage("STOP_PGS_STATUS_RESULT");
        try {
            result.put("ok", ok);
            result.put("status", status);
        } catch (JSONException ignored) { return; }
        // Startup authentication can finish before Chrome Custom Tabs establishes
        // the MessagePort. Do not silently discard that result: deliver it as soon
        // as the validated channel becomes ready.
        if (!messageChannelReady) {
            pendingPlayGamesStatus = result;
            Log.d("STOP_PLAY_GAMES", "Queued PGS status until TWA message channel is ready: " + status);
            return;
        }
        sendMessage(result);
    }

    private void flushPendingPlayGamesStatus() {
        if (!messageChannelReady || pendingPlayGamesStatus == null) return;
        JSONObject result = pendingPlayGamesStatus;
        pendingPlayGamesStatus = null;
        sendMessage(result);
    }

    private void showInterstitialWhenReady() {
        if (!mobileAdsReady) {
            Log.w(TAG, "INTERSTITIAL requested before Mobile Ads initialization finished");
            activeInterstitialRequestId = null;
            return;
        }
        String requestId = activeInterstitialRequestId;
        if (requestId == null || requestId.isEmpty()) return;
        Uri uri = Uri.parse("stopad://interstitial?requestId=" + Uri.encode(requestId)
                + "&origin=" + Uri.encode("https://www.stopjuegodepalabras.com"));
        try {
            Log.d(TAG, "Launching native interstitial activity requestId=" + requestId);
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (RuntimeException error) {
            Log.e(TAG, "INTERSTITIAL launch failed", error);
            activeInterstitialRequestId = null;
        }
    }

    private boolean isAllowedOrigin(String origin) {
        return "https://stopjuegodepalabras.com".equals(origin)
                || "https://www.stopjuegodepalabras.com".equals(origin);
    }

    private void sendInterstitialResult(String requestId, boolean shown, String source) {
        if (requestId == null || requestId.isEmpty()) return;
        JSONObject result = new JSONObject();
        try {
            result.put("type", "STOP_AD_INTERSTITIAL_RESULT");
            result.put("requestId", requestId);
            result.put("shown", shown);
            result.put("source", source);
        } catch (JSONException ignored) { return; }
        sendMessage(result);
        if (requestId.equals(activeInterstitialRequestId)) activeInterstitialRequestId = null;
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
            Log.i(TAG, "BRIDGE_DIAG phase=native_post_message result=" + result
                    + " message=" + message.optString("type") + " channelReady=" + messageChannelReady);
        } catch (RuntimeException error) { Log.w(TAG, "postMessage failed", error); }
    }
}
