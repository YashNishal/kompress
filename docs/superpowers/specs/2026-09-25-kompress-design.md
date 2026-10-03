# Kompress: design spec

> A browser-only image and video optimiser, built for batches.

Status: approved in brainstorming on 2026-09-24/25. Visual mockups (Swiss × Studio queue, dual-panel Compare, Quick Look) were reviewed in the brainstorm companion.

## 1. Goals and constraints

- Optimise **many images and videos at once**, with a pixel-accurate **compare preview** for any file.
- **100% client-side.** Files never leave the device. No accounts and no backend in v1.
- Stack: **Next.js 16 (App Router, Turbopack)**, **Bun**, **shadcn/ui on Tailwind v4**, deployed on **Vercel** as static output plus headers (no functions needed).
- The design must feel deliberate and product-grade (see §5), not template-generated.

## 2. Architecture

Three layers, with dependencies pointing one way: **UI → store → engine**. `engine/` has no React imports.

```
src/
├─ app/
│  ├─ (marketing)/page.tsx       prerendered landing; the hero is a live drop zone
│  ├─ [conversion]/page.tsx      curated SEO pages (png-to-avif, compress-mp4, …)
│  └─ app/                       client-only workspace
│     ├─ page.tsx                Queue view
│     └─ compare/[id]/page.tsx   Compare view
├─ components/ui/                shadcn primitives restyled to Instrument tokens
├─ components/workspace/         Queue, Inspector, StatsBand, CompareCanvas, QuickLook,
│                                Filmstrip, VideoTimeline, DropZone, QualityScale, RatioBar
├─ store/                        Zustand: items, global settings, overrides, selection, UI
└─ engine/
   ├─ scheduler.ts               priority lanes, worker pool, cancellation, watchdog
   ├─ capabilities.ts            WebCodecs matrix, SAB, OPFS, FS Access, deviceMemory
   ├─ settings.ts                resolveSettings(global, typePreset, overrides), settingsHash
   ├─ codecs/                    one adapter per codec behind a shared interface
   ├─ video/                     Mediabunny + WebCodecs pipeline, target-size maths
   ├─ ffmpeg/                    lazy fallback for inputs the browser cannot decode
   ├─ metrics/                   SSIM (Butteraugli later)
   ├─ storage/                   OPFS output store, IndexedDB session and presets
   ├─ export/                    streaming ZIP (client-zip), save-to-folder
   └─ workers/                   image.worker, video.worker, ffmpeg.worker
```

**Codec interface:** `{ id, canEncode(caps), encode(input, options, signal) → Blob }`. The UI never knows which library sits behind a codec.

**Main thread ↔ workers:** Comlink, transferring `ArrayBuffer`/`ImageBitmap`s. The main thread never decodes or encodes.

**Persistence:** encoded outputs live in OPFS. The store holds only keys and metadata.

**Libraries:** jSquash (MozJPEG, libwebp, libavif, JXL, OxiPNG, resize), libimagequant (lossy PNG), libheif-js (HEIC input), SVGO, Mediabunny (demux/mux + WebCodecs), @ffmpeg/ffmpeg (fallback), client-zip, Comlink, Zustand.

## 3. Processing pipeline

```ts
QueueItem {
  id; file: File; kind: 'image' | 'video'
  probe: { width; height; duration?; codec?; hasAlpha?; hasExif? }
  overrides: Partial<Settings>
  status: 'probing' | 'queued' | 'encoding' | 'done' | 'failed' | 'cancelled'
  progress: number                       // 0..1
  output?: { key; size; format; width; height; ssim?; ms }
  error?: { code: EngineErrorCode; message; recovery? }
  settingsHash
}
```

Flow: drop → probe (on the main thread, cheap) → resolve settings → `scheduler.enqueue` → worker decodes, resizes, encodes and measures SSIM → Blob → OPFS → store update.

**Scheduler**
- Lanes, highest priority first: `preview`, `probe`, `interactive`, `batch`. One worker is reserved for preview and probe jobs, so previews never wait behind the batch. Queued jobs with the same key are replaced (latest wins). Cancelling a running job terminates and respawns its worker.
- Image pool: `clamp(hardwareConcurrency − 1, 1, 6)` workers.
- Video: 1 job at a time. While it runs, the image pool shrinks by one.
- Re-encodes are debounced (150 ms), the previous job is aborted via `AbortSignal`, and results with a stale `settingsHash` are discarded.
- Cache key is `fileHash + settingsHash`.
- Very large images (≥ 24 MP) are encoded at the visible crop first, then in full.

**Video**
- Target-size bitrate = `(targetBytes·8·0.97 − audioBits) / duration`. If the result overshoots by more than 3%, run one refinement pass.
- Output is streamed to OPFS, so memory stays flat.
- The compare view decodes the same timestamp from both files.

