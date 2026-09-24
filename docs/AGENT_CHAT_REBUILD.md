# Townsquare Agent Chat — Rebuild Handoff

**For:** a Claude Code session working in `dave-sucks/townsquare`
**Written:** 2026-09-22, from a session with full read access to both repos
**Source of the patterns:** the Hindsight repo, checked out at `/Users/davebixler/hindsight`

---

## 0. Read this first: how this session should run

**You can read Hindsight's source directly. Copy from it; don't reinvent it.**
Start the session with Hindsight added as a second directory:

```bash
cd ~/path/to/townsquare && claude --add-dir /Users/davebixler/hindsight
```

Every "port" row in §4 names a real Hindsight file. Open it, copy it into
townsquare, then make the listed changes. Hindsight's chat stack has been
through ~700 PRs of real use. Its comments explain *why* each odd-looking line
is there (dedupe cursors, body proxies, replay ids, stop conditions). Keep
those comments when you port a file. They record bugs that were already fixed.

**Do not edit anything in `/Users/davebixler/hindsight`.** It is read-only
reference material for this job.

**Scope:** this is a from-scratch rebuild of `/chat` only. Delete the old chat
route and the old chat component. The rest of townsquare (map, feed,
profiles, lists, import worker) stays as it is, and the new chat *uses* those
parts.

---

## 1. What we're building

Townsquare is a map of bars and restaurants built from **influencer posts**.
Instagram and TikTok creators are imported as `User` rows
(`isInstagramImport = true`), and each post becomes a `Review` on a `Place`,
with caption, media, likes and posted date. Regular users follow creators
(`Follow`), save places (`SavedPlace`) and build lists (`List`/`ListPlace`).

The chat is an agent. The user talks to Claude, Claude calls tools against
**our database first** and the open web second, and the results render as
polished, clickable place lists that stay in sync with the map. Example asks
it must handle well:

- "find burger spots from people I follow in this area"
- "where has @someinfluencer been posting about lately?"
- "best natural wine bar near me that more than one creator has posted"
- "what's the story on Via Carota? what are people saying?"
- "plan a Saturday in Williamsburg: coffee, lunch, a bar"
- "save the top three to my Date Night list"
- general research: "is Katz's actually worth the line?" → web search +
  our posts about it

