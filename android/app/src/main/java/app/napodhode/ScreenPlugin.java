package app.napodhode;

import android.graphics.Color;
import android.view.View;
import android.view.WindowManager;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * The window around the WebView (src/platform/android.ts).
 * keepOn: keeps the screen on during a workout with rest (src/lib/wake-lock.ts). The Wake Lock API of the WebView is
 * dropped whenever the page is hidden; the window flag holds until the workout ends and needs no permission.
 * setBackground: the theme's page color behind the system bars. A WebView older than 140 is not drawn under the
 * bars (Capacitor pads it), and without this the strips there stay white in a dark theme.
 * insets: the status bar's height as Android has it, for --native-top in globals.css (1.1.2). On the S22 the page's
 * own insets (env() and Capacitor's --safe-area-inset-top) still left the top under the status bar. The same for the
 * navigation bar at the bottom, for --native-bottom (1.1.4): sheets without a footer went under it on the S22.
 */
@CapacitorPlugin(name = "Screen")
public class ScreenPlugin extends Plugin {

    @PluginMethod
    public void keepOn(PluginCall call) {
        boolean on = Boolean.TRUE.equals(call.getBoolean("on", false));
        getActivity().runOnUiThread(() -> {
            if (on) getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            else getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            call.resolve();
        });
    }

    /**
     * { top, bottom: dp rounded up; padded / paddedBottom: Capacitor already moved the WebView off the bar (old WebView) }.
     */
    @PluginMethod
    public void insets(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            View decor = getActivity().getWindow().getDecorView();
            WindowInsetsCompat insets = ViewCompat.getRootWindowInsets(decor);
            int px = 0;
            int bottomPx = 0;
            if (insets != null) {
                Insets bars = insets.getInsetsIgnoringVisibility(WindowInsetsCompat.Type.statusBars());
                Insets cut = insets.getInsets(WindowInsetsCompat.Type.displayCutout());
                px = Math.max(bars.top, cut.top);
                Insets nav = insets.getInsets(WindowInsetsCompat.Type.navigationBars());
                bottomPx = Math.max(nav.bottom, cut.bottom);
            }
            float density = getActivity().getResources().getDisplayMetrics().density;
            JSObject res = new JSObject();
            res.put("top", (int) Math.ceil(px / density));
            res.put("padded", decor.getPaddingTop() > 0);
            res.put("bottom", (int) Math.ceil(bottomPx / density));
            res.put("paddedBottom", decor.getPaddingBottom() > 0);
            call.resolve(res);
        });
    }

    @PluginMethod
    public void setBackground(PluginCall call) {
        int color;
        try {
            color = Color.parseColor(call.getString("color", ""));
        } catch (IllegalArgumentException e) {
            call.reject("Not a color: " + call.getString("color"));
            return;
        }
        getActivity().runOnUiThread(() -> {
            getActivity().getWindow().getDecorView().setBackgroundColor(color);
            // Capacitor pads the WebView itself there: its own background (white by default) fills the padding.
            getBridge().getWebView().setBackgroundColor(color);
            call.resolve();
        });
    }
}
