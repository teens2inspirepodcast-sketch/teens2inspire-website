import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Teens2Inspire",
    short_name: "Teens2Inspire",
    description: "Inspiring Jewish teen girls.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#111012",
    theme_color: "#111012",
    icons: [
      { src: "/pwa-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
