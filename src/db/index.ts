import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
const connectionString = process.env.DATABASE_URL || "postgres://localhost:5432/placeholder";

if (!process.env.DATABASE_URL) {
  console.warn('Warning: DATABASE_URL is not defined. Using placeholder for build-time safety.');
}

// Disable prefetch as it is not supported for "Transaction" pool mode
const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, { schema });

// --- Environment Validation ---
const requiredEnv = [
  'DATABASE_URL',
  'GEMINI_API_KEY',
  'GROQ_API_KEY',
  // GITHUB_TOKEN is used for OpenAI fallback in this app
  'GITHUB_TOKEN', 
];

// We only throw in production or dev, not during build time (Next.js build phase)
if (process.env.NODE_ENV !== 'test' && !process.env.NEXT_PHASE) {
  for (const env of requiredEnv) {
    if (!process.env[env]) {
      console.error(`❌ Critical Error: Missing environment variable: ${env}`);
      if (process.env.NODE_ENV === 'production') {
        throw new Error(`Missing environment variable: ${env}`);
      }
    }
  }
}

