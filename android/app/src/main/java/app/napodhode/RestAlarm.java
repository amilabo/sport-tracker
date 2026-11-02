package app.napodhode;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.AssetFileDescriptor;
import android.media.AudioAttributes;
import android.media.AudioDeviceInfo;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * The end-of-rest signal while the app is away (stage A5, apk/docs/a5-a7-design.md, mockup С2).
 * The page hands over the whole timeline of the rest (src/domain/rest-signals.ts): the countdown now, «Пора» or the next
 * phase of a circuit by time later. Every later step is an exact alarm. While the app is on screen the alarms are ignored
 * (the page beeps itself); when it leaves the screen the current step is shown as a countdown on the lock screen.
 *
 * Sound (1.1.1, after the test on the phone): in headphones «пи-пи-пи» goes where the music goes, over it (navigation
 * guidance, the music ducks for a moment), so the «Вибро» mode does not silence it. Without headphones it is the sound of
 * a notification: the channel «Конец отдыха» plays it at the notification volume, «Вибро» / «Без звука» leave the
 * vibration only. (1.1.0 played it at the media volume — silent from the speaker with the media volume down.)
 */
final class RestAlarm {

    static final String CH_TIMER = "rest_timer";
    static final String CH_DUE = "rest_due";
    static final String CH_DUE_SOUND = "rest_due_sound";
    static final int NOTIFICATION_ID = 5001;
    private static final String PREFS = "rest_alarm";
    private static final long[] PATTERN = { 0, 180, 90, 180, 90, 180 };

    /** MainActivity is resumed: the page signals itself. Lost with the process — then it is not on screen anyway. */
    static volatile boolean foreground;

    private RestAlarm() {}

    private static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static void ensureChannels(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        // The countdown: shown on the lock screen, makes no sound of its own.
        NotificationChannel timer = new NotificationChannel(CH_TIMER, "Таймер отдыха", NotificationManager.IMPORTANCE_DEFAULT);
        timer.setDescription("Обратный отсчёт отдыха, пока приложение свёрнуто");
        timer.setSound(null, null);
        timer.enableVibration(false);
        timer.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
        // «Пора» in headphones (or with «Звук сигнала» off): the app plays the beeps itself, over the music.
        NotificationChannel due = new NotificationChannel(CH_DUE, "Конец отдыха в наушниках", NotificationManager.IMPORTANCE_HIGH);
        due.setDescription("«Пора», когда подключены наушники: звук играет приложение поверх музыки");
        due.setSound(null, null);
        due.enableVibration(false);
        due.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
        // «Пора» without headphones: the channel's own sound at the notification volume; the ringer mode applies.
        // The vibration is the app's own (it is felt in «Без звука» too), so the channel does not vibrate.
        NotificationChannel dueSound = new NotificationChannel(CH_DUE_SOUND, "Конец отдыха", NotificationManager.IMPORTANCE_HIGH);
        dueSound.setDescription("«Пора» без наушников: звук уведомления, громкость — как у уведомлений, в «Вибро» — только вибрация");
        dueSound.setSound(
            android.net.Uri.parse("android.resource://" + c.getPackageName() + "/" + R.raw.rest_signal),
            new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()
        );
        dueSound.enableVibration(false);
        dueSound.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(timer);
        nm.createNotificationChannel(due);
        nm.createNotificationChannel(dueSound);
    }

    private static PendingIntent alarmIntent(Context c, int index, long gen, int flags) {
        Intent i = new Intent(c, RestAlarmReceiver.class).putExtra("i", index).putExtra("gen", gen);
        return PendingIntent.getBroadcast(c, index, i, flags | PendingIntent.FLAG_IMMUTABLE);
    }

