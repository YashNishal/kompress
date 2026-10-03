<p>
  <img src="src/app/icon.svg" width="56" height="56" alt="">
</p>

# kompress/

**Smaller files. Same pixels.** Kompress batch-compresses images and video in the browser. Every encode runs on your device, and nothing is uploaded.

- **Images:** AVIF, WebP, JPEG XL, JPEG and PNG, with quality, lossless, resize and metadata controls.
- **Video:** shrink to a target size, cap the resolution and frame rate, and trim.
- **Batches:** add hundreds of files or a whole folder, then export one file, a ZIP or straight to a folder.
- **Compare:** split, side-by-side and diff views at up to 8×, with size and SSIM for each side.
- **Three modes:** Light, Dark and Phosphor.

## Development

```bash
bun install
bun run dev      # http://localhost:3000
bun run lint
```

The site is served with cross-origin isolation (COOP/COEP in `next.config.ts`). This unlocks `SharedArrayBuffer`, which the multithreaded AVIF and JPEG XL encoders need. Anything embedded in the site must therefore be same-origin or CORP-enabled.

Set `NEXT_PUBLIC_SITE_URL` to the public origin so social share images resolve to absolute URLs. Vercel deployments fill this in automatically.

## Layout

```
src/app/                 routes, metadata, icons and the social card
src/components/workspace queue, inspector, compare and quick look
src/engine/              codecs, workers, scheduler and export
src/store/               workspace state and the processing pipeline
docs/superpowers/specs/  product and design spec
```

## Brand

- **Mark:** a lowercase k whose arm is the slash from the wordmark, on an ink tile.
  - Master file: `src/app/icon.svg`.
  - In the app, `<BrandMark />` redraws it from theme colours.
- **Wordmark:** `kompress/` in IBM Plex Mono 500, lowercase, with the slash in the accent colour.
- **Colour:** charcoal `#141414`, paper `#f2f1ee` and orange `#ff6a1a`. In light mode the orange is `#e85d0c`.
- **Type:** IBM Plex Sans for the UI and IBM Plex Mono for figures.
- **Icons:**
  - `favicon.ico` holds 16, 32 and 48 px sizes. `apple-icon.png` is 180 px and full-bleed.
  - `public/icon-{192,512}.png` and `icon-maskable-512.png` serve the web app manifest.
  - `opengraph-image.png` is the 1200×630 share card.
