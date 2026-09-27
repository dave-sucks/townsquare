#!/usr/bin/env node
/**
 * Captures the product's pages at 1440×900 and 390×844 into
 * docs/engine/screens/<route>-<width>.png, signed in through the dev login.
 *
 *   node scripts/screenshots.mjs [--base http://localhost:3001] [--out dir] [--only feed,place]
 *
 * Needs a running `next dev` with DEV_LOGIN_EMAIL set, and Google Chrome
 * installed (playwright-core drives it; no browser download).
 */

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";
import pg from "pg";
import dotenv from "dotenv";

// DEV_LOGIN_EMAIL lives in the dev-only env file.
dotenv.config({ path: ".env.development.local", quiet: true });
dotenv.config({ quiet: true });

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const BASE = arg("base", "http://localhost:3001");
const OUT = arg("out", "docs/engine/screens");
const ONLY = arg("only", "")?.split(",").filter(Boolean) ?? [];

const VIEWPORTS = [
  { width: 1440, height: 900, deviceScaleFactor: 1, isMobile: false },
  { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true },
];

/** Ids for the dynamic routes, looked up once. */
async function lookupIds() {
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    const one = async (sql, params = []) => (await db.query(sql, params)).rows[0] ?? null;
    const me = await one("SELECT id FROM users WHERE lower(email) = lower($1)", [process.env.DEV_LOGIN_EMAIL ?? ""]);
    const list = me ? await one("SELECT id FROM lists WHERE user_id = $1 ORDER BY created_at LIMIT 1", [me.id]) : null;
    // Place pages are keyed by Google place id.
    const place = await one("SELECT google_place_id AS id FROM places WHERE name ILIKE 'Hamburger America%' ORDER BY created_at LIMIT 1");
    return { listId: list?.id ?? null, placeId: place?.id ?? null };
  } finally {
    await db.end();
  }
}

function routes({ listId, placeId }) {
  return [
    { name: "explore", path: "/", settle: 4000 },
    { name: "feed", path: "/feed" },
    { name: "my-places", path: "/my-places" },
    { name: "lists", path: "/lists" },
    listId && { name: "list", path: `/lists/${listId}` },
    { name: "people", path: "/people" },
    placeId && { name: "place", path: `/places/${placeId}`, settle: 3500 },
    { name: "profile", path: "/u/brotherlyburgers", settle: 3500 },
    { name: "chat", path: "/chat" },
    { name: "admin-import", path: "/admin/import" },
    {
      name: "admin-import-job",
      path: "/admin/import",
      // The job detail view has no URL of its own: open the first job card.
      before: (page) => page.locator('[data-testid^="card-job-"]').first().click(),
    },
  ].filter(Boolean);
}

/** Wait for data: network quiet, no skeletons or spinners left. */
async function settle(page) {
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  await page
    .waitForFunction(() => !document.querySelector('[data-slot="skeleton"], .animate-spin'), null, { timeout: 15_000 })
    .catch(() => {});
  await page
    .waitForFunction(() => [...document.images].every((img) => img.complete), null, { timeout: 10_000 })
    .catch(() => {});
  // Next's dev-mode badge would sit on top of the nav avatar.
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" }).catch(() => {});
}

async function main() {
  const ids = await lookupIds();
  const list = routes(ids).filter((r) => ONLY.length === 0 || ONLY.includes(r.name));
  mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: vp.deviceScaleFactor,
        isMobile: vp.isMobile,
        hasTouch: vp.isMobile,
        colorScheme: "light",
        // Union Square, so "Nearby" and the map have something to show.
        geolocation: { latitude: 40.7359, longitude: -73.9911 },
        permissions: ["geolocation"],
      });
      const page = await context.newPage();
      for (const r of list) {
        const file = join(OUT, `${r.name}-${vp.width}.png`);
        try {
          await page.goto(`${BASE}${r.path}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
          await settle(page);
          if (r.before) {
            await r.before(page);
            await settle(page);
          }
          await page.waitForTimeout(r.settle ?? 1500);
          await page.screenshot({ path: file });
          console.log(`✓ ${file}`);
        } catch (err) {
          console.error(`✗ ${r.name} @ ${vp.width}: ${err.message}`);
        }
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
