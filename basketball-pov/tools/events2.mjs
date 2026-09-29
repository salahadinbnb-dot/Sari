// Export v2 (1v1) sound-event times from the page (the ball schedule lives in game2.js and needs the rigs).
import fs from 'node:fs';
import { startServer, openPage } from './harness.mjs';
const server = await startServer();
const { browser, page } = await openPage(server, 'src/index2.html', 'half');
const ev = await page.evaluate(() => window.events());
await browser.close(); server.close();
fs.writeFileSync(new URL('../out/events2.json', import.meta.url), JSON.stringify(ev, null, 1));
console.log(JSON.stringify({ duration: ev.duration, bounces: ev.bounces.length, freezes: ev.freezes.map(f => f.tag) }));
