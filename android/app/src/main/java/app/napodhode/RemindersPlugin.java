package app.napodhode;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** The page's side of Reminders (stage A6): src/platform/android.ts → reminders. */
@CapacitorPlugin(name = "Reminders")
public class RemindersPlugin extends Plugin {

    @Override
    public void load() {
        Reminders.ensureChannel(getContext());
    }

    /** { items: [{ kind, at, title, text, path }] } — every reminder ahead; an empty list turns them all off. */
    @PluginMethod
    public void set(PluginCall call) {
        if (call.getArray("items") == null) {
            call.reject("items are required");
            return;
        }
        Reminders.set(getContext(), call.getArray("items"));
        call.resolve();
    }
}
