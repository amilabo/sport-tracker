import { readFileSync } from "node:fs";
import type { NextConfig } from "next";

// On GitHub Pages the app lives under /<repo>. Locally it is served from the root.
const basePath = process.env.PAGES_BASE_PATH ?? "";
// The APK build (scripts/build-android.mjs); the site build never bundles the Capacitor layer.
const android = process.env.NEXT_PUBLIC_TARGET === "android";
// The APK version (A4): the same number as versionName in android/app/build.gradle.
const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath: basePath || undefined,
  assetPrefix: basePath || undefined,
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_PUBLIC_APP_VERSION: version,
  },
  turbopack: {
    resolveAlias: android ? {} : { "@/platform/android": "./src/platform/android-off.ts" },
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
