#!/usr/bin/env node
/**
 * Captures the product's pages at 1440×900 and 390×844 into
 * docs/engine/screens/<route>-<width>.png, signed in through the dev login.
 *
 *   node scripts/screenshots.mjs [--base http://localhost:3001] [--out dir] [--only feed,place]
 *
 * Routes marked `admin` are captured with admin mode on (the dev login must
 * be in ADMIN_EMAILS).
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
    // Admin screens: a place on a roundup that still has places to confirm.
    const adminPlace = await one("SELECT google_place_id AS id FROM places WHERE name = 'Radio Bakery' LIMIT 1");
    const roundup = await one("SELECT id FROM ingested_posts WHERE canonical_post_id = 'DS7wRC-kYM5'");
    // The run trace: the post run with the most steps.
    const run = await one(
      "SELECT r.id FROM engine_runs r JOIN engine_steps s ON s.run_id = r.id WHERE r.kind = 'post' GROUP BY r.id ORDER BY count(*) DESC, max(r.started_at) DESC LIMIT 1",
    );
    return { listId: list?.id ?? null, placeId: place?.id ?? null, adminPlaceId: adminPlace?.id ?? null, roundupId: roundup?.id ?? null, runId: run?.id ?? null };
  } finally {
    await db.end();
  }
}

function routes({ listId, placeId, adminPlaceId, roundupId, runId }) {
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
    adminPlaceId && { name: "admin-place", path: `/places/${adminPlaceId}`, admin: true, settle: 3500 },
    adminPlaceId && {
      name: "admin-place-menu",
      path: `/places/${adminPlaceId}`,
      admin: true,
      before: (page) => page.locator('[data-testid="button-place-admin"]').click(),
    },
    adminPlaceId && roundupId && {
      name: "admin-mention-editor",
      path: `/places/${adminPlaceId}`,
      admin: true,
      settle: 2500,
      before: async (page) => {
        await page.locator('[data-testid="tab-feed"]').click();
        await page.locator(`[data-testid="button-edit-post-${roundupId}"]`).last().click();
      },
    },
    { name: "admin-review", path: "/admin/review", admin: true },
    {
      name: "admin-review-dialog",
      path: "/admin/review",
      admin: true,
      settle: 4000,
      // The first item, with Instagram's embed loaded.
      before: async (page) => {
        await page.locator('[data-testid^="row-review-"]').first().click();
        await page.locator('[data-testid="dialog-review"] iframe').first().waitFor({ timeout: 30_000 }).catch(() => {});
      },
    },
    { name: "admin-creators", path: "/admin/creators", admin: true },
    {
      name: "admin-creator",
      path: "/admin/creators/girlgottaeatz",
      admin: true,
      settle: 5000,
      before: (page) => page.locator('[data-testid="list-creator-posts"] iframe').first().waitFor({ timeout: 30_000 }).catch(() => {}),
    },
    {
      name: "admin-reprocess",
      path: "/admin/creators",
      admin: true,
      before: async (page) => {
        await page.locator('[data-testid="button-sources-actions"]').click();
        await page.locator('[data-testid="button-reprocess-all"]').click();
        await page.locator('[data-testid="reprocess-estimate"]').waitFor({ timeout: 30_000 });
      },
    },
    { name: "admin-profile", path: "/u/girlgottaeatz", admin: true, settle: 3500 },
    {
      name: "admin-profile-menu",
      path: "/u/girlgottaeatz",
      admin: true,
      before: (page) => page.locator('[data-testid="button-source-admin"]:visible').click(),
    },
    {
      name: "admin-profile-posts",
      path: "/u/girlgottaeatz",
      admin: true,
      before: async (page) => {
        // Mobile renders the profile twice (the hidden desktop panel and the bottom sheet).
        await page.locator('[data-testid="tab-feed"]:visible').click();
        await page.locator('[data-testid="select-post-filter"]:visible').click();
        await page.locator('[data-testid="option-post-filter-all"]').click();
        await page.locator('[data-testid="list-source-posts"]:visible').waitFor({ timeout: 20_000 });
      },
    },
    { name: "admin-runs", path: "/admin/runs", admin: true },
    runId && {
      name: "admin-run",
      path: `/admin/runs/${runId}`,
      admin: true,
      settle: 4000,
      // Open the Read step to show what it did.
      before: (page) => page.locator('[data-testid="list-run-steps"] button').first().click(),
    },
    { name: "admin-agents", path: "/admin/agents", admin: true },
    {
      name: "admin-agent",
      path: "/admin/agents/summarize",
      admin: true,
      settle: 1000,
      // v2 (the archived draft) run next to the active v1: two calls, about $0.004.
      before: async (page) => {
        await page.locator('[data-testid="select-version"]').click();
        await page.locator('[data-testid="option-version-2"]').click();
        await page.locator('[data-testid="input-playground-target"]').fill("ChIJw2RCuSZZwokRVt7nWZNROm0");
        await page.locator('[data-testid="button-run-playground"]').click();
        await page.locator('[data-testid="playground-results"]').waitFor({ timeout: 60_000 });
      },
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
    for (const [vp, admin] of VIEWPORTS.flatMap((vp) => [[vp, false], [vp, true]])) {
      const batch = list.filter((r) => !!r.admin === admin);
      if (batch.length === 0) continue;
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
      if (admin) await context.addInitScript(() => window.localStorage.setItem("twnsq-admin-mode", "1"));
      const page = await context.newPage();
      for (const r of batch) {
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
