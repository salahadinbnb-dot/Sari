# Scripz

Paste an Instagram, YouTube, X or Facebook link → get the transcript, timestamps, SRT subtitles, a PDF and the original video.

Transcription runs **in the visitor's browser** (Whisper via [transformers.js](https://huggingface.co/docs/transformers.js), WebGPU when available, WebAssembly otherwise). There is no API key, no per-minute charge and no usage cap — the only cost is the visitor's own CPU/GPU time and a one-time model download that the browser caches.

## Live site

The site is published from the `gh-pages` branch of this repository (GitHub Pages, "Deploy from a branch"):

- URL: `https://salahadinbnb-dot.github.io/Sari/`
- Workflow: `.github/workflows/deploy-scripz.yml` runs on every push to `claude/scripz-domain-migration-nkjgg5` that touches `scripz/`. It typechecks, tests, builds, and force-pushes `dist/` to `gh-pages`; GitHub then redeploys the site within a minute or two.
- The `gh-pages` branch holds only build output. Never commit to it by hand.

### Custom domain

1. Settings → Pages → Custom domain → enter the domain and follow GitHub's DNS instructions (CNAME to `salahadinbnb-dot.github.io`).
2. In the workflow, set `VITE_BASE_PATH` to `/` (a custom domain serves from the root, not `/Sari/`).
3. Add a `public/CNAME` file containing the domain so it survives each deploy.

## How it works

| Step | Where it runs | Notes |
| --- | --- | --- |
| Link → video URL | Supabase edge functions (`supabase/functions/fetch-*`) | Instagram / X / Facebook use RapidAPI + public mirrors; YouTube uses platform captions first. |
| Video → audio | Browser | The file is fetched directly from the platform CDN (they allow it) and decoded with the Web Audio API. |
| Audio → text | Browser (Web Worker) | `src/lib/whisper/` — Whisper base (default) or small, chunked with real timestamps. |
| Fallback | Supabase `transcribe-audio` | Only if the browser can't download/decode a video (e.g. YouTube without captions). Metered; can be switched off in the engine menu. |

The engine menu in the top-right lets a visitor pick quality (Fast = `whisper-base`, Accurate = `whisper-small`), the spoken language, and whether the cloud fallback is allowed. Settings live in `localStorage`.

## Local development

```sh
cd scripz
npm install --ignore-scripts   # onnxruntime-node's postinstall is not needed for the web build
npm run dev                    # http://localhost:8080
npm run typecheck && npm test && npm run build
```

`npm run build` copies the ONNX Runtime WebAssembly files into `public/ort/` (git-ignored) and writes `dist/404.html` for SPA routing on GitHub Pages.

## Backend (link extraction)

The edge functions and their config live in `supabase/`. They currently run on the Supabase project that Lovable Cloud provisioned (`lqxaxkeknjxmkbhxktyh`, credentials in `.env` — the anon key is public by design). To move them to your own free Supabase project:

```sh
npm i -g supabase
supabase login
supabase link --project-ref <your-project-ref>
supabase secrets set RAPIDAPI_KEY=... YOUTUBE_RAPIDAPI_KEY=...
supabase functions deploy fetch-instagram fetch-twitter-video fetch-facebook fetch-youtube-transcript download-youtube-video transcribe-audio
```

Then update `VITE_SUPABASE_URL`, `VITE_SUPABASE_PROJECT_ID` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env` and push — the workflow rebuilds the site. (`transcribe-audio` and `telegram-webhook` still call Lovable's AI gateway and need `LOVABLE_API_KEY`; they are optional now.)
