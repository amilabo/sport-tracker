package app.napodhode;

import android.Manifest;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import org.json.JSONException;

/**
 * The page's side of RestAlarm (stage A5) and the notification permission shared with the reminders (A6).
 * src/platform/android.ts → restAlarm, notifications.
 */
@CapacitorPlugin(
    name = "RestAlarm",
    permissions = { @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = "notifications") }
)
public class RestAlarmPlugin extends Plugin {

    @Override
    public void load() {
        RestAlarm.ensureChannels(getContext());
    }

    /** "granted" | "prompt" (Android may still ask) | "denied" (only the settings can turn them on). */
    private String state() {
        if (NotificationManagerCompat.from(getContext()).areNotificationsEnabled()) return "granted";
        if (Build.VERSION.SDK_INT < 33) return "denied";
        PermissionState s = getPermissionState("notifications");
        return s == PermissionState.PROMPT || s == PermissionState.PROMPT_WITH_RATIONALE ? "prompt" : "denied";
    }

    private void resolveState(PluginCall call) {
        JSObject out = new JSObject();
        out.put("state", state());
        call.resolve(out);
    }

    @PluginMethod
    public void permission(PluginCall call) {
        resolveState(call);
    }

    /** Android's one-time dialog (13+); on older phones notifications are on unless turned off in the settings. */
    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < 33 || !"prompt".equals(state())) resolveState(call);
        else requestPermissionForAlias("notifications", call, "permissionAnswered");
    }

    @PermissionCallback
    private void permissionAnswered(PluginCall call) {
        resolveState(call);
    }

    /** The app's notification settings. */
    @PluginMethod
    public void openSettings(PluginCall call) {
        Intent i;
        if (Build.VERSION.SDK_INT >= 26) {
            i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
        } else {
            i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName()));
        }
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }

    /** { signals: [{ at, title, text, until, alert }], sound } — the rest's timeline, replacing the one before. */
    @PluginMethod
    public void schedule(PluginCall call) {
        try {
            RestAlarm.schedule(getContext(), call.getArray("signals"), Boolean.TRUE.equals(call.getBoolean("sound", true)));
            call.resolve();
        } catch (JSONException | NullPointerException e) {
            call.reject("signals must be [{ at, title, text, until, alert }]", e);
        }
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        RestAlarm.cancel(getContext());
        call.resolve();
    }

    /** The signal while the app is on screen, by the same rule as in the background: { tick } — one short beep. */
    @PluginMethod
    public void beep(PluginCall call) {
        RestAlarm.play(getContext(), Boolean.TRUE.equals(call.getBoolean("tick", false)) ? R.raw.rest_tick : R.raw.rest_signal);
        call.resolve();
    }
}
