#!/usr/bin/env node
import { readFileSync } from "fs";
import { spawnSync } from "child_process";

const keys = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "R2_PUBLIC_URL",
];

const vars = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  let value = trimmed.slice(eq + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  if (keys.includes(key) && value) vars[key] = value;
}

const missing = keys.filter((k) => !vars[k]);
if (missing.length) {
  console.error("Missing in .env.local:", missing.join(", "));
  process.exit(1);
}

const targets = ["production", "preview", "development"];
let ok = 0;
let fail = 0;

for (const key of keys) {
  for (const target of targets) {
    const result = spawnSync(
      "npx",
      ["vercel", "env", "add", key, target, "--force"],
      {
        input: vars[key],
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
        shell: true,
      }
    );
    if (result.status === 0) {
      ok++;
      console.log(`OK ${key} (${target})`);
    } else {
      fail++;
      console.error(
        `FAIL ${key} (${target}):`,
        result.stderr?.trim() || result.stdout?.trim()
      );
    }
  }
}

console.log(`Done: ${ok} set, ${fail} failed`);
process.exit(fail ? 1 : 0);
