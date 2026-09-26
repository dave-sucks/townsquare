# Townsquare Engine — Master Build Spec

> Snapshot of the living doc at https://claude.ai/code/artifact/ff427eb2-d67e-49c7-b27b-401f6f02e907 (rev 20). This file is the build source.

Sep 25, 2026 · @Dave

## Summary

This spec builds the Townsquare Engine: the system that turns creators' Instagram posts into places people can search and discover on the map. Import by handle already works as a proof of concept; the engine replaces its single pass with a staged pipeline you can watch, correct and improve.

What gets built:

- **The pipeline.** Fetch a creator's posts, keep every raw post and its media, read images and video (frames and speech), find each place a post mentions, pull out that place's dishes, tags and sentiment, then roll everything up into each place's tags, summary and search index.
- **Agents with versioned prompts.** Each stage is a small agent with its own prompt, model and output schema. A playground runs any prompt on any post, and evals score a draft before it goes live.
- **A learning loop.** Low-confidence results land in a review queue. Every correction is saved as a labeled example that feeds the prompts and the evals.
- **Admin mode on the product itself.** The same feed, post, place and profile pages gain inline edit controls for admins. Separate pages exist only where the product has no page: agents, evals, taxonomy, runs.
- **Search that uses it.** The chat agent and the map read the new structured data: per-place excerpts, controlled tags and real neighborhood boundaries.

Nothing that works today may break, the UI clones existing patterns, and every phase ships as one verified PR.

## How to use this doc

This doc is the build contract: follow it as written, in phase order, without stopping to ask. Where it is silent, choose the option that reuses the most existing code and record the choice in the PR description.

1. **Precedence.** This doc, then the existing code's conventions, then your own taste. If the doc conflicts with a must-not-break feature (see Outcomes), keep the feature working and note the deviation in the PR.
2. **One PR per phase.** Branch `engine/phase-N-<slug>` from the latest `main`. Merge only after `npx tsc --noEmit` is clean, `npm run build` passes, the Vercel check passes, and the PR shows the phase's acceptance checks with screenshots (1440×900 desktop and 390×844 mobile for any UI change).
3. **Never break what works.** Run the regression checklist in Outcomes before every merge.
4. **Protect production data.** Develop against the dev database described in Environment. Production only ever receives additive migrations, applied by the deploy. Never drop or rename a production table or column.
5. **Dave presses the expensive buttons.** Build re-processing, re-scraping and backfills as admin actions. Never run them against production yourself.
6. **Spend budget: $50 total** for model and API calls across the whole build. Iterate on the 60-post dev sample. Every PR states what it spent (the engine logs cost per call).
7. **Clone before you create.** Every new screen starts from an existing page or component named in the Design contract. No new colors, fonts, spacing scales or UI libraries.
8. **Done means seen.** A phase is not done until you have driven it in a browser with the dev login and captured the screenshots.
9. **Blocked by something only Dave can do?** Finish everything else, put the blocker at the top of the PR description, and move on to the next unblocked phase.
10. **No outside references.** Patterns borrowed from Dave's other project (Hindsight) are fully described here. Do not look for that codebase.

The same words mean the same things everywhere in this doc, the code and the UI:

| Term | Meaning |
| --- | --- |
| Source | A creator account the engine follows (today: an Instagram handle) |
| Sync | One fetch of a source's new posts |
| Post | One social post, with its raw payload and mirrored media |
| Mention | One place referenced by one post, with its own excerpt, dishes, tags and sentiment |
| Place | A real venue with a Google place id; the unit on the map |
| Tag | A term from the controlled taxonomy (category + tag) |
| Agent | One pipeline stage that calls a model with a versioned prompt |
| Run | One execution of the pipeline for one post, made of stage steps |
| Review item | A result waiting for a human decision |
| Example | A human-approved input and output, used for few-shot prompts and evals |
| Eval | A scored run of one prompt version against a set of examples |

## Outcomes

The engine is done when Dave can add a handle, watch it sync, see exactly what each agent decided for every post, fix any of it inline, and see those fixes make the next run better. Every target below is measured on the golden set (see Review and learning loop) and reported on the Evals page.

| Outcome | Today | Target |
| --- | --- | --- |
| Posts resolved to at least one place (posts that are about a place) | 399 of 678 posts (59%) | 90% |
| Precision of auto-accepted place matches | not measured | 97% |
| Multi-place posts split into one mention per place, each with its own excerpt | no: one review per post, full caption on every place | yes |
| Places with a neighborhood | 145 of 314 | every place in a supported city |
| Post and place images that load | Instagram CDN and Google photo links have expired | 100%, from mirrored storage |
| Tag precision on mentions | not measured | 90% |
| Average model cost per post, all stages | not measured | $0.04 or less |
| Prompt changes | edited in code | playground, eval, promote, one-click rollback |

### Must not break

Run this checklist before every merge. Each item must behave exactly as it does on `main` today, with the same data.

| Feature | Where | Check |
| --- | --- | --- |
| Explore map | `/` | Markers load for the viewport, filters work, a marker opens its place |
| Place page | `/places/[id]` | Header, photos, tags, AI summary, creator posts, save and rate |
| Creator profile | `/u/[username]` | Header, stats, post grid, follow |
| Feed and home | `/feed`, `/home` | Activity items render and link correctly |
| Saves and lists | `/my-places`, `/lists`, `/lists/[id]` | Save, rate (ehh 1, liked 3, loved 5), add to list, list pages |
| People | `/people` | Follow and unfollow |
| Agent chat | `/chat` | All 11 tools answer; place lists sync with the map; history reopens old chats |
| Import by handle | `/admin/import` | Keeps working until the Sources page replaces it, then redirects there |
| Auth | login, logout, onboarding | Unchanged |

The chat agent reads places, posts and tags through `src/lib/places/query.ts`. Any schema change must keep every chat tool working in the same PR, and the Search phase moves those queries onto the engine's new tables.

## Today

Import by handle works as a proof of concept: 9 creators, 678 posts fetched, 408 reviews at 314 places. But it was built for an always-on Replit server, its confidence scores don't measure match quality, and almost nothing it decides can be seen or corrected.

### How it works now

1. `/admin/import` posts to `/api/admin/import/instagram/profile`, which creates an `ImportJob` and enqueues `IMPORT_PROFILE` in the `jobs` table.
2. An in-process poller started from `src/instrumentation.ts` (`src/lib/worker/runner.ts`, every 5s) claims jobs. On Vercel this only runs while some request keeps an instance awake.
3. `import-profile.ts` runs Apify `apify~instagram-scraper` (waits at most 60s), mirrors the profile photo to Supabase Storage `photos/profile-pics/`, upserts the creator as a `User` (`isInstagramImport`), and for each new post writes an `IngestedPost` with its full raw payload, then enqueues `PROCESS_POST`.
4. `process-post.ts` runs five strategies (location tag, caption regex, hashtag, @mentions, a gpt-4o-mini venue list), each with its own Google Text Search and no location bias. A result at 0.85 or above auto-resolves; anything else is marked unresolved with its candidates.
5. A resolved post gets Place Details, a `Place` upsert, one `Review` carrying the whole caption, `Photo` rows pointing at Instagram's CDN, a creator `SavedPlace` and an `Activity`. Then `ENRICH_REVIEW` (gpt-4o-mini tags into `review_tags`), `UPDATE_PLACE_AGGREGATES` (into `place_tag_aggregates`), `REFRESH_PLACE_SUMMARY` every 5th review, and two un-awaited calls: `autoTagPlace` (into `place_tags`, which is what the map shows) and `autoSummaryPlace` (overwrites `ai_summary`).
6. Unresolved posts wait for Dave, who picks places by hand in the job detail view. 117 posts were resolved that way.

