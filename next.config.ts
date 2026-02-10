import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*"],
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
