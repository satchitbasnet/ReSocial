import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  sql: ReturnType<typeof postgres> | undefined;
};

function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }

  if (!globalForDb.sql) {
    globalForDb.sql = postgres(url, {
      // Required when using Supabase transaction pooler (port 6543)
      prepare: false,
      ssl: url.includes("supabase") ? "require" : undefined,
    });
  }

  return globalForDb.sql;
}

export function getDb() {
  return drizzle(getSql(), { schema });
}

export type Db = ReturnType<typeof getDb>;