The user's words for the product: *our style chat*, *general research with
Claude*, *our reviews and places in the DB*, *per-account* ("people I
follow", "my saves"), and *beautiful tool calls for the list results*.

---

## 2. What exists in townsquare today (audited 2026-09-22)

Last commit: 2026-03-05. Next 16.1.6, React 19.2, Prisma 7.3 (adapter-pg),
Supabase auth, TanStack Query, shadcn (new-york, **hugeicons** icon library),
Tailwind v4, Google Maps.

### Current chat: replace it

| File | What it does | Verdict |
|---|---|---|
| `src/app/api/conversations/[id]/messages/route.ts` (575 lines) | Raw `openai.chat.completions` with `gpt-5-mini`. It makes **one** tool call (`search_places` → Google Text Search, top 5), runs a **second** LLM call to write a blurb, and sends a hand-rolled SSE stream (`data: {places}` / `data: {content}`). The loop is single-shot, with no multi-step agent. | **Delete.** Keep only the helper logic noted below. |
| `src/components/pages/chat-dashboard.tsx` (995 lines) | Custom message list, custom SSE parsing, and a `Textarea` composer. Contains `ChatPlaceCardInline` and `SaveAllToListButton`. The layout is a full-bleed `PlaceMap` with a floating 22rem left panel on desktop and a `BottomSheet` on mobile. | **Keep the layout shell** (map + floating panel + bottom sheet). **Replace** everything inside the panel with the Hindsight `Thread`. |
| `src/app/chat/page.tsx` | Auth gate → `ChatDashboard` | Keep and repoint. |
| `src/app/api/conversations/route.ts`, `[id]/route.ts` | Conversation list / delete | Keep and adapt for history. |
| `prisma` `Conversation`, `ChatMessage { role, content, places Json }` | Flat text + a places blob | **Incompatible** with AI SDK `UIMessage.parts`. See §7. |

**The current system prompt works against the product:** it says *"If asked
about a social media account or influencer, say you can't access social
media."* Influencer posts are the core of the product. The new prompt must say
the opposite.

### Worth keeping from the old route (move into tool files)

- `persistPlaces()`: Google result → upsert `Place` + neighborhood from
  Place Details address components. Becomes part of `search_google_places`.
- `autoTagPlaces()` / `assignEmojis()`: fine as background enrichment. **Do
  not** run them inline in a tool; they add 2 LLM calls to every search.
  Enqueue them on the existing `Job` queue (`src/lib/worker/queue.ts`).
- The photo proxy URL pattern `/api/places/photo?photoRef=…&maxWidth=…`.

### Data you can query (the part that makes this app special)

```
User      id, username, firstName, lastName, profileImageUrl, instagramHandle,
          isInstagramImport, isVerified, avatarEmoji
Follow    followerId → followingId            ← "people I follow"
Place     id, googlePlaceId, name, formattedAddress, neighborhood, locality,
          lat, lng (REAL — no PostGIS), primaryType, types Json, priceLevel,
          photoRefs Json, aiSummary, topChips Json
Review    userId (the creator), placeId, rating, note, source (manual|instagram|tiktok),
          instagramUrl, socialPostCaption, socialPostMediaUrl, socialPostMediaType,
          socialPostLikes, socialPostPostedAt      ← the influencer posts
Photo     placeId, reviewId, url, carouselPosition
Tag / TagCategory (slug, displayName, searchWeight)
PlaceTag (placeId, tagId, source, confidence)
PlaceTagAggregate (placeId, tagId, confidence, evidenceCount, isSuppressed)  ← best "what is this place" signal
ReviewTag (reviewId, tagId, confidence)
SavedPlace (userId, placeId, hasBeen, rating 1–3, emoji)
List / ListPlace (visibility PRIVATE|PUBLIC, isSystem, systemSlug)
```

Existing endpoints to reuse or read for query shape:
`/api/places/db-search` (bbox on lat/lng + trending count from reviews in the
last 30 days), `/api/feed`, `/api/users/[username]`, `/api/saved-places`,
`/api/lists/[id]/places`, `/api/chat/save-all-to-list`,
`/api/places/details`, `/api/places/photo`.

**Before building, check the data (phase 0):** count `users where
is_instagram_import`, `reviews where source='instagram'`, `follows`, and
`place_tag_aggregates`. If `follows` is empty for the test account, "people I
follow" returns nothing. Seed some follows through the onboarding follow
endpoint (`/api/onboarding/follow`), not with hand-written SQL.

---

## 3. Target architecture (Hindsight's, adapted)

```
/chat page
 └─ ChatShell (kept: PlaceMap full-bleed + floating panel / BottomSheet)
     └─ ChatMapProvider  ← NEW: shared state between tool results and the map
         └─ ChatRuntime (DefaultChatTransport + useChatRuntime + AssistantRuntimeProvider)
             └─ Thread (assistant-ui primitives)
                 ├─ CitedMarkdownText   (assistant prose + inline source citations)
                 ├─ Reasoning           (collapsible thinking block)
                 └─ ToolCallGroup → ToolCallRow → dispatch on result.ui
                       ├─ "tool-ui"      → ToolUIRenderer  (generic CoT-style rows)
                       ├─ "place-list"   → PlaceListRenderer (THE beautiful list)
                       └─ "ask-question" → AskQuestionRenderer (quick replies)

POST /api/chat  (one route)
 └─ streamText({ model: anthropic(...), system, messages: convertToModelMessages(trimmed),
                 tools: { ...ourTools(ctx), web_search: anthropic server tool },
                 stopWhen: [stepCountIs(N), hasToolCall("ask_question")] })
    .toUIMessageStreamResponse()
    onFinish → persist UIMessage[] to Conversation
```

**The one rule that keeps this clean (from Hindsight's CLAUDE.md, learned
the hard way):** every tool returns a `ToolResult` envelope with a `ui`
discriminator. The renderer list is **short and closed**. A new tool almost
never needs a new renderer; it returns `data.items` rows for the generic
renderer, or place rows for the place list. Hindsight built and then deleted
six one-off renderers. Don't repeat that.

---

## 4. File-by-file port manifest

Paths on the left are in `/Users/davebixler/hindsight`. Paths on the right are
in townsquare (`src/` prefix, per townsquare's `@/*` alias).

### Server / agent core

| Hindsight source | → Townsquare dest | Changes |
|---|---|---|
| `lib/agent/define-tool.ts` | `src/lib/agent/define-tool.ts` | Remove the `gateLog` / `recordGateRejection` / `detectGateRejection` block (DAV-219 telemetry; townsquare has none). Remove `modes`. Keep timing logs, try/catch → `{ok:false}`, `progressLabel`, per-call `ui` override. |
| `lib/agent/tool-result.ts` | `src/lib/agent/tool-result.ts` | Replace the `ToolUI` union with `"tool-ui" \| "place-list" \| "ask-question"`. Replace `ToolUIItem` kinds with `generic`, `place` (see §6), and `person` (creator avatar + handle + text). Keep `ToolSource` and `normalizeToolResult`. |
| `lib/agent/tool-context.ts` | `src/lib/agent/tool-context.ts` | Shrink to `{ userId, conversationId, location?, mapBounds?, groupId(phase) }`. Keep the `groupId()` method and `createToolContext()` exactly as they are. |
| `app/api/agent/[mode]/route.ts` (1142 lines) | `src/app/api/chat/route.ts` (~200 lines) | Take only what's listed: `trimToolResults()` (line 61; shrinks old tool outputs to their `summary` before they go back to the model), `convertToModelMessages`, `streamText` call shape, `stopWhen` array, `onFinish` persistence with the explicit `onFinishPromise` + `waitUntil` pattern (comments at ~line 827), `toUIMessageStreamResponse()`. Drop: modes, runs, analysts, OpenAI strict schema, model overrides. **Fix the thinking config for current models (see §5).** |
| `lib/agent/modes.ts` | *(don't port)* | One chat mode. Put the model id + maxSteps in `src/lib/agent/config.ts`. |
| `lib/agent/convert-messages.ts` | `src/lib/agent/convert-messages.ts` | Needed for replaying a saved conversation into `useChatRuntime`. Also read commit `b3d31842` in Hindsight ("replay ids are minted around the ids already in it"). It fixed a bug where a resumed thread wouldn't open. Port that fix too. |

### Client / chat UI

| Hindsight source | → Townsquare dest | Changes |
|---|---|---|
| `components/chat/chat-runtime.tsx` | `src/components/chat/chat-runtime.tsx` | **Copy as-is.** The body proxy matters here: it lets you send the **live map bounds and user location** with every message without rebuilding the transport (§8). |
| `components/assistant-ui/thread.tsx` | `src/components/chat/thread.tsx` | Keep the primitives, `turnAnchor="top"`, sticky `ViewportFooter` mask, scroll-to-bottom, welcome, message components, `ToolDedupeProvider`. Swap `HindsightComposer` for a trimmed composer (below). Change the `--thread-max-width` for the 22rem panel (the thread is narrow here; test at 352px). Replace the footer mask bg with the panel's bg token. |
| `components/assistant-ui/hindsight-composer.tsx` (763 lines) | `src/components/chat/composer.tsx` | Keep: autosize input, send/stop, attachments off, model picker off. Replace `$TICKER` search with **@creator mention** search against `/api/users?q=` (same popover mechanics). Replace slash commands with 3–4 suggestion chips ("Near me", "From people I follow", "Date night", "Late night"). |
| `components/assistant-ui/cited-markdown-text.tsx` | `src/components/chat/cited-markdown-text.tsx` | Keep citation parsing + `InlineCitation` popovers (these show web-search sources). Keep the `### Stage N` h3 filter only if you use stage headers in the prompt (you won't; remove it). |
| `components/assistant-ui/message-sources-context.tsx` | same folder | As-is. |
| `components/ai-elements/inline-citation.tsx` | `src/components/ai-elements/inline-citation.tsx` | As-is. Hindsight rule: **every citation is this component**; never a Badge chip. |
| `components/ai-elements/tool-progress.tsx` | `src/components/ai-elements/tool-progress.tsx` | Keep `ToolProgress`, `Header`, `Content`, `Item`, `Sources`. Replace `ToolProgressTickerItem` with **`ToolProgressPlaceItem`** (16px place thumb or emoji in the dot slot, bold name, " — " text) and **`ToolProgressPersonItem`** (16px avatar, `@handle`). Drop the parqet logo URL. Swap lucide icons → hugeicons (§9). |
| `components/agent/ToolCallGroup.tsx` | `src/components/chat/tool-call-group.tsx` | **Copy as-is** (grouping by `groupId`, "(+N more)" headers, cross-message dedupe). Change the ticker fallback in the header to `args.query`. |
| `components/agent/tool-dedupe-context.tsx` | same folder | As-is. |
| `components/agent/ToolCallRow.tsx` | `src/components/chat/tool-call-row.tsx` | Three-way switch: `place-list`, `ask-question`, default `tool-ui`. `inferLoadingUI`: `search_places`, `places_from_people_i_follow`, `search_google_places` → `place-list`. |
| `components/agent/ToolErrorRow.tsx` | same folder | As-is. |
| `components/agent/renderers/ToolUIRenderer.tsx` | `src/components/chat/renderers/tool-ui-renderer.tsx` | Remove the proposal + legacy branches. Map `place`/`person`/`generic` item kinds. |
| `components/agent/renderers/AskQuestionRenderer.tsx` + `components/tool-ui/question-flow/*` + `components/manifest-ui/quick-reply.tsx` | `src/components/chat/renderers/…` | For "which neighborhood?" / "what vibe?" clarifying questions. Keep `hasToolCall("ask_question")` in `stopWhen`. |
| `components/agent/Reasoning.tsx` | `src/components/chat/reasoning.tsx` | As-is. |
| `components/assistant-ui/tool-uis/tool-ui-shared.tsx` | same | `extractToolSources` + `SourceChips`. |
| `components/assistant-ui/tooltip-icon-button.tsx`, `tool-fallback.tsx` | same | As-is. |
| **new** | `src/components/chat/renderers/place-list-renderer.tsx` | The main new component. Spec in §6. |
| **new** | `src/components/chat/chat-map-context.tsx` | §8. |

**Also read, don't port:** Hindsight's `components/agent/AgentChat.tsx`
(how the pieces get composed, welcome configs, and tabs) and
`app/(root)/chat/ChatPageClient.tsx` (the general-purpose chat page, the
closest analog to this one).

---

## 5. The route (`src/app/api/chat/route.ts`)

### Packages (match Hindsight's working versions)

```bash
npm i ai@^6 @ai-sdk/anthropic@^3 @assistant-ui/react@^0.12.17 @assistant-ui/react-ai-sdk@^1.3 @assistant-ui/react-markdown@^0.12 remark-gfm@^4 react-markdown@^10
```

Townsquare already has `@assistant-ui/react@0.12.3` (installed, never used).
Bump it. Remove `openai` only after the enrichment jobs are moved off it, or
keep it for the worker. Env: `ANTHROPIC_API_KEY`.

### Model and thinking (current API; Hindsight's config is out of date here)

- Default model: **`claude-opus-5`**. For a cheaper per-turn cost later, `claude-sonnet-5` is the swap. That's Dave's call, not the session's.
- **Thinking:** Hindsight passes `thinking: { type: "enabled", budgetTokens: 4000 }`. **Do not copy that.** Current models reject a thinking budget with a 400. Use adaptive thinking. In `@ai-sdk/anthropic` providerOptions that is `anthropic: { thinking: { type: "adaptive" } }`, plus a summarized display so the Reasoning block has text to show. Verify the exact option names against the installed `@ai-sdk/anthropic` types before writing them; if the provider version doesn't accept `adaptive`, upgrade it.
- **Web search:** use Anthropic's server-side web search tool (type `web_search_20260209`, name `web_search`), declared through the provider's tool helper in `@ai-sdk/anthropic` (look for `anthropic.tools.webSearch_*` in the installed package; use the newest dated variant it exports). Give it `maxUses: 5` and `userLocation` from the request when known. Its results come back as source parts. Wire them into `message-sources-context` so they render as `InlineCitation`s. **Server-tool errors don't throw.** They arrive as a result block with an error code. Render that as a generic "web search unavailable" row.
- Don't set `temperature` (rejected on current models).
- `maxSteps`: 12 is plenty for chat. `stopWhen: [stepCountIs(12), hasToolCall("ask_question")]`.

### Request body

```ts
{ messages: UIMessage[], conversationId: string,
  location?: { lat: number; lng: number },          // from useUserLocation()
  mapBounds?: { north: number; south: number; east: number; west: number } } // from PlaceMap
```

Auth with `getCurrentUser()` (`src/lib/auth.ts`). Reject if the conversation
isn't the user's. Build the `ToolContext` from user + location + bounds.

### System prompt (short; the tools carry the knowledge)

Write it fresh. Hindsight's prompts are trading-specific. Include:

1. Who: a local food & drink guide built on **posts from creators the user
   can follow**. Our database is the primary source. The web is for
   background, hours, news, and places we don't have yet.
2. Order of operations: our DB tools first (`search_places`,
   `places_from_people_i_follow`), then `search_google_places` only when
   we have nothing good, then `web_search` for questions about a place.
3. "This area" / "near me" means the `mapBounds` / `location` the tools
   already have. Don't ask where the user is when bounds exist.
4. Ask a clarifying question with `ask_question` **only** when the request
   can't be run at all. Otherwise search, show results, and offer to narrow.
5. After a place list renders, write 2–3 sentences that add something the
   list can't show (who posted it, what they said, why it fits). Don't
   restate the list and don't output JSON.
6. Attribute creators by handle (@name). Quote at most a short phrase from a
   caption.
7. Writes (`save_place`, `add_to_list`) only when the user asks for them.

Inject a compact user context block: username, counts of follows / saves /
lists, and the names of the user's lists (so "add to Date Night" resolves).
**Don't** inject the 50 saved places like the old route did. A tool
(`get_my_places`) covers that.

---

## 6. The tool catalog

Each tool is one file in `src/lib/agent/tools/`, uses `defineTool`, and gets
registered in `src/lib/agent/tools/index.ts` → `createChatTools(ctx)`.
Every tool supplies a `progressLabel` in the gerund, Chain-of-Thought style
("Finding burger spots your people posted near you", "Reading @handle's recent
posts"). Those labels are what make the rows feel alive.

### Shared place row (the data every place tool returns)

```ts
type PlaceRow = {
  kind: "place";
  placeId: string; googlePlaceId: string;
  name: string; emoji?: string | null;
  category?: string;              // from primaryType, humanized (reuse getChatCategory from chat-dashboard.tsx)
  neighborhood?: string | null;
  lat: number; lng: number;
  priceLevel?: string | null;
  photoRef?: string | null;       // first of photoRefs, served via /api/places/photo
  tags?: { slug: string; displayName: string }[];   // top 3 from PlaceTagAggregate (not suppressed, by confidence)
  creators?: { id: string; username: string; avatar?: string | null; isFollowed: boolean }[]; // who posted it
  postCount?: number;
  latestPost?: { reviewId: string; caption?: string; mediaUrl?: string; url?: string; postedAt?: string; likes?: number; creator: string };
  mySave?: { saved: boolean; hasBeen: boolean; rating?: number | null; listIds: string[] };
  distanceMi?: number;            // when location is known
  why?: string;                   // one line the tool computes, e.g. "3 creators you follow · 12 posts"
};
```

Tools that return places set `ui: "place-list"` and
`data: { query, scope, places: PlaceRow[], total, truncated }`. The `summary`
(what goes back to the model after trimming) is a compact text list: name,
neighborhood, creator handles, and why. That way the model can write about
the places without the full rows taking up context.

### Tools

| Tool | Purpose | Input (zod) | Notes |
|---|---|---|---|
| `search_places` | Search **our DB** by what + where. | `query` (e.g. "burgers", "natural wine"), `area?` ("bounds" \| "near_me" \| neighborhood name), `sort?` ("most_posted" \| "trending" \| "closest"), `limit?` ≤ 12 | Match the query against tag slug/displayName (via `PlaceTagAggregate`, then `PlaceTag`), `Place.name`, `aiSummary`, and `Review.socialPostCaption` (ILIKE is fine to start; add `pg_trgm` later). Area: bbox from `ctx.mapBounds` or `ctx.location` ± radius (reuse the bbox math in `/api/places/db-search`), or a neighborhood ILIKE. Rank by distinct creators, then post count in the last 90 days. |
| `places_from_people_i_follow` | The per-account ask: "burger spots from people I follow in this area". | same as above | Same query, but `Review.userId IN (SELECT followingId FROM follows WHERE followerId = ctx.userId)`. Returns `creators` limited to followed accounts, `isFollowed: true`. If the user follows nobody, return a generic row that says so and suggests `find_creators`. **Don't fall back silently** to everyone's posts. |
| `get_place` | Deep dive: "what are people saying about X". | `placeId` or `name` + `area?` | Place + aiSummary + top tags + the last 8 reviews/posts (caption, creator, likes, date, url) + the user's own save state. Returns `ui: "place-list"` with one place and `latestPost`s expanded, or `tool-ui` rows of posts (pick one and keep it consistent). |
| `get_creator` | "Where has @handle been lately?" | `handle` | User profile + their most recent 12 places (from Review, newest first) as `PlaceRow[]`. `ui: "place-list"` with a header row for the creator. |
| `find_creators` | "Who should I follow for tacos in Brooklyn?" | `query`, `area?` | Creators ranked by matching posts in the area. `ui: "tool-ui"` with `person` items + follow state. |
| `get_my_places` | "What's on my want-to-go list near here?" | `filter?` ("want_to_go" \| "been" \| "list"), `listName?`, `area?` | From `SavedPlace` / `ListPlace`. |
| `search_google_places` | Fallback for places we don't have. | `query`, `area?` | Port `searchPlaces()` + `persistPlaces()` from the old route. Enqueue tagging/emoji on the `Job` queue; don't run them inline. `creators: []`, `why: "Not posted by anyone on Townsquare yet"`. |
| `web_search` | Background, hours, openings, news. | (Anthropic server tool) | Not a `defineTool`. Sources render as citations. |
| `save_place` | Write: save / mark been / rate. | `placeId`, `status` ("want_to_go" \| "been"), `rating?` | Reuse the logic in `/api/saved-places`. Returns `tool-ui` with one place item + a check. Also invalidate `["saved-places"]` on the client (§8). |
| `add_to_list` | Write: add one or more places to a list (create if missing). | `listName`, `placeIds[]` | Reuse `/api/chat/save-all-to-list` logic. |
| `ask_question` | Clarifying question with 2–5 quick replies. | port Hindsight's `lib/agent/tools/ask-question.ts` schema | Stops the turn (`stopWhen`). |

Shared query code goes in `src/lib/places/query.ts` (one `findPlaces({ match,
area, creatorScope, sort, limit, userId })` function). `search_places`,
`places_from_people_i_follow` and `get_my_places` all call it. It's the
townsquare version of Hindsight's rule: one write path, one read path, and
the tools stay thin.

---

## 7. Persistence

`ChatMessage { content String, places Json }` can't hold `UIMessage.parts`
(text + reasoning + tool calls + sources). Two PRs, in this order (a Hindsight
lesson: never ship a schema drop together with the code that stops using the
column):

1. **PR A (additive):** add `Conversation.messages Json?` holding the full
   `UIMessage[]`, written in `onFinish` (Hindsight saves one `thread`
   RunMessage per run the same way). New chats read and write only this.
   Old conversations: convert on read. `content` → a text part, `places` →
   a synthesized `tool-search_places` part with `output-available` and a
   `place-list` result, so old chats render in the new UI.
2. **PR B (later, after it's proven):** drop `ChatMessage`.

Titles: keep the "first user message, truncated to 50 chars" behavior, or
generate a title with a cheap model call after the first turn.

---

## 8. Map ↔ chat bridge (the part that makes it feel native)

`ChatMapProvider` (React context) holds:

```ts
{ resultSets: Map<toolCallId, PlaceRow[]>, activeSetId, selectedPlaceId,
  setSelected(id, source: "map" | "list"), mapBounds, location }
```

- `PlaceListRenderer` registers its places on mount/update
  (`registerResultSet(toolCallId, places)`), and the **latest** set becomes
  active. `PlaceMap` shows the active set's markers (it already takes
  `places`, `selectedPlaceId` and `onMarkerClick`).
- Clicking a list row: select it, `mapRef.panTo`, pulse the marker. Clicking
  a marker: select it, scroll the row into view (the old dashboard already
  does this with `placeCardRefs`; keep that pattern).
- Hovering or clicking an older result list makes that set active again.
- `ChatRuntime`'s `body` is `{ conversationId, location, mapBounds }`.
  The body proxy re-reads it on each send, so "in this area" always means
  the map as it is right now. Debounce map `idle` → bounds.
- After `save_place` / `add_to_list` finish, invalidate TanStack
  `["saved-places"]` so the save dropdowns update.

---

## 9. The place list renderer: spec

Hindsight's tool rows are quiet, chain-of-thought style: a muted header with a
chevron, dot rows, and favicon source chips. The place list is the **one loud
component**. It's the answer the user came for.

**Structure**

```
[ToolProgressHeader]  Finding burger spots your people posted · 7 places  ›     (collapsible, muted)
┌───────────────────────────────────────────────────────────────┐
│ [48px photo]  🍔 Au Cheval                          [Save ▾]  │
│               Burgers · $$ · West Village · 0.4 mi            │
│               (avatar)(avatar)(avatar) @a, @b +3 · 12 posts    │
│               [smash burger] [late night] [bar seating]        │
│               "the double with egg is the move" — @a, 3d ago  ›│  ← expands to the post (media + caption + link)
├───────────────────────────────────────────────────────────────┤
│ …                                                             │
└───────────────────────────────────────────────────────────────┘
[Show all 7 on map]   [Save all to list ▾]          (from SaveAllToListButton)
```

- Use shadcn `Item` (townsquare already has `ui/item.tsx`), `Avatar` +
  `AvatarGroup`-style overlap, `Badge variant="secondary"` for tags,
  `Collapsible` for the post expand, and `SaveToListDropdown` (already built,
  `src/components/shared/save-to-list-dropdown.tsx`) for the save control.
- Row click → select + pan the map; name click → `/places/[googlePlaceId]`.
- While loading (`loading=true`, no result yet), show 3 skeleton rows with the
  progressLabel as the header. Empty result → one muted line + the follow-up
  the agent should offer.
- Show 5 rows, then "Show N more" in place.
- Mobile (BottomSheet): the same component. Test at 375px.
- Post preview: `socialPostMediaUrl` thumbnail + caption clamp (port
  Hindsight's `components/ai-elements/clamped-text.tsx`). Link out to
  `instagramUrl`. Don't load the Instagram embed script in chat
  (`social-post-card.tsx` does that; it's heavy in a list).

**Design rules (townsquare tokens, Hindsight discipline)**

- Tokens and fonts come from townsquare's `src/app/globals.css`: Host
  Grotesk body, **Tuffy (`font-brand`) for place names**, neutral base,
  `--radius` 0.625rem. No hex colors; CSS variables only.
- Icons: **hugeicons** (`@hugeicons/react` + `@hugeicons/core-free-icons`),
  townsquare's library. Every ported Hindsight file uses lucide; swap them
  all as you port so the app has one icon language.
- Use shadcn components with their variants and sizes. Don't restyle them
  with className overrides. Layout classes on wrappers are fine.
- Numbers use `tabular-nums`. Every renderer has loading, empty and error
  states.

---

## 10. Hindsight bugs you'll hit if you don't copy the fix

| Trap | Fix (already in the files you're porting) |
|---|---|
| `useChat` sends `UIMessage[]`; `streamText` wants `ModelMessage[]` | Always `await convertToModelMessages(...)` |
| v6 tool parts are `type: "tool-<name>"`, args in `part.input`, done when `state === "output-available"` | `ToolCallGroup` reads both `args/input` and `result/output` |
| Tool results pile up and blow the context | `trimToolResults()` sends only `summary` back to the model; full `data` stays on the client |
| Transport recreated on every render → lost stream / stale body | `ChatRuntime` creates it once with a mutable body proxy |
| Model keeps talking after asking a question → orphan prose under the card | `stopWhen: hasToolCall("ask_question")` |
| Same tool call rendered twice across adjacent messages | `ToolDedupeProvider` cursor |
| Resumed conversation won't open (duplicate message ids on replay) | Hindsight commit `b3d31842` in `convert-messages.ts` |
| `onFinish` persistence cut off on Vercel | the `onFinishPromise` + `waitUntil` pattern in the route |
| Non-place content rendered as a fake place row (Hindsight's version was a fake `$MARKET` ticker) | Prose is a `generic` item. A place row is only for a real `Place` |
| A client component imports a server lib → `tsc` passes, `next build` fails | Type-only imports in client files; run `next build`, not just `tsc` |
| Prisma `Json` fields are `unknown` | Cast through a type guard (`photoRefs`, `types`, `topChips`) |

---

## 11. Build plan (one PR per phase, each shippable)

**Phase 0 (data check, no code):** the §2 row counts; confirm the test
user has follows; list which tags exist for "burger". Report the numbers.

**Phase 1 (skeleton that streams):** packages; `/api/chat` with Claude +
`web_search` only; `ChatRuntime` + `Thread` + composer + `CitedMarkdownText`
+ `Reasoning`, inside the existing map shell. Accept: ask a general question,
see streamed prose with citations and a thinking block, and see the conversation
survive a reload (PR A persistence).

**Phase 2 (tool plumbing + generic rows):** `define-tool`, `tool-result`,
`tool-context`, `ToolCallGroup`, `ToolCallRow`, `ToolUIRenderer`,
`tool-progress` (hugeicons, place/person items). Tools: `find_creators`,
`get_my_places`. Accept: tool rows appear with gerund labels and collapse
into groups.

**Phase 3 (the place list + map bridge):** `src/lib/places/query.ts`,
`search_places`, `places_from_people_i_follow`, `PlaceListRenderer`,
`ChatMapProvider`. Accept: "find burger spots from people I follow in this
area" (with the map on a neighborhood) returns only followed creators'
places inside the bounds, markers match the rows, selection syncs both ways,
and the agent's follow-up names creators by handle.

**Phase 4 (depth + writes):** `get_place`, `get_creator`,
`search_google_places` (enrichment on the Job queue), `save_place`,
`add_to_list`, `ask_question`. Accept: "what are people saying about X" shows
posts; "save the top 3 to Date Night" creates/updates the list and the save
dropdowns update without a reload.

**Phase 5 (polish):** mobile BottomSheet pass at 375px, empty/error states,
suggestion chips, @mention composer, conversation history panel, delete old
`ChatMessage` (PR B).

**Every phase:** `npx tsc --noEmit`, `next build`, then drive `/chat` in the
browser and screenshot the result. Don't call a phase done from type checks
alone.

---

## 12. Out of scope (don't build)

- Multiple agent modes, analysts, runs, crons: that's Hindsight's domain.
- Voice (the `.replit_integration_files/…/audio` code), image generation.
- New Google Maps features, feed changes, import-pipeline changes.
- A sixth renderer. If you think you need one, add a row kind instead.
