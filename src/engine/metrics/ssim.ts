/**
 * Luma SSIM over non-overlapping 8×8 windows. This is a fast approximation of
 * the Wang et al. metric, good for ranking encodes, and cheap enough to run on
 * every preview. Inputs must share dimensions.
 */
export function ssim(a: ImageData, b: ImageData): number {
  if (a.width !== b.width || a.height !== b.height) throw new Error("SSIM: size mismatch");
  const { width: w, height: h } = a;
  const la = luma(a.data, w * h);
  const lb = luma(b.data, w * h);
  const C1 = (0.01 * 255) ** 2;
  const C2 = (0.03 * 255) ** 2;
  const N = 8;
  let total = 0;
  let windows = 0;
  for (let y = 0; y + N <= h; y += N) {
    for (let x = 0; x + N <= w; x += N) {
      let sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0;
      for (let j = 0; j < N; j++) {
        let i = (y + j) * w + x;
        for (let k = 0; k < N; k++, i++) {
          const pa = la[i], pb = lb[i];
          sa += pa; sb += pb; saa += pa * pa; sbb += pb * pb; sab += pa * pb;
        }
      }
      const n = N * N;
      const ma = sa / n, mb = sb / n;
      const va = saa / n - ma * ma;
      const vb = sbb / n - mb * mb;
      const cov = sab / n - ma * mb;
      total += ((2 * ma * mb + C1) * (2 * cov + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2));
      windows++;
    }
  }
  return windows ? total / windows : 1;
}

function luma(d: Uint8ClampedArray, px: number) {
  const out = new Float32Array(px);
  for (let i = 0, p = 0; i < px; i++, p += 4) out[i] = 0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2];
  return out;
}
