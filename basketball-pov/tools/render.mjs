// Render the timeline to H.264 MP4 using N parallel headless browsers.
// usage: node tools/render.mjs --out out/file.mp4 [--q half] [--workers 3] [--from 0] [--to N] [--size 1920x1080] [--step 1]
import { startServer, openPage, ROOT } from './harness.mjs';
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? a.push([v.slice(2), arr[i + 1]]) : 0, a), []));
const out = path.resolve(args.out || 'out/preview.mp4');
const q = args.q || '';
const workers = +(args.workers || 3);
const size = (args.size || '1920x1080').split('x').map(Number);
const step = +(args.step || 1);
const FF = execFileSync('python3', ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())']).toString().trim();
const tmpDir = path.join(ROOT, 'frames'); fs.mkdirSync(tmpDir, { recursive: true });

const server = await startServer();
// find frame count
const probe = await openPage(server, 'src/index.html', q);
const total = await probe.page.evaluate(() => window.__frames);
await probe.browser.close();
const from = +(args.from || 0), to = Math.min(+(args.to || total), total);
const idx = []; for (let i = from; i < to; i += step) idx.push(i);
console.log('frames', total, 'rendering', idx.length, 'workers', workers);
const chunk = Math.ceil(idx.length / workers);
const t0 = Date.now();
let done = 0;
const parts = [];
await Promise.all(Array.from({ length: workers }, async (_, w) => {
  const mine = idx.slice(w * chunk, (w + 1) * chunk);
  if (!mine.length) return;
  const part = path.join(tmpDir, `part_${w}.mp4`); parts[w] = part;
  const ff = spawn(FF, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(30 / step), '-c:v', 'mjpeg', '-i', '-',
    '-vf', `scale=${size[0]}:${size[1]}:flags=lanczos`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', part], { stdio: ['pipe', 'inherit', 'inherit'] });
  const { browser, page } = await openPage(server, 'src/index.html', q);
  for (const i of mine) {
    await page.evaluate(i => window.renderFrame(i), i);
    const buf = await page.screenshot({ type: 'jpeg', quality: 94 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    done++;
    if (done % 20 === 0) { const el = (Date.now() - t0) / 1000; console.log(`${done}/${idx.length}  ${(el / done * (idx.length - done)).toFixed(0)}s left`); }
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  await browser.close();
}));
server.close();
const list = path.join(tmpDir, 'list.txt');
fs.writeFileSync(list, parts.filter(Boolean).map(p => `file '${p}'`).join('\n'));
fs.mkdirSync(path.dirname(out), { recursive: true });
execFileSync(FF, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', out]);
console.log('wrote', out, ((Date.now() - t0) / 1000).toFixed(0) + 's');
