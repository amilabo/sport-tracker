package app.napodhode;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * The reminders of «Ритм» (stage A6). The page plans them four weeks ahead (src/domain/reminders.ts) and hands over the
 * whole list on every change; here they become alarms. The list is kept, so a reboot or a change of time sets them again.
 * An ordinary notification: the phone's own sound, vibration in «Вибро» — right for a reminder, unlike the rest signal.
 */
final class Reminders {

    static final String CHANNEL = "reminders";
    private static final String PREFS = "reminders";
    private static final int ID_BASE = 6000;

    private Reminders() {}

    private static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static void ensureChannel(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationChannel ch = new NotificationChannel(CHANNEL, "Напоминания", NotificationManager.IMPORTANCE_DEFAULT);
        ch.setDescription("План на неделю, завтра тренировка, цель недели");
        c.getSystemService(NotificationManager.class).createNotificationChannel(ch);
    }

    private static PendingIntent alarm(Context c, int index, int flags) {
        Intent i = new Intent(c, ReminderReceiver.class).putExtra("i", index);
        return PendingIntent.getBroadcast(c, ID_BASE + index, i, flags | PendingIntent.FLAG_IMMUTABLE);
    }

    /** [{ kind, at, title, text, path }] — replaces every reminder planned before. */
    static void set(Context c, JSONArray items) {
        cancelAll(c);
        prefs(c).edit().putString("items", items.toString()).putInt("count", items.length()).apply();
        arm(c);
    }

    /** Sets an alarm for every reminder still ahead (after set, a reboot, a change of time or of the app). */
    static void arm(Context c) {
        JSONArray items = items(c);
        AlarmManager am = c.getSystemService(AlarmManager.class);
        long now = System.currentTimeMillis();
        for (int i = 0; i < items.length(); i++) {
            long at = items.optJSONObject(i) == null ? 0 : items.optJSONObject(i).optLong("at");
            if (at <= now) continue;
            PendingIntent pi = alarm(c, i, PendingIntent.FLAG_UPDATE_CURRENT);
            if (Build.VERSION.SDK_INT >= 31 && !am.canScheduleExactAlarms()) am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
            else am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
        }
    }

    private static void cancelAll(Context c) {
        AlarmManager am = c.getSystemService(AlarmManager.class);
        int count = prefs(c).getInt("count", 0);
        for (int i = 0; i < count; i++) {
            PendingIntent pi = alarm(c, i, PendingIntent.FLAG_NO_CREATE);
            if (pi != null) {
                am.cancel(pi);
                pi.cancel();
            }
        }
    }

    private static JSONArray items(Context c) {
        try {
            return new JSONArray(prefs(c).getString("items", "[]"));
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    /** A screen inside the app: notifications, widgets and shortcuts open it through Capacitor's appUrlOpen. */
    static Intent openPath(Context c, String path) {
        return new Intent(Intent.ACTION_VIEW, Uri.parse("app.napodhode://open" + (path == null || path.isEmpty() ? "/" : path)))
            .setClass(c, MainActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
    }

    static void fire(Context c, int index) {
        JSONObject r = items(c).optJSONObject(index);
        if (r == null || !NotificationManagerCompat.from(c).areNotificationsEnabled()) return;
        // A reminder that comes hours late (the phone was off) is no longer about the right moment.
        if (System.currentTimeMillis() - r.optLong("at") > 2 * 60 * 60 * 1000L) return;
        ensureChannel(c);
        String kind = r.optString("kind");
        int id = "weekly".equals(kind) ? ID_BASE + 1 : "tomorrow".equals(kind) ? ID_BASE + 2 : ID_BASE + 3;
        PendingIntent tap = PendingIntent.getActivity(c, id, openPath(c, r.optString("path")), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        String text = r.optString("text");
        NotificationCompat.Builder b = new NotificationCompat.Builder(c, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_napodhode)
            .setContentTitle(r.optString("title"))
            .setContentText(text.replace("\n", " · "))
            .setStyle(new NotificationCompat.BigTextStyle().bigText(text))
            .setContentIntent(tap)
            .setAutoCancel(true)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT);
        try {
            NotificationManagerCompat.from(c).notify(id, b.build());
        } catch (SecurityException e) {
            // The permission was taken away meanwhile.
        }
    }
}
