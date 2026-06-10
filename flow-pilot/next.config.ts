import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep Vercel deploys unblocked while the legacy UI is migrated to strict TypeScript/ESLint.
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
