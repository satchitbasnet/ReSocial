#!/usr/bin/env node
/**
 * Push non-empty vars from .env.local to Vercel (production, preview, development).
 * Usage: node scripts/push-vercel-env.mjs
 */
import { readFileSync } from "fs";
import { spawnSync } from "child_process";

const raw = readFileSync(".env.local", "utf8");
const vars = {};

for (const line of raw.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  const value = trimmed.slice(eq + 1).trim();
  if (!value) continue;
  vars[key] = value;
}

const targets = ["production", "preview", "development"];
let added = 0;

for (const [key, value] of Object.entries(vars)) {
  for (const target of targets) {
    const result = spawnSync(
      "npx",
      ["vercel", "env", "add", key, target, "--force"],
      {
        input: value,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
        shell: true,
      }
    );
    if (result.status !== 0) {
      console.error(`Failed ${key} (${target}):`, result.stderr?.trim());
      process.exitCode = 1;
    } else {
      added++;
    }
  }
}

console.log(`Synced ${Object.keys(vars).length} keys (${added} env entries).`);
