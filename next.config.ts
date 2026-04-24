import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  serverComponentsExternalPackages: ['@google/generative-ai', 'openai', 'groq-sdk'],
};


export default nextConfig;
