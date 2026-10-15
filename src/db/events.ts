import type { StoreName } from "@/domain/types";

type Listener = (changed: ReadonlySet<StoreName>) => void;

const listeners = new Set<Listener>();
const CHANNEL_NAME = "sport-tracker-db";
let channel: BroadcastChannel | null | undefined;

function getChannel() {
  if (channel === undefined) {
    channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(CHANNEL_NAME);
    // Another tab of the app changed data: refresh our queries too.
    channel?.addEventListener("message", (e: MessageEvent<StoreName[]>) => notify(new Set(e.data)));
    // Node (tests) keeps the process alive while a channel is open.
    (channel as (BroadcastChannel & { unref?: () => void }) | null)?.unref?.();
  }
  return channel;
}

function notify(changed: ReadonlySet<StoreName>) {
  listeners.forEach((l) => l(changed));
}

/** Called by repositories after a write transaction commits. */
export function emitChange(stores: StoreName[]) {
  notify(new Set(stores));
  getChannel()?.postMessage(stores);
}

export function onChange(listener: Listener): () => void {
  getChannel();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
