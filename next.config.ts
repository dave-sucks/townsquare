import path from "node:path";
import type { NextConfig } from "next";

const devOrigins: string[] = [];
if (process.env.REPLIT_DEV_DOMAIN) {
  devOrigins.push(process.env.REPLIT_DEV_DOMAIN);
}

const nextConfig: NextConfig = {
  allowedDevOrigins: devOrigins,
  // This directory is the root: a checkout nested in another (a git
  // worktree) would otherwise build against the outer one's files.
  turbopack: { root: path.resolve(__dirname) },
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        poll: false,
        aggregateTimeout: 2000,
        ignored: [
          "**/node_modules/**",
          "**/.git/**",
          "**/.next/**",
          "**/.local/**",
          "**/cache/**",
          "**/.replit/**",
          "**/generated/**",
        ],
      };
    }
    return config;
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
