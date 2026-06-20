# Supabase database setup

ReSocial uses **Supabase as hosted PostgreSQL only** (custom JWT auth, not Supabase Auth).

## Recommended: Drizzle push

1. Create a Supabase project.
2. Copy connection strings from **Project Settings → Database**:
   - **Transaction pooler** (6543) → `DATABASE_URL` in `.env.local`
   - **Direct** (5432) → `DIRECT_DATABASE_URL` in `.env.local`
3. Run:

```bash
npm run db:push
```

This syncs `src/lib/db/schema.ts` to your Supabase database.

## Optional: Supabase CLI migrations

The SQL files in `migrations/` are legacy snapshots. Prefer `db:push` for the full schema.

To use the CLI:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

## Connection strings

| Variable | Use | Port |
|----------|-----|------|
| `DATABASE_URL` | App runtime (Next.js, Render) | 6543 (pooler) |
| `DIRECT_DATABASE_URL` | Migrations / `db:push` | 5432 (direct) |

Always append `?pgbouncer=true` to the pooler URI for serverless.
