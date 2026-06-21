<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Supabase Database Standard Operating Procedure (SOP)

For **ANY** database operation, schema modification, or data manipulation, you **MUST** follow this proactive SOP workflow exclusively to avoid conflicts and authentication errors.

## Step 1: Create Migration
Generate a new migration file for your changes:
`npx supabase migration new <name>`
*Proactive Note:* This command creates the file instantly but may hang in the background. **Do NOT wait indefinitely** for the process to exit. Verify the file exists in `supabase/migrations/` and proceed.

## Step 2: Write SQL
Open the newly generated migration file and write your SQL queries (CREATE, ALTER, DROP, etc.).

## Step 3: Proactive Push
Push the migration to the remote database. You do NOT need to run `supabase link`. By providing the project ID natively, the CLI works entirely stateless (like in CI/CD). To avoid the CLI silently failing to read `.env.local`, you **MUST** explicitly inject the credentials into the environment dynamically:
`$env:SUPABASE_DB_PASSWORD=(Get-Content .env.local | ConvertFrom-StringData).SUPABASE_DB_PASSWORD.Trim('"'); $env:SUPABASE_PROJECT_ID=(Get-Content .env.local | ConvertFrom-StringData).SUPABASE_PROJECT_ID.Trim('"'); npx supabase db push`
