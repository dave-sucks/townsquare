import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["https://ce1feebc-3522-48c6-a6d6-07a05a691343-00-1j0yawfde98j3.janeway.replit.dev"],
  env: {
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
    localPatterns: [
      {
        pathname: "/api/places/photo/**",
        search: "?*",
      },
    ],
  },
};

export default nextConfig;
