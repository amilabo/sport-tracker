package app.napodhode;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.UriPermission;
import android.net.Uri;
import android.provider.DocumentsContract;
import androidx.activity.result.ActivityResult;
import androidx.documentfile.provider.DocumentFile;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import org.json.JSONException;

/**
 * The folder for automatic copies (src/lib/auto-backup.ts, stage A3). Android lets an app write into a
 * folder of the user's choice only through the system folder picker (Storage Access Framework); the access
 * is kept permanently, so it survives restarts, app updates and reboots. Files written here stay in the
 * folder after the app is uninstalled — that is the point of the automatic copy.
 */
@CapacitorPlugin(name = "BackupFolder")
public class BackupFolderPlugin extends Plugin {

    private static final String PREFS = "backup_folder";
    private static final String KEY_TREE = "tree_uri";
    private static final int ACCESS = Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION;

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private Uri savedTree() {
        String s = prefs().getString(KEY_TREE, null);
        return s == null ? null : Uri.parse(s);
    }

    private boolean hasAccess(Uri tree) {
        for (UriPermission p : getContext().getContentResolver().getPersistedUriPermissions()) {
            if (p.getUri().equals(tree) && p.isReadPermission() && p.isWritePermission()) return true;
        }
        return false;
    }

    /** "primary:Documents/На подходе" → "Documents / На подходе". */
    private static String displayName(Uri tree) {
        String id = DocumentsContract.getTreeDocumentId(tree);
        int colon = id.indexOf(':');
        String path = colon >= 0 ? id.substring(colon + 1) : id;
        return path.isEmpty() ? "Память телефона" : path.replace("/", " / ");
    }

    /** { name, ok }: ok = the folder still exists and the app may write into it. */
    private JSObject describe(Uri tree) {
        JSObject folder = new JSObject();
        folder.put("name", displayName(tree));
        DocumentFile dir = hasAccess(tree) ? DocumentFile.fromTreeUri(getContext(), tree) : null;
        folder.put("ok", dir != null && dir.exists() && dir.isDirectory() && dir.canWrite());
        return folder;
    }

    /** The chosen folder if it is usable; otherwise rejects the call and returns null. */
    private DocumentFile writableDir(PluginCall call) {
        Uri tree = savedTree();
        DocumentFile dir = tree != null && hasAccess(tree) ? DocumentFile.fromTreeUri(getContext(), tree) : null;
        if (dir == null || !dir.exists() || !dir.canWrite()) {
            call.reject("No access to the backup folder", "NO_FOLDER");
            return null;
        }
        return dir;
    }

    /** { folder: { name, ok } } — or {} if no folder was chosen yet. */
    @PluginMethod
    public void folder(PluginCall call) {
        JSObject result = new JSObject();
        Uri tree = savedTree();
        if (tree != null) result.put("folder", describe(tree));
        call.resolve(result);
    }

    /** The system folder picker, opened in «Documents». { folder } — or {} if the user backed out. */
    @PluginMethod
    public void chooseFolder(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(ACCESS | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        intent.putExtra(
            DocumentsContract.EXTRA_INITIAL_URI,
            DocumentsContract.buildDocumentUri("com.android.externalstorage.documents", "primary:Documents")
        );
        startActivityForResult(call, intent, "folderPicked");
    }

    @ActivityCallback
    private void folderPicked(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Intent data = result.getData();
        if (result.getResultCode() != Activity.RESULT_OK || data == null || data.getData() == null) {
            call.resolve(new JSObject());
            return;
        }
        Uri tree = data.getData();
        ContentResolver resolver = getContext().getContentResolver();
        try {
            resolver.takePersistableUriPermission(tree, ACCESS);
        } catch (SecurityException e) {
            call.reject("The folder cannot be kept", "NO_FOLDER", e);
            return;
        }
        Uri old = savedTree();
        if (old != null && !old.equals(tree)) {
            try {
                resolver.releasePersistableUriPermission(old, ACCESS);
            } catch (SecurityException ignored) {
                // already gone
            }
        }
        prefs().edit().putString(KEY_TREE, tree.toString()).apply();
        JSObject out = new JSObject();
        out.put("folder", describe(tree));
        call.resolve(out);
    }

    /** { name, data }: writes the file in the folder, replacing a file of the same name. */
    @PluginMethod
    public void write(PluginCall call) {
        String name = call.getString("name");
        String data = call.getString("data");
        if (name == null || data == null) {
            call.reject("name and data are required");
            return;
        }
        DocumentFile dir = writableDir(call);
        if (dir == null) return;
        try {
            DocumentFile file = dir.findFile(name);
            if (file == null) file = dir.createFile("application/json", name);
            if (file == null) throw new IllegalStateException("createFile failed");
            // "wt": truncate — a shorter copy must not keep the tail of the longer one written earlier today.
            try (OutputStream out = getContext().getContentResolver().openOutputStream(file.getUri(), "wt")) {
                if (out == null) throw new IllegalStateException("no output stream");
                out.write(data.getBytes(StandardCharsets.UTF_8));
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Writing the copy failed", "WRITE_FAILED", e);
        }
    }

    /** { files: [{ name, modified }] } — every file in the folder; modified in ms. */
    @PluginMethod
    public void list(PluginCall call) {
        DocumentFile dir = writableDir(call);
        if (dir == null) return;
        JSArray files = new JSArray();
        for (DocumentFile f : dir.listFiles()) {
            if (!f.isFile() || f.getName() == null) continue;
            JSObject item = new JSObject();
            item.put("name", f.getName());
            item.put("modified", f.lastModified());
            files.put(item);
        }
        JSObject result = new JSObject();
        result.put("files", files);
        call.resolve(result);
    }

    /** { names }: deletes these files from the folder (missing ones are skipped). */
    @PluginMethod
    public void remove(PluginCall call) {
        DocumentFile dir = writableDir(call);
        if (dir == null) return;
        JSArray names = call.getArray("names", new JSArray());
        try {
            for (int i = 0; i < names.length(); i++) {
                DocumentFile f = dir.findFile(names.getString(i));
                if (f != null) f.delete();
            }
            call.resolve();
        } catch (JSONException e) {
            call.reject("names must be strings", e);
        }
    }
}
