import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  serverExternalPackages: ['@google/generative-ai', 'openai'],
  experimental: {
    optimizePackageImports: ['lucide-react'],
    serverActions: {
      allowedOrigins: [
        'localhost:3000',
        'localhost:8080',
        '*.github.dev',
        '*.app.github.dev',
        '*.preview.app.github.dev',
        '*.codespaces.githubusercontent.com',
        '*.trycloudflare.com',
        '*.tunnel.cloud',
        '*.gemini.local',
        '*.localhost',
        '*.pages.dev'
      ]
    }
  },
};

export default nextConfig;
