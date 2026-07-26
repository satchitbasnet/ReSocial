# ReSocial

**Post once, reach everywhere.** ReSocial is an automated content repurposing and distribution platform — upload once, then publish (or schedule) to the social accounts you connect.

## What’s real today

| Area | Status |
|------|--------|
| **TikTok** | Real OAuth + Content Posting API |
| **YouTube** | Real OAuth + upload |
| **Instagram** | Real OAuth (Instagram Login) + Reels / photos / carousels |
| **Facebook** | Real OAuth + Page posts / photos / video |
| **X (Twitter)** | OAuth + publish code present; **on hold** until you add paid API credentials |
| **Stripe** | Checkout + portal for Starter / Pro / Agency |
| **Media storage** | Cloudflare R2 (preferred) or Vercel Blob fallback |
| **Scheduling** | Cron-driven (`publish-scheduled`); frequent runs via GitHub Actions on Vercel Hobby |
| **Repurpose workflows** | Source polling (IG / YT / FB / TikTok) + redistribute |
| **Inbox** | Comments / DMs / mentions sync + replies |
| **Analytics** | Dashboard, post metrics, best-time insights (plan-gated) |
| **Team / approvals** | Invites + approval queue |
| **AI captions** | Suggest caption on Upload (Gemini if `GEMINI_API_KEY` set; else templates) |

## Features (product)

- Marketing site (home, creators, business, agency, pricing)
- Auth with 14-day trial signup
- Upload & multi-platform distribute (video + images)
- Connected accounts (OAuth for major platforms)
- Calendar, history, workflows, listening, benchmarking, reports
- Affiliate + team settings

## Tech stack

- **Next.js 15** (App Router)
- **TypeScript** + **Tailwind CSS 4**
- **PostgreSQL** ([Supabase](https://supabase.com)) + **Drizzle ORM**
- **JWT** sessions (httpOnly cookies)
- **Vercel** production hosting (optional Render blueprint in `render.yaml`)

## Getting started

### 1. Install

```bash
npm install
```

### 2. Environment

```bash
cp .env.example .env.local
```

Minimum for local auth + DB:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Supabase **transaction pooler** (port **6543**, `?pgbouncer=true`) |
| `DIRECT_DATABASE_URL` | Supabase **session/direct** URI (port **5432**) — migrations only |
| `AUTH_SECRET` | Random 32+ character secret |
| `NEXT_PUBLIC_URL` / `NEXT_PUBLIC_APP_URL` | e.g. `http://localhost:3000` |

Generate a secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

For real publishing, also set the platform OAuth vars and storage tokens documented in `.env.example` (`TIKTOK_*`, `YOUTUBE_*`, `INSTAGRAM_*`, `FACEBOOK_*`, R2 or `BLOB_READ_WRITE_TOKEN`, `STRIPE_*`, `CRON_SECRET`, etc.).

**Instagram:** use the **Instagram App ID + Secret** from Meta → Instagram → API setup with Instagram login — not the main Facebook App ID.

### 3. Database (Supabase)

1. Create a project at [supabase.com](https://supabase.com).
2. Copy pooler + direct connection strings into `.env.local`.
3. Push schema:

```bash
npm run db:push
```

Or apply SQL via Supabase CLI:

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

### 4. Dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project structure

```
src/
├── app/
│   ├── page.tsx                 # Marketing home
│   ├── creators|business|agency # Segment landings
│   ├── login/ & signup/
│   ├── dashboard/               # Product UI
│   └── api/                     # Auth, connect, cron, publish, …
├── components/
│   ├── marketing/               # Landing sections (viewfinder design)
│   ├── dashboard/
│   └── ui/
└── lib/
    ├── db/                      # Drizzle schema
    ├── platforms/               # OAuth + publishers
    ├── repurpose/               # Workflow source polling
    ├── inbox/ analytics/ …
    └── cron-auth.ts
```

## Deployment (Vercel)

Primary production target: **Vercel**.

1. Link the repo / deploy the project.
2. Set the same env vars as `.env.example` (Production).
3. `DATABASE_URL` must be your **Supabase** pooler URI.
4. OAuth redirect URIs must use your production host, e.g.  
   `https://your-domain/api/auth/callback/instagram`

### Cron jobs

Route handlers live under `/api/cron/*` and `/api/reports/send`. They expect:

```http
Authorization: Bearer $CRON_SECRET
```

- **Vercel Hobby** only allows **daily** native crons (`vercel.json`).
- **Frequent** jobs (publish every ~5 min, inbox hourly, repurpose every ~15 min) use **GitHub Actions** (`.github/workflows/cron-jobs.yml`).  
  Repo secrets: `CRON_SECRET`, `APP_URL` (e.g. `https://re-social.vercel.app`).
- Optional: Render cron services in `render.yaml` can curl the same URLs.
- Manual test: `node scripts/trigger-cron.mjs publish-scheduled`

## Platform OAuth redirect URIs

Register these exactly (no trailing slash), swapping in your app URL:

| Platform | Redirect URI |
|----------|----------------|
| TikTok | `{APP}/api/auth/callback/tiktok` |
| YouTube | `{APP}/api/auth/callback/youtube` |
| Instagram | `{APP}/api/auth/callback/instagram` |
| Facebook | `{APP}/api/auth/callback/facebook` |
| X (when enabled) | `{APP}/api/auth/callback/twitter` |

## License

MIT
