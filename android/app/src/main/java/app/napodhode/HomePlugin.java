package app.napodhode;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** The page's side of the widgets (A7) and the icon shortcuts (A8): src/platform/android.ts → home. */
@CapacitorPlugin(name = "Home")
public class HomePlugin extends Plugin {

    /** { widgets: { week, doneDays, count, goal, last, next, colors }, shortcut: { label, path } }. */
    @PluginMethod
    public void update(PluginCall call) {
        JSObject widgets = call.getObject("widgets");
        JSObject shortcut = call.getObject("shortcut");
        if (widgets != null) Widgets.save(getContext(), widgets);
        if (shortcut != null) Shortcuts.update(getContext(), shortcut);
        call.resolve();
    }
}
