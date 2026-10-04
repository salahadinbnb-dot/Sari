// usage: node tools/clipview.mjs <clip> <outPrefix> <view deg> t1 t2 ...   (renders frames + sheet)
import { startServer, openPage } from './harness.mjs';
import { execFileSync } from 'node:child_process';
const [,, clip, out, view, ...ts] = process.argv;
const server = await startServer();
const { browser, page } = await openPage(server, 'src/clipview.html', 'clip=' + clip, { width: 640, height: 640 });
const info = await page.evaluate(() => window.info);
console.log(clip, JSON.stringify(info));
const times = ts.length ? ts.map(Number) : Array.from({ length: 12 }, (_, i) => +(i * info.dur / 11).toFixed(2));
const files = [];
for (const t of times) {
  const r = await page.evaluate(([t, v]) => window.renderAt(t, v), [t, +view]);
  const f = `${out}_${clip}_${t}.png`; await page.screenshot({ path: f }); files.push(f);
  console.log(t, JSON.stringify(r));
}
await browser.close(); server.close();
execFileSync('python3', ['-c', `
import sys
from PIL import Image, ImageDraw
fs=sys.argv[2:]; ims=[Image.open(f).resize((320,320)) for f in fs]
cols=6; rows=(len(ims)+cols-1)//cols
S=Image.new('RGB',(320*cols,320*rows))
for i,(im,f) in enumerate(zip(ims,fs)):
    S.paste(im,((i%cols)*320,(i//cols)*320)); ImageDraw.Draw(S).text(((i%cols)*320+5,(i//cols)*320+5), f.rsplit('_',1)[1][:-4], fill=(255,255,0))
S.save(sys.argv[1])`, `${out}_${clip}.jpg`, ...files]);
console.log('sheet', `${out}_${clip}.jpg`);
