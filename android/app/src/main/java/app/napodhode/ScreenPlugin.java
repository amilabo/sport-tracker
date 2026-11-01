package app.napodhode;

import android.graphics.Color;
import android.view.WindowManager;
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