### Data on 2026-09-25

| What | Count |
| --- | --- |
| Posts fetched (`ingested_posts`) | 678 from 9 creators, all with raw payloads |
| Resolved / unresolved / stuck | 395 / 282 / 1 (stuck in `new` since Feb 23) |
| Resolved by location tag / by hand / by caption | 242 / 117 / 36 |
| Posts with a location tag | 640 |
| Posts with video / with a separate audio track | 441 / 438 |
| Reviews | 408 (image 306, carousel 89, video 13) |
| Places | 314: 169 without a neighborhood, 306 with an AI summary, 0 with top chips |
| Taxonomy | 49 tags in 6 categories, none with a definition, 3 never used |
| Tag rows | 626 review tags, 1,538 place tags (31 marked manual but written by a seed script at random), 75 aggregates |
| Post images | 1,646 `photos` rows, all Instagram CDN links that have expired |

### What's wrong

| Problem | Evidence | Fixed in |
| --- | --- | --- |
| Jobs don't reliably run in production; stuck jobs never recover | Poller only runs during requests; one `PROCESS_POST` has been `running` since Feb 23 | Architecture |
| Imports can come back partial | Apify caps `waitForFinish` at 60s; the polling fallback never runs | Sync stage |
| Media disappears | Instagram links expire; single-image posts get no media; carousels are duplicated; video is ignored | Media stage |
| Confidence measures which strategy fired, not the match | A location tag that doesn't match scores 1.0 and one that does scores 0.95; "try the spicy rigatoni" searches for a restaurant | Resolve stage |
| Multi-place posts break | AI matches are capped at 0.80 so never auto-resolve; manual multi-resolve copies the post under inconsistent keys; every review carries the whole caption | Mentions |
| Tags live in three places that disagree | Map reads `place_tags` (un-awaited, never cleaned), chat reads aggregates, `top_chips` is never read; code and seed use different slugs | Taxonomy, Aggregate stage |
| Two summarizers overwrite each other | `autoSummaryPlace` and `REFRESH_PLACE_SUMMARY` both write `ai_summary`; errors are swallowed | Summarize stage |
| Counters drift | Failed counts every attempt; jobs are marked complete before posts are processed | Run ledger |
| Neighborhoods are unreliable | 169 places have none; "Manhattan" and "New York" appear as neighborhoods | Neighborhoods |
| No admin role, weak guards | Any signed-in user can import; an open image proxy at `/api/proxy-image`; `next.config.ts` copies the server Maps key into the browser bundle | Phase 0 |
| Nothing is visible or correctable | No run history, no prompt versions, no evals, no cost tracking; the only correction is picking a place for an unresolved post | The whole engine |

The six current prompts are listed in the Appendix. All run on gpt-4o-mini through Replit-era OpenAI variables; the engine replaces every one of them.

## Design contract

New UI must look like it was always part of Townsquare. Every screen starts from an existing page or component, uses only the tokens below, and tucks actions into menus and popovers.

### Dave's rules

- **Clean, minimal, modern.** Dropdowns and popovers instead of rows of exposed buttons. One primary action per view.
- **Admin tools live on the product.** If something already has a product UI (a post, a place, a creator), the admin version is that same UI with an admin edit mode. Never build a parallel internal screen for it.
- **Reuse components.** A post, place or creator renders with the same component everywhere, admin views included.
- **Minimal internal pages** only where the product has no surface: agents and prompts, evals, taxonomy, runs, review queue.
- **Clone, don't invent.** When unsure, copy an existing pattern exactly. Dave has tuned the sizes, gaps, padding, colors and layouts; new work inherits them.

### Tokens and recipes

| Element | Use exactly |
| --- | --- |
| Page shell | `<AppShell user={user}>` then `<PageHeader title="…">`. Page actions go in PageHeader children as `Button size="sm"`. Never a custom top bar. |
| Page title | PageHeader's `text-sm font-semibold font-brand` in an `h-12 border-b px-4` bar. Chrome stays quiet. |
| Index page body | `flex-1 overflow-auto p-4 max-w-3xl mx-auto w-full pb-20 md:pb-4` (`max-w-4xl` for dense admin lists) |
| Detail page body | `flex-1 overflow-auto pb-20 md:pb-0`, inner `p-4 w-full max-w-2xl mx-auto pt-0`, sections in `space-y-6` |
| Section eyebrow | `text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3` |
| Sub-heading | `text-sm font-medium` in a `space-y-2` block. Never `text-lg` or larger for sections. |
| Entity title | `text-xl font-bold font-brand`: the only large heading, for a place, creator or list name |
| Text | Body `text-sm`; meta `text-xs text-muted-foreground`; long prose `text-base text-muted-foreground`; every number `tabular-nums` |
| Fonts | Host Grotesk is the default. Tuffy (`font-brand`) only for titles and entity names. `font-mono` is undefined in this app; don't use it. |
| Color | Tokens only: `bg-background`, `bg-card`, `bg-muted`, `bg-muted/50`, `hover:bg-accent`, `text-muted-foreground`, `border`, `text-destructive`. Primary is near-black. Brand blue `#0004EC` is only for the logo and map pins. |
| Status | `StatusDot` (`w-2 h-2 rounded-full`): emerald-500 done, blue-500 running, amber-500 needs review, red-500 failed, stone-400 queued. Extract it from the import page into `src/components/shared/status-dot.tsx`; add no other hues. |
| Cards | `rounded-lg border bg-card` with `p-3` or `p-4`. Clickable cards and rows get `hover:bg-accent`. The `hover-elevate` classes in the codebase do nothing; never use them. |
| Dense rows | The PlaceCard row: `flex items-center gap-3 p-1 rounded-md hover:bg-accent`, a `w-12 h-12 rounded-md bg-muted` thumbnail, `text-sm font-semibold truncate` title, `text-xs text-muted-foreground` meta joined with `·` |
| Buttons | shadcn sizes only: `sm` in headers and rows, `ghost` + `icon-sm` for icon actions, `outline` for secondary, `destructive` for delete. Loading swaps the icon for `Loading03Icon animate-spin` and disables. Links use `nativeButton={false} render={<Link/>}`. |
| Icons | Hugeicons only. 16px default, 12px in meta rows, 20px in nav, 48px in empty states |
| Tabs | shadcn Tabs with `TabsList className="justify-start"`; pill chips for collections; icon segments `rounded-lg bg-muted p-0.5` |
| Filters | Outline `sm` DropdownMenu triggers with a trailing `Tick01Icon` on the chosen item; active filters as removable secondary Badges |
| Empty state | `flex flex-col items-center justify-center py-16`, 48px muted icon, `font-medium` line, `text-sm text-muted-foreground` line, optional `Button className="mt-4"` |
| Loading | Skeletons shaped like the final layout; a centered `Loading03Icon` only inside panels |
| Time | `formatDistanceToNowStrict` from date-fns. Never raw `toLocaleString()`. |
| Data | TanStack Query with `apiRequest`, invalidate after mutations, `refetchInterval` 5–10s for anything running |
| Feedback | sonner `toast.success` / `toast.error(err.message \|\| "Failed to …")`; inline form errors `text-sm text-destructive` |
| Tests | `data-testid` on every interactive element (`button-*`, `input-*`, `card-*`, `tab-*`) |
| Mobile | Every surface works at 390px. Popovers become Drawers via `useIsMobile`, as `SaveToListDropdown` does. Use `h-dvh`, never `h-screen`. |

