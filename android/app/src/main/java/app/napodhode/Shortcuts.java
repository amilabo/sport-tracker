package app.napodhode;

import android.content.Context;
import androidx.core.content.pm.ShortcutInfoCompat;
import androidx.core.content.pm.ShortcutManagerCompat;
import androidx.core.graphics.drawable.IconCompat;
import java.util.Arrays;
import org.json.JSONObject;

/**
 * The shortcuts on the app icon (stage A8, mockup Я1): the workout — the next plan by name (before «Начать»),
 * «Продолжить: …» while one is in progress, «Тренировки» without plans; and «Замер». Either can be pinned.
 */
final class Shortcuts {

    private Shortcuts() {}

    /** { label, path } of the workout shortcut, chosen by the page (src/lib/home-sync.ts). */
    static void update(Context c, JSONObject shortcut) {
        String label = shortcut.optString("label", "Тренировки");
        String path = shortcut.optString("path", "/");
        ShortcutInfoCompat workout = new ShortcutInfoCompat.Builder(c, "workout")
            .setShortLabel(label.length() > 25 ? label.substring(0, 24) + "…" : label)
            .setLongLabel(label)
            .setIcon(IconCompat.createWithResource(c, R.drawable.ic_shortcut_workout))
            .setIntent(Reminders.openPath(c, path))
            .setRank(0)
            .build();
        ShortcutInfoCompat measure = new ShortcutInfoCompat.Builder(c, "measure")
            .setShortLabel("Замер")
            .setLongLabel("Замер")
            .setIcon(IconCompat.createWithResource(c, R.drawable.ic_shortcut_measure))
            .setIntent(Reminders.openPath(c, "/body/?add"))
            .setRank(1)
            .build();
        ShortcutManagerCompat.setDynamicShortcuts(c, Arrays.asList(workout, measure));
    }
}
