// GitHub Pages serves 404.html for unknown paths — reuse index.html so the SPA router handles them,
// and add .nojekyll so nothing in dist/ is ignored by the Pages builder.
import { copyFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist");
copyFileSync(path.join(dist, "index.html"), path.join(dist, "404.html"));
writeFileSync(path.join(dist, ".nojekyll"), "");
console.log("postbuild: wrote dist/404.html and dist/.nojekyll");