**Export**
- One file: direct download.
- Many files: a streaming ZIP read from OPFS, keeping folder structure.
- Chrome also gets Save to folder (File System Access API).

## 4. Functional requirements (v1)

**Input**
- F1. Add files by drag and drop, paste (⌘V), the file picker, or a folder (recursive).
- F2. Supported inputs:
  - Images: JPEG, PNG, WebP, AVIF, JXL, HEIC/HEIF, GIF (first frame), SVG, BMP, TIFF.
  - Videos: MP4, MOV, WebM, MKV. Exotic codecs go through the ffmpeg fallback.
- F3. Soft warnings above 500 files or 4 GB of video. On mobile, warn above 1 GB per video.

**Image settings** (global, with per-file override)
- F4. Formats: MozJPEG, WebP, AVIF, JXL, PNG (OxiPNG), lossy PNG (quantised), and "Auto: smallest at equal SSIM".
- F5. Quality 0–100, a lossless toggle where the format supports it, and advanced codec options.
- F6. Resize by longest edge, width, height or percentage. Lanczos3 by default. Never upscale.
- F7. Strip EXIF/GPS by default, apply orientation first, and optionally keep the colour profile.

**Video settings** (global, with per-file override)
- F8. Codecs: H.264/MP4, VP9/WebM, AV1. Only codecs the browser supports are shown.
- F9. Modes:
  - Quality (bits per pixel).
  - Target size, with presets Discord 25 MB, Email 20 MB, WhatsApp 16 MB, and custom.
- F10. Resolution presets 2160/1440/1080/720/480p or source. Frame-rate cap 60/30/24 or source.
- F11. Audio: copy, AAC/Opus at 64–192 kbps, or remove.
- F12. Trim with a filmstrip timeline and frame-accurate timecodes.

**Queue view**
- F13. Stats band: In · Out · Saved · Files done · Job progress and ETA.
- F14. Table: #, thumbnail, name and dimensions, conversion, after/before ratio bar, size, saved.
- F15. Row states: queued, encoding (%), done, failed with a one-click recovery, cancelled.
- F16. Multi-select to apply settings, remove or retry. Sort and filter by type, status or savings.
- F17. "Keep original if bigger" is on by default.
- F18. Quick Look: Space opens a floating compare, ↑↓ step, Enter opens Compare, Esc closes.

**Compare view**
- F19. Dual panel: each side is the Original or any encode, with its own settings.
- F20. Modes: Split (draggable handle), Side by side, Diff (amplified difference).
- F21. Zoom Fit/2×/4×/8×, synced pan, pixelated when zoomed, wheel and pinch, keys 1–4.
- F22. Hold Space to show the original.
- F23. Live stats per side: size, saved, dimensions, encode time, SSIM.
- F24. "Apply to all" promotes a side's settings to global.
- F25. Filmstrip plus ←/→ to step through the batch.
- F26. Video: the same canvas plus a frame scrubber and trim. Both sides stay time-synced.

**Export and persistence**
- F27. Single download, ZIP, or save to folder. Filename pattern `{name}.{ext}` or a custom pattern.
- F28. Presets (save, name, reuse). Built in: Web hero, Thumbnails, Social, Email-safe, Discord video.
- F29. The session survives a refresh (IndexedDB plus OPFS). "Clear session" wipes it.
- F30. Installable PWA that works offline after the first load.

