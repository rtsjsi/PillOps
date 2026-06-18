import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  serverExternalPackages: ['@google/generative-ai', 'openai', 'groq-sdk'],
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
};

export default nextConfig;
