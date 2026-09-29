// Render one or more frames of the main scene to PNG for review.
// usage: node tools/still.mjs <outPrefix> <frame> [frame...]
import { startServer, openPage } from './harness.mjs';
const [,, out, ...frames] = process.argv;
const server = await startServer();
const t0 = Date.now();
const { browser, page } = await openPage(server, 'src/index.html', process.env.Q || '');
console.log('load ms', Date.now() - t0);
for (const f of frames.length ? frames : ['0']) {
  const ms = await page.evaluate(i => window.renderFrame(+i), f);
  const t1 = Date.now();
  await page.screenshot({ path: `${out}_${f}.png` });
  console.log('frame', f, 'render ms', Math.round(ms), 'shot ms', Date.now() - t1);
}
await browser.close(); server.close();
