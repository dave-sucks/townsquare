# Beli Clone - Place Saving Application

## Overview
This project is a web-first clone of the Beli app, designed to enable users to discover, save, and visualize places on an interactive map. Users can search for places using the Google Places API, save them to custom lists, mark places as "been" with ratings (bad/okay/great), and view all saved locations on a Google Map with color-coded pins. The application aims to provide a seamless experience for managing personal place collections, fostering social interaction through following other users and sharing activities, and organizing places into custom lists. Key capabilities include user authentication, Google Places search with autocomplete, flexible save-with-rating system, list management, interactive map display, and a responsive UI that adapts to desktop and mobile. The long-term vision is to become a comprehensive platform for personal travel and exploration planning, enhancing user engagement through social features and personalized content.

## User Preferences
Preferred communication style: Simple, everyday language.
UI components: All UI must use shadcn/ui components exclusively - no ad-hoc Tailwind or custom components.

## System Architecture

### Frontend Architecture
- **Framework**: Next.js 16 with App Router and TypeScript.
- **State Management**: TanStack React Query for server-side state.
- **UI Components**: shadcn/ui component library, built on Radix UI primitives (nova style, stone theme).
- **Styling**: Tailwind CSS, utilizing CSS variables for theming.
- **Layout**: Full-width Google Map as the primary content area, with floating UI elements for search, settings, and place lists. Responsive design includes a floating sidebar for desktop and an interactive draggable bottom sheet for mobile with three snap points (collapsed ~56px, mid ~30%, expanded ~90%), velocity-based snapping, and proper scroll/drag handoff.
- **Map Features**: Dynamic map styling with multiple themes, map settings popover for radius, traffic, and transit layers.
- **Place Interaction**: Bidirectional synchronization between the place list and map, including visual cues for selection, map panning, and scrolling.
- **Lists**: Users can create private or public lists to organize saved places, with a dedicated management page and individual list detail views. List detail pages use the same map-based dashboard pattern with ListDashboard and ListPlacesPanel components.
- **Place Details**: Dedicated full-page and modal views for place details, including photos, user reviews, and social context (friends who saved).
- **Social Features**: User profiles, a people directory, and an activity feed displaying actions from the user and followed accounts.
- **Profile Pages**: Map-based dashboard layout matching the main app, with floating sidebar containing profile header (photo, name, followers/following, follow button) and tabbed content for Places and Feed. Places tab shows saved places with status and list filters; Feed tab shows reviews. Both tabs have 1:1 map interaction - clicking a card highlights it on the map and vice versa.

### Backend Architecture
- **Framework**: Next.js API Routes (App Router).
- **Session Management**: `iron-session` for encrypted cookies.
- **Authentication**: Replit Auth via OpenID Connect (OIDC).
- **API Structure**: RESTful endpoints under the `/api/` prefix.

### Data Storage
- **Database**: PostgreSQL, hosted on Neon.
- **ORM**: Prisma 7 with the `pg` adapter.
- **Schema**: Defined in `prisma/schema.prisma`.
- **Key Tables**: `users`, `sessions`, `places` (cached Google Places data), `saved_places` (junction table for user-place relationships with status), `lists`, `list_places`, `reviews`, `photos`, `follows`, `activities`.

### Authentication Flow
- Initiated via Replit Auth (OIDC provider: `https://replit.com/oidc`).
- Session data is stored in an encrypted cookie using `iron-session`.
- Protected API routes validate user sessions based on `userId`.
- Frontend utilizes a `useAuth` hook for managing user authentication state.

## External Dependencies

### APIs and Services
- **Google Places API**: For place search, autocomplete, and fetching detailed place information.
- **Google Maps JavaScript API**: For rendering interactive maps and displaying place markers.
- **PostgreSQL Database**: Primary data store, accessed via `DATABASE_URL`.
- **Replit Auth**: OpenID Connect (OIDC) provider for user authentication.
- **Replit Object Storage**: For storing user-uploaded photos.

### Key npm Dependencies
- `prisma` & `@prisma/client` & `@prisma/adapter-pg`: Database ORM and client.
- `iron-session`: Secure session management.
- `openid-client`: OIDC protocol implementation.
- `@tanstack/react-query`: Asynchronous state management for React.
- `shadcn/ui` components & `@radix-ui/*`: UI component library and primitives.
- `lucide-react`: Icon library.

### Environment Variables Required
- `DATABASE_URL`: Connection string for the PostgreSQL database.
- `SESSION_SECRET`: Secret key for encrypting session cookies.
- `GOOGLE_MAPS_API_KEY`: API key for Google Places and Maps services.
- `REPL_ID`: Replit deployment identifier (auto-provided).
- `REPLIT_DEV_DOMAIN`: Development domain (auto-provided).

## Recent Changes

### Place Saving Model Refactor (February 2026)
- **Replaced status-based saving with hasBeen/rating model:**
  - Old: `SavedPlace.status: "WANT" | "BEEN"` enum
  - New: `SavedPlace.hasBeen: boolean` + `SavedPlace.rating: number | null` (1=bad, 2=okay, 3=great)
- **Key behavioral changes:**
  - Saving a place no longer requires a status - it just saves the place
  - "Been there" is now separate from lists - users can mark places as visited with a 3-point rating
  - Rating circles (red=bad, yellow=okay, green=great) shown in save popover
  - Places can be on multiple lists regardless of whether they've been visited
