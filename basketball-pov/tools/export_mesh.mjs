import fs from 'node:fs';
import { startServer, openPage, ROOT } from './harness.mjs';
const server = await startServer();
for (const m of ['04', '03', '02']) {
  const { browser, page } = await openPage(server, 'src/export_mesh.html', 'm=' + m, { width: 200, height: 200 });
  const data = await page.evaluate(() => window.__data);
  fs.writeFileSync(`${ROOT}/assets/raw/m${m}/mesh.json`, data);
  const d = JSON.parse(data);
  console.log(m, 'verts', d.pos.length / 3, 'index', d.index ? d.index.length / 3 : 'none', 'groups', JSON.stringify(d.groups), d.mats);
  await browser.close();
}
server.close();
