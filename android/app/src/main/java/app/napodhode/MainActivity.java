package app.napodhode;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Our own plugins must be registered before the bridge starts.
        registerPlugin(ScreenPlugin.class);
        registerPlugin(BackupFolderPlugin.class);
        registerPlugin(RestAlarmPlugin.class);
        registerPlugin(RemindersPlugin.class);
        registerPlugin(HomePlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onResume() {
        super.onResume();
        // A5: the page gives the rest signal itself; the lock screen countdown goes away.
        RestAlarm.setForeground(this, true);
    }

    @Override
    public void onPause() {
        // A5: the power button or another app — the rest goes on as a notification with its signals.
        RestAlarm.setForeground(this, false);
        super.onPause();
    }
}
