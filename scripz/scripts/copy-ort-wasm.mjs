// Copies the ONNX Runtime WebAssembly binaries into public/ort/ so the site serves
// them from its own origin instead of a third-party CDN. Runs before `dev` and `build`.
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(here, "../node_modules/onnxruntime-web/dist");
const outDir = path.resolve(here, "../public/ort");

if (!existsSync(distDir)) {
  console.error(`onnxruntime-web not found at ${distDir}. Run npm install first.`);
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
// Every variant of the runtime: ONNX Runtime picks plain / jsep (WebGPU) / asyncify / jspi
// depending on what the visitor's browser supports.
const files = readdirSync(distDir).filter((f) => f.startsWith("ort-wasm-simd-threaded."));
for (const f of files) copyFileSync(path.join(distDir, f), path.join(outDir, f));
console.log(`Copied ${files.length} ONNX Runtime files to public/ort/`);
