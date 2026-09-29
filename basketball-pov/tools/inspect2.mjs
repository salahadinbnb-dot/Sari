import { startServer, openPage } from './harness.mjs';
const [,, specs, out, w = '1600', h = '900'] = process.argv;
const server = await startServer();
const { browser, page } = await openPage(server, 'src/inspect2.html', 'p=' + encodeURIComponent(specs), { width: +w, height: +h });
await page.screenshot({ path: out });
await browser.close(); server.close();
