// Render stills at given SIM times; optional overhead/side cams; builds a contact sheet.
// usage: node tools/sim.mjs <out.png> <cam:behind|top|side|front> t1 t2 ...
import { startServer, openPage } from './harness.mjs';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
const [,, out, cam, ...ts] = process.argv;
const server = await startServer();
const { browser, page } = await openPage(server, 'src/index.html', process.env.Q || 'half');
const tmp = [];
const cams = {
  top: { pos: [1.5, 17, 6.5], look: [1.2, 0, 5.2] },
  side: { pos: [12, 3.2, 6], look: [1, 1, 6] },
  front: { pos: [1.2, 2.6, -0.5], look: [1.5, 1.0, 7] },
  close: null,
};
for (const t of ts) {
  let co = cams[cam] || null;
  if (cam.startsWith('close:')) { const [, nm, ang, dist, h] = cam.split(':'); co = await page.evaluate(([nm, t, ang, dist, h]) => window.closeCam(nm, +t, +ang, +(dist || 3.2), +(h || 1.3)), [nm, t, ang || 0, dist, h]); }
  await page.evaluate(([t, co]) => window.renderSim(+t, co), [t, co]);
  const f = `${out}.${t}.jpg`;
  await page.screenshot({ path: f, type: 'jpeg', quality: 85, clip: { x: 0, y: 0, width: 1920, height: 1080 } });
  tmp.push(f);
}
await browser.close(); server.close();
// contact sheet via python PIL
const py = `
import sys
from PIL import Image, ImageDraw
fs=sys.argv[2:]; out=sys.argv[1]
ims=[Image.open(f).resize((640,360)) for f in fs]
cols=3 if len(ims)>4 else 2 if len(ims)>1 else 1
rows=(len(ims)+cols-1)//cols
sheet=Image.new('RGB',(640*cols,360*rows),(0,0,0))
for i,(im,f) in enumerate(zip(ims,fs)):
    sheet.paste(im,((i%cols)*640,(i//cols)*360))
    d=ImageDraw.Draw(sheet); d.text(((i%cols)*640+8,(i//cols)*360+6), f.split('.')[-3]+'.'+f.split('.')[-2], fill=(255,255,0))
sheet.save(out)
`;
fs.writeFileSync('/tmp/_sheet.py', py);
execFileSync('python3', ['/tmp/_sheet.py', out, ...tmp]);
console.log('wrote', out);