- **Database migration:**
  - Added `hasBeen` boolean and `rating` integer to `SavedPlace` model
  - Added `isSystem` boolean and `systemSlug` string to `List` model for system lists
  - Migrated existing data: BEEN status → hasBeen=true + rating=2, WANT status → hasBeen=false
  - Auto-creates "Want to Go" system list per user for backward compatibility
- **Updated components:**
  - `SaveToListDropdown` redesigned with rating picker and list checkboxes
  - All place cards, detail panels, and map markers updated to use new model
  - API routes updated to handle hasBeen/rating updates
  - Activity types changed from `PLACE_SAVED_WANT` to `PLACE_SAVED`
  - Status filters renamed from "Want/Been" to "Not visited/Been" across all pages
  - PlaceCard displays colored rating circles for visited places or "Saved"/list badges for saved places

### Sidebar Panel Architecture Refactor (February 2026)
- Refactored sidebar to use clean panel-based architecture with state lifted to parent:
  - `DiscoverSidebar` is now a pure view switcher that renders panels based on `currentView` prop
  - View state (`currentView`, `viewingPlaceId`) is managed in `DiscoverPage` parent component
  - Three self-contained panels: `PlaceListPanel`, `MapSettingsPanel`, `PlaceDetailPanel`
- Each panel has its own header with appropriate controls:
  - `PlaceListPanel`: SidebarTrigger, "Places" title, settings button, filter dropdowns
  - `MapSettingsPanel`: Close button, "Map Settings" title, all settings controls
  - `PlaceDetailPanel`: Back button, place info, save controls
- `MapSettingsContent` is the single source of truth for settings UI

### Neighborhood/Locality Support (February 2026)
- Added `neighborhood` and `locality` fields to Place model
- Google Places API details route extracts address_components (neighborhood, sublocality, locality)
- PlaceCard displays neighborhood instead of full address (fallback: locality → first address part)
- Backfill script at `scripts/backfill-neighborhoods.ts` updates existing places
- Note: Instagram-imported places without valid Google Place IDs cannot be backfilled

### Profile Page User Context Separation (February 2026)
- **Problem solved**: When viewing another user's profile, the save/bookmark dropdown was showing that user's saved status and lists instead of the logged-in viewer's status
- **Backend changes**:
  - `/api/users/[username]` endpoint now returns `currentUserPlaceData` when viewing another user's profile
  - For each place on the profile, includes the viewer's: `savedPlaceId`, `hasBeen`, `rating`, and `lists`
- **Frontend changes**:
  - `PlaceCard` component now separates display data (profile owner's hasBeen/rating) from interaction data (viewer's save status)
  - `SaveToListDropdown` uses the viewer's saved place data, not the profile owner's
  - Tooltip text changes from "You've been here" to "Been here" when viewing another user's profile
- **Data flow**: `ProfilePage` → `UserSidebar` → `PlacesList` → `PlaceCard` all pass `currentUserPlaceData` through props

### AI Chat with Place Search (February 2026)
- **Chat Interface**: New `/chat` page with conversation-based AI assistant for place discovery
- **OpenAI Function Calling**: Uses gpt-5-mini with `search_places` tool for natural language place queries
- **Place Cards in Chat**: Assistant messages can include structured place cards with photos, ratings, save buttons
- **Database Models**:
  - `Conversation` model: stores user chat sessions with title
  - `ChatMessage` model: stores messages with role, content, and `places` JSON field for embedded place data
- **Streaming with SSE**: Real-time streaming response with proper buffering for partial JSON handling
- **System Prompt Context**: AI has access to user's saved places (up to 50) and lists (up to 20) for personalized recommendations
- **Save from Chat**: Users can save places directly from chat cards to their saved places
- **Key Components**:
  - `ChatPage` (`src/components/pages/chat-page.tsx`): Main chat interface with conversation management
  - `ChatPlaceCard` (`src/components/chat-place-card.tsx`): Inline place cards with save functionality
  - Messages API (`src/app/api/conversations/[id]/messages/route.ts`): SSE endpoint with OpenAI function calling

### Custom Emoji Markers (February 2026)
- **Feature**: Users can assign custom emojis to their saved places that display as map markers
- **Database**: Added `emoji` field (nullable string) to `SavedPlace` model
- **Emoji Picker**: Uses `emoji-picker-react` library with two variants:
  - `inline`: Small ghost button next to text (original)
  - `area`: 48px muted square that replaces the photo as primary visual
- **Place Cards**: Emoji now replaces the photo as the primary visual element
  - 48px muted background square with centered emoji
  - Entire area is clickable to open the emoji picker
  - If no emoji set, shows a muted MapPin icon as placeholder
- **Map Integration**:
  - Uses custom `OverlayView`-based emoji markers (no mapId required, so custom styles work)
  - Falls back to regular `Marker` with colored circles for non-emoji places
  - Factory function `createEmojiMarkerOverlay` creates overlays after Google Maps API loads
- **UI Components**:
  - `EmojiPickerPopover` (`src/components/shared/emoji-picker-popover.tsx`): Supports both inline and area variants
  - Emoji picker only visible when viewing own profile (`isOwnProfile=true`)
  - Not shown on list detail pages (list_place IDs differ from saved_place IDs)
- **API**: PATCH `/api/saved-places/[id]` accepts `emoji` field for updating saved place emoji
- **Backfill**: Script at `scripts/backfill-emojis.ts` assigns emojis based on place type (restaurant→🍽️, bar→🍸, park→🌳, etc.)