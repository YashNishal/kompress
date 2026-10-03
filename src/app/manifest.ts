import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kompress",
    short_name: "Kompress",
    description: "Compress images and video in your browser. Nothing is uploaded.",
    start_url: "/app",
    display: "standalone",
    background_color: "#141414",
    theme_color: "#141414",
    categories: ["photo", "productivity", "utilities"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
