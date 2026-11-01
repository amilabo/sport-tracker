// The site build swaps src/platform/android.ts for this module (resolveAlias in next.config.ts),
// so no Capacitor code is bundled at all. Never called: getPlatform() takes the android branch only in the APK.
export { web as android } from "./web";
