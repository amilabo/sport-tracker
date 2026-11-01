// Builds the web part for the APK and copies it into the native project (android/).
//   node scripts/build-android.mjs          — out/ for the APK + `cap sync android`
//   node scripts/build-android.mjs --apk    — the same, then a debug APK into ../apk/builds/
//   node scripts/build-android.mjs --release — the same, then the signed na-podhode-vX.Y.Z.apk + .sha256 (npm run apk)
// The same pages as the site, served from https://localhost inside the APK: no basePath, no service worker.
// Note: out/ then holds the APK build; `npm run build` makes the site again.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
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

const release = process.argv.includes("--release");
const { version } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`build-android: version "${version}" must be X.Y.Z (versionCode is made from it)`);
// The release key never lives in the repository (apk/docs/android-install.md).
const keystoreProps = process.env.NAPODHODE_KEYSTORE_PROPERTIES ?? "C:\\Android\\keys\\keystore.properties";
if (release && !existsSync(keystoreProps)) {
  throw new Error(`build-android: no signing key settings at ${keystoreProps} (set NAPODHODE_KEYSTORE_PROPERTIES)`);
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

if (process.argv.includes("--apk") || release) {
  // Gradle breaks on Cyrillic and spaces in the path: build through the ASCII junction (apk/README.md).
  const ascii = "C:\\dev\\sport-tracker";
  const gradleRoot = /^[\x21-\x7e]+$/.test(root) ? root : existsSync(ascii) && realpathSync.native(ascii) === root ? ascii : null;
  if (!gradleRoot) throw new Error(`build-android: the path has non-ASCII characters; create the junction ${ascii} → ${root}`);
  env.GRADLE_USER_HOME ??= "C:\\Android\\gradle";
  const androidDir = join(gradleRoot, "android");
  run(join(androidDir, process.platform === "win32" ? "gradlew.bat" : "gradlew"), [release ? "assembleRelease" : "assembleDebug"], androidDir);

  const builds = join(root, "..", "apk", "builds");
  mkdirSync(builds, { recursive: true });
  const outputs = join(root, "android", "app", "build", "outputs", "apk");
  const built = release ? join(outputs, "release", "app-release.apk") : join(outputs, "debug", "app-debug.apk");
  if (!existsSync(built)) throw new Error(`build-android: ${built} was not made (is the key in keystore.properties right?)`);
  if (release) verifySignature(built);
  const name = release ? `na-podhode-v${version}.apk` : `na-podhode-v${version}-debug.apk`;
  copyFileSync(built, join(builds, name));
  if (release) {
    const sha = createHash("sha256").update(readFileSync(built)).digest("hex");
    writeFileSync(join(builds, `${name}.sha256`), `${sha}  ${name}\n`);
  }
  console.log(`\nAPK: apk/builds/${name}`);
}

// apksigner from the newest build-tools: the release APK must carry our key, not be unsigned.
function verifySignature(apk) {
  const sdk = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT ?? "C:\\Android\\Sdk";
  const tools = join(sdk, "build-tools");
  const newest = existsSync(tools) ? readdirSync(tools).sort((a, b) => a.localeCompare(b, "en", { numeric: true })).pop() : null;
  if (!newest) throw new Error(`build-android: no build-tools in ${sdk}, cannot check the signature`);
  run(join(tools, newest, process.platform === "win32" ? "apksigner.bat" : "apksigner"), ["verify", "--print-certs", apk]);
}
