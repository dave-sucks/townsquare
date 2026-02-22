# Twn Sq - Place Saving Application

## Overview
Twn Sq is a web-first application designed to enable users to discover, save, and visualize places on an interactive map. Users can search for places using the Google Places API, save them to custom lists, mark places as "been" with ratings (bad/okay/great), and view all saved locations on a Google Map with color-coded pins. The application aims to provide a seamless experience for managing personal place collections, fostering social interaction through following other users and sharing activities, and organizing places into custom lists. Key capabilities include user authentication, Google Places search with autocomplete, flexible save-with-rating system, list management, interactive map display, and a responsive UI that adapts to desktop and mobile. The long-term vision is to become a comprehensive platform for personal travel and exploration planning, enhancing user engagement through social features and personalized content.

## User Preferences
Preferred communication style: Simple, everyday language.
UI components: All UI must use shadcn/ui components exclusively - no ad-hoc Tailwind or custom components.

### Key Rule: Failed Fix Protocol
**Anytime the user asks for a fix and it doesn't work, do NOT just try again.** First: (1) explain why the previous attempt didn't work and what was done wrong, (2) undo the failed change, and (3) only then attempt a new fix with a proper understanding of the root cause.

### CRITICAL: DO NOT SWITCH TO TURBOPACK
**NEVER change the dev command from `--webpack` to `--turbopack`.** Turbopack does NOT work with this project. This has been attempted many times and always fails, requiring a revert. The dev command MUST remain `next dev --webpack`. Do not attempt to "fix" slow compilation by switching bundlers.

### CRITICAL: PRODUCTION MODE WORKFLOW
The app workflow MUST run in production mode: `npm run build && npx next start -p 5000`. Do NOT use `npm run dev` or `next dev` for the workflow — it causes 5-24 second live compilation delays per page. The app must be built once and served as a production app. The `.replit` workflow args should be `"npm run build && npx next start -p 5000"`, NEVER `"npm run dev"`.

## System Architecture

### Frontend Architecture
- **Framework**: Next.js 16 with App Router and TypeScript.
- **State Management**: TanStack React Query for server-side state.
- **UI Components**: shadcn/ui component library, built on Radix UI primitives (nova style, stone theme).
- **Styling**: Tailwind CSS, utilizing CSS variables for theming.
- **Layout**: Full-width Google Maps map as the primary content area, with floating UI elements for search, settings, and place lists. Responsive design includes a floating sidebar for desktop and an interactive draggable bottom sheet for mobile with three snap points. **IMPORTANT**: Always use `h-dvh` (not `h-screen`) for full-viewport containers — `100vh` is broken on mobile browsers where the URL bar makes the viewport shorter than `100vh`.
- **Search Bar**: FloatingSearch renders at the MapLayout level (not inside PlaceMap) with `z-[55]`, independent of map lifecycle. Uses SaveToListDropdown for save flow — one POST call to `/api/saved-places` which fetches Google Place Details server-side when needed.
- **Map Rendering**: Google Maps JS API (via wrapper components in `src/components/ui/map.tsx` with shared loader in `src/lib/google-maps-loader.ts`). Custom emoji markers render as React components via DOM portals using `google.maps.OverlayView`. Map styles switchable between Standard/Silver/Dark/Night/Aubergine/Retro/Satellite/Terrain via settings panel using native Google Maps styled map JSON. BoundsController auto-fits to places when the set of places changes (tracked by ID+coordinates signature). StyleController listens for window custom events from map settings. Label density uses Google Maps `featureType` visibility rules.
- **Landing Page Map**: Uses the same shared Google Maps loader (`src/components/landing-map.tsx`) for decorative animation on the landing page.
- **Avatar Markers**: On the Explore page (following tab), markers show user profile pictures instead of dots.
- **Place Interaction**: Bidirectional synchronization between the place list and map, including visual cues for selection, map panning, and scrolling.
- **Lists**: Users can create private or public lists to organize saved places.
- **Place Details**: Dedicated full-page and modal views for place details, including photos, user reviews, and social context.
- **Social Features**: User profiles, a people directory, and an activity feed displaying actions from the user and followed accounts, including social post embeds in reviews.
- **Profile Pages**: Map-based dashboard layout with floating sidebar containing profile header and tabbed content for Places and Feed.
- **Tagging System**: Robust tagging system for places with categories like Vibe, Food Type, Occasion, Features, Dietary, Drinks. Tags have search weights for ranking.
- **AI Chat**: New `/chat` page with conversation-based AI assistant for place discovery using OpenAI Function Calling and displaying place cards. Home state shows input field ready to type; creates conversation on first message. AI tools include `search_places` (find places via Google) and `suggest_save_to_list` (offer a "Save all to [list]" button). The AI also assigns contextual emojis to each place result using a separate AI call. Chat message interface supports `action` field for rendering interactive buttons like "Save All to List".
- **Activity Feed**: Supports "All" and "Following" tabs with filter API parameter. Following tab shows contextual empty state for users not following anyone.
- **Bottom Sheet**: Accepts `requestedSnapPoint` prop to programmatically snap (e.g., snap to mid when a place is selected on mobile).
- **Mobile Navigation**: Floating bottom navigation bar (`src/components/mobile-nav.tsx`) visible only on mobile (<768px). Features a pill-shaped bar with icon-only buttons for Map, Feed, and Chat, plus a separate menu toggle button. The menu opens an overlay with additional navigation items (People, Lists, Notifications, theme toggle, etc.). The desktop sidebar trigger is hidden on mobile.

