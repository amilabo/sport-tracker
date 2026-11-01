import type { CapacitorConfig } from "@capacitor/cli";

// INVARIANT — never change appId, androidScheme or hostname after the first
// install. The WebView origin (https://localhost) owns IndexedDB: a different
// value means a "new" app with an empty database, and an APK with another
// appId cannot be installed over the old one. appName may change freely.
// See ../apk/docs/android-apk-plan.md, decision 1.
const config: CapacitorConfig = {
  appId: "app.napodhode",
  appName: "На подходе",
  webDir: "out",
  server: {
    androidScheme: "https",
    hostname: "localhost",
  },
  android: {
    // Android WebView must not reach the network: the app is fully offline.
    allowMixedContent: false,
  },
};

export default config;
