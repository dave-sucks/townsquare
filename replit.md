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