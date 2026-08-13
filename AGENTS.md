<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# PillOps — agent resume guide

Indian pharmacy inventory & POS: stock, purchase invoices (OCR + manual), sales, expiry, reports, multi-store admin.

**Read `README.md` key paths first.** Do not broad-scan the repo. Ignore `scripts/archive/`, `supabase/.temp/`, and `package-lock.json`. Never read all migration files unless you are doing schema work.

Remote: `https://github.com/rtsjsi/PillOps.git` (default branch `main`).

---

## Product, stack, deploy, DB

| Layer | What it is |
|-------|------------|
| App | Next.js 16 App Router, React 19, Tailwind 4 (`src/app/globals.css` tokens; shadcn-style UI under `src/components/ui`) |
| Auth + data | Supabase Auth + Postgres + RLS. Cloud project ref `pnjfoilzdneemgkkywoo` (URL already in `wrangler.jsonc`) |
| Hosting | Cloudflare Workers via OpenNext (`open-next.config.ts`, `wrangler.jsonc`, worker name `pillops`) |
| OCR | Groq vision default (`meta-llama/llama-4-scout-17b-16e-instruct`), Gemini + OpenRouter fallbacks, client-side Tesseract (“offline”) |
| Package manager | npm (`package-lock.json`) |

There is **no local database**. All durable data lives in cloud Supabase. CI (`.github/workflows/deploy-db.yml`) pushes migrations on `main` using GitHub secrets `SUPABASE_PROJECT_ID`, `SUPABASE_DB_PASSWORD`, `SUPABASE_ACCESS_TOKEN`.

