import type { MetadataRoute } from "next";

// Installable PWA (01-tech-stack.md). Serwist service worker (offline cache,
// mutation queue) arrives with the Phase 2/3 offline work — installability
// does not require it.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Soru",
    short_name: "Soru",
    description: "Soru by Sorusoft",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#fafafa",
    theme_color: "#3566d6",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
