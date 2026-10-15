// Renders scripts/icons/icon.svg to the PNG icons in public/icons/ with headless Chrome (no extra dependencies).
// Run once after changing the SVG: node scripts/icons/render.mjs [path-to-chrome]
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "..", "public", "icons");
const chromePath = process.argv[2] ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const svg = readFileSync(join(here, "icon.svg"), "utf8");
const sizes = { "icon-192.png": 192, "icon-512.png": 512, "apple-touch-icon.png": 180, "favicon-32.png": 32 };

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

for (const [name, size] of Object.entries(sizes)) {
  await send("Emulation.setDeviceMetricsOverride", { width: size, height: size, deviceScaleFactor: 1, mobile: false });
  const html = `<html><body style="margin:0">${svg.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body></html>`;
  await send("Page.navigate", { url: "data:text/html;base64," + Buffer.from(html).toString("base64") });
  await sleep(400);
  const { data } = await send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: size, height: size, scale: 1 } });
  writeFileSync(join(out, name), Buffer.from(data, "base64"));
  console.log("→", name);
}
ws.close();
chrome.kill();