### Backend Architecture
- **Framework**: Next.js API Routes (App Router).
- **Session Management**: `iron-session` for encrypted cookies.
- **Authentication**: Replit Auth via OpenID Connect (OIDC).
- **API Structure**: RESTful endpoints under the `/api/` prefix.

### Data Storage
- **Database**: PostgreSQL, hosted on Neon.
- **ORM**: Prisma 7 with the `pg` adapter.
- **Schema**: Defined in `prisma/schema.prisma` with models for users, sessions, places, saved places, lists, reviews, photos, follows, activities, and a comprehensive tagging system (`TagCategory`, `Tag`, `PlaceTag`).
- **Place Saving Model**: `SavedPlace` now includes `hasBeen: boolean` and `rating: number | null` (1=bad, 2=okay, 3=great) instead of a status enum.
- **Neighborhood/Locality Support**: Added `neighborhood` and `locality` fields to the Place model.
- **Custom Emoji Markers**: Added `emoji` field to `SavedPlace` model. Auto-assigned on save via `getDefaultEmoji()` based on place type.
- **Social Post Embeds**: `Review` model includes fields for `socialPostCaption`, `socialPostMediaUrl`, `socialPostMediaType`, `socialPostLikes`, and `socialPostPostedAt`.

### Emoji Display Rules
- **My Places (DiscoverPage)**: Shows the logged-in user's own emoji from their `savedPlace.emoji` on map markers and over photos.
- **Lists (ListPage)**: Shows the list owner's emoji (from the owner's `savedPlace.emoji` for each place).
- **Following/Burgers collections (ExplorePage)**: Does NOT show any emojis. Always shows colored dots.
- **Profile pages**: Shows dots (no emoji data provided).
- **AI Chat**: AI assigns its own contextual emojis to suggested places (separate system, not from savedPlace).

### Authentication Flow
- Initiated via Replit Auth (OIDC provider: `https://replit.com/oidc`).
- Session data is stored in an encrypted cookie using `iron-session`.
- Protected API routes validate user sessions based on `userId`.
- Frontend utilizes a `useAuth` hook for managing user authentication state.

## External Dependencies

### APIs and Services
- **Google Places API**: For place search, autocomplete, and fetching detailed place information.
- **Google Maps JavaScript API**: For rendering the interactive app map and the landing page decorative animation. Uses native Google Maps styles for themes (Standard, Silver, Dark, Night, Aubergine, Retro, Satellite, Terrain) and featureType visibility rules for label density control.
- **PostgreSQL Database**: Primary data store.
- **Replit Auth**: OpenID Connect (OIDC) provider for user authentication.
- **Replit Object Storage**: For storing user-uploaded photos.
- **OpenAI API**: For AI chat functionality (gpt-5-mini with function calling).

### Key npm Dependencies
- `prisma` & `@prisma/client` & `@prisma/adapter-pg`: Database ORM and client.
- `iron-session`: Secure session management.
- `openid-client`: OIDC protocol implementation.
- `@tanstack/react-query`: Asynchronous state management for React.
- `shadcn/ui` components & `@radix-ui/*`: UI component library and primitives.
- `lucide-react`: Icon library.
- `frimousse`: Headless emoji picker library.

### Social Import & Place Knowledge Engine
- **Admin UI**: `/admin/import` page for managing Instagram profile imports.
- **Worker System**: Background job worker in `src/lib/worker/runner.ts` polls every 5s. Handlers in `src/lib/worker/handlers/`.
  - `IMPORT_PROFILE`: Fetches Instagram posts via Apify API, creates IngestedPost records.
  - `PROCESS_POST`: Resolves posts to Google Places using confidence-based matching ladder (geotag > caption > hashtag > tagged accounts > AI). Auto-resolves at 0.85+ confidence.
  - `ENRICH_REVIEW`: Uses OpenAI to extract tags from captions/content with 0.55+ confidence threshold.
  - `UPDATE_PLACE_AGGREGATES`: Aggregates tags at place level with source weights (manual: 1.2, user: 1.0, ai: 0.8, google: 0.6).
  - `REFRESH_PLACE_SUMMARY`: Generates AI summaries and top chips for places.
- **Manual Resolve**: Admin can manually match unresolved posts to places via Google Places search in the admin UI.
- **Prisma Models**: ImportJob, IngestedPost, Job (queue), ReviewTag, PlaceTagAggregate added to schema.
- **Tag Taxonomy**: 50+ tags seeded across Style, Vibe, Price, Food Type, Features, Occasion categories.

### Environment Variables Required
- `DATABASE_URL`: Connection string for the PostgreSQL database.
- `SESSION_SECRET`: Secret key for encrypting session cookies.
- `GOOGLE_MAPS_API_KEY`: API key for Google Places and Maps services.
- `REPL_ID`: Replit deployment identifier.
- `REPLIT_DEV_DOMAIN`: Development domain.