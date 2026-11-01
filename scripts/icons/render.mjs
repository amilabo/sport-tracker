// Renders scripts/icons/icon.svg to the PNG icons in public/icons/ with headless Chrome (no extra dependencies).
// Run once after changing the SVG: node scripts/icons/render.mjs [--android] [path-to-chrome]
// --android: the launcher icons for Android 7.x instead (android/app/src/main/res/mipmap-*); newer versions use
// the adaptive icon drawable/ic_launcher_foreground.xml — redraw that one by hand from the SVG too.
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const android = args.includes("--android");
const chromePath = args.find((a) => !a.startsWith("--")) ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const svg = readFileSync(join(here, "icon.svg"), "utf8");
const res = join(here, "..", "..", "android", "app", "src", "main", "res");
const densities = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
// file → [size, round]
const icons = android
  ? Object.fromEntries(
      Object.entries(densities).flatMap(([d, size]) => [
        [join(res, `mipmap-${d}`, "ic_launcher.png"), [size, false]],
        [join(res, `mipmap-${d}`, "ic_launcher_round.png"), [size, true]],
      ]),
    )
  : Object.fromEntries(
      Object.entries({ "icon-192.png": 192, "icon-512.png": 512, "apple-touch-icon.png": 180, "favicon-32.png": 32 }).map(
        ([name, size]) => [join(here, "..", "..", "public", "icons", name), [size, false]],
      ),
    );

const port = 9400 + Math.floor(Math.random() * 400);
const chrome = spawn(chromePath, ["--headless=new", "--disable-gpu", "--hide-scrollbars", `--remote-debugging-port=${port}`,
  `--user-data-dir=${mkdtempSync(join(tmpdir(), "icons-"))}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let target;
for (let i = 0; i < 50 && !target; i++) {
  try { target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json(); } catch { await sleep(200); }
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let seq = 0;
const pending = new Map();
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); pending.get(m.id)?.(m.result); pending.delete(m.id); });
const send = (method, params = {}) => new Promise((r) => { const id = ++seq; pending.set(id, r); ws.send(JSON.stringify({ id, method, params })); });

for (const [file, [size, round]] of Object.entries(icons)) {
  await send("Emulation.setDeviceMetricsOverride", { width: size, height: size, deviceScaleFactor: 1, mobile: false });
  // Transparent page: the round icon is a circle, its corners stay empty.
  await send("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } });
  const clip = round ? ` style="display:block;border-radius:50%"` : ` style="display:block"`;
  const html = `<html><body style="margin:0;background:transparent">${svg.replace("<svg ", `<svg width="${size}" height="${size}"${clip} `)}</body></html>`;
  await send("Page.navigate", { url: "data:text/html;base64," + Buffer.from(html).toString("base64") });
  await sleep(400);
  const { data } = await send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: size, height: size, scale: 1 } });
  writeFileSync(file, Buffer.from(data, "base64"));
  console.log("→", file);
}
ws.close();
chrome.kill();
