import type { MetadataRoute } from "next";

// Lets the team add the site to a phone's home screen, for use at the door.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Paper Fox bookings",
    short_name: "Paper Fox",
    description: "Book Paper Fox crafting weekends and manage bookings.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#93ded0",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
