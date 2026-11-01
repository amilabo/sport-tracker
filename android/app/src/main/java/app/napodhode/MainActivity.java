package app.napodhode;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Our own plugins must be registered before the bridge starts.
        registerPlugin(ScreenPlugin.class);
        registerPlugin(BackupFolderPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
