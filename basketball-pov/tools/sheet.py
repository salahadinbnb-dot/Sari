import sys
from PIL import Image, ImageDraw
out=sys.argv[1]; fs=sys.argv[2:]
W,H=960,540
ims=[Image.open(f).convert('RGB').resize((W,H)) for f in fs]
cols=2 if len(ims)>1 else 1
rows=(len(ims)+cols-1)//cols
sheet=Image.new('RGB',(W*cols,H*rows))
for i,(im,f) in enumerate(zip(ims,fs)):
    sheet.paste(im,((i%cols)*W,(i//cols)*H))
    ImageDraw.Draw(sheet).text(((i%cols)*W+6,(i//cols)*H+4), f.rsplit('_',1)[-1], fill=(255,255,0))
sheet.save(out, quality=88)
