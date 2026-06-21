# ReSocial

**Post Once, Reach Everywhere.** ReSocial is an automated content repurposing and distribution platform — upload your videos once and distribute them to TikTok, YouTube, Instagram, Facebook, X, Pinterest, and Snapchat.

Inspired by [Repurpose.io](https://repurpose.io), built as a full-stack Next.js application.

## Features

- **Marketing site** — Landing pages for creators, businesses, and agencies with pricing
- **User authentication** — Sign up, login, 14-day free trial (10 videos)
- **Multi-platform upload** — Upload video/image and publish to multiple platforms at once
- **Connected accounts** — Connect social media accounts per platform
- **Post history** — Track distribution status across all platforms
- **Subscription tiers** — Starter, Pro, and Agency plans

## Tech Stack

- **Next.js 15** (App Router, Server Actions)
- **TypeScript** + **Tailwind CSS 4**
- **PostgreSQL** (Supabase) + **Drizzle ORM**
- **JWT auth** with httpOnly cookies

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

Generate an auth secret:

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
│   └── api/                  # API routes
├── components/
│   ├── layout/               # Navbar, footer
│   ├── marketing/            # Landing page sections
│   ├── dashboard/            # Dashboard sidebar
│   └── ui/                   # Shared UI components
└── lib/
    ├── db/                   # Drizzle schema & client
    ├── auth.ts               # Session management
    ├── constants.ts          # Platforms, plans, features
    └── platforms/            # Platform publisher logic
```

## Deployment (Render)

1. Create a Neon PostgreSQL database
2. Set environment variables on Render
3. Build command: `npm run build`
4. Start command: `npm start`
5. Run `npm run db:push` once to create tables

> **Note:** Render's filesystem is ephemeral. For production, replace local file uploads with cloud storage (S3, Vercel Blob, etc.).

## Platform Integrations

The MVP includes a publisher abstraction layer. Each platform currently simulates publishing for demo purposes. To enable real OAuth publishing:

1. Register apps with each platform's developer portal
2. Add OAuth client IDs/secrets to `.env.local`
3. Implement OAuth callback routes
4. Replace simulated `publishToPlatform()` with real API calls

## License

MIT
