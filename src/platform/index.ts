import type { Platform } from "./types";
import { web } from "./web";

export type { Platform } from "./types";

/**
 * Build target, inlined at build time: "android" only in the APK build (scripts/build-android.mjs).
 * In the site build "@/platform/android" is an empty stand-in (next.config.ts), so no @capacitor code reaches it
 * (checked by build-pwa.mjs).
 */
export const IS_ANDROID = process.env.NEXT_PUBLIC_TARGET === "android";

let loading: Promise<Platform> | null = null;

export function getPlatform(): Promise<Platform> {
  loading ??=
    process.env.NEXT_PUBLIC_TARGET === "android" ? import("@/platform/android").then((m) => m.android) : Promise.resolve(web);
  return loading;
}
