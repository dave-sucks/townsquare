# Beli Clone - Place Saving Application

## Overview

This is a web-first clone of the Beli app, focused on discovering, saving, and viewing places on a map. The application allows users to search for places using Google Places API, save them with a status (WANT to visit or BEEN there), and view all saved places on an interactive Google Map.

Core features:
- User authentication via Replit Auth (OIDC)
- Google Places search with autocomplete
- Save places with WANT/BEEN status
- Interactive map displaying saved places with color-coded pins (red=WANT, green=BEEN, blue=SELECTED)
- Tabs to filter saved places
- Bidirectional list↔map selection synchronization
- Map overlay preview card for selected places

## Recent Changes (Milestone 5 - Reviews & Photos)

**Date: January 31, 2026**

### Review System
- Users can write one review per place with 0-10 rating scale
- Review model with unique constraint on (userId, placeId)
- Review CRUD API routes at `/api/reviews` and `/api/reviews/[id]`
- ReviewDialog component with rating slider, note field, date picker, and photo upload
- Reviews displayed on place detail pages with followed users' reviews prioritized first
- Review creation triggers REVIEW_CREATED activity with rating in metadata

### Photo Upload System
- Photo model linked to reviews and/or places
- Replit Object Storage integration for cloud photo storage
- Two-step upload flow: request presigned URL → upload to GCS directly
- PhotoGallery component with lightbox viewer for browsing photos
- API routes at `/api/photos` and `/api/uploads/request-url`

### User Profile Updates
- New "Reviews" tab added to 4-tab layout (Want/Been/Reviews/Lists)
- Profile API now returns user's reviews with place info
- Review cards show rating badge, place name, note preview

### Map Preview Enhancements
- Preview card displays rating badge when user has reviewed the place
- "Add Review" button appears when place has no review yet
- Reviews data fetched via `/api/reviews?userId={userId}` for current user's reviews
- ReviewDialog invalidates all "my-reviews" queries using predicate to ensure map preview updates after review creation

### Activity Feed Updates
- REVIEW_CREATED activities rendered with rating information
- Activity metadata now includes rating for review activities

---

## Previous Changes (Milestone 4 - Social Following & Activity Feed)

**Date: January 31, 2026**

### Follow System
- Users can follow and unfollow other users
- Follow model with unique constraint on (followerId, followingId), prevents self-follows
- API routes at `/api/follows` for POST (follow) and DELETE (unfollow)
- Follow/Unfollow buttons on profile pages and people directory
- Follower/following counts displayed on profile pages

### Activity Feed (/home)
- Shows activity from current user and users they follow
- Activity types: PLACE_SAVED_WANT, PLACE_MARKED_BEEN, PLACE_ADDED_TO_LIST, LIST_CREATED, REVIEW_CREATED
- Activity cards with user avatar, action description, place/list links
- Infinite scroll pagination with cursor-based loading
- Empty state with links to browse people or go to map
- Deduplication prevents duplicate activities per user/type/target/day

### Activity Tracking
- All save/been/add-to-list/create-list actions now create Activity records
- DedupeKey format: `{actorId}:{type}:{targetId}:{date}` for daily deduplication
- Activity helper function at `src/lib/activity.ts`

### Social Context on Places
- Place detail pages now show "Friends who saved this place" section
- Displays followed users who have also saved the same place
- Shows their status (Want/Been) with links to their profiles

### Navigation Updates
- "Activity Feed" link added to user dropdown menu
- Links to /home accessible from the map view
- Post-login redirect now goes to /home (Activity Feed) instead of map view

### Auth Improvements
- Auth callback handles email conflicts gracefully by checking for existing users with same email
- Updated to support test environment scenarios with unique user ID generation

---

## Previous Changes (Milestone 3.5 - Pages & Deep Links)

**Date: January 31, 2026**

### Place Detail Pages (/places/[id])
- Full-page view for any place using Google Place ID as route parameter
- Shows place name, address, and current user's status (Want/Been/Not Saved)
- Action buttons: Mark as Want, Mark as Been, Add to List, Open in Google Maps
- Lists section showing which of user's lists contain the place
- Reviews placeholder section for future implementation
- API route at `/api/places/[placeId]` returns place details + user's saved status + lists containing place

