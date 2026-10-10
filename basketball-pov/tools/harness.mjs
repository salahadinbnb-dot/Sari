// Shared helpers: tiny static server + headless Chromium with software WebGL.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); }
catch { playwright = require('/opt/node22/lib/node_modules/playwright'); }

export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.fbx': 'application/octet-stream', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.css': 'text/css', '.bin': 'application/octet-stream',
};

export function startServer(port = 0) {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    const file = path.join(ROOT, url);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); res.end('not found'); return;
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(r => server.listen(port, '127.0.0.1', () => r(server)));
}

export async function openPage(server, page = 'src/index.html', query = '', { width = 1920, height = 1080 } = {}) {
  const browser = await playwright.chromium.launch({
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
      '--enable-webgl', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'],
  });
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  p.on('console', m => { if (process.env.QUIET !== '1') console.log('[page]', m.text()); });
  p.on('pageerror', e => console.log('[pageerror]', e.message));
  const port = server.address().port;
  await p.goto(`http://127.0.0.1:${port}/${page}${query ? '?' + query : ''}`);
  await p.waitForFunction(() => window.__ready === true || window.__error, null, { timeout: 600000 });
  const err = await p.evaluate(() => window.__error);
  if (err) throw new Error('page error: ' + err);
  return { browser, page: p };
}