    /** Replaces the timeline: [{ at, title, text, until, alert }], times in ms. */
    static void schedule(Context c, JSONArray signals, boolean sound) throws JSONException {
        cancelAlarms(c);
        long gen = System.currentTimeMillis();
        prefs(c).edit()
            .putString("signals", signals.toString())
            .putLong("gen", gen)
            .putInt("count", signals.length())
            .putBoolean("sound", sound)
            .apply();
        AlarmManager am = c.getSystemService(AlarmManager.class);
        long now = System.currentTimeMillis();
        for (int i = 0; i < signals.length(); i++) {
            long at = signals.getJSONObject(i).getLong("at");
            if (at <= now) continue;
            PendingIntent pi = alarmIntent(c, i, gen, PendingIntent.FLAG_UPDATE_CURRENT);
            if (Build.VERSION.SDK_INT >= 31 && !am.canScheduleExactAlarms()) am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
            else am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
        }
        if (!foreground) showCurrent(c);
    }

    private static void cancelAlarms(Context c) {
        AlarmManager am = c.getSystemService(AlarmManager.class);
        int count = prefs(c).getInt("count", 0);
        long gen = prefs(c).getLong("gen", 0);
        for (int i = 0; i < count; i++) {
            PendingIntent pi = alarmIntent(c, i, gen, PendingIntent.FLAG_NO_CREATE);
            if (pi != null) {
                am.cancel(pi);
                pi.cancel();
            }
        }
    }

    /** Nothing runs any more: no alarms, no notification. */
    static void cancel(Context c) {
        cancelAlarms(c);
        prefs(c).edit().clear().apply();
        NotificationManagerCompat.from(c).cancel(NOTIFICATION_ID);
    }

    /** The app came to the screen (the page takes over) or left it (the countdown goes to the lock screen). */
    static void setForeground(Context c, boolean fg) {
        foreground = fg;
        if (fg) NotificationManagerCompat.from(c).cancel(NOTIFICATION_ID);
        else showCurrent(c);
    }