**Cross-cutting**
- F31. Light, dark and phosphor themes; the default follows the system. The Compare canvas is always neutral dark (#1c1c1c).
- F32. Fully keyboard operable, a ⌘K command menu, and a split handle movable by arrow keys.
- F33. No uploads. Cookieless Vercel Analytics page views only.

**Out of scope for v1.** Deferred to v1.1: GIF ↔ video conversion, audio and thumbnail extraction, crop/rotate, animated WebP/AVIF, Butteraugli. Later: accounts, cloud links, API/CLI. Excluded: video editing (merging clips, changing speed).

## 5. UI and design system

**Direction: "Instrument".** A dense pro tool. (Until 2026-10-01 there were also Swiss and Editorial skins; they were removed and Instrument is the only design.)
- The queue has a stats band, a hairline grid, small-caps inspector sections and one accent colour.
- Compare is a dual panel on a neutral dark canvas with a filmstrip.

**Modes.** Light, Dark and Phosphor, picked from the theme menu in the top bar. "System" follows the OS between light and dark. The Compare canvas stays `#1c1c1c` in every mode.
- **Light:** bench grey `#f2f1ee`, ink `#1f1e1c`, hairlines `#dcdad5`, orange accent `#e85d0c`, savings green `#2c7a39`.
- **Dark:** charcoal `#141414`, text `#d9d6d0`, hairlines `#262626`, orange accent `#ff6a1a`, savings green `#9fd49a`.
- **Phosphor:** a green trace on a black scope. Background `#0a0d0a`, text `#b6e8bf`, amber accent `#ffb020`, savings `#6dff8e`. Figures get a soft glow and the page carries faint scanlines.
- The accent is used only for selection, progress and the primary action.
- Mechanics: next-themes sets the `light`, `dark` or `phosphor` class on `<html>` before first paint. The Tailwind `dark:` variant matches both `.dark` and `.phosphor`, and a `phosphor:` variant targets Phosphor alone. Tokens live in `globals.css`.

**Type:** IBM Plex Sans for the UI and IBM Plex Mono for figures, timecodes and key hints. Numerals are always tabular.

**Shape:** 5 px control radius, 46 px queue rows, 3 px progress bars and a thin quality slider. No shadows except on floating layers. Structure comes from hairlines.

**Motion:** 120–180 ms ease-out, only where it carries meaning. Respects `prefers-reduced-motion`.

**Responsive**
- 1280 px and up: full layout.
- 1024–1279 px: the inspector becomes a drawer.
- Below 1024 px: the queue becomes a list, the inspector a bottom sheet, and Compare a single canvas with a settings sheet.

**States:** an empty queue shows a drop target plus "Try sample images". Unsupported capabilities get an inline explanation, never a silent disabled control.

**Landing page:** the hero is a working drop zone plus a live draggable compare demo. No icon-feature grid.

## 6. Errors and capabilities

`capabilities.ts` probes the following once per session:
- `VideoEncoder`/`VideoDecoder.isConfigSupported` for each codec and resolution tier
- `crossOriginIsolated` (multithreaded WASM builds)
- OPFS
- `showDirectoryPicker`
- `deviceMemory`

The UI **hides unsupported options with a one-line reason**.

| Code | Recovery shown to the user |
|---|---|
| `UNSUPPORTED_INPUT` | Retry with ffmpeg (slower) |
| `DECODE_FAILED` | "File looks damaged" · Remove |
| `ENCODER_UNAVAILABLE` | Auto-fallback to H.264, with a toast |
| `OUT_OF_MEMORY` | Retry at 1080p / Retry one at a time |
| `TARGET_UNREACHABLE` | Shows the smallest achievable size · Accept / Change |
| `LARGER_THAN_SOURCE` | Keep the original, labelled "Already optimal" |
| `STORAGE_FULL` | Export finished files and clear them |
| `CANCELLED` | Silent |

**Resilience**
- A worker crash kills only that worker. It is replaced, and the job fails with a code. After two crashes on the same file, stop retrying it.
- Watchdog: no progress for 60 s (image) or 120 s (video) kills the job.
- After an out-of-memory failure, the image pool shrinks to 2 workers.
- `beforeunload` warns while jobs are running. After a refresh, finished outputs come back from OPFS and interrupted jobs are requeued.
- The only automatic retry is falling back from the multithreaded to the single-threaded WASM build. Every other recovery is a visible user action.

**Security**
- CSP `connect-src 'self'` plus the analytics endpoint.
- WASM and ffmpeg assets are self-hosted on the same origin.
- Every route sends `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`. This was changed from `/app` only (2026-09-25): a file dropped on the landing page must reach the workspace without a document swap, and the site embeds no third parties.

## 7. Testing, performance, deployment

**Testing:** deferred by decision (2026-09-25). No unit or e2e frameworks in v1. Verification is manual in the browser plus `next build` type-checking. Revisit before public launch.

**Performance budgets**
- Landing JS ≤ 120 KB gzipped.
- Workspace shell ≤ 200 KB, excluding lazy codecs.
- Codecs are loaded on first use. ffmpeg (about 30 MB) loads only on fallback.
- The main thread never has tasks over 50 ms during a batch.
- Preview re-encode feedback under 1 s for images up to 12 MP on a mid-range laptop.

**Deployment**
- Vercel, framework preset Next.js, installing and building with Bun.
- `next.config.ts` `headers()` sets COOP/COEP site-wide and caches WASM assets for a long time (immutable).
- Preview deployments for every branch.

## 8. Build phases

1. Scaffold, design tokens, fonts, shell layout, headers.
2. Engine core: settings, capabilities, scheduler, image worker with jSquash, OPFS store.
3. Queue view: drop zone, table, stats band, inspector, export ZIP.
4. Compare view and Quick Look.
5. Video pipeline (Mediabunny/WebCodecs), timeline, target size.
6. ffmpeg fallback, HEIC/SVG, presets, session restore, PWA, landing and SEO pages.
