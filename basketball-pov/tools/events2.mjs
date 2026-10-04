// Export sound-event times from a page (the ball schedule lives in the game module and needs the rigs).
// usage: node tools/events2.mjs [page] [out]   (defaults: the v2 1v1 page -> out/events2.json)
import fs from 'node:fs';
import { startServer, openPage } from './harness.mjs';
const PAGE = process.argv[2] || 'src/index2.html';
const OUT = process.argv[3] || new URL('../out/events2.json', import.meta.url);
const server = await startServer();
const { browser, page } = await openPage(server, PAGE, 'half');
const ev = await page.evaluate(() => window.events());
await browser.close(); server.close();
fs.writeFileSync(OUT, JSON.stringify(ev, null, 1));
console.log(JSON.stringify({ duration: ev.duration, bounces: ev.bounces.length, freezes: ev.freezes.map(f => f.tag) }));