The current `/admin/import` page is the one exception to copy selectively. Keep what Dave likes about it: the job cards, status dots, the metrics line, the post-by-post resolution view. Drop what departs from the product: `text-lg` headings, a detail view with no URL, a rotated arrow as a back button, raw timestamps.

### Admin mode

Admin mode turns the product itself into the internal tool. It is the only way admins edit posts, places and creators.

- **Who.** Admins are the emails in `ADMIN_EMAILS`. A server helper `isAdmin(user)` guards every `/api/admin/*` route and every `/admin/*` page. `/api/auth/user` returns `isAdmin`.
- **Switch.** An "Admin mode" switch in the sidebar user menu (desktop) and the mobile menu, shown to admins only. Its state lives in localStorage (`twnsq-admin-mode`) behind an `AdminModeProvider` and `useAdminMode()`.
- **Indicator.** While it's on, the nav avatar carries a `size-2 rounded-full bg-amber-500` dot, and an Admin group appears in the nav: Review, Sources, Runs, Agents, Taxonomy.
- **One edit pattern.** Admin controls open an admin panel: a clone of the `SaveToListDropdown` panel. Popover `w-80 p-0` on desktop, Drawer on mobile, a `px-4 pt-4 pb-3` header, uppercase eyebrows, `py-3 px-4 hover:bg-accent` rows, and a destructive last row with `border-t`. The trigger is a ghost `icon-sm` button with `PencilEdit01Icon`, placed next to the entity's existing actions and visible only in admin mode.
- **Inline edits.** In admin mode, tag chips show a remove control on hover and a trailing "Add tag" chip that opens a taxonomy search popover. Long text (a summary, an excerpt) uses Edit, Cancel and Save around a textarea.
- **Everything leaves a trail.** Every admin write goes through the single write function for that concept, which records an audit row and, when it corrects an agent, saves an Example.

Phase 0 captures baseline screenshots of every product page into `docs/engine/screens/` (see Appendix). New screens must match them.

## Architecture

Each post runs through eight stages on Inngest, the same background runner Dave uses in Hindsight. Four stages are agents with versioned prompts; the rest is plain code. Every stage writes a step row, so the admin UI shows exactly what happened and what it cost.

&#91;embedded content: engine pipeline · 8 stages, 4 agents, review loop\]

Highlighted stages are agents. Read, Resolve and Tag all send low-confidence results to the review queue; Dave's fixes become examples that feed every agent's prompt and its evals.

### Stages

| # | Stage | Kind | Model | Output |
| --- | --- | --- | --- | --- |
| 1 | Sync | Code (Apify) | none | New posts with raw payloads |
| 2 | Media | Code | none | Mirrored images, video and audio; one 3×3 frame sheet per video |
| 3 | Transcribe | API | OpenAI `gpt-4o-mini-transcribe` | Transcript, or skipped when there is no speech or no key |
| 4 | Read | Agent | `claude-sonnet-5` | Post type and every place mentioned, each with a verbatim excerpt, dishes, verdict and score |
| 5 | Resolve | Code, agent when unsure | `claude-sonnet-5` | A Google place id with confidence, or a review item |
| 6 | Tag | Agent | `claude-haiku-4-5` | Taxonomy tags with evidence, plus suggested new tags |
| 7 | Aggregate | Code | none | Place tags, known-for dishes, verdict counts, neighborhood, search document |
| 8 | Summarize | Agent | `claude-sonnet-5` | The place summary and its known-for dishes |

### Runtime

- **Inngest** runs every stage through one serve route, `src/app/api/inngest/route.ts`, with `maxDuration = 800` (the Vercel team is on Pro).
- `engine/source.sync` runs daily at 06:00 ET for every active source, and on demand from "Sync now". It starts an Apify run without waiting, polls it with `step.sleep` every 20 seconds for up to 20 minutes, reads the dataset, upserts posts and sends `engine/post.ingested` for each new one. Concurrency is 1 per source.
- `engine/post.process` handles `engine/post.ingested` and `engine/post.reprocess`. It runs stages 2 to 6 as separate `step.run` calls, with a global concurrency limit of 4 and one run per post at a time. It sends `engine/place.changed` for every place it touched.
- `engine/place.refresh` runs Aggregate and Summarize, debounced for 2 minutes per place. Summarize only runs when the place's mentions changed.
- `engine/eval.run` and `engine/backfill` are started from the admin UI. Backfill sends `engine/post.reprocess` in throttled batches.
- **Status comes from what landed.** Each step writes an `engine_steps` row, and a run's status is derived from those rows, never from what a model said. Steps are idempotent (upserts keyed by post and place), Inngest retries a failed step 3 times, and a post that still fails ends as a failed run plus a review item. Nothing is dropped.
- **Development** uses the Inngest Dev Server (`npx inngest-cli@latest dev`), which needs no keys.
- **The old worker** (`src/instrumentation.ts`, `src/lib/worker/*`, the `jobs` table) keeps running untouched until the Cutover phase switches imports to the engine and removes the poller. The chat's `persistGooglePlaces` then sends `engine/place.changed` instead of enqueuing `REFRESH_PLACE_SUMMARY`.

### Storage and providers

- **Post media:** Supabase Storage public bucket `post-media`, paths `ig/{handle}/{shortcode}/{n}.{ext}` and `ig/{handle}/{shortcode}/sheet.jpg`, prefixed with `STORAGE_PREFIX` (`dev/` outside production). The bucket is created on first use with the service role key. Media is copied so the agents can read it after Instagram's links expire; the product keeps displaying it as it does today.
- **Video frames:** `ffmpeg-static` pulls 9 evenly spaced frames and `sharp` tiles them into one 1152×1152 JPEG. Ship the ffmpeg binary with `outputFileTracingIncludes`.
- **Google photos are never copied.** Google's terms allow storing place IDs, not photos. The photo proxy refreshes an expired reference by itself (already on `main`).
- **Anthropic:** `@anthropic-ai/sdk` in `src/lib/engine/llm.ts`. Every call is `messages.parse` with `output_config: { format: zodOutputFormat(schema), effort }`, `cache_control` on the system prompt, and usage converted to dollars by `src/lib/engine/pricing.ts`. The chat keeps the AI SDK; the engine uses the Anthropic SDK because it needs exact usage and structured outputs.
- **OpenAI** (`OPENAI_API_KEY`) is used for transcription only. The Replit-era `AI_INTEGRATIONS_OPENAI_*` variables retire with the old worker.
- **Google Places:** keep the legacy Text Search and Details endpoints, all in `src/lib/places/google.ts`.
- **Apify:** `apify~instagram-scraper` over REST, run asynchronously (start, poll, read the dataset), with `onlyPostsNewerThan` for incremental syncs. Check that field name against the actor's current input schema.

### Code layout

One write function per concept (a Hindsight rule): the pipeline, the admin UI and any future tool all call the same writer, so a rule can't live on only one path.

