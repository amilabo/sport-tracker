package app.napodhode;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * A reboot, a change of the clock or the time zone, an app update: alarms do not survive these, so the reminders (A6)
 * are set again from the kept list and the widgets (A7) are redrawn for the new day.
 */
public class SystemEventsReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        Reminders.arm(context);
        Widgets.refreshAll(context);
    }
}
