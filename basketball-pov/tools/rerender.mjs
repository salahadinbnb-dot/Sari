// Re-render a frame range to lossless PNGs (for splicing fixes into a finished video).
// usage: node tools/rerender.mjs <from> <to-inclusive> <outDir>
import fs from 'node:fs';
import { startServer, openPage } from './harness.mjs';
const [,, a, b, dir] = process.argv;
fs.mkdirSync(dir, { recursive: true });
const server = await startServer();
const { browser, page } = await openPage(server, 'src/index.html', '');
for (let i = +a; i <= +b; i++) {
  await page.evaluate(i => window.renderFrame(i), i);
  await page.screenshot({ path: `${dir}/fix_${i}.png` });
}
await browser.close(); server.close();
console.log('rendered', +b - +a + 1, 'frames');
