#!/usr/bin/env node
/**
 * Manually trigger a production cron route.
 * Usage: node scripts/trigger-cron.mjs publish-scheduled
 * Env: CRON_SECRET, APP_URL (default https://re-social.vercel.app)
 */
import { readFileSync, existsSync } from "fs";

function loadEnvLocal() {
  if (!existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    const key = m[1].trim();
    const val = m[2].trim().replace(/^"|"$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

const jobs = {
  "publish-scheduled": "/api/cron/publish-scheduled",
  "inbox-sync": "/api/cron/inbox-sync",
  "repurpose-sources": "/api/cron/repurpose-sources",
  "usage-reset": "/api/cron/usage-reset",
  "reports-send": "/api/reports/send",
};

const job = process.argv[2];
const path = jobs[job];
if (!path) {
  console.error("Usage: node scripts/trigger-cron.mjs <job>");
  console.error("Jobs:", Object.keys(jobs).join(", "));
  process.exit(1);
}

const secret = process.env.CRON_SECRET;
const base = (process.env.APP_URL || process.env.NEXT_PUBLIC_URL || "https://re-social.vercel.app").replace(/\/$/, "");
if (!secret) {
  console.error("CRON_SECRET is required");
  process.exit(1);
}

const url = `${base}${path}`;
const res = await fetch(url, {
  headers: { Authorization: `Bearer ${secret}` },
});
const text = await res.text();
console.log(res.status, text);
process.exit(res.ok ? 0 : 1);
