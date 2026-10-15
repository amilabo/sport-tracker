import { touch } from "@/domain/entity";
import { SETTINGS_ID, type BaseEntity, type Settings } from "@/domain/types";
import { getDb, withTx } from "../client";

export const settingsRepo = {
  async get(): Promise<Settings> {
    const settings = await (await getDb()).get("settings", SETTINGS_ID);
    // getDb() seeds settings on first open, so a missing record means the database is broken.
    if (!settings) throw new Error("Settings record is missing");
    return settings;
  },

  async update(patch: Partial<Omit<Settings, keyof BaseEntity | "schema_version">>): Promise<Settings> {
    return withTx(["settings"], "readwrite", async (tx) => {
      const current = await tx.objectStore("settings").get(SETTINGS_ID);
      if (!current) throw new Error("Settings record is missing");
      const updated = touch(current, patch);
      await tx.objectStore("settings").put(updated);
      return updated;
    });
  },
};
