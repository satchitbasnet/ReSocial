# ReSocial

**Post Once, Reach Everywhere.** ReSocial is an automated content distribution platform — upload once and publish to TikTok, YouTube, Instagram, Facebook, X, and more.

## Features

- **Marketing site** — Landing pages for creators, businesses, and agencies with pricing
- **User authentication** — Sign up, login, 14-day free trial
- **Multi-platform upload** — Upload video/image and publish to multiple platforms at once
- **Real OAuth publishing** — TikTok, YouTube, Instagram, Facebook, and X (Twitter)
- **Scheduling** — Cron-driven scheduled publishing (every 5 minutes on Render)
- **Inbox sync** — Hourly comment sync for connected accounts
- **Repurpose workflows** — Poll sources every 15 minutes for new content to redistribute
- **Stripe billing** — Starter, Pro, and Agency plans with usage metering
- **Cloudflare R2** — Media storage (with Vercel Blob as an alternative)
- **AI captions** — Optional OpenAI caption suggestions on upload (falls back to templates)

## Tech Stack

- **Next.js 15** (App Router)
- **TypeScript** + **Tailwind CSS 4**
- **PostgreSQL** (Supabase) + **Drizzle ORM**
- **JWT auth** with httpOnly cookies
- **Stripe** for subscriptions
- **Cloudflare R2** / Vercel Blob for media
- **Resend** for scheduled email reports

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Required variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Supabase **transaction pooler** URI (port 6543, `?pgbouncer=true`) |
| `DIRECT_DATABASE_URL` | Supabase **direct** URI (port 5432) — for `npm run db:push` only |
| `AUTH_SECRET` | Random 32+ character secret for JWT signing |
| `NEXT_PUBLIC_APP_URL` | App URL (e.g. `http://localhost:3000`) |
| `CRON_SECRET` | Bearer token for `/api/cron/*` and report cron routes |

Platform OAuth, Stripe, R2, and optional `OPENAI_API_KEY` are documented in `.env.example`.

Generate secrets:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Set up Supabase database

1. Create a project at [supabase.com](https://supabase.com).
2. In **Project Settings → Database**, copy:
   - **Transaction pooler** URI → `DATABASE_URL` (port **6543**, add `?pgbouncer=true`)
   - **Direct connection** URI → `DIRECT_DATABASE_URL` (port **5432**)
3. Push the Drizzle schema:

```bash
npm run db:push
```

Alternatively, apply SQL migrations via Supabase CLI:

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
src/
├── app/
│   ├── page.tsx              # Home / marketing
│   ├── creators/             # Content creators landing
│   ├── business/             # Small business landing
│   ├── agency/               # Agency landing
│   ├── pricing/              # Pricing page
│   ├── login/ & signup/      # Auth pages
│   ├── dashboard/            # App dashboard
│   └── api/                  # API routes (OAuth, cron, Stripe, upload, …)
├── components/
│   ├── layout/               # Navbar, footer
│   ├── marketing/            # Landing page sections
│   ├── dashboard/            # Dashboard UI
│   └── ui/                   # Shared UI components
└── lib/
    ├── db/                   # Drizzle schema & client
    ├── auth.ts               # Session management
    ├── constants.ts          # Platforms, plans, features
    ├── platforms/            # Real + simulated platform publishers
    ├── ai/                   # Caption generation
    └── repurpose/            # Source polling workflows
```

## Deployment (Render)

`render.yaml` defines:

- **Web service** `resocial` (binds `0.0.0.0:$PORT` via `npm start`)
- **Cron jobs** that `curl` the app with `Authorization: Bearer $CRON_SECRET`:
  - `*/5 * * * *` → `/api/cron/publish-scheduled`
  - `*/15 * * * *` → `/api/cron/repurpose-sources`
  - hourly → `/api/cron/inbox-sync`
  - daily 06:00 UTC → `/api/cron/usage-reset`
  - daily 08:00 UTC → `/api/reports/send`

Shared `CRON_SECRET` lives in the `resocial-cron` env group. Set `NEXT_PUBLIC_APP_URL` on the web service to your public Render URL so cron jobs can reach it.

> **Note:** Render's filesystem is ephemeral. Use Cloudflare R2 (or Vercel Blob) for media — do not rely on local `/uploads`.

## Platform Integrations

| Platform | Status |
|----------|--------|
| TikTok | Real OAuth + Content Posting API |
| YouTube | Real OAuth + upload |
| Instagram | Real OAuth + publish |
| Facebook | Real OAuth (Pages) + publish |
| X (Twitter) | Real OAuth 2.0 PKCE + media upload + tweets |
| Pinterest | Simulated (demo connect) |
| Snapchat | Simulated (demo connect) |

To enable a real integration: register the app in the platform developer portal, set redirect URI to `{NEXT_PUBLIC_APP_URL}/api/auth/callback/{platform}`, and add client credentials from `.env.example`.

## License

MIT
