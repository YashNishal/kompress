import type { NextConfig } from "next";

// Cross-origin isolation unlocks SharedArrayBuffer, which the multithreaded
// AVIF/JXL encoders and ffmpeg.wasm need. It is applied site-wide (not only
// /app) so a file dropped on the landing page can hand off to the workspace
// without a mid-flow document swap; nothing on the site embeds third parties.
const isolation = [
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
];

// `next build` runs with --webpack: Turbopack (16.3) deadlocks bundling the
// multithreaded AVIF/JXL/oxipng encoders, whose thread workers re-import the
// module that spawned them. Webpack builds the same graph in ~10s.
const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/:path*", headers: isolation },
      {
        source: "/:path*.wasm",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
