// PWA helpers: base path, install state and the Android install prompt.

/** "/sport-tracker" on GitHub Pages, "" locally (see next.config.ts). */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Opened from the home screen icon, not in a browser tab. */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export type Platform = "ios" | "android" | "other";

export function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac; touch points tell it apart.
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "other";
}

/** Chrome's beforeinstallprompt event (not in the TS DOM types). */
export interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// The event fires once, early, possibly before the hint is on screen: keep it in a tiny external store.
let installEvent: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
let listening = false;

function listen() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    installEvent = e as InstallPromptEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener("appinstalled", () => {
    installEvent = null;
    listeners.forEach((l) => l());
  });
}

export const installPrompt = {
  subscribe(listener: () => void) {
    listen();
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  get: () => installEvent,
  /** Shows the system install dialog; true if the user installed the app. */
  async show(): Promise<boolean> {
    const e = installEvent;
    if (!e) return false;
    installEvent = null;
    listeners.forEach((l) => l());
    await e.prompt();
    return (await e.userChoice).outcome === "accepted";
  },
};

/** Starts listening as early as possible (called from the app shell). */
export function initInstallPrompt() {
  listen();
}

/**
 * Runs in <head>: if a script of the app fails to load (e.g. a page from an old version after an update),
 * reload once; if that did not help within a minute and there is a network — drop the service worker and its
 * caches and reload from the network. Data in IndexedDB is not touched. Without this the screen stays white.
 */
export const loadRecoveryScript = `(function(){
var K="st-recover",busy=false;
function recover(){
if(busy)return;busy=true;
var n=0;try{var s=JSON.parse(sessionStorage.getItem(K)||"null");if(s&&Date.now()-s.t<60000)n=s.n;sessionStorage.setItem(K,JSON.stringify({t:Date.now(),n:n+1}))}catch(e){}
if(n===0){location.reload();return}
if(n===1&&navigator.onLine&&navigator.serviceWorker){
navigator.serviceWorker.getRegistrations().then(function(rs){return Promise.all(rs.map(function(r){return r.unregister()}))})
.then(function(){return caches.keys()}).then(function(ks){return Promise.all(ks.filter(function(k){return k.indexOf("st-")===0}).map(function(k){return caches.delete(k)}))})
.then(function(){location.reload()},function(){location.reload()});
}
}
window.addEventListener("error",function(e){var t=e.target;if(t&&(t.tagName==="SCRIPT"||t.tagName==="LINK")&&/\\/_next\\//.test(t.src||t.href||""))recover()},true);
window.addEventListener("unhandledrejection",function(e){var r=e.reason;if(r&&(r.name==="ChunkLoadError"||/chunk|dynamically imported module/i.test(r.message||"")))recover()});
})();`;
