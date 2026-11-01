package app.napodhode;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Typeface;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;
import java.util.Calendar;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * The home screen widgets (stage A7, mockups В1–В3): the week «1 из 2» with its seven days, the next plan, the days since
 * the last workout. The page writes what they show and the theme's colors (HomePlugin.update); the widgets count the day
 * and the week themselves, so a new week shows «0 из 2» and the days go on without the app. Redrawn at midnight.
 */
final class Widgets {

    private static final String PREFS = "home_widgets";
    static final String ACTION_MIDNIGHT = "app.napodhode.WIDGETS_MIDNIGHT";
    private static final Class<?>[] KINDS = { WidgetWide.class, WidgetSmall.class, WidgetSlim.class, WidgetSince.class };
    private static final String[] LETTERS = { "П", "В", "С", "Ч", "П", "С", "В" };

    private Widgets() {}

    static void save(Context c, JSONObject data) {
        c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("data", data.toString()).apply();
        refreshAll(c);
    }

    static JSONObject data(Context c) {
        try {
            return new JSONObject(c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("data", "{}"));
        } catch (JSONException e) {
            return new JSONObject();
        }
    }

    static void refreshAll(Context c) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(c);
        boolean any = false;
        for (Class<?> k : KINDS) {
            int[] ids = mgr.getAppWidgetIds(new ComponentName(c, k));
            for (int id : ids) update(c, mgr, id, k);
            any |= ids.length > 0;
        }
        if (any) scheduleMidnight(c);
    }

    /** The next local midnight, inexact: the day count and the week change then even if the app is not opened. */
    static void scheduleMidnight(Context c) {
        Calendar cal = Calendar.getInstance();
        cal.add(Calendar.DAY_OF_YEAR, 1);
        cal.set(Calendar.HOUR_OF_DAY, 0);
        cal.set(Calendar.MINUTE, 0);
        cal.set(Calendar.SECOND, 30);
        Intent i = new Intent(c, WidgetWide.class).setAction(ACTION_MIDNIGHT);
        PendingIntent pi = PendingIntent.getBroadcast(c, 7000, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        c.getSystemService(AlarmManager.class).set(AlarmManager.RTC, cal.getTimeInMillis(), pi);
    }

    // ── what the widgets show ──────────────────────────────────────────────────────────────

    private static Calendar today() {
        Calendar cal = Calendar.getInstance();
        cal.set(Calendar.HOUR_OF_DAY, 0);
        cal.set(Calendar.MINUTE, 0);
        cal.set(Calendar.SECOND, 0);
        cal.set(Calendar.MILLISECOND, 0);
        return cal;
    }

    /** Monday 0 … Sunday 6. */
    private static int weekday(Calendar cal) {
        return (cal.get(Calendar.DAY_OF_WEEK) + 5) % 7;
    }

    private static String key(Calendar cal) {
        return String.format(java.util.Locale.ROOT, "%04d-%02d-%02d", cal.get(Calendar.YEAR), cal.get(Calendar.MONTH) + 1, cal.get(Calendar.DAY_OF_MONTH));
    }

    private static String mondayKey() {
        Calendar cal = today();
        cal.add(Calendar.DAY_OF_YEAR, -weekday(cal));
        return key(cal);
    }

    /** Days since «2026-10-29»; -1 — never. */
    private static int daysSince(String last) {
        if (last == null || last.length() != 10) return -1;
        Calendar then = Calendar.getInstance();
        then.clear();
        then.set(Integer.parseInt(last.substring(0, 4)), Integer.parseInt(last.substring(5, 7)) - 1, Integer.parseInt(last.substring(8, 10)));
        long diff = today().getTimeInMillis() - then.getTimeInMillis();
        return (int) Math.max(0, Math.round(diff / 86400000.0));
    }

    static String dayWord(int n) {
        int m10 = n % 10, m100 = n % 100;
        if (m10 == 1 && m100 != 11) return "день";
        if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return "дня";
        return "дней";
    }

    /** Always in days (decision of 01.11.2026): «сегодня», «1 день назад», «12 дней назад». */
    private static String ago(int n) {
        return n == 0 ? "сегодня" : n + " " + dayWord(n) + " назад";
    }

    private static int color(JSONObject colors, String name, String fallback) {
        try {
            return Color.parseColor(colors.optString(name, fallback));
        } catch (IllegalArgumentException e) {
            return Color.parseColor(fallback);
        }
    }

    private static final class View_ {
        boolean[] done = new boolean[7];
        int count;
        Integer goal;
        int today;
        int since;
        String nextId;
        String nextName;
        int bg, ink, muted, line, panel, panelInk, panelMuted, accent, onAccent;
    }

    private static View_ read(Context c) {
        JSONObject d = data(c);
        View_ v = new View_();
        boolean thisWeek = mondayKey().equals(d.optString("week"));
        JSONArray days = d.optJSONArray("doneDays");
        if (thisWeek && days != null) for (int i = 0; i < days.length(); i++) {
            int w = days.optInt(i, -1);
            if (w >= 0 && w < 7) v.done[w] = true;
        }
        v.count = thisWeek ? d.optInt("count") : 0;
        v.goal = d.isNull("goal") || !d.has("goal") ? null : d.optInt("goal");
        v.today = weekday(today());
        v.since = daysSince(d.optString("last", null));
        JSONObject next = d.optJSONObject("next");
        v.nextId = next == null ? null : next.optString("id");
        v.nextName = next == null ? null : next.optString("name");
        JSONObject col = d.optJSONObject("colors");
        if (col == null) col = new JSONObject();
        v.bg = color(col, "surface", "#FBF8F2");
        v.ink = color(col, "ink", "#17140F");
        v.muted = color(col, "muted", "#5F584D");
        v.line = color(col, "line", "#B8AD9A");
        v.panel = color(col, "panel", "#17140F");
        v.panelInk = color(col, "panelInk", "#F2EDE4");
        v.panelMuted = color(col, "panelMuted", "#CFC6B6");
        v.accent = color(col, "accent", "#FF5A1F");
        v.onAccent = color(col, "onAccent", "#17140F");
        return v;
    }

    // ── drawing ────────────────────────────────────────────────────────────────────────────

    /** Seven circles (done — accent, today — ringed, past — faded, ahead — outlined), letters under them if `letters`. */
    private static Bitmap days(Context c, View_ v, float widthDp, float circleDp, boolean letters) {
        float dp = c.getResources().getDisplayMetrics().density;
        int w = Math.max(1, Math.round(widthDp * dp));
        float r = circleDp * dp / 2f;
        float letterH = letters ? 15 * dp : 0;
        int h = Math.round(circleDp * dp + letterH + 2 * dp);
        Bitmap bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
        Canvas cv = new Canvas(bmp);
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        Paint text = new Paint(Paint.ANTI_ALIAS_FLAG);
        text.setTextAlign(Paint.Align.CENTER);
        text.setTextSize(11 * dp);
        text.setTypeface(Typeface.create("sans-serif", Typeface.BOLD));
        float col = w / 7f;
        for (int i = 0; i < 7; i++) {
            float cx = col * i + col / 2f;
            float cy = r + dp;
            if (v.done[i]) {
                p.setStyle(Paint.Style.FILL);
                p.setColor(v.accent);
                p.setAlpha(255);
                cv.drawCircle(cx, cy, r, p);
            } else if (i == v.today) {
                p.setStyle(Paint.Style.STROKE);
                p.setStrokeWidth(2.5f * dp);
                p.setColor(v.ink);
                cv.drawCircle(cx, cy, r - 1.25f * dp, p);
            } else if (i < v.today) {
                p.setStyle(Paint.Style.FILL);
                p.setColor(v.line);
                p.setAlpha(128);
                cv.drawCircle(cx, cy, r, p);
                p.setAlpha(255);
            } else {
                p.setStyle(Paint.Style.STROKE);
                p.setStrokeWidth(1.5f * dp);
                p.setColor(v.line);
                cv.drawCircle(cx, cy, r - 0.75f * dp, p);
            }
            if (letters) {
                text.setColor(i == v.today ? v.ink : v.muted);
                cv.drawText(LETTERS[i], cx, h - 3 * dp, text);
            }
        }
        return bmp;
    }

    private static PendingIntent open(Context c, int requestCode, String path) {
        return PendingIntent.getActivity(c, requestCode, Reminders.openPath(c, path), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static void tint(RemoteViews rv, int id, int color) {
        rv.setInt(id, "setColorFilter", color);
        rv.setInt(id, "setImageAlpha", Color.alpha(color));
    }

    private static String weekBig(View_ v) {
        return v.goal == null ? String.valueOf(v.count) : v.count + " из " + v.goal;
    }

    private static String weekLabel(View_ v) {
        return v.goal != null && v.count >= v.goal ? "Цель ✓" : "Неделя";
    }

    static void update(Context c, AppWidgetManager mgr, int id, Class<?> kind) {
        View_ v = read(c);
        Bundle opts = mgr.getAppWidgetOptions(id);
        int widthDp = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0);
        RemoteViews rv;
        if (kind == WidgetSince.class) {
            rv = new RemoteViews(c.getPackageName(), R.layout.widget_since);
            tint(rv, R.id.w_bg, v.bg);
            rv.setTextViewText(R.id.w_big, v.since < 0 ? "—" : v.since == 0 ? "Сегодня" : v.since + " " + dayWord(v.since));
            rv.setTextColor(R.id.w_big, v.ink);
            rv.setTextViewText(R.id.w_sub, v.since < 0 ? "тренировок пока не было" : "с прошлой тренировки");
            rv.setTextColor(R.id.w_sub, v.muted);
            rv.setOnClickPendingIntent(R.id.w_root, open(c, 7100 + id, "/"));
            rv.setContentDescription(R.id.w_root, v.since < 0 ? "Тренировок пока не было" : "С прошлой тренировки: " + ago(v.since));
        } else if (kind == WidgetSlim.class) {
            rv = new RemoteViews(c.getPackageName(), R.layout.widget_slim);
            tint(rv, R.id.w_bg, v.bg);
            weekTexts(rv, v);
            float daysW = (widthDp > 0 ? widthDp : 300) - 28 - 84 - 12;
            rv.setImageViewBitmap(R.id.w_days, days(c, v, daysW, 22, true));
            rv.setOnClickPendingIntent(R.id.w_root, open(c, 7200 + id, "/rhythm/"));
            rv.setContentDescription(R.id.w_root, "Неделя: " + weekBig(v));
        } else if (kind == WidgetSmall.class) {
            rv = new RemoteViews(c.getPackageName(), R.layout.widget_small);
            tint(rv, R.id.w_bg, v.bg);
            weekTexts(rv, v);
            float daysW = (widthDp > 0 ? widthDp : 150) - 28;
            rv.setImageViewBitmap(R.id.w_days, days(c, v, daysW, 16, false));
            agoRow(rv, v);
            rv.setOnClickPendingIntent(R.id.w_root, open(c, 7300 + id, "/rhythm/"));
            rv.setContentDescription(R.id.w_root, "Неделя: " + weekBig(v) + (v.since >= 0 ? ", прошлая тренировка " + ago(v.since) : ""));
        } else {
            rv = new RemoteViews(c.getPackageName(), R.layout.widget_wide);
            tint(rv, R.id.w_bg, v.bg);
            weekTexts(rv, v);
            agoRow(rv, v);
            float daysW = (widthDp > 0 ? widthDp : 300) - 32;
            rv.setImageViewBitmap(R.id.w_days, days(c, v, daysW, 28, true));
            rv.setOnClickPendingIntent(R.id.w_week, open(c, 7400 + id, "/rhythm/"));
            rv.setContentDescription(R.id.w_week, "Ритм: неделя " + weekBig(v));
            if (v.nextName == null) {
                rv.setViewVisibility(R.id.w_plan, View.GONE);
            } else {
                rv.setViewVisibility(R.id.w_plan, View.VISIBLE);
                tint(rv, R.id.w_panel, v.panel);
                tint(rv, R.id.w_play_bg, v.accent);
                tint(rv, R.id.w_play, v.onAccent);
                rv.setTextViewText(R.id.w_next_label, "Следующая");
                rv.setTextColor(R.id.w_next_label, v.panelMuted);
                rv.setTextViewText(R.id.w_next, v.nextName);
                rv.setTextColor(R.id.w_next, v.panelInk);
                rv.setOnClickPendingIntent(R.id.w_plan, open(c, 7500 + id, "/workout/?plan=" + v.nextId));
                rv.setContentDescription(R.id.w_plan, "Следующая: " + v.nextName + ". Открыть план");
            }
        }
        mgr.updateAppWidget(id, rv);
    }

    private static void weekTexts(RemoteViews rv, View_ v) {
        rv.setTextViewText(R.id.w_label, weekLabel(v).toUpperCase(java.util.Locale.ROOT));
        rv.setTextColor(R.id.w_label, v.muted);
        rv.setTextViewText(R.id.w_big, weekBig(v));
        rv.setTextColor(R.id.w_big, v.ink);
    }

    private static void agoRow(RemoteViews rv, View_ v) {
        if (v.since < 0) {
            rv.setViewVisibility(R.id.w_ago_row, View.GONE);
            return;
        }
        rv.setViewVisibility(R.id.w_ago_row, View.VISIBLE);
        rv.setTextViewText(R.id.w_ago, ago(v.since));
        rv.setTextColor(R.id.w_ago, v.muted);
        tint(rv, R.id.w_clock, v.muted);
    }
}
