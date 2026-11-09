package app.replit.stop_el_juego.twa;

import static android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION;

import android.app.Activity;
import android.graphics.Bitmap;
import android.graphics.Matrix;
import android.net.Uri;
import android.os.AsyncTask;
import android.os.Bundle;
import android.os.Build;
import android.util.Log;
import android.widget.ImageView;

import androidx.annotation.Nullable;
import androidx.browser.customtabs.CustomTabsSession;
import androidx.browser.customtabs.TrustedWebUtils;
import androidx.browser.trusted.TrustedWebActivityIntentBuilder;
import androidx.browser.trusted.splashscreens.SplashScreenParamKey;
import androidx.browser.trusted.splashscreens.SplashScreenVersion;
import androidx.core.content.FileProvider;

import com.google.androidbrowserhelper.trusted.LauncherActivityMetadata;
import com.google.androidbrowserhelper.trusted.Utils;
import com.google.androidbrowserhelper.trusted.splashscreens.PwaWrapperSplashScreenStrategy;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/**
 * Keeps Android Browser Helper's native splash UI, while granting the app UID read access
 * to the same FileProvider URI before handing it to the browser.
 */
final class StopTwaSplashScreenStrategy extends PwaWrapperSplashScreenStrategy {
    private static final String TAG = "STOP_TWA_SPLASH";
    private final Activity activity;
    private final LauncherActivityMetadata metadata;
    private final Bitmap splashBitmap;
    private final ImageView.ScaleType scaleType;
    @Nullable private final Matrix transformationMatrix;
    private String providerPackage;
    @Nullable private TransferTask transferTask;
    @Nullable private Runnable pendingLaunch;
    private boolean enterAnimationComplete = Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP;

    StopTwaSplashScreenStrategy(Activity activity, LauncherActivityMetadata metadata,
            ImageView.ScaleType scaleType, @Nullable Matrix transformationMatrix) {
        super(activity, metadata.splashImageDrawableId,
                androidx.core.content.ContextCompat.getColor(
                        activity, metadata.splashScreenBackgroundColorId),
                scaleType, transformationMatrix, metadata.splashScreenFadeOutDurationMillis,
                metadata.fileProviderAuthority, metadata.startChromeBeforeAnimationComplete);
        this.activity = activity;
        this.metadata = metadata;
        this.scaleType = scaleType;
        this.transformationMatrix = transformationMatrix;
        this.splashBitmap = Utils.convertDrawableToBitmap(activity, metadata.splashImageDrawableId);
    }

    @Override
    public void onTwaLaunchInitiated(String providerPackage,
            TrustedWebActivityIntentBuilder builder) {
        this.providerPackage = providerPackage;
        // Retain ABH's original native splash rendering and system-bar handling.
        super.onTwaLaunchInitiated(providerPackage, builder);
    }

    @Override
    public void configureTwaBuilder(TrustedWebActivityIntentBuilder builder,
            CustomTabsSession session, Runnable onReadyCallback) {
        if (splashBitmap == null || metadata.fileProviderAuthority == null
                || metadata.fileProviderAuthority.isEmpty()
                || providerPackage == null
                || !TrustedWebUtils.areSplashScreensSupported(
                        activity, providerPackage, SplashScreenVersion.V1)) {
            Log.w(TAG, "Splash transfer unavailable; continuing with normal TWA launch");
            onReadyCallback.run();
            return;
        }

        transferTask = new TransferTask(builder, session, onReadyCallback);
        transferTask.execute();
    }

    private final class TransferTask extends AsyncTask<Void, Void, Boolean> {
        private final TrustedWebActivityIntentBuilder builder;
        private final CustomTabsSession session;
        private final Runnable onReadyCallback;

        TransferTask(TrustedWebActivityIntentBuilder builder, CustomTabsSession session,
                Runnable onReadyCallback) {
            this.builder = builder;
            this.session = session;
            this.onReadyCallback = onReadyCallback;
        }

        @Override
        protected Boolean doInBackground(Void... ignored) {
            try {
                File directory = new File(activity.getFilesDir(), "twa_splash");
                if (!directory.exists() && !directory.mkdirs()) {
                    Log.w(TAG, "Could not create splash image directory");
                    return false;
                }
                File file = new File(directory, "splash_image.png");
                try (OutputStream output = new FileOutputStream(file)) {
                    if (isCancelled()) return false;
                    if (!splashBitmap.compress(Bitmap.CompressFormat.PNG, 100, output)) {
                        Log.w(TAG, "Could not encode splash image");
                        return false;
                    }
                    output.flush();
                }
                if (isCancelled()) return false;

                Uri uri = FileProvider.getUriForFile(
                        activity, metadata.fileProviderAuthority, file);
                // Chromium's reported regression checks the calling app UID during receiveFile.
                // Grant that UID access as well as the browser package grant made by AndroidX.
                activity.grantUriPermission(
                        activity.getPackageName(), uri, FLAG_GRANT_READ_URI_PERMISSION);

                return TrustedWebUtils.transferSplashImage(activity, file,
                        metadata.fileProviderAuthority, providerPackage, session);
            } catch (Exception error) {
                Log.w(TAG, "Splash image transfer failed; continuing without transferred splash",
                        error);
                return false;
            }
        }

        @Override
        protected void onPostExecute(Boolean success) {
            if (isCancelled() || activity.isFinishing()) return;
            if (!Boolean.TRUE.equals(success)) {
                Log.w(TAG, "Browser did not accept transferred splash image; using background-only splash parameters");
                // Even when Chrome rejects the image file, pass the configured splash
                // background color so supported providers can avoid a default white frame.
                // Keep the same launch-animation handling as the successful transfer path.
                builder.setSplashScreenParams(makeSplashParams());
            } else {
                builder.setSplashScreenParams(makeSplashParams());
            }

            Runnable launch = () -> {
                if (activity.isFinishing()) return;
                onReadyCallback.run();
                activity.overridePendingTransition(0, 0);
            };
            if (metadata.startChromeBeforeAnimationComplete || enterAnimationComplete) {
                launch.run();
            } else {
                pendingLaunch = launch;
                boolean preloaded = session.mayLaunchUrl(builder.getUri(), null, null);
                Log.i(TAG, "Splash ready; waiting for activity enter animation. Preload=" + preloaded);
            }
        }
    }

    private Bundle makeSplashParams() {
        Bundle params = new Bundle();
        params.putString(SplashScreenParamKey.KEY_VERSION, SplashScreenVersion.V1);
        params.putInt(SplashScreenParamKey.KEY_FADE_OUT_DURATION_MS,
                metadata.splashScreenFadeOutDurationMillis);
        params.putInt(SplashScreenParamKey.KEY_BACKGROUND_COLOR,
                androidx.core.content.ContextCompat.getColor(
                        activity, metadata.splashScreenBackgroundColorId));
        params.putInt(SplashScreenParamKey.KEY_SCALE_TYPE, scaleType.ordinal());
        if (transformationMatrix != null) {
            float[] values = new float[9];
            transformationMatrix.getValues(values);
            params.putFloatArray(SplashScreenParamKey.KEY_IMAGE_TRANSFORMATION_MATRIX, values);
        }
        return params;
    }

    @Override
    public void onActivityEnterAnimationComplete() {
        enterAnimationComplete = true;
        super.onActivityEnterAnimationComplete();
        Runnable launch = pendingLaunch;
        pendingLaunch = null;
        if (launch != null) launch.run();
    }

    @Override
    public void destroy() {
        if (transferTask != null) transferTask.cancel(true);
        transferTask = null;
        pendingLaunch = null;
        super.destroy();
    }
}
