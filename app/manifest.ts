import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Shopi Admin",
    short_name: "Shopi Admin",
    description: "Review Shopi listings and manage the marketplace.",
    start_url: "/posts?tab=pending",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    background_color: "#ffffff",
    theme_color: "#e80063",
    orientation: "any",
    icons: [
      { src: "/icons/shopi-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/shopi-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
