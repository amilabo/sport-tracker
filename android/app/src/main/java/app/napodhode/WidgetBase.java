package app.napodhode;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;

/** The four widgets of A7 differ only in their layout (Widgets.update). */
public abstract class WidgetBase extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) Widgets.update(context, mgr, id, getClass());
        Widgets.scheduleMidnight(context);
    }

    /** Stretched: the days are redrawn to the new width. */
    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager mgr, int id, Bundle options) {
        Widgets.update(context, mgr, id, getClass());
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        if (Widgets.ACTION_MIDNIGHT.equals(intent.getAction())) Widgets.refreshAll(context);
        else super.onReceive(context, intent);
    }
}
