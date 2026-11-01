// Builds the web part for the APK and copies it into the native project (android/).
//   node scripts/build-android.mjs          — out/ for the APK + `cap sync android`
//   node scripts/build-android.mjs --apk    — the same, then a debug APK into ../apk/builds/
// The same pages as the site, served from https://localhost inside the APK: no basePath, no service worker.
// Note: out/ then holds the APK build; `npm run build` makes the site again.
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Real path: when run through the C:\dev\sport-tracker junction, ".." must still be the project folder.
const root = realpathSync.native(join(dirname(fileURLToPath(import.meta.url)), ".."));
const outDir = join(root, "out");
const env = { ...process.env, PAGES_BASE_PATH: "", NEXT_PUBLIC_TARGET: "android" };

function run(cmd, args, cwd = root) {
  console.log(`\n> ${cmd} ${args.join(" ")}`);
  // Windows runs npm, npx and .bat through the shell: one quoted command line (all arguments are our own constants).
  const r =
    process.platform === "win32"
      ? spawnSync([cmd, ...args].map((a) => (/\s/.test(a) ? `"${a}"` : a)).join(" "), { cwd, env, stdio: "inherit", shell: true })
      : spawnSync(cmd, args, { cwd, env, stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, files);
    else files.push(p);
  }
  return files;
}

run("npm", ["run", "check"]);
run("npx", ["next", "build"]);

// The build really is the APK one: no service worker, the android layer inside.
if (existsSync(join(outDir, "sw.js"))) throw new Error("build-android: out/sw.js must not be in the APK");
const js = walk(outDir).filter((f) => f.endsWith(".js"));
if (!js.some((f) => readFileSync(f, "utf8").includes("backButton"))) {
  throw new Error("build-android: the android layer (src/platform/android.ts) is missing from the build");
}

run("npx", ["cap", "sync", "android"]);

if (process.argv.includes("--apk")) {
  // Gradle breaks on Cyrillic and spaces in the path: build through the ASCII junction (apk/README.md).
  const ascii = "C:\\dev\\sport-tracker";
  const gradleRoot = /^[\x21-\x7e]+$/.test(root) ? root : existsSync(ascii) && realpathSync.native(ascii) === root ? ascii : null;
  if (!gradleRoot) throw new Error(`build-android: the path has non-ASCII characters; create the junction ${ascii} → ${root}`);
  env.GRADLE_USER_HOME ??= "C:\\Android\\gradle";
  const androidDir = join(gradleRoot, "android");
  run(join(androidDir, process.platform === "win32" ? "gradlew.bat" : "gradlew"), ["assembleDebug"], androidDir);

  const { version } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const builds = join(root, "..", "apk", "builds");
  mkdirSync(builds, { recursive: true });
  const name = `na-podhode-v${version}-debug.apk`;
  copyFileSync(join(root, "android", "app", "build", "outputs", "apk", "debug", "app-debug.apk"), join(builds, name));
  console.log(`\nAPK: apk/builds/${name}`);
}
