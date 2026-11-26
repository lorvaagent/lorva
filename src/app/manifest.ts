import type { MetadataRoute } from "next";
import { BRAND } from "@/config/brand";

// Install metadata with the placeholder tile (dark ground, readable on light and dark home screens).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${BRAND.name}: ${BRAND.slogan.replace(/\.$/, "")}`,
    short_name: BRAND.name,
    description: `Trading agents with your rules and limits, tested and monitored, on ${BRAND.chainName}.`,
    start_url: "/",
    display: "standalone",
    background_color: "#f4f4f4",
    theme_color: "#f4f4f4",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
