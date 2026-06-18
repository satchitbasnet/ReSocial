# ReSocial

**Post once, reach everywhere.** ReSocial is an automated content repurposing and distribution platform — upload your videos once and distribute them to TikTok, YouTube, Instagram, Facebook, LinkedIn, X, Pinterest, and Snapchat.

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
- **PostgreSQL** (Neon) + **Drizzle ORM**
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
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `AUTH_SECRET` | Random 32+ character secret for JWT signing |
| `NEXT_PUBLIC_APP_URL` | App URL (e.g. `http://localhost:3000`) |

Generate an auth secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Set up the database

```bash
npm run db:push
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
