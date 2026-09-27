#!/usr/bin/env node
/**
 * Applies pending Prisma migrations during the production build, and does
 * nothing anywhere else (previews, local builds).
 *
 *   build: node scripts/migrate-deploy.mjs && prisma generate && next build
 *
 * A database that predates Prisma Migrate (no _prisma_migrations table) gets
 * 0000_baseline marked as applied first; the baseline matches the schema
 * that was already there. Migrations are additive only.
 *
 * Connection: MIGRATE_DATABASE_URL, else DIRECT_URL, else DATABASE_URL, but
 * never Supabase's direct host (db.<ref>.supabase.co is IPv6-only, which
 * Vercel's build machines can't reach), and never the transaction pooler
 * (port 6543 can't run migrations; the same pooler serves session mode on
 * 5432).
 */

import { spawnSync } from "node:child_process";
import pg from "pg";
import "dotenv/config";

const BASELINE = "0000_baseline";

if (process.env.VERCEL_ENV !== "production") {
  console.log(`[migrate] Skipped: VERCEL_ENV is ${process.env.VERCEL_ENV ?? "unset"}, not production.`);
  process.exit(0);
}

function migrationUrl() {
  const candidates = [
    ["MIGRATE_DATABASE_URL", process.env.MIGRATE_DATABASE_URL],
    ["DIRECT_URL", process.env.DIRECT_URL],
    ["DATABASE_URL", process.env.DATABASE_URL],
  ];
  for (const [name, raw] of candidates) {
    if (!raw) continue;
    const url = new URL(raw);
    if (/^db\.[a-z0-9]+\.supabase\.co$/.test(url.hostname)) {
      console.log(`[migrate] Not using ${name}: ${url.hostname} is IPv6-only.`);
      continue;
    }
    if (url.hostname.endsWith(".pooler.supabase.com") && url.port === "6543") {
      url.port = "5432";
      url.searchParams.delete("pgbouncer");
    }
    console.log(`[migrate] Using ${name} → ${url.hostname}:${url.port || "5432"}`);
    return url.toString();
  }
  throw new Error("No usable database URL (set MIGRATE_DATABASE_URL to a session-mode URL)");
}

function prisma(args, env) {
  const res = spawnSync("npx", ["prisma", ...args], { stdio: "inherit", env });
  if (res.status !== 0) throw new Error(`prisma ${args.join(" ")} failed (exit ${res.status})`);
}

async function hasMigrationsTable(url) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const { rows } = await client.query("SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS present");
    return rows[0].present;
  } finally {
    await client.end();
  }
}

try {
  const url = migrationUrl();
  const env = { ...process.env, DATABASE_URL: url };
  if (!(await hasMigrationsTable(url))) {
    console.log(`[migrate] No _prisma_migrations table: marking ${BASELINE} as applied.`);
    prisma(["migrate", "resolve", "--applied", BASELINE], env);
  }
  prisma(["migrate", "deploy"], env);
} catch (err) {
  console.error(`[migrate] ${err.message}`);
  process.exit(1);
}
