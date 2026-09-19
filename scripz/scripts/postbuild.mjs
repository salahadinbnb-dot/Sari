// GitHub Pages serves 404.html for unknown paths — reuse index.html so the SPA router handles them,
// and add .nojekyll so nothing in dist/ is ignored by the Pages builder.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist");
const notFound = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Scripz</title>
<script>
  // GitHub Pages serves this for unknown paths. Send the visitor to the app root (the repo path on
  // *.github.io, otherwise the domain root); the app itself uses relative asset URLs.
  var seg = location.pathname.split("/")[1];
  var root = /\\.github\\.io$/.test(location.hostname) && seg ? "/" + seg + "/" : "/";
  location.replace(root + location.search + location.hash);
</script></head><body></body></html>
`;
writeFileSync(path.join(dist, "404.html"), notFound);
writeFileSync(path.join(dist, ".nojekyll"), "");
console.log("postbuild: wrote dist/404.html and dist/.nojekyll");

// Guard: GitHub push protection rejects pushes that contain 32-character tokens next to the
// word "Mistral" (see scrubSecretLookalikes in vite.config.ts). Fail loudly if any slipped through.
const assetsDir = path.join(dist, "assets");
const offenders = [];
for (const file of readdirSync(assetsDir).filter((f) => f.endsWith(".js"))) {
  const code = readFileSync(path.join(assetsDir, file), "utf8");
  for (const m of code.matchAll(/\b([A-Za-z0-9]*istral[A-Za-z0-9]*)\b/g)) {
    if (m[1].length === 32) offenders.push(`${file}: ${m[1]}`);
  }
}
if (offenders.length > 0) {
  console.error("postbuild: secret-lookalike identifiers still present:\n  " + offenders.join("\n  "));
  process.exit(1);
}
console.log("postbuild: no secret-lookalike identifiers in dist/assets");
