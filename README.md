# PillOps — Pharmacy inventory & POS (Next.js 16 + Supabase + Cloudflare)

Indian pharmacy management app: inventory, purchases (invoice OCR), POS, reports.

## Stack

- **Frontend:** Next.js 16 App Router, React 19, Tailwind 4
- **Backend:** Supabase (Postgres + Auth + RLS)
- **Deploy:** Cloudflare via OpenNext (`npm run build:cloudflare`)
- **AI/OCR:** Groq vision (`meta-llama/llama-4-scout-17b-16e-instruct`), optional Gemini + OpenRouter fallbacks, offline Tesseract

## Setup

```bash
npm install
cp .env.example .env.local   # fill in Supabase + GROQ_API_KEY
npm run dev
```

## Key paths (for agents — read these first, avoid broad repo scans)

| Area | Path |
|------|------|
| Invoice OCR scan UI | `src/app/purchases/scan/page.tsx` |
| Invoice OCR API | `src/app/api/extract-invoice/route.ts` |
| AI models & prompts | `src/lib/ai-server.ts` |
| Offline text parser | `src/lib/invoice-text-parser.ts` |
| Purchase review/save | `src/app/purchases/review/page.tsx` |
| DB queries | `src/lib/queries.ts` |
| Migrations | `supabase/migrations/` |
| Agent rules | `AGENTS.md` |

## Deploy (Cloudflare)

Build command: `npm run build:cloudflare`

Set `GROQ_API_KEY`, `GEMINI_API_KEY` and/or `OPENROUTER_API_KEY` (optional fallbacks), and Supabase vars in Cloudflare dashboard.

## Scripts

See `scripts/README.md`. Active utilities only; one-off DB scripts are in `scripts/archive/`.
