# FitnessMotion — WEB version (three.js)

This folder is the **browser implementation** of FitnessMotion (published as a claude.ai artifact).
It is **not** the native iPhone app.

| | Web (this folder) | Native iPhone app |
| --- | --- | --- |
| Tech | HTML + three.js, procedural 3D demos on a CC0 MakeHuman body | SwiftUI, bundled exercise video demos |
| Where | `Sari` repo → `fitnessmotion/` | Mac: `~/Developer/FitnessMotion` (`com.hezigod.FitnessMotion`), delivered as `FitnessMotion-1.5.zip` |
| Current | 133 exercises (`js/library.js` + packs in `js/extra/`), coaching cues, 6-week plans | 1.5 (8): 100 exercises, Refresh fixes — see `docs/RELEASE_1.5.md` in that project |

Changes here never affect the iPhone app, and the native app does not load anything from this folder.

## Layout
- `js/library.js` — motion clips per exercise; `js/extra/*.js` — exercise packs (catalogue rows, cues, motions, props)
- `js/store.js` — catalogue, equipment, workout generation, persistence; `js/plan.js` — 6-week plans
- `js/cues.js` — form cues; `dev/preview.html` — contact sheet for checking motions (`?ids=a,b`)
