import type { Platform } from "./types";

/** The site: everything stays as the browser does it (service worker, Wake Lock and install hint live in their components). */
export const web: Platform = {
  kind: "web",
  start: () => () => {},
  setSystemBars() {},
  keepScreenOn: async () => false,
};