App deploy is **not** in GitHub Actions. Build with `npm run build:cloudflare`, then deploy the OpenNext worker (Wrangler / Cloudflare dashboard). Cloudflare must have `GROQ_API_KEY`, optional `GEMINI_API_KEY` / `OPENROUTER_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and the `NEXT_PUBLIC_SUPABASE_*` values (public pair is also in `wrangler.jsonc` `vars`).

---

## Auth, tenancy, roles, how to sign in

**Sign in:** `/login` — Supabase `signInWithPassword` (email + password). No self-signup in the UI. `/` redirects to `/login`. There are **no demo credentials in the repo**; use an existing store user or create one in Super Admin / Staff (service role).

**Session:** cookie-based Supabase SSR (`src/middleware.ts`, `src/utils/supabase/server.ts`). Middleware redirects unauthenticated users to `/login` for some routes only (see traps).

**Tenancy:** `stores` rows. Each non-admin user has `user_profiles.store_id`. RLS scopes store data. Super Admin has no home store; they pick one in the top bar, stored as cookie `pillops_selected_store_id`. Server mutations that need a store (`src/app/actions.ts` `getStoreId`) **throw** if Super Admin has not selected a pharmacy.

**Roles** (`user_profiles.role`):

| Role | Nav extras | Typical powers |
|------|------------|----------------|
| `staff` | Reports | Day-to-day inventory / POS / purchases |
| `owner` | Reports, Staff, Settings | Store settings, staff for their store |
| `super_admin` | Super Admin (`/admin`), Staff, Settings, Reports | All stores, global medicine master, create stores/users |

Login clears `pillops_selected_store_id` and the client profile cache.

---

## Directory map

| Area | Path |
|------|------|
| Pages (App Router) | `src/app/` |
| Invoice OCR UI | `src/app/purchases/scan/page.tsx` |
| Invoice OCR API | `src/app/api/extract-invoice/route.ts` |
| Purchase review / save | `src/app/purchases/review/page.tsx` → RPC `save_purchase_invoice` |
| Manual purchase | `src/app/purchases/manual/page.tsx` |
| POS / sales | `src/app/pos/`, `src/components/pos/` → RPCs `save_sales_invoice` / `update_sales_invoice` |
| Inventory list | `src/app/inventory/page.tsx` → RPC `get_inventory_list` |
| Medicine directory (global catalog) | `src/app/medicines/` |
| Expiry | `src/app/expiry/` → RPC `get_expiring_batches` |
| Reports hub | `src/app/reports/` |
| Super Admin | `src/app/admin/` + `src/app/api/admin/route.ts` |
| Staff | `src/app/staff/page.tsx` + `src/app/api/staff/route.ts` |
| Nav + role filter | `src/lib/nav-config.ts` |
| Client reads (RLS, browser) | `src/lib/queries.ts` — **reads only** |
| Server mutations | `src/app/actions.ts`, `src/app/admin/actions.ts`, `src/app/medicines/actions.ts` |
| Admin (service role) client | `src/utils/supabase/admin.ts` |
| Browser / server Supabase | `src/utils/supabase/client.ts`, `src/utils/supabase/server.ts` |
| OCR models / prompts | `src/lib/ai-server.ts` |
| Offline text parser | `src/lib/invoice-text-parser.ts` |
| Schema | `supabase/migrations/` (plain SQL; not Drizzle runtime) |
| Seed (manufacturers) | migration `20260620000002_seed_indian_manufacturers.sql` — no `npm run seed` |
| One-off DB scripts | `scripts/` (active) and `scripts/archive/` (already-run; do not read unless asked) |
| Agent rules | this file; `CLAUDE.md` only `@AGENTS.md`; Cursor: `.cursor/rules/project-context.mdc` |

**Core tables (names you will see):** `stores`, `user_profiles`, `global_medicine_master`, `store_inventory`, `store_inventory_batches`, `purchase_invoices`, `sales_invoices`. Shared catalog vs per-store stock is the main split.

---

## Hard domain rules — never reintroduce

1. **Cloudflare Worker CPU:** browser reads go through anon key + RLS (`queries.ts`). Do not move list/browse queries onto the Worker. Mutations stay server actions / RPCs.
2. **Vision models:** only Groq models that accept images. Text-only Groq models return **404** with images. Do not add them to `GROQ_OCR_MODELS`.
3. **OCR spend:** do not call live vision APIs while exploring. Prefer the scan page **Offline OCR** path (Tesseract) for local tests.
4. **Inventory UI:** do not put back the bulky summary strip or category chips on `/inventory` (removed for perf). `fetchInventorySummary` / `get_inventory_summary` still exist but the list page does not use them.
5. **POS shortcuts:** do not put back the F2 keyboard shortcut.
6. **Route templates:** `src/app/template.tsx` must **not** use `key={pathname}` — that remounts forms and wipes in-progress invoices.
7. **Staff emails:** `/api/staff` loads emails with `auth.admin.getUserById` per profile. Do **not** switch it back to `auth.admin.listUsers()` (that 500s when the user list is large). `getStoreStaff` in `actions.ts` still uses `listUsers` and is unused by the staff page — do not wire the page to that helper.
8. **Pack / sale qty:** `units_per_pack` on the global master; syrups/injections/ointments/drops/inhalers are not split (`src/lib/pack-size.ts`).
9. **Secrets:** never commit `.env.local`, `.dev.vars`, service role, DB password, or API tokens. `.env.example` is the tracked template.
10. **Do not “fix” migration filenames** (e.g. `0000_slim_morbius.sql` is a leftover Drizzle-era name; renaming breaks `supabase migration repair` / history).

---

## Commands

```bash
npm install
cp .env.example .env.local   # then restore real secrets (see Resume)
npm run dev                  # Next.js local
npm run lint
npm run build                # Next.js production build (not what Cloudflare uses)
npm run build:cloudflare     # OpenNext worker build
npm run preview              # OpenNext build + wrangler preview (needs .dev.vars)
```

**Migrations / seed / secrets** — follow the Supabase SOP below. There is no npm seed or npm deploy script.

Active CLI utilities (`npx tsx scripts/<name>.ts`, needs `DATABASE_URL` in `.env.local`):

| Script | Purpose |
|--------|---------|
| `enrich_manufacturers.ts` | AI-enrich manufacturer data |
| `get_enum.ts` | Inspect `medicine_category` enum |
| `get_random_enrichment.ts` | Sample medicines needing enrichment |
| `enrich_in_stock_medicines.ts` | Backfill in-stock pack/manufacturer |
| `check_stock_enrichment.ts` | Stats on missing enrichment |
| `test-openrouter-invoice.ts` / `test-qwen-invoice.ts` | One-off OCR probes (burns API credits) |

---

## Known inconsistencies / traps

- **Middleware matcher is incomplete.** Protected in middleware: `/dashboard`, `/inventory`, `/pos`, `/purchases`, `/invoice`, `/admin`, `/profile`, `/settings`, `/staff`. **Not** in the matcher: `/medicines`, `/expiry`, `/reports` (and `/api/*`). Those pages still need a session for data (RLS), but the layout shell can render without a redirect.
- **`queries.ts` uses the browser client.** Importing `fetchUserProfile` from a Route Handler (`extract-invoice`) does not see `document.cookie`; Super Admin store context for OCR can be empty on the server.
- **`.env.example` vs local ops keys.** Local `.env.local` also has `DATABASE_URL`, `SUPABASE_DB_PASSWORD`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_ID`, `CLOUDFLARE_API_TOKEN` (needed for CLI migrate / optional Wrangler). Restore the full file, not only the OCR keys.
- **Pooler port:** `DATABASE_URL` must use session pooler **5432**. Port **6543** (transaction pooler) breaks `supabase db push` / `migration repair` (`SQLSTATE 42P05`).
- **OpenNext caches are dummy** (`incrementalCache` / `tagCache` / `queue` in `open-next.config.ts`). Do not assume ISR or tag revalidation on Cloudflare.
- **`getAllUsers` / `listUsers` in admin** can fail or truncate on large auth user lists; staff listing was already moved to per-id fetch.
- **Medicine directory** inlines its own `useDebounce` instead of `@/hooks/use-debounce`. Harmless; do not “clean” unless you are already in that file.
- **Next.js 16** APIs differ from older training data — read `node_modules/next/dist/docs/` before using new Next APIs.

---

## Context-saving rules

1. **Minimize scope** — only open files relevant to the task; never read all migrations.
2. **No AI calls in exploration** — understand code before suggesting API/model changes.
3. **Prefer offline OCR** when testing scan flow without burning API credits.
4. **DB changes** — follow the Supabase SOP below only when schema changes are needed.

---

## Supabase Database SOP

For **ANY** database operation, schema modification, or data manipulation, follow this workflow:

### Step 1: Create Migration
`npx supabase migration new <name>`
*Note:* May hang in background. Verify file exists in `supabase/migrations/` and proceed.

### Step 2: Write SQL
Edit the new migration file (CREATE, ALTER, DROP, etc.).

### Step 3: Push
Prefer `DATABASE_URL` from `.env.local` with the **session pooler** port **5432** (not transaction pooler **6543**) — `db push` / `migration repair` fail on `:6543` with prepared-statement errors (`SQLSTATE 42P05`).

```powershell
$dbUrl = (Get-Content .env.local | ConvertFrom-StringData).DATABASE_URL.Trim('"')
$directUrl = $dbUrl -replace ':6543/', ':5432/'
npx supabase db push --db-url $directUrl --yes
```

Fallback (linked project + password env vars):

`$env:SUPABASE_DB_PASSWORD=(Get-Content .env.local | ConvertFrom-StringData).SUPABASE_DB_PASSWORD.Trim('"'); $env:SUPABASE_PROJECT_ID=(Get-Content .env.local | ConvertFrom-StringData).SUPABASE_PROJECT_ID.Trim('"'); npx supabase db push`

Pushing `main` also runs `.github/workflows/deploy-db.yml` (link + `migration repair` of `0000` + `db push`). Do not duplicate that repair against a DB that already has a different history without checking `supabase_migrations.schema_migrations`.

---

## Resume a machine

Secrets are **not** in git. This repo does not record where you stored `.env.local`. **Ask the human** if the restore location is unknown (Google Drive, password manager, USB, etc.). Do not invent a backup.

After you clone again:

1. Restore **`.env.local`** from wherever it was copied (required). Also restore **`.dev.vars`** if you use `npm run preview` / Wrangler locally (same secret kinds, Cloudflare-local file).
2. If those files are missing, copy `.env.example` → `.env.local` and fill keys from Supabase + Groq/Gemini/OpenRouter + Cloudflare dashboards. You still need `DATABASE_URL` (port 5432) for migrations.
3. `npm install`
4. `npm run dev`

Do not commit `.env.local` or `.dev.vars`. You do not need `node_modules`, `.next`, `.open-next`, or `.wrangler` from the old disk.
