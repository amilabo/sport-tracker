import { deleteDB, openDB, type IDBPTransaction, type StoreNames } from "idb";
import { emitChange } from "./events";
import { DB_NAME, DB_VERSION, upgradeSchema, type TrackerDatabase, type TrackerDB } from "./schema";
import { seedIfNeeded } from "./seed";

let dbPromise: Promise<TrackerDatabase> | null = null;

async function open(): Promise<TrackerDatabase> {
  const db = await openDB<TrackerDB>(DB_NAME, DB_VERSION, {
    upgrade(database, oldVersion) {
      upgradeSchema(database, oldVersion);
    },
    blocking() {
      // A newer version of the app opened the database in another tab: let it upgrade.
      db.close();
      dbPromise = null;
    },
  });
  await seedIfNeeded(db);
  return db;
}

/** The database, opened and seeded on first use. */
export function getDb(): Promise<TrackerDatabase> {
  if (!dbPromise) {
    dbPromise = open().catch((err) => {
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}

/**
 * Runs fn in one transaction. Inside fn await only IndexedDB requests,
 * otherwise the transaction auto-commits early. Write transactions notify subscribers after commit.
 */
export async function withTx<S extends StoreNames<TrackerDB>[], M extends "readonly" | "readwrite", R>(
  stores: S,
  mode: M,
  fn: (tx: IDBPTransaction<TrackerDB, S, M>) => Promise<R>,
): Promise<R> {
  const db = await getDb();
  const tx = db.transaction(stores, mode);
  let result: R;
  try {
    result = await fn(tx);
  } catch (err) {
    // All or nothing: writes made before the error must not commit.
    tx.done.catch(() => {});
    try {
      tx.abort();
    } catch {
      // already finished
    }
    throw err;
  }
  await tx.done;
  if (mode === "readwrite") emitChange(stores);
  return result;
}

/** Asks the browser not to evict our data under storage pressure (important on iOS). */
export async function requestPersistentStorage(): Promise<boolean | null> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) return null;
  try {
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}

/** Closes the connection; the next getDb() opens it again (data stays). */
export async function closeDb() {
  const pending = dbPromise;
  dbPromise = null;
  if (pending) {
    try {
      (await pending).close();
    } catch {
      // failed to open — nothing to close
    }
  }
}

/** Tests only: closes and deletes the database. */
export async function resetDbForTests() {
  await closeDb();
  await deleteDB(DB_NAME);
}
