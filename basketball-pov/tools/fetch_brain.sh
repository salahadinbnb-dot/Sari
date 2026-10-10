#!/usr/bin/env bash
# The v12 brain: FreeSurfer's fsaverage cortex and the MNI152 2009c template, from TemplateFlow, built into
# assets/brain/brain.bin + brain.json by tools/brain_mesh.py (needs: pip install nibabel scikit-image trimesh scipy)
set -euo pipefail
cd "$(dirname "$0")/.."
D=assets/brain; TF=https://templateflow.s3.amazonaws.com
mkdir -p "$D"
get() { [ -s "$D/$1" ] || curl -sf -o "$D/$1" "$TF/$2"; }
for h in L R; do
  get "fsavg_${h}_pial.surf.gii" "tpl-fsaverage/tpl-fsaverage_hemi-${h}_den-41k_pial.surf.gii"
  get "fsavg_${h}_sulc.shape.gii" "tpl-fsaverage/tpl-fsaverage_hemi-${h}_den-41k_sulc.shape.gii"
done
get mni_brain_mask.nii.gz tpl-MNI152NLin2009cAsym/tpl-MNI152NLin2009cAsym_res-01_desc-brain_mask.nii.gz
get mni_T1w.nii.gz tpl-MNI152NLin2009cAsym/tpl-MNI152NLin2009cAsym_res-01_T1w.nii.gz
[ -s "$D/brain.bin" ] || python3 tools/brain_mesh.py
echo "brain ready"
