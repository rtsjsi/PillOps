<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# PillOps agent guide

**Read `README.md` key paths first.** Do not broad-scan the repo. Ignore `scripts/archive/`, `supabase/.temp/`, and `package-lock.json`.

## App map

- **Purchases / invoice OCR:** `src/app/purchases/scan` → `src/app/api/extract-invoice` → `src/app/purchases/review` → `save_purchase_invoice` RPC
- **AI config:** `src/lib/ai-server.ts` (Groq Scout default, Gemini fallback, offline Tesseract on client)
- **Inventory / POS / sales:** `src/app/inventory`, `src/app/pos`, `src/lib/queries.ts`
- **Auth middleware:** `src/middleware.ts` (cookie-based Supabase session guard)
- **Deploy:** Cloudflare OpenNext — `npm run build:cloudflare`, config in `open-next.config.ts` + `wrangler.jsonc`

## Context-saving rules

1. **Minimize scope** — only open files relevant to the task; never read all migrations.
2. **No AI calls in exploration** — understand code before suggesting API/model changes.
3. **Prefer offline OCR path** when testing scan flow without burning API credits.
4. **DB changes** — follow Supabase SOP below only when schema changes are needed.

## Supabase Database SOP

For **ANY** database operation, schema modification, or data manipulation, follow this workflow:

### Step 1: Create Migration
`npx supabase migration new <name>`
*Note:* May hang in background. Verify file exists in `supabase/migrations/` and proceed.

### Step 2: Write SQL
Edit the new migration file (CREATE, ALTER, DROP, etc.).

### Step 3: Push
`$env:SUPABASE_DB_PASSWORD=(Get-Content .env.local | ConvertFrom-StringData).SUPABASE_DB_PASSWORD.Trim('"'); $env:SUPABASE_PROJECT_ID=(Get-Content .env.local | ConvertFrom-StringData).SUPABASE_PROJECT_ID.Trim('"'); npx supabase db push`
