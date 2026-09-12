package app.replit.stop_el_juego.twa;

import android.graphics.Color;
import android.os.Bundle;
import android.widget.ScrollView;
import android.widget.TextView;

/**
 * TWA startup diagnostic. If Browser Helper fails during onCreate, keep the
 * activity alive and show the real exception instead of Android's generic
 * "app has crashed" dialog.
 */
public class LauncherActivity extends com.google.androidbrowserhelper.trusted.LauncherActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        try {
            super.onCreate(savedInstanceState);
        } catch (Throwable error) {
            showStartupError(error);
        }
    }

    private void showStartupError(Throwable error) {
        ScrollView scrollView = new ScrollView(this);
        TextView textView = new TextView(this);
        textView.setTextColor(Color.BLACK);
        textView.setTextSize(14);
        textView.setPadding(32, 32, 32, 32);
        textView.setText(buildErrorText(error));
        scrollView.setBackgroundColor(Color.WHITE);
        scrollView.addView(textView);
        setContentView(scrollView);
    }

    private String buildErrorText(Throwable error) {
        StringBuilder out = new StringBuilder();
        out.append("STOP Android startup diagnostic\n\n");
        out.append(error.getClass().getName()).append(": ").append(error.getMessage()).append("\n\n");
        out.append("Stack trace:\n");
        for (StackTraceElement element : error.getStackTrace()) {
            out.append("at ").append(element).append('\n');
        }
        Throwable cause = error.getCause();
        while (cause != null) {
            out.append("\nCaused by: ").append(cause.getClass().getName()).append(": ")
                    .append(cause.getMessage()).append('\n');
            for (StackTraceElement element : cause.getStackTrace()) {
                out.append("at ").append(element).append('\n');
            }
            cause = cause.getCause();
        }
        return out.toString();
    }
}
