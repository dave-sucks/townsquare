import type { NextConfig } from "next";

const devOrigins: string[] = [];
if (process.env.REPLIT_DEV_DOMAIN) {
  devOrigins.push(process.env.REPLIT_DEV_DOMAIN);
}

const nextConfig: NextConfig = {
  allowedDevOrigins: devOrigins,
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
