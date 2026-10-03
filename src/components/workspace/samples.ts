"use client";

import type { Incoming } from "@/store/processor";

/**
 * "Try sample images" without shipping sample assets: a few photographic-ish
 * test cards drawn on a canvas (gradients, fine detail, text and noise, the
 * things that separate codecs) and exported as lossless PNGs.
 */
export async function makeSamples(): Promise<Incoming[]> {
  const W = 1800;
  const H = 1200;
  const draws: [string, (ctx: CanvasRenderingContext2D) => void][] = [
    ["sample-dusk.png", dusk],
    ["sample-grid.png", grid],
    ["sample-type.png", type],
  ];
  const out: Incoming[] = [];
  for (const [name, draw] of draws) {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d")!;
    draw(ctx);
    grain(ctx, W, H);
    const blob = await new Promise<Blob>((res) => c.toBlob((b) => res(b!), "image/png"));
    out.push({ file: new File([blob], name, { type: "image/png" }), path: `samples/${name}` });
  }
  return out;
}

function dusk(ctx: CanvasRenderingContext2D) {
  const { width: w, height: h } = ctx.canvas;
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#1b2a4a");
  sky.addColorStop(0.55, "#e07a5f");
  sky.addColorStop(1, "#f2cc8f");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#fff4d6";
  ctx.beginPath();
  ctx.arc(w * 0.68, h * 0.58, 110, 0, Math.PI * 2);
  ctx.fill();
  for (let layer = 0; layer < 4; layer++) {
    ctx.fillStyle = ["#3d405b", "#2f3150", "#232540", "#15162a"][layer];
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 12) {
      const y = h * (0.62 + layer * 0.09) + Math.sin(x / (140 - layer * 20) + layer) * (40 - layer * 6) + Math.sin(x / 31) * 6;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.fill();
  }
}

function grid(ctx: CanvasRenderingContext2D) {
  const { width: w, height: h } = ctx.canvas;
  ctx.fillStyle = "#efeeea";
  ctx.fillRect(0, 0, w, h);
  const cols = ["#e1ff32", "#0e0e0e", "#c8321b", "#3a86ff", "#8338ec", "#fb5607"];
  const s = 150;
  for (let y = 0; y < h; y += s)
    for (let x = 0; x < w; x += s) {
      const i = ((x / s) * 7 + (y / s) * 3) % cols.length;
      ctx.fillStyle = cols[i];
      if ((x / s + y / s) % 3 === 0) ctx.fillRect(x + 8, y + 8, s - 16, s - 16);
      else {
        ctx.beginPath();
        ctx.arc(x + s / 2, y + s / 2, s / 2 - 10, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  // Fine lines: the first thing lossy codecs smear.
  ctx.strokeStyle = "#0e0e0e";
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 6) {
    ctx.beginPath();
    ctx.moveTo(x, h - 160);
    ctx.lineTo(x + 80, h);
    ctx.stroke();
  }
}

function type(ctx: CanvasRenderingContext2D) {
  const { width: w, height: h } = ctx.canvas;
  ctx.fillStyle = "#0e0e0e";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#e1ff32";
  ctx.fillRect(0, h - 260, w, 260);
  ctx.fillStyle = "#efeeea";
  ctx.font = "900 220px system-ui, sans-serif";
  ctx.fillText("KOMPRESS", 80, 330);
  ctx.font = "500 34px system-ui, sans-serif";
  const line = "The quick brown fox jumps over the lazy dog. 0123456789 — ";
  for (let i = 0; i < 12; i++) ctx.fillText(line.repeat(3), 80 - i * 37, 440 + i * 42);
  ctx.fillStyle = "#0e0e0e";
  ctx.font = "800 120px system-ui, sans-serif";
  ctx.fillText("−74% saved", 80, h - 90);
}

function grain(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  let seed = 1;
  for (let i = 0; i < d.length; i += 4) {
    seed = (seed * 16807) % 2147483647;
    const n = ((seed / 2147483647) - 0.5) * 14;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}
