#!/usr/bin/env bash
# Downloads the Microsoft Rocketbox athlete models (MIT) and builds the per-player uniform textures.
set -euo pipefail
cd "$(dirname "$0")/.."
RB=${RB:-/tmp/microsoft-rocketbox}
if [ ! -d "$RB/.git" ]; then
  GIT_LFS_SKIP_SMUDGE=1 git clone --depth 1 --filter=blob:none --no-checkout https://github.com/microsoft/Microsoft-Rocketbox "$RB"
fi
mkdir -p assets/raw
python3 - "$RB" <<'PY'
import os, subprocess, sys
from PIL import Image
rb = sys.argv[1]
for n, code in [('04', 'm026'), ('03', 'm300'), ('02', 'm301')]:
    base = f'Assets/Avatars/Professions/Sports_Male_{n}'
    dst = f'assets/raw/m{n}'; os.makedirs(dst, exist_ok=True)
    def get(path):
        return subprocess.run(['git', '-C', rb, 'show', f'HEAD:{path}'], check=True, capture_output=True).stdout
    open(f'{dst}/model.fbx', 'wb').write(get(f'{base}/Export/Sports_Male_{n}.fbx'))
    files = subprocess.run(['git', '-C', rb, 'ls-tree', '--name-only', f'HEAD:{base}/Textures'], check=True, capture_output=True, text=True).stdout.split()
    for f in files:
        tmp = f'/tmp/{f}'; open(tmp, 'wb').write(get(f'{base}/Textures/{f}'))
        im = Image.open(tmp); name = f.replace(code + '_', '').replace('.tga', '')
        if 'opacity' in name: im.save(f'{dst}/{name}.png')
        elif 'normal' in name: im.convert('RGB').save(f'{dst}/{name}.png')
        else: im.convert('RGB').save(f'{dst}/{name}.jpg', quality=93)
    print('model', n, 'ok')
PY
node tools/export_mesh.mjs
python3 tools/bake.py
python3 tools/prep_textures.py
# CMU Graphics Lab motion capture (free for any use): skeletons + the clips play1v1.js (v2) and play3.js (v3) use
mkdir -p assets/mocap
for f in 06/06.asf 78/78.asf 124/124.asf 06/06_06.amc 06/06_15.amc 124/124_06.amc \
         78/78_20.amc 78/78_22.amc 78/78_25.amc 78/78_27.amc 78/78_30.amc 78/78_32.amc 78/78_12.amc \
         06/06_04.amc 06/06_13.amc 124/124_05.amc 78/78_28.amc; do
  n=$(basename "$f"); [ -s "assets/mocap/$n" ] || curl -sf -o "assets/mocap/$n" "http://mocap.cs.cmu.edu/subjects/$f"
done
python3 tools/mocap.py 06_06 06_15 124_06 78_20 78_22 78_25 78_27 78_30 78_32 78_12 06_04 06_13 124_05 78_28
echo "assets ready"