```
src/lib/engine/
  inngest.ts              client + event types
  functions/              source-sync, post-process, place-refresh, eval-run, backfill
  stages/                 sync, media, transcribe, read, resolve, tag, aggregate, summarize
  agents/<key>/           prompt.v1.md, schema.ts (zod + field contract), context.ts
  llm.ts  pricing.ts      model calls, cost
  write/                  posts, mentions, places, tags, steps, audit (the only writers)
  review.ts  examples.ts  review items, few-shot selection
  evals/                  runner, metrics
  config.ts               thresholds and limits
src/app/api/inngest/route.ts
src/app/api/admin/**      admin endpoints, all behind isAdmin
src/app/admin/**          review, sources, runs, agents, taxonomy
src/components/admin/**   admin mode: provider, admin panel, editors
```

## Data model

All migrations are additive, and a mention is stored as a `reviews` row. Every product surface already renders reviews, so multi-place posts show up correctly on each place with their own excerpt and no product rewrite.

| Concept | Table | Change |
| --- | --- | --- |
| Source | `sources` (new) | `id, platform, handle, user_id` (the creator's User), `status` (active, paused), `home_city`, `notes` (fed to Read, e.g. rating scale), `trust_weight` (default 1.0), `last_synced_at`, `last_post_at`. Backfilled from the 9 imported creators. |
| Sync | `import_jobs` | Add `source_id`, `apify_run_id`, `since`. The UI calls these syncs. |
| Post | `ingested_posts` | Add `source_id`, `post_type`, `is_place_content`, `is_sponsored`, `transcript`, `media_status`, `last_run_id`. Stop writing `review_id`. |
| Post media | `post_media` (new) | One row per image, video, audio track or frame sheet: `post_id, kind, position, original_url, storage_path, width, height, duration_s`. |
| Mention | `reviews` | Add `ingested_post_id`, `excerpt`, `dishes` (jsonb), `verdict`, `creator_score`, `creator_score_max`, `role`, `confidence`, `status` (auto, confirmed, rejected), `resolved_by` (code, agent, human), `is_sponsored`. Replace the unique on `instagram_post_id` with unique `(instagram_post_id, place_id)`. |
| Mention tags | `review_tags` | Add `evidence`, `run_id`. |
| Place | `places` | Add `neighborhood_id`, `known_for` (jsonb), `verdict_counts` (jsonb), `search_document` (tsvector + GIN index), `is_hidden`, `merged_into_id`. |
| Place tags | `place_tag_aggregates` | Recomputed by Aggregate and read by every surface. `place_tags` rows with source `manual` become admin overrides (always shown); `is_suppressed` on an aggregate hides it. |
| Neighborhood | `neighborhoods` (new) | `id, city, name, slug, aliases text[], borough, geometry jsonb, bbox jsonb` |
| Run, step | `engine_runs`, `engine_steps` (new) | Run: `post_id, trigger, status, cost_usd, started_at, finished_at, error`. Step: `run_id, stage, status, input jsonb, output jsonb, agent_version_id, model, tokens_in, tokens_out, tokens_cached, cost_usd, latency_ms, error, attempt`. |
| Agent, version | `agents`, `agent_versions` (new) | Agent: `key` (read, resolve, tag, summarize), `active_version_id`. Version: `agent_key, version, system_prompt, model, effort, max_tokens, notes, status` (draft, active, archived), `eval_summary` jsonb, `created_by`, `created_at`. |
| Example | `examples` (new) | `agent_key, post_id, review_id, input jsonb, expected jsonb, source` (human\_confirmed, human\_corrected, builder\_draft, seed), `in_golden_set, note, created_by, created_at` |
| Review item | `review_items` (new) | `kind, post_id, review_id, question, payload jsonb, status` (open, resolved, dismissed), `resolution jsonb, resolved_by, resolved_at, priority` |
| Eval | `eval_runs`, `eval_results` (new) | Run: `agent_version_id, status, metrics jsonb, cost_usd`. Result: `eval_run_id, example_id, output jsonb, scores jsonb`. |
| Tag suggestion | `tag_suggestions` (new) | `label, category_slug, evidence jsonb, count, status` (open, accepted, mapped, rejected), `tag_id` |
| Taxonomy | `tags` | Add `synonyms text[]`, `status` (active, deprecated), `merged_into_id`. `description` becomes the definition the Tag agent reads. |
| Audit | `audit_log` (new) | `entity, entity_id, action, field_changes jsonb, actor` (user id or agent key), `run_id, note, created_at`. Written only by the `write/` functions. |

### Migrations

- **Phase 0 baselines Prisma Migrate.** Generate `prisma/migrations/0000_baseline` from the current schema with `prisma migrate diff --from-empty`, and add `scripts/migrate-deploy.mjs`. The script runs only when `VERCEL_ENV=production`: if `_prisma_migrations` is missing it marks the baseline applied, then runs `prisma migrate deploy`. The build becomes `node scripts/migrate-deploy.mjs && prisma generate && next build`.
- **Additive only:** new tables, columns, enum values and indexes. Relaxing a unique constraint is allowed. Dropping or renaming is not.
- **Guard Supabase-only SQL.** Anything that needs a Supabase-only extension goes in a `DO` block that checks `pg_available_extensions` first, so the same migrations also run on plain local Postgres.

### Backfill

- Sources come from the 9 `is_instagram_import` users and their `import_jobs`.
- `reviews.ingested_post_id` is set from the existing `ingested_posts.review_id`.
- Existing reviews keep their data until Dave triggers re-processing from the admin UI.
- **Re-processing never overwrites human work.** It replaces a post's mentions but keeps any mention with status `confirmed` or `resolved_by = human`.

### Product queries that must change with mentions

- **Profile grid and feeds show each post once.** One post can now have several review rows, so group by `instagram_post_id`.
- **One activity per post, not per mention.** Use the dedupe key `review_import_<post id>`.

## Pipeline stages

Code does everything deterministic; models only make judgment calls. Every threshold below is a starting value in `src/lib/engine/config.ts`, tuned later with evals.

### 1. Sync

- **Fetch.** Start `apify~instagram-scraper` with `directUrls: [profile]`, `resultsType: "posts"`, `resultsLimit: 50` and `onlyPostsNewerThan: last_post_at minus 2 days` (first sync: 100 posts). Poll until it succeeds, then read the dataset.
- **Store.** Upsert each post by `(platform, shortCode)` and keep the full raw payload. Update the source's `last_synced_at` and `last_post_at`.
- **Fresh media for old posts.** Admin action: "Refresh media for existing posts" re-scrapes stored post URLs (`directUrls` = post URLs), because the 678 stored payloads carry expired links.

### 2. Media

- **What gets copied.** `images[]` if non-empty, else `displayUrl`; `childPosts[].displayUrl` for carousels (deduped by URL); `videoUrl`; `audioUrl`.
- **Frame sheet.** For video, 9 evenly spaced frames tiled into one sheet.
- **What Read receives.** The cover plus up to 3 carousel images, downscaled to 768px on the long edge, plus the frame sheet.
- **Failures.** A failed download marks `media_status = partial` and the run continues.

### 3. Transcribe

Send the mirrored audio to OpenAI when the video has audio and runs 180 seconds or less. Store the text on the post. Skip with a reason (no audio, too long, no key) — never fail.

### 4. Read (agent)

- **Input, as pre-digested context blocks.** Creator (handle, home city, notes), post facts (type, date, location tag, tagged accounts, @mentions, hashtags, paid partnership flag), caption, the creator's own comment replies, up to 5 other top comments, transcript, images, and up to 3 examples.
- **Output.** Post type, sponsored, and a list of places with excerpt, dishes, verdict, score and confidence (schema under Agents).
- **Gates.** Every excerpt must be a verbatim substring of the caption or transcript (after whitespace normalization). A tagged account must be one the post actually tags. A post typed `not_a_place` has no places. A failed gate goes back to the model once, with the exact reason and what to do instead; if it still fails, the post gets a review item.

### 5. Resolve (code, then agent)

- **Search.** For each place, query Google Text Search: the location tag name when it matches the place name (token similarity 0.8 or more), otherwise `name + area hint + source home city`. Bias to the source's home city, or the area hint's city (geocoded once and cached). Keep the top 5.
- **Score each candidate in code.**
  - 0.60 × name similarity (lowercase; strip punctuation, "the", "restaurant", "nyc"; token-set ratio)
  - 0.15 × food or drink type
  - 0.15 × distance (1.0 within 2 km, 0 at 25 km)
  - 0.10 × business status (operational 1, temporarily closed 0.5, closed 0.2)
- **Auto-accept.** Top score 0.82 or more, lead of 0.10 or more over the next candidate, and name similarity 0.75 or more.
- **Otherwise the Resolve agent picks.** It chooses one of the candidate ids or `none`. A high-confidence pick is accepted; anything else becomes a "Confirm place" review item with the candidates attached.
- **Write the place.** Reuse an existing Place by Google id; otherwise create it through the one place writer, which also assigns the neighborhood.

### 6. Tag (agent, one call per mention)

- **Input.** The mention (excerpt, dishes, verdict), place facts (Google types, price level), the taxonomy with definitions and synonyms, and up to 3 examples.
- **Output.** Tag slugs from an enum of active tags, each with confidence and a quoted evidence line, plus suggestions for missing tags.
- **Apply.** Keep high- and medium-confidence tags. Suggestions go to `tag_suggestions`, merged by normalized label.

### 7. Aggregate (code, per place)

- **Tag confidence** = 1 − ∏(1 − c × trust × recency) over the place's mentions. Mention confidence maps high 0.9, medium 0.6, low 0.3; recency has a 365-day half-life. Show a tag at 0.7 or more, or when two or more mentions support it. Manual place tags always show; suppressed aggregates never do.
- **Everything else.**
  - Known for: the top 3 normalized dish names by mention count.
  - Verdict counts.
  - Neighborhood by polygon.
  - Search document: A = name, B = tags, synonyms and known-for, C = the 20 latest excerpts, D = neighborhood and locality.

### 8. Summarize (agent, per place, debounced)

- **Input.** Place facts, computed verdict counts and dish counts, and up to 12 mentions (handle, date, verdict, excerpt), newest and most liked first.
- **Output.** A summary, plus known-for dishes chosen only from the dish list it was given.
- **Where it goes.** Writes `ai_summary`, which becomes the only writer of that field; `autoSummaryPlace` and `REFRESH_PLACE_SUMMARY` retire.

### Review items the pipeline creates

| Kind | When |
| --- | --- |
| Confirm place | Resolve didn't auto-accept or the agent wasn't confident |
| Check not-a-place | Read called a post with a location tag `not_a_place` |
| Fix extraction | A Read gate failed twice |
| Failed run | A stage failed after retries |
| Spot check | 5% of auto-accepted mentions, chosen at random, to measure precision |
| Confirm example | The builder's draft golden-set labels (see Review loop) |

## Agents and prompts

Four agents, each small, versioned and scored. They follow Dave's three-layer rule from Hindsight: a rule that code can enforce is a gate (Layer 1); context the model shouldn't have to work out is pre-digested (Layer 2); the prompt carries only identity, goals and judgment (Layer 3). If you find yourself adding prompt text to fix a failure, first ask whether a gate or better context would fix it.

| Agent | Model | Effort | Max tokens | Runs | Est. cost |
| --- | --- | --- | --- | --- | --- |
| Read | `claude-sonnet-5` | low | 4,000 | once per post | $0.022 |
| Resolve | `claude-sonnet-5` | low | 1,000 | only for unsure matches (\~40%) | $0.002 per post |
| Tag | `claude-haiku-4-5` | none | 1,500 | once per mention | $0.004 per post |
| Summarize | `claude-sonnet-5` | low | 800 | once per changed place | $0.005 |

With transcription (\~$0.002) the total is about **$0.035 per post**, and a full re-process of the 678 posts is about $25. Prices come from Anthropic's [pricing page](https://platform.claude.com/docs/en/about-claude/pricing): Sonnet 5 costs $2 / $10 per million input / output tokens and Haiku 4.5 $1 / $5, and cache reads cost 10% of input. The system prompt and taxonomy are always sent as a cached prefix.

### Field contract

Every output field has a kind (Hindsight's field contract). `field-contract.test.ts` fails when a field has no row, when a CHOSEN field isn't an enum on the wire, or when a JUDGED rule's marker text is missing from the prompt.

| Kind | Meaning | Examples |
| --- | --- | --- |
| COMPUTED | Code decides; the field is not in the schema | numeric confidence, cost, neighborhood, place id for auto-accepted matches |
| CHOSEN | Model picks from an enum | post type, verdict, confidence (high, medium, low), tag slug, evidence source |
| JUDGED | Model decides under a rule a gate checks | excerpt is verbatim; known-for dishes come from the given list |
| IDENTITY | Must reference something that exists | Resolve's candidate id; a tagged account |
| TEXT | Model's own words | place name as written, reason, summary |

Models report confidence as a bucket, never a number; code maps it to a number.

### Read v1

```
Townsquare is a map of places that food creators recommend. You read one Instagram post and report which real places it is about and what the creator says about each one. Each place you report becomes a mention: it appears on that place's page with the excerpt you choose, and it feeds search, so "burgers in the West Village" or "date night" find it.

A place is a specific venue someone can visit: a restaurant, bar, café, bakery, food hall stall, market vendor or food shop. Neighborhoods, cities, dishes, packaged brands, recipes and home cooking are not places. A post can be about zero, one or many places; a roundup like "top 10 pizza in NYC" has ten.

Use every signal you are given: the caption, the location tag, tagged accounts, the creator's replies in the comments, the transcript, and text or signage in the images and video frames. When signals disagree, the most specific wins: a venue named in the caption or on screen beats a generic location tag like "New York, New York". Report a place only when the post supports it. If the post only hints ("this spot in the East Village"), report it with low confidence and say what is missing, so a person can finish it.

The excerpt is copied word for word from the caption or transcript: the part about that place, trimmed to what a reader needs. In a roundup each place gets only its own lines. Record the dishes the creator names, their verdict, and any score exactly as they wrote it. Mark the post sponsored when it discloses a paid partnership, gifted meal or ad.
```

Schema: `postType` (single\_place, roundup, guide, not\_a\_place, other), `notPlaceReason`, `sponsored`, and `places[]`, each with:

- `name`, `evidence[]` (caption, location\_tag, tagged\_account, creator\_comment, transcript, on\_screen\_text, image)
- `taggedAccount`, `addressHint`, `areaHint`
- `role` (primary, list\_item, passing)
- `excerpt`, `excerptSource` (caption, transcript)
- `dishes[]` (name, sentiment)
- `verdict` (loved, liked, mixed, disliked, none)
- `score` (value, outOf, raw)
- `confidence`, `missing`

### Resolve v1

```
You match a place mentioned in an Instagram post to one Google Maps listing. You get what the post says about the place and up to five candidate listings, already scored by name and distance. Pick the listing the creator meant, or none if no candidate is that place. The same name can belong to other branches, a closed location or an unrelated business; use the address and area hints, the creator's city and the kind of food to tell them apart. When two branches fit equally and the post names no area, choose none and say why; a person will pick.
```

Schema: `choice` (enum of the candidate ids plus `none`), `confidence`, `reason`.

### Tag v1

```
You tag one place mention for Townsquare's search. Given what a creator said about a place, choose the tags from the taxonomy that this mention supports. A tag needs evidence in the excerpt, the dishes or the place facts: tag what this mention shows, not what the place is probably like. Venue type and cuisine can come from the place facts; vibe, occasion and features need the creator's words or images. Follow each tag's definition rather than its name. When the mention supports something people would search for and the taxonomy lacks it, suggest it.

{{taxonomy: category, then each tag as slug: definition (synonyms)}}
```

Schema: `tags[]` (slug enum, confidence, evidence) and `suggestions[]` (label, category enum, evidence). Gate: evidence must be a substring of the mention text or a given fact line.

### Summarize v1

```
Write the short summary at the top of a place's page on Townsquare. It tells someone deciding whether to go what creators say about this place: what it is known for, what they loved, and anything they warned about. Two sentences, plain and specific: dish names, not adjectives. Use only what the mentions say, and when creators disagree, say so. Name a creator by handle only when one creator's opinion carries the point.
```

Schema: `summary`, `knownFor[]` (at most 3; gate: each must be in the given dish list).

### How prompts are stored and changed

- **Where they live.** The v1 texts ship as `src/lib/engine/agents/<key>/prompt.v1.md` and are seeded into `agent_versions` on first deploy. From then on the database is the source of truth; output schemas stay in code.
- **How a call is built.** The system prompt is the version's text (cached). The user message is built by `context.ts`, the Layer 2 digest, in tagged blocks (`<creator>`, `<post>`, `<caption>`, `<comments>`, `<transcript>`, `<examples>`) with the images attached.
- **Examples.** Up to 3 per call: same source first, then same post type, confirmed or corrected ones only, newest first.
- **Every step records the version.** Each step stores the `agent_version_id` it ran, so any output traces back to the exact prompt.

## Review and learning loop

The engine gets better by saving Dave's decisions, not by fine-tuning. Every correction becomes a labeled example, and examples improve the prompts in two ways: as few-shot examples inside them, and as evals that score each new prompt version.

- **Routing.** Only uncertain work reaches a person. Auto-accepted results go live immediately; everything in the review-item table (Pipeline stages) waits in the queue.
- **A decision is a correction.** Accepting, editing or rejecting a review item, or any admin-mode edit to a mention, saves an `examples` row for the agent whose output changed. It holds the input the agent saw and the corrected output, with source `human_confirmed` or `human_corrected`.
- **Reviewer directives.** A rejection can carry a note, which goes into the audit log. The next run of that post includes the note in its context, the way Hindsight feeds a rejected proposal's message to the next run.
- **Golden set.** In Phase 4 the builder drafts labels for the 60-post dev sample by reading each post and its media itself, saved as `builder_draft` examples. They show up as "Confirm example" review items, and every one Dave confirms joins the golden set. The 117 posts Dave already resolved by hand are seeded as Resolve examples.
- **Evals.**
  - Running an eval runs one agent version over every golden example and stores per-example scores.
  - Read is scored on place recall and precision, matched after resolution.
  - Resolve is scored on Google-id accuracy.
  - Tag is scored on precision and recall per category.
  - Summarize is scored on faithfulness: `claude-haiku-4-5` checks every claim against the mentions.
- **Promotion rule.** A draft can go live only if its eval score matches or beats the active version on the golden set; Dave can override with a note. Rollback is promoting an older version.
- **Production failures become examples.** A wrong result Dave fixes in admin mode is automatically an example, so the next eval covers it.
- **Live precision.** The 5% spot checks feed a precision number per agent over the last 30 days, shown on the Agents page.

## Taxonomy

The taxonomy becomes a curated vocabulary with definitions, because the Tag agent follows definitions, not names. Version 2 below is seeded in the Taxonomy phase; Dave edits it afterwards on the Taxonomy page.

| Category | Tags (seed) |
| --- | --- |
| Venue | restaurant, bar, cocktail\_bar, wine\_bar, dive\_bar, cafe, bakery, deli, food\_hall, dessert\_shop |
| Cuisine | american, italian, mexican, japanese, chinese, korean, thai, vietnamese, indian, mediterranean, middle\_eastern, french, caribbean, latin\_american, jewish\_deli |
| Food | burger, smashburger, pizza, pasta, tacos, birria, ramen, sushi, wings, bbq, sandwich, bagels, coffee, pastries, dessert, ice\_cream, seafood, steak, dumplings, noodles |
| Vibe | casual, upscale, lively, chill, romantic, intimate, trendy, classic |
| Occasion | date\_night, group\_hang, celebration, work\_lunch, solo, late\_night, brunch |
| Features | takeout, delivery, outdoor\_seating, rooftop, reservations, walk\_in, counter\_service |
| Price | affordable, splurge (price level itself comes from Google's `price_level`) |
| Dietary | vegetarian\_friendly, vegan, gluten\_free, halal, kosher |

- **Every tag gets a one-sentence definition and synonyms.** For example: `date_night`: "Creators call it good for a date, or describe an intimate, romantic setting" (synonyms: date spot, romantic dinner).
- **Merges from v1.**
  - `smashburger_food` goes into `smashburger` (Food).
  - `expensive`, `pricey` and `upscale`-as-price go into `splurge`; `cheap` goes into `affordable`.
  - `casual_hang` becomes `group_hang`.
  - `dive-bar` and `cocktail_bar` move from Vibe to Venue.
  - `gourmet`, `modern`, `old_school`, `dry-aged`, `detroit-style` and `michelin` become synonyms or retire.
- **Merging is an admin action.** It re-points `review_tags` and `place_tags` to the target tag and keeps the old slug as a synonym, so nothing breaks.
- **Seed-script junk.** The 31 place tags marked `manual` came from a seed script that assigned tags at random. Mark them `ai` so they stop acting as admin overrides.
- **Suggestions inbox.** Tag suggestions from the agent collect by normalized label with counts and evidence quotes. Dave can accept one (creates a tag), map it (adds a synonym to an existing tag) or reject it.
- **The prompt follows the taxonomy.** The taxonomy text in the Tag prompt is generated from the database, so an edit takes effect on the next run. Re-tagging existing mentions after a change is an admin action that re-runs only the Tag stage from stored Read output, which is cheap.

## Screens

Most admin work happens on the product pages in admin mode; five small internal pages cover the rest. Every screen follows the Design contract.

### Admin mode on product pages

| Surface | What admin mode adds |
| --- | --- |
| Place page `/places/[id]` | Pencil button beside the save button opens the admin panel: edit name, move the pin (map in a Dialog), neighborhood, price, primary type; hide place; merge into another place (place search); re-run summary; view runs. Tag chips get remove and "Add tag". The summary gets Edit / Cancel / Save. |
| Posts on a place page or feed | Each post gets a pencil on hover that opens the mention editor for that post |
| Mention editor | A Dialog (`sm:max-w-lg`, Drawer on mobile). Top: the post itself, media and caption, with the excerpt highlighted. Below: one `PlaceRowCard` per mention, reused from chat, each with excerpt (editable), verdict dropdown, dishes as chips, tags as removable chips plus "Add tag", "Change place" (place search popover), and remove. Footer: "Add place", "Mark not a place", "Re-run", Save. |
| Creator profile `/u/[username]` | A status line under the profile header: status dot, last sync, posts / places / needs review. A pencil opens the source panel: Sync now, pause or resume, home city, notes for the Read agent, trust weight, "Refresh media", "Re-process all posts". The Places / Feed tabs gain a filter dropdown (All, Needs review, Not a place, Failed), and posts show a status dot. |
| Explore map | Nothing new. It keeps working as is. |

### Internal pages

All are under `/admin`, gated by `isAdmin`, and linked from the nav's Admin group.

- **Review** (`/admin/review`)
  - Layout: index-page layout (`max-w-3xl`). Kind filter pills (All, Confirm place, Not a place, Fix extraction, Failed, Spot check, Confirm example) with counts.
  - Rows: dense rows with post thumbnail, question, creator, relative time.
  - Opening a row: opens the mention editor with the question and candidates on top; resolving moves to the next item.
  - Keyboard: J / K to move, Enter to open.
- **Sources** (`/admin/sources`)
  - Replaces `/admin/import`, which redirects here.
  - Add a source: a handle input in PageHeader with an Add button.
  - List: one card per source in the import page's job-card style: avatar, handle, status dot, last sync, metrics line (posts, places, needs review, not a place, failed) with the same amber and red counts. A card opens the creator's profile in admin mode.
  - Sync history: a list inside the source panel.
- **Runs** (`/admin/runs` and `/admin/runs/[id]`)
  - List: dense rows with post thumbnail, creator, status dot, stages done, cost, duration; status and source filter dropdowns.
  - Detail: the post on top, then the stages rendered with the chat's `TraceStep` rows (label, model, cost, duration, expandable input and output JSON), then "Re-run from here" per stage.
- **Agents** (`/admin/agents` and `/admin/agents/[key]`)
  - List: one row per agent with active version, model, 7-day runs, 7-day cost, live precision, last eval score.
  - Detail, left: the prompt editor. A version dropdown, the prompt in a textarea (`text-sm`, autosized), model and effort selects, notes, Save draft.
  - Detail, right: the playground. Pick a post by URL or from recent posts, run the draft, and see the output rendered with product components (Read as mention cards, Tag as chips, Summarize as the summary block), plus "Compare with active" side by side, tokens, cost and time.
  - Actions menu: Run eval, Promote, Archive.
  - Evals: a list under the editor. Each row shows version, date, score per metric, cost; a row expands to per-example results and failures.
- **Taxonomy** (`/admin/taxonomy`)
  - Suggestions: the inbox at the top.
  - Tags: categories as sections with eyebrows, tags as rows (name, uses, status). Clicking a tag opens a popover to edit name, definition, synonyms and status, or to merge.

### What the product shows from the engine

- **Place page.** A "Known for" row of dish chips (existing Badge style) under the summary. Posts show their excerpt, not the full caption, with "More" expanding to the caption.
- **Chat and map.** Tags come from `place_tag_aggregates` everywhere, so the map, place page and chat agree.

## Search and chat integration

The chat agent and the map read the engine's output through `src/lib/places/query.ts`; the Search phase rewrites those queries without changing any tool's input or output shape.

- **Neighborhoods are polygons.**
  - NYC: seed `neighborhoods` from NYC Open Data's 2020 Neighborhood Tabulation Areas (public domain GeoJSON). Aliases come from splitting compound names ("SoHo-Little Italy-Hudson Square" gives SoHo, Little Italy, Hudson Square).
  - Assignment: `@turf/boolean-point-in-polygon` assigns `places.neighborhood_id` when a place is written, plus a backfill for all 314.
  - Display name: Google's neighborhood component when it matches an alias of that area, otherwise the area's first alias. Outside NYC, fall back to Google's component.
  - No PostGIS: point-in-polygon runs in code at write time.
- **Area search.** `resolveArea` matches an area name against neighborhood names and aliases first and filters by `neighborhood_id`, so "West Village" means inside the polygon. It falls back to today's geocode-and-radius for unknown areas.
- **Text search.** Search ranks `search_document` with `websearch_to_tsquery`, which gets stemming (burgers matches burger) and weighting by name, tags and excerpts. The current term-group matching stays only as a fallback when full-text search returns nothing.
- **Tags.** One source for all surfaces: aggregates plus manual overrides minus suppressed. The chat's tag filters use slugs and synonyms.
- **Post previews.** `PlaceRow` post previews in chat use `excerpt` instead of the caption.
- **Regression test.** Add `scripts/search-regression.ts`, which runs 20 fixed queries against the dev database and snapshots the top 5 results. The PR shows the before and after. Minimum set: "burgers in the West Village", "late night pizza", "natural wine bar", "date night Williamsburg", "dessert near me", "ramen", "from people I follow".

## Build plan

Nine phases, one PR each, in this order. Each phase lists what it ships and what must be shown in its PR before merging.

| # | Phase | Ships | Acceptance (shown in the PR) |
| --- | --- | --- | --- |
| 0 | Foundations | Dev login; `ADMIN_EMAILS` + `isAdmin` on every `/api/admin/*` and `/admin/*`; admin mode switch, provider, nav group and amber dot; `StatusDot` extracted; Prisma Migrate baseline + `migrate-deploy.mjs`; Inngest client and serve route; `@anthropic-ai/sdk`, `llm.ts`, `pricing.ts`; `audit_log`; `scripts/screenshots.mjs`; baseline screenshots of every page in `docs/engine/screens/` | Screenshots of admin mode on and off; a non-admin gets 403 from `/api/admin/*`; production build runs the migrate script as a no-op |
| 1 | Sources, sync, media | `sources`, `post_media`, sync columns; `engine/source.sync` with async Apify; media stage with bucket, frames sheet and fixes for single-image and carousel posts; Sources page; `/admin/import` redirect; creator profile admin strip | A 5-post sync in dev from one source; mirrored images and a frame sheet in storage; the Sources page and profile strip at both widths |
| 2 | Pipeline and runs | `engine_runs`, `engine_steps`, `agents`, `agent_versions` seeded with v1; stages 3 to 8; mention columns on `reviews` and the new unique; Runs pages with the trace view; field-contract test | The 60-post dev sample processed end to end with cost per post reported; a roundup post split into one mention per place; the run trace screenshot; every chat tool still answers |
| 3 | Admin mode editing | Mention editor; place admin panel (edit, hide, merge, tags, summary); post pencils; all writes through `write/` with audit rows and examples | Edit a mention, change a place, merge two places, edit tags; audit rows and examples exist for each |
| 4 | Review and golden set | `review_items`, `examples`; review rules; Review page; builder-drafted golden set for the 60-post sample; few-shot selection | Queue shows every kind; resolving an item saves an example; the 60 drafts wait as Confirm example items |
| 5 | Agents, playground, evals | Agents pages, prompt editor, playground, `eval_runs`, `eval_results`, metrics, promote and rollback, live precision | An eval of each v1 agent on the draft golden set with scores; a draft prompt compared side by side; promote then roll back |
| 6 | Taxonomy | Tag definitions, synonyms, status, merges; v2 seed; suggestions inbox; Taxonomy page; Tag prompt built from the database; re-tag action | v2 taxonomy live; a suggestion accepted and one mapped to a synonym; re-tag of the dev sample |
| 7 | Neighborhoods and search | `neighborhoods` with NYC polygons; place assignment and backfill; `search_document`; `query.ts` rewrite; aggregates as the single tag source; excerpts in chat previews; known-for row on place pages | Search regression before and after; "burgers in the West Village" returns only places inside the polygon; every chat tool answers; place page screenshots |
| 8 | Cutover | Admin actions "Refresh media" and "Re-process all" with progress and cost estimate; old worker, poller and job handlers removed; `persistGooglePlaces` sends `engine/place.changed`; `autoTagPlace` and `autoSummaryPlace` retired | The whole must-not-break checklist passes; the old pipeline code is gone; a Cutover note for Dave with the cost estimate and the button to press |

After each merge, reply in the PR with what Dave should look at and anything blocked on him.

## Environment and setup

The builder works against a local copy of the database, never production, and signs in with a development-only login.

### Dev database

- **Setup script.** `scripts/dev-db.sh` installs Postgres 17 (PGDG apt repo), creates `townsquare_dev`, and restores the `public` schema from production with `pg_dump --no-owner --no-privileges --schema=public "$PROD_DATABASE_URL"`. It then runs `prisma migrate deploy` against the local database.
- **Session start.** Run it at the start of every cloud session. It is idempotent and takes about a minute.
- **Production is read-only.** `PROD_DATABASE_URL` is used only for that dump. The app's `DATABASE_URL` and `DIRECT_URL` point at local Postgres.
- **Fallback.** If apt is unavailable, use the `embedded-postgres` npm package with the same restore.

### Dev login

In development only (`NODE_ENV === "development"` and `DEV_LOGIN_EMAIL` set), `getCurrentUser()` returns the user with that email. That user counts as an admin. Production builds can never enable it.

### Environment variables

| Variable | Cloud session | Vercel production | Notes |
| --- | --- | --- | --- |
| `PROD_DATABASE_URL` | yes | no | Read-only use, for the dump |
| `ANTHROPIC_API_KEY` | yes | already set |  |
| `GOOGLE_MAPS_API_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | yes | already set |  |
| `APIFY_TOKEN` | yes | check it's set |  |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | already set |  |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | already set | Storage uploads |
| `OPENAI_API_KEY` | yes | add | Transcription only; without it that stage is skipped |
| `ADMIN_EMAILS` | yes | add | Dave's email |
| `DEV_LOGIN_EMAIL` | yes | never | Dave's email |
| `STORAGE_PREFIX` | `dev/` | empty |  |
| `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` | not needed (Dev Server) | set by the Inngest Vercel integration |  |

### Dave's pre-flight

- [ ] Create the cloud environment for the townsquare repo with network access set to Full (it needs Supabase, Anthropic, Google, Apify, OpenAI and Instagram's CDN) and the cloud-session variables above.
- [ ] In Vercel production, add `ADMIN_EMAILS` and `OPENAI_API_KEY`, and confirm `APIFY_TOKEN` and `DIRECT_URL` are set (migrations use `DIRECT_URL`).
- [ ] Install the Inngest integration on the townsquare Vercel project, in the same Inngest account as Hindsight. It sets both Inngest keys and syncs the app on each deploy.
- [ ] Optional: attach screenshots of anything you want matched exactly to the kickoff message.

If any of these is missing, the builder continues with everything that doesn't need it and lists the blocker at the top of the next PR.

## Out of scope

- **The chat UI and the chat agent's prompt.** Dave has a separate styling pass planned. Only `query.ts`, previews and tag sources change, in the Search phase.
- **TikTok and other platforms.** The schema keeps `platform`; Instagram only.
- **Embeddings and semantic search.** Revisit once full-text search and tags are measured.
- **The Batch API.** At about $25 per full re-process it isn't worth the complexity. Revisit when a backfill would cost over $100.
- **Fine-tuning.** Learning happens through examples, few-shot prompts and evals.
- **Polygons outside NYC.**
- **Redesigning product pages** beyond the admin-mode controls, the known-for row and excerpts.
- **Dropping any old table or column.** A later cleanup, done by Dave.

## Kickoff prompt

Paste this into the cloud session, with screenshots attached if you have them.

```
You're building the Townsquare Engine: the system that turns creators' Instagram posts into search-ready places on the map, plus the agents, prompts, review loop, admin mode and internal tools around it.

The full spec is docs/ENGINE_SPEC.md in this repo. Read all of it before writing code. It is decision-free on purpose: follow it as written, in phase order, and don't stop to ask me questions. Where it's silent, choose the option that reuses the most existing code and note the choice in the PR.

How to work:
- Run scripts/dev-db.sh first (Phase 0 creates it) and develop against the local copy. Production data is read-only for you.
- One PR per phase (branch engine/phase-N-<slug>). Merge a PR yourself once tsc, the build and the Vercel check pass and the PR shows the phase's acceptance checks with desktop and mobile screenshots taken with the dev login.
- Run the must-not-break checklist before every merge. The chat at /chat must keep working the whole way through.
- The design contract is strict. Clone existing components and patterns; add no new colors, fonts or UI libraries. Admin editing lives on the product pages in admin mode.
- Budget: $50 of model and API spend across the build. Report spend in each PR. Never run re-processing, re-scraping or backfills against production; build the button and I'll press it.
- If something needs me (a key, a setting), finish everything else, put the blocker at the top of the PR, and keep going with the next unblocked phase.

Start with Phase 0.
```

## Appendix

### Baseline screenshots (Phase 0)

`scripts/screenshots.mjs` captures each route at 1440×900 and 390×844 with the dev login into `docs/engine/screens/<route>-<width>.png`. It runs before Phase 0 changes anything and again in every PR that touches UI.

Routes:

- `/`
- `/feed`
- `/my-places`
- `/lists`
- `/lists/[id]` (first list)
- `/people`
- `/places/[id]` (Hamburger America)
- `/u/[username]` (brotherlyburgers)
- `/chat`
- `/admin/import`, plus one job detail

### Current prompts being replaced

All run on `gpt-4o-mini` through raw `fetch` with the Replit-era OpenAI variables. None validates its output.

| Prompt | File | What it does |
| --- | --- | --- |
| Venue extraction | `src/lib/worker/handlers/process-post.ts` (\~285) | Lists venue names from the first 500 characters of the caption |
| Review tags | `src/lib/worker/handlers/enrich-review.ts` (\~48) | Tags a caption from the taxonomy, keeps 0.55 and above |
| Place summary (job) | `src/lib/worker/handlers/refresh-place-summary.ts` (\~46) | 2–3 sentence summary from aggregates and 3 captions |
| Place tags | `src/lib/auto-tag-place.ts` (\~43) | Picks 3–5 place tags; feeds what the map shows |
| Place summary (inline) | `src/lib/auto-summary-place.ts` (\~46) | Second summary writer for the same field |
| Admin tag backfill | `src/app/api/admin/backfill-tags/route.ts` (\~81) | Bulk place tagging |

### Data snapshot

All counts are in the Today section and were taken on 2026-09-25 from production.
