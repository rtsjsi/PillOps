# Scripts

## Active (reusable)

| Script | Purpose |
|--------|---------|
| `enrich_manufacturers.ts` | AI-enrich manufacturer data via `src/lib/ai-server.ts` |
| `get_enum.ts` | Inspect `medicine_category` enum values |
| `get_random_enrichment.ts` | Sample medicines needing enrichment |

Run with: `npx tsx scripts/<name>.ts` (requires `.env.local` with `DATABASE_URL`).

## Archive (`archive/`)

One-off data cleanup/import scripts already run against production. **Agents should not read these** unless explicitly asked — they bloat context and are not part of the runtime app.
