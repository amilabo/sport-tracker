import { useLive } from "@/db/hooks";
import { backupRepo } from "@/db/repos/backup";
import { settingsRepo } from "@/db/repos/settings";
import { nowIso, toLocalDate } from "@/domain/time";
import { STORE_NAMES } from "@/domain/types";

export type DeliveryResult = "shared" | "downloaded" | "cancelled";

/** sport-tracker-backup-ГГГГ-ММ-ДД.json (PRD §3.11). */
export function backupFileName(date: Date = new Date()): string {
  return `sport-tracker-backup-${toLocalDate(date)}.json`;
}

/**
 * The backup file, kept ready while the screen is open. Safari allows «Поделиться» only right inside a tap,
 * so the file must exist before the tap — reading the database after it would be too late.
 */
export function usePreparedBackup(enabled = true): File | null {
  const { data } = useLive(
    async () => {
      if (!enabled) return null;
      const backup = await backupRepo.exportAll();
      return new File([JSON.stringify(backup)], backupFileName(), { type: "application/json" });
    },
    [enabled],
    STORE_NAMES,
  );
  return data ?? null;
}

/** Sends the file through the system share sheet; where that is not available (or fails), downloads it. */
export async function deliverBackup(file: File): Promise<DeliveryResult> {
  if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      await markExported();
      return "shared";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
      // Not allowed or failed: fall back to a download below.
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  await markExported();
  return "downloaded";
}

function markExported() {
  return settingsRepo.update({ last_export_at: nowIso() });
}
