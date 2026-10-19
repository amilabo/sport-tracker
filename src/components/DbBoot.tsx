"use client";

import { useEffect, useState } from "react";
import { getDb, requestPersistentStorage } from "@/db/client";
import { workoutsRepo } from "@/db/repos/workouts";

/** Opens (and on first launch seeds) the database at startup; shows a clear message if storage is unavailable. */
export function DbBoot() {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    getDb()
      .then(() => Promise.all([requestPersistentStorage(), workoutsRepo.autoFinishStale()]))
      .catch((err) => {
        console.error(err);
        setFailed(true);
      });
    // A workout left open overnight is finished when the app comes back the next day (PRD §3.13).
    const onVisible = () => {
      if (document.visibilityState === "visible") workoutsRepo.autoFinishStale().catch(console.error);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  if (!failed) return null;
  return (
    <div role="alert" className="mx-4 mt-4 rounded-2xl border-2 border-danger bg-surface p-4">
      <p className="font-semibold">Не получилось открыть хранилище на телефоне</p>
      <p className="mt-1 text-sm text-ink-muted">
        Без него записи не сохранятся. Проверьте, что браузер не в приватном режиме, и перезапустите приложение.
      </p>
    </div>
  );
}
