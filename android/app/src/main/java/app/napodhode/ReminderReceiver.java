package app.napodhode;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** A reminder's alarm (Reminders.set). */
public class ReminderReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        Reminders.fire(context, intent.getIntExtra("i", -1));
    }
}
