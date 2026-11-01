package app.napodhode;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** An exact alarm of the rest timeline (RestAlarm.schedule). Holds the process a moment while the beeps play. */
public class RestAlarmReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        PendingResult pending = goAsync();
        try {
            RestAlarm.fire(context, intent.getIntExtra("i", -1), intent.getLongExtra("gen", 0));
        } finally {
            // The beeps (< 1 s) play on the main thread after this; 1.5 s keeps the process up for them.
            new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(pending::finish, 1500);
        }
    }
}
