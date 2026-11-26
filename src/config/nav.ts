import { BRAND } from "@/config/brand";

export const NAV = [
  { href: "/room", label: "Control room" },
  { href: "/build", label: "Build" },
  { href: "/method", label: "Method" },
  { href: "/token", label: BRAND.symbol },
] as const;

/** Every public route, for the sitemap. */
export const ROUTES = ["/", "/room", "/build", "/method", "/token"] as const;
