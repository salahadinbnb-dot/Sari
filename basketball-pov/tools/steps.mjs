import { startServer, openPage } from './harness.mjs';
const [,, n, a, b] = process.argv;
const server = await startServer();
const { browser, page } = await openPage(server, 'src/index.html', 'half');
const r = await page.evaluate(([n, a, b]) => window.stepsOf(n, +a, +b), [n, a, b]);
for (const x of r) console.log(JSON.stringify(x));
const path = await page.evaluate(([n, a, b]) => { const o = []; for (let t = +a; t <= +b; t += 0.05) { const f = window.__w ? 0 : 0; } return o; }, [n, a, b]);
await browser.close(); server.close();
