#!/usr/bin/env node
/**
 * Dumps the database's public schema to ~/townsquare-backups/ before a
 * migration or a bulk run, so any mistake can be undone.
 *
 *   node scripts/db-backup.mjs [label]
 *
 * Restore (replaces every public table with the dump's copy):
 *   pg_restore --clean --if-exists --no-owner --no-privileges \
 *     --schema=public -d "<url>" ~/townsquare-backups/<file>.dump
 *
 * Needs pg_dump 17 or newer (the server runs Postgres 17): set PG_DUMP, or
 * `brew install libpq`. Reads DIRECT_URL, falling back to DATABASE_URL.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import "dotenv/config";

const raw = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!raw) {
  console.error("DIRECT_URL or DATABASE_URL must be set");
  process.exit(1);
}

// Split at the LAST "@": the password may itself contain "@" or "$".
const m = raw.match(/^postgres(?:ql)?:\/\/([^:]+):(.*)@([^@/:]+)(?::(\d+))?\/([^?]+)/);
if (!m) {
  console.error("Could not parse the database URL");
  process.exit(1);
}
const [, user, password, host, port = "5432", database] = m;

const pgDump =
  process.env.PG_DUMP ||
  ["/opt/homebrew/opt/libpq/bin/pg_dump", "/usr/local/opt/libpq/bin/pg_dump"].find(existsSync) ||
  "pg_dump";

const dir = join(homedir(), "townsquare-backups");
mkdirSync(dir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const label = process.argv[2] ? `-${process.argv[2].replace(/[^\w-]/g, "")}` : "";
const file = join(dir, `townsquare-${stamp}${label}.dump`);

console.log(`Dumping public schema from ${host}:${port}/${database} …`);
const res = spawnSync(
  pgDump,
  ["--format=custom", "--no-owner", "--no-privileges", "--schema=public", "-h", host, "-p", port, "-U", user, "-d", database, "-f", file],
  { stdio: "inherit", env: { ...process.env, PGPASSWORD: decodeURIComponent(password) } },
);
if (res.status !== 0) {
  console.error(`pg_dump failed (exit ${res.status}). Is ${pgDump} version 17 or newer?`);
  process.exit(1);
}
console.log(`Saved ${file} (${(statSync(file).size / 1024 / 1024).toFixed(1)} MB)`);
