"""Build the v12 brain from open MRI-derived data (in MNI-style millimetre coordinates, x right, y front, z up):
the cerebral cortex is FreeSurfer's fsaverage pial surface (41k vertices a hemisphere, via TemplateFlow) with its
sulcal depth for shading; the cerebellum and brainstem are what's left of the MNI152 2009c brain once the cortex is
taken out, as an isosurface of the template's T1 (so the cerebellum keeps some of its folia).
Writes assets/brain/brain.bin (float32 positions, float32 sulc, uint32 indices, back to back) and brain.json (offsets).
usage: python3 tools/brain_mesh.py   (tools/fetch_brain.sh downloads the data and runs this)
"""
import json, os
import numpy as np
import nibabel as nib
import trimesh
from scipy import ndimage
from skimage import measure

D = os.path.join(os.path.dirname(__file__), '..', 'assets', 'brain')
parts, blobs, off = {}, [], 0


def add(name, V, F, sulc=None):
    global off
    V = np.ascontiguousarray(V, np.float32); F = np.ascontiguousarray(F, np.uint32)
    e = {'nv': int(len(V)), 'nf': int(len(F)), 'pos': off}; blobs.append(V.tobytes()); off += V.nbytes
    if sulc is not None:
        s = np.ascontiguousarray(sulc, np.float32); e['sulc'] = off; blobs.append(s.tobytes()); off += s.nbytes
    e['idx'] = off; blobs.append(F.tobytes()); off += F.nbytes
    parts[name] = e
    print(name, e['nv'], 'verts', e['nf'], 'faces')


# the cortex
hemis = {}
for h in 'LR':
    g = nib.load(os.path.join(D, f'fsavg_{h}_pial.surf.gii'))
    V, F = g.darrays[0].data, g.darrays[1].data
    s = nib.load(os.path.join(D, f'fsavg_{h}_sulc.shape.gii')).darrays[0].data
    add('cortex' + h, V, F, s); hemis[h] = trimesh.Trimesh(V, F, process=False)

# the cerebellum and brainstem: the template brain minus the cortex (and a few mm round it)
mimg = nib.load(os.path.join(D, 'mni_brain_mask.nii.gz')); mask = mimg.get_fdata() > 0.5
t1 = nib.load(os.path.join(D, 'mni_T1w.nii.gz')).get_fdata()
A = mimg.affine; inv = np.linalg.inv(A)
cer = np.zeros(mask.shape, bool)
for h, m in hemis.items():
    vg = m.voxelized(pitch=1.0).fill()
    pts = vg.points  # voxel centres inside the hemisphere, in mm
    ijk = np.round(np.c_[pts, np.ones(len(pts))] @ inv.T)[:, :3].astype(int)
    ok = np.all((ijk >= 0) & (ijk < np.array(mask.shape)), axis=1)
    cer[tuple(ijk[ok].T)] = True
cer = ndimage.binary_closing(cer, iterations=2)
cer = ndimage.binary_dilation(cer, iterations=4)
rest = mask & ~cer
lab, n = ndimage.label(rest)
sizes = ndimage.sum(rest, lab, range(1, n + 1))
keep = lab == (1 + int(np.argmax(sizes)))
print('cerebellum + brainstem voxels', int(keep.sum()), 'of', n, 'pieces')
vol = ndimage.gaussian_filter(np.where(ndimage.binary_dilation(keep, iterations=1), t1, 0.0), 0.7)
verts, faces, _, _ = measure.marching_cubes(vol, level=5600.0, step_size=1)
verts = np.c_[verts, np.ones(len(verts))] @ A.T
cb = trimesh.Trimesh(verts[:, :3], faces[:, ::-1], process=True)
cb = max(cb.split(only_watertight=False), key=lambda m: len(m.faces))
trimesh.smoothing.filter_taubin(cb, iterations=6)
print('cerebellum bbox', cb.bounds.round(1).tolist())
add('cerebellum', cb.vertices, cb.faces)

open(os.path.join(D, 'brain.bin'), 'wb').write(b''.join(blobs))
json.dump(parts, open(os.path.join(D, 'brain.json'), 'w'), indent=1)
print('wrote', off, 'bytes')
