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
  plugins: {
    // Hidden by the app as soon as the first screen is drawn (src/platform/android.ts); 2.5 s is only the fallback.
    SplashScreen: { launchShowDuration: 2500, launchAutoHide: true, backgroundColor: "#F2EDE4", showSpinner: false },
    // Edge-to-edge: the page draws under transparent bars and pads itself. "css" also hands the bars' real size to the
    // page as --safe-area-inset-* (measured by Android): on the S22 env(safe-area-inset-top) alone came out short and the
    // status bar covered the top of the screen (1.1.1). globals.css takes the larger of the two.
    SystemBars: { insetsHandling: "css", initialViewportFitValueHint: "cover" },
  },
};

export default config;