### User Profile Pages (/u/[username])
- Profile page accessible by username or user ID
- Shows avatar, name, and placeholder Edit Profile/Follow buttons
- Three tabs: Want (WANT places), Been (BEEN places), Lists (user's lists)
- For non-owners: only shows PUBLIC lists
- Links from profile places to place detail pages
- API route at `/api/users/[username]` returns user data with want/been/lists

### People Directory (/people)
- Paginated list of all users (excluding current user)
- Debounced search by username
- User cards with avatar, name, and stats (places saved, lists created)
- Links to user profile pages
- API route at `/api/users?search=...` for listing/searching users

### Deep Linking
- PlaceRow: Clickable place name links to `/places/{googlePlaceId}`
- PlacePreview: "Open Details" button and clickable name link to place page
- List detail page: Place names now link to place detail pages
- User dropdown: "My Profile" and "Browse People" navigation links

### Auth Updates
- Added username field to auth user data
- Updated useAuth hook and /api/auth/user to include username

---

## Previous Changes (Phase 3 - Usability & Lists)

**Date: January 30, 2026**

### Lists/Collections Feature
- Users can create lists to organize saved places
- List model with visibility (PRIVATE/PUBLIC), name, and description
- Full CRUD API for lists at `/api/lists` and `/api/lists/[id]`
- Lists management page at `/lists` and individual list page at `/lists/[id]`
- AddToListDialog component for adding places to lists from map preview

### Filtering Architecture
- **List Filter**: Dropdown above tabs to filter by a specific list
- **Tab Filter**: WANT/BEEN/All status filter (applied after list filter)
- Filter order: List filter first → Tab filter second
- Tab counts show list-filtered results only (before applying tab filter)
- Map markers receive fully filtered places (both list and tab filters)
- Selection clears when selected place is filtered out

### Selection State Architecture
- `selectedPlaceId` state lives in `main-app.tsx` as the single source of truth
- No duplicated selection state across components
- Selection controls: active list row, active map marker, map center, and preview visibility

### List ↔ Map Synchronization
- **List → Map**: Clicking a place in the list sets selectedPlaceId, pans map to location, zooms to street level, and shows preview card
- **Map → List**: Clicking a map marker sets selectedPlaceId, highlights corresponding list row, scrolls list to bring row into view, and shows preview card
- Uses React refs (placeRowRefs) to scroll list items into view when marker is clicked

### Components
- `src/components/place-row.tsx`: Wrapper component for list items with cva variants for selection highlighting
- `src/components/place-preview.tsx`: Map overlay showing place name, address, status, and quick actions (including add to list)
- `src/components/add-to-list-dialog.tsx`: Dialog for adding places to lists
- `src/components/ui/scroll-area.tsx`: shadcn ScrollArea for independent list scrolling

### Marker States
Three distinct visual states for map markers:
1. **WANT**: Red (#ef4444), 24px, heart icon
2. **BEEN**: Green (#22c55e), 24px, checkmark icon  
3. **SELECTED**: Blue (#3b82f6), 32px, larger with 3px white border, z-index 1000

### Layout
- Full viewport height layout (h-screen) with overflow-hidden
- Left panel: List filter dropdown + Tabs at top, ScrollArea for place list below
- Right panel: Full-height map with relative positioning for preview overlay
- Header remains sticky at top

## User Preferences

Preferred communication style: Simple, everyday language.
UI components: All UI must use shadcn/ui components exclusively - no ad-hoc Tailwind or custom components.

## System Architecture

### Frontend Architecture
- **Framework**: Next.js 16 with App Router and TypeScript
- **State Management**: TanStack React Query for server state
- **UI Components**: shadcn/ui component library with Radix UI primitives (nova style, stone theme)
- **Styling**: Tailwind CSS with CSS variables for theming

The frontend follows a page-based structure under `src/app/` with shared components in `src/components/`.

### Backend Architecture
- **Framework**: Next.js API Routes (App Router)
- **Session Management**: iron-session for encrypted cookies
- **Authentication**: Replit Auth via OpenID Connect (OIDC)
- **API Structure**: RESTful endpoints under `/api/` prefix

### Data Storage
- **Database**: PostgreSQL (Neon-backed on Replit)
- **ORM**: Prisma 7 with pg adapter
- **Schema Location**: `prisma/schema.prisma`

Database tables:
- `users`: User accounts with Replit user ID, email, firstName, lastName, profileImageUrl
- `session`: Session data (for express session compatibility)
- `places`: Cached place data from Google Places API (uses Google Place ID as unique identifier)
- `saved_places`: Junction table linking users to places with status (WANT/BEEN enum)

### Authentication Flow
- Replit Auth via OIDC provider at https://replit.com/oidc
- Session stored in encrypted cookie via iron-session
- Protected API routes check session for userId
- Frontend uses useAuth hook to manage user state
- Auth state is fetched on app load via `/api/auth/user`

### External Integrations
- **Google Places API**: Used for place search autocomplete and fetching place details
- **Google Maps JavaScript API**: Renders interactive map with saved place markers

### API Routes
- `GET /api/login` - Initiates OIDC login flow
- `GET /api/logout` - Logs out user and destroys session
- `GET /api/auth/callback` - OIDC callback handler
- `GET /api/auth/user` - Get current authenticated user
- `GET /api/places/search?q=...` - Search places via Google Places Autocomplete
- `GET /api/places/details?place_id=...` - Get place details
- `GET /api/saved-places` - Get user's saved places
- `POST /api/saved-places` - Save a new place
- `PATCH /api/saved-places/[id]` - Update saved place status
- `DELETE /api/saved-places/[id]` - Remove saved place

## External Dependencies

### APIs and Services
- **Google Places API**: Required for place search functionality.
- **Google Maps JavaScript API**: Required for map display.
- **PostgreSQL Database**: Required. Connection via `DATABASE_URL` environment variable.
- **Replit Auth**: OIDC authentication via Replit.

### Key npm Dependencies
- `prisma` + `@prisma/client` + `@prisma/adapter-pg`: Database ORM
- `iron-session`: Session management
- `openid-client`: OIDC authentication
- `@tanstack/react-query`: Server state management
- shadcn/ui components (various `@radix-ui/*` packages)
- `lucide-react`: Icons

### Environment Variables Required
- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: Secret key for session encryption
- `GOOGLE_MAPS_API_KEY`: API key for Google Places and Maps APIs
- `REPL_ID`: Replit deployment ID (auto-provided)
- `REPLIT_DEV_DOMAIN`: Development domain (auto-provided)

### Database Migrations
Run `npx prisma db push` to push schema changes to the database.
Run `npx prisma generate` to regenerate the Prisma client after schema changes.
