import { startServer, openPage } from './harness.mjs';
const server = await startServer();
const { browser, page } = await openPage(server, 'src/index.html', 'half');
const r = await page.evaluate(() => window.diagnose());
console.log('pop count', r.popCount);
for (const p of r.pops) console.log('POP', JSON.stringify(p));
console.log('REACH', JSON.stringify(r.reach, null, 1));
await browser.close(); server.close();
