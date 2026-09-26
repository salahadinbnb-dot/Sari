// Exercise packs. Each pack module exports `data` (catalogue rows + coaching cues) and
// `motions(H)` returning { id: () => spec } built from library.js helpers (see H in library.js).
import * as upper from './upper.js?v=7';
import * as cables from './cables.js?v=7';
import * as lower from './lower.js?v=7';
import * as core from './core.js?v=7';

export const PACKS = [upper, cables, lower, core];