    private static JSONArray signals(Context c) {
        try {
            return new JSONArray(prefs(c).getString("signals", "[]"));
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    /** The step running now, quietly — if it still counts down («Пора» already given on screen is not repeated). */
    private static void showCurrent(Context c) {
        JSONArray list = signals(c);
        long now = System.currentTimeMillis();
        JSONObject current = null;
        for (int i = 0; i < list.length(); i++) {
            JSONObject s = list.optJSONObject(i);
            if (s != null && s.optLong("at") <= now) current = s;
        }
        if (current == null || current.isNull("until") || current.optLong("until") <= now) return;
        show(c, current, current.optBoolean("alert") ? CH_DUE : CH_TIMER, false);
    }

    /** An alarm went off: the next step of the timeline. */
    static void fire(Context c, int index, long gen) {
        if (gen != prefs(c).getLong("gen", -1) || foreground) return;
        JSONObject s = signals(c).optJSONObject(index);
        if (s == null || !NotificationManagerCompat.from(c).areNotificationsEnabled()) return;
        if (!s.optBoolean("alert")) {
            show(c, s, CH_TIMER, false);
            return;
        }
        boolean sound = prefs(c).getBoolean("sound", true);
        boolean phones = headphones(c.getSystemService(AudioManager.class));
        // Without headphones the channel makes the sound; in headphones the app plays it over the music.
        show(c, s, sound && !phones ? CH_DUE_SOUND : CH_DUE, true);
        vibrate(c);
        if (sound && phones) play(c, R.raw.rest_signal);
    }

    private static void show(Context c, JSONObject s, String channel, boolean alert) {
        if (!NotificationManagerCompat.from(c).areNotificationsEnabled()) return;
        ensureChannels(c);
        boolean due = !CH_TIMER.equals(channel);
        Intent open = c.getPackageManager().getLaunchIntentForPackage(c.getPackageName());
        PendingIntent tap = PendingIntent.getActivity(c, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder b = new NotificationCompat.Builder(c, channel)
            .setSmallIcon(R.drawable.ic_stat_napodhode)
            .setContentTitle(s.optString("title"))
            .setContentText(s.optString("text"))
            .setStyle(new NotificationCompat.BigTextStyle().bigText(s.optString("text")))
            .setContentIntent(tap)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setCategory(due ? NotificationCompat.CATEGORY_ALARM : NotificationCompat.CATEGORY_STOPWATCH)
            .setPriority(due ? NotificationCompat.PRIORITY_HIGH : NotificationCompat.PRIORITY_DEFAULT)
            .setSilent(!alert);
        if (!s.isNull("until")) {
            b.setUsesChronometer(true).setChronometerCountDown(true).setWhen(s.optLong("until")).setShowWhen(true).setOngoing(true);
        } else {
            b.setAutoCancel(true).setWhen(System.currentTimeMillis()).setShowWhen(true);
        }
        try {
            NotificationManagerCompat.from(c).notify(NOTIFICATION_ID, b.build());
        } catch (SecurityException e) {
            // The permission was taken away meanwhile.
        }
    }

    static void vibrate(Context c) {
        Vibrator v = Build.VERSION.SDK_INT >= 31
            ? c.getSystemService(VibratorManager.class).getDefaultVibrator()
            : (Vibrator) c.getSystemService(Context.VIBRATOR_SERVICE);
        if (v == null || !v.hasVibrator()) return;
        // As an alarm: «Без звука» does not stop it.
        AudioAttributes attrs = new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).build();
        if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createWaveform(PATTERN, -1), attrs);
        else v.vibrate(PATTERN, -1, attrs);
    }

    /** Wired, Bluetooth or USB headphones are playing now. */
    private static boolean headphones(AudioManager am) {
        for (AudioDeviceInfo d : am.getDevices(AudioManager.GET_DEVICES_OUTPUTS)) {
            switch (d.getType()) {
                case AudioDeviceInfo.TYPE_WIRED_HEADSET:
                case AudioDeviceInfo.TYPE_WIRED_HEADPHONES:
                case AudioDeviceInfo.TYPE_BLUETOOTH_A2DP:
                case AudioDeviceInfo.TYPE_BLUETOOTH_SCO:
                case AudioDeviceInfo.TYPE_USB_HEADSET:
                case AudioDeviceInfo.TYPE_BLE_HEADSET:
                    return true;
                default:
                    break;
            }
        }
        return false;
    }

    /**
     * The beeps, by the rule of A5: in headphones always, over the music (which ducks), at the media volume; from the
     * speaker only in the normal ringer mode, at the notification volume — like «Пора» in the background. Any thread.
     */
    static void play(Context c, int res) {
        Context app = c.getApplicationContext();
        new Handler(Looper.getMainLooper()).post(() -> {
            AudioManager am = app.getSystemService(AudioManager.class);
            boolean phones = headphones(am);
            if (!phones && am.getRingerMode() != AudioManager.RINGER_MODE_NORMAL) return;
            AudioAttributes attrs = new AudioAttributes.Builder()
                .setUsage(phones ? AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE : AudioAttributes.USAGE_NOTIFICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
            AudioFocusRequest focus = Build.VERSION.SDK_INT >= 26
                ? new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK).setAudioAttributes(attrs).build()
                : null;
            MediaPlayer mp = new MediaPlayer();
            Runnable done = () -> {
                mp.release();
                if (Build.VERSION.SDK_INT >= 26) am.abandonAudioFocusRequest(focus);
                else am.abandonAudioFocus(null);
            };
            try (AssetFileDescriptor afd = app.getResources().openRawResourceFd(res)) {
                mp.setAudioAttributes(attrs);
                mp.setDataSource(afd.getFileDescriptor(), afd.getStartOffset(), afd.getLength());
                mp.setOnCompletionListener(p -> done.run());
                mp.setOnErrorListener((p, what, extra) -> {
                    done.run();
                    return true;
                });
                mp.prepare();
                if (Build.VERSION.SDK_INT >= 26) am.requestAudioFocus(focus);
                else am.requestAudioFocus(null, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK);
                mp.start();
            } catch (Exception e) {
                done.run();
            }
        });
    }
}
