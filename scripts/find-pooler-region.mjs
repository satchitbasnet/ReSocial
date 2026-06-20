import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

const password = process.env.SUPABASE_DB_PASSWORD ?? "N2nZz7G5RW8QUEZo";
const ref = "jtletzljdhasaidsiqjn";
const regions = [
  "us-east-1", "us-east-2", "us-west-1", "us-west-2",
  "eu-west-1", "eu-west-2", "eu-west-3", "eu-central-1", "eu-north-1",
  "ap-southeast-1", "ap-southeast-2", "ap-northeast-1", "ap-northeast-2", "ap-south-1",
  "ca-central-1", "sa-east-1",
];
const prefixes = ["aws-0", "aws-1"];

async function tryUrl(label, url) {
  const sql = postgres(url, { ssl: "require", max: 1, connect_timeout: 6, prepare: false });
  try {
    await sql`select 1 as ok`;
    console.log("OK", label);
    console.log(url.replace(password, "***"));
    await sql.end();
    return true;
  } catch (e) {
    const msg = String(e.message ?? e).slice(0, 100);
    if (!msg.includes("ENOTFOUND") && !msg.includes("timeout")) {
      console.log("near", label, msg);
    }
    await sql.end({ timeout: 1 }).catch(() => {});
    return false;
  }
}

for (const prefix of prefixes) {
  for (const region of regions) {
    const host = `${prefix}-${region}.pooler.supabase.com`;
    const txn = `postgresql://postgres.${ref}:${password}@${host}:6543/postgres?pgbouncer=true`;
    if (await tryUrl(`${prefix}/${region}/6543`, txn)) process.exit(0);

    const session = `postgresql://postgres.${ref}:${password}@${host}:5432/postgres`;
    if (await tryUrl(`${prefix}/${region}/5432`, session)) process.exit(0);
  }
}

// Direct host (works on Vercel IPv6)
const direct = `postgresql://postgres:${password}@db.${ref}.supabase.co:5432/postgres`;
if (await tryUrl("direct/5432", direct)) process.exit(0);

console.error("No connection matched");
process.exit(1);
