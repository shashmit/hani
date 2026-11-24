// Regenerate the app icons: start Chrome with --headless --remote-debugging-port=9333,
// then run `node scripts/icon/render.mjs assets` (the preview-*.png files are just for checking).
// Render SVGs to PNG through the headless Chrome already running on :9333.
import { writeFileSync } from 'node:fs';
import { doc } from './art.mjs';
const outDir = process.argv[2];
const jobs = [
  ['icon.png', { size: 1024, scale: 0.8, bg: 'forest', dy: 0.01 }],
  ['android-icon-foreground.png', { size: 1024, scale: 0.56, bg: null, dy: 0.01 }],
  ['android-icon-background.png', { size: 1024, scale: 0, bg: 'forest' }],
  ['android-icon-monochrome.png', { size: 1024, scale: 0.56, bg: null, mono: true, dy: 0.01 }],
  ['splash-icon.png', { size: 1024, scale: 0.7, bg: null }],
  ['favicon.png', { size: 48, scale: 0.84, bg: 'forest' }],
  ['preview-mono.png', { size: 400, scale: 0.56, bg: 'forest', mono: true, dy: 0.01 }],
  ['preview-oat.png', { size: 512, scale: 0.8, bg: 'oat' }],
];
const ver = await (await fetch('http://localhost:9333/json/version')).json();
const ws = new WebSocket(ver.webSocketDebuggerUrl);
let id = 0; const pending = new Map();
const send = (method, params = {}, sessionId) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); } };
await new Promise((r) => (ws.onopen = r));
const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
const s = (m, p) => send(m, p, sessionId);
await s('Page.enable');
await s('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
for (const [name, opts] of jobs) {
  const svg = opts.scale === 0 ? doc({ ...opts, scale: 0.0001 }) : doc(opts);
  const html = `<html><body style="margin:0;background:transparent">${svg}</body></html>`;
  await s('Emulation.setDeviceMetricsOverride', { width: opts.size, height: opts.size, deviceScaleFactor: 1, mobile: false });
  await s('Page.navigate', { url: 'data:text/html;base64,' + Buffer.from(html).toString('base64') });
  await new Promise((r) => setTimeout(r, 400));
  const { data } = await s('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: opts.size, height: opts.size, scale: 1 } });
  writeFileSync(`${outDir}/${name}`, Buffer.from(data, 'base64'));
  console.log('wrote', name);
}
await send('Target.closeTarget', { targetId });
process.exit(0);
