# Twn Sq - Place Saving Application

## Overview
Twn Sq is a web-first application designed to enable users to discover, save, and visualize places on an interactive map. Users can search for places using the Google Places API, save them to custom lists, mark places as "been" with ratings (bad/okay/great), and view all saved locations on a Google Map with color-coded pins. The application aims to provide a seamless experience for managing personal place collections, fostering social interaction through following other users and sharing activities, and organizing places into custom lists. Key capabilities include user authentication, Google Places search with autocomplete, flexible save-with-rating system, list management, interactive map display, and a responsive UI that adapts to desktop and mobile. The long-term vision is to become a comprehensive platform for personal travel and exploration planning, enhancing user engagement through social features and personalized content.

## User Preferences
Preferred communication style: Simple, everyday language.
UI components: All UI must use shadcn/ui components exclusively - no ad-hoc Tailwind or custom components.

## System Architecture

### Frontend Architecture
- **Framework**: Next.js 16 with App Router and TypeScript.
- **State Management**: TanStack React Query for server-side state.
- **UI Components**: shadcn/ui component library, built on Radix UI primitives (nova style, stone theme).
- **Styling**: Tailwind CSS, utilizing CSS variables for theming.
- **Layout**: Full-width Google Map as the primary content area, with floating UI elements for search, settings, and place lists. Responsive design includes a floating sidebar for desktop and an interactive draggable bottom sheet for mobile with three snap points. **IMPORTANT**: Always use `h-dvh` (not `h-screen`) for full-viewport containers — `100vh` is broken on mobile browsers where the URL bar makes the viewport shorter than `100vh`.
- **Search Bar**: FloatingSearch renders at the MapLayout level (not inside PlaceMap) with `z-[55]`, independent of Google Maps lifecycle.
- **Map Features**: Dynamic map styling with multiple themes, map settings popover for radius, traffic, and transit layers, and custom emoji markers.
- **Place Interaction**: Bidirectional synchronization between the place list and map, including visual cues for selection, map panning, and scrolling.
- **Lists**: Users can create private or public lists to organize saved places.
- **Place Details**: Dedicated full-page and modal views for place details, including photos, user reviews, and social context.
- **Social Features**: User profiles, a people directory, and an activity feed displaying actions from the user and followed accounts, including social post embeds in reviews.
- **Profile Pages**: Map-based dashboard layout with floating sidebar containing profile header and tabbed content for Places and Feed.
- **Tagging System**: Robust tagging system for places with categories like Vibe, Food Type, Occasion, Features, Dietary, Drinks. Tags have search weights for ranking.
- **AI Chat**: New `/chat` page with conversation-based AI assistant for place discovery using OpenAI Function Calling and displaying place cards. Home state shows input field ready to type; creates conversation on first message.
- **Activity Feed**: Supports "All" and "Following" tabs with filter API parameter. Following tab shows contextual empty state for users not following anyone.
- **Bottom Sheet**: Accepts `requestedSnapPoint` prop to programmatically snap (e.g., snap to mid when a place is selected on mobile).

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
- **Custom Emoji Markers**: Added `emoji` field to `SavedPlace` model.
- **Social Post Embeds**: `Review` model includes fields for `socialPostCaption`, `socialPostMediaUrl`, `socialPostMediaType`, `socialPostLikes`, and `socialPostPostedAt`.

### Authentication Flow
- Initiated via Replit Auth (OIDC provider: `https://replit.com/oidc`).
- Session data is stored in an encrypted cookie using `iron-session`.
- Protected API routes validate user sessions based on `userId`.
- Frontend utilizes a `useAuth` hook for managing user authentication state.

## External Dependencies

### APIs and Services
- **Google Places API**: For place search, autocomplete, and fetching detailed place information.
- **Google Maps JavaScript API**: For rendering interactive maps and displaying place markers.
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

### Environment Variables Required
- `DATABASE_URL`: Connection string for the PostgreSQL database.
- `SESSION_SECRET`: Secret key for encrypting session cookies.
- `GOOGLE_MAPS_API_KEY`: API key for Google Places and Maps services.
- `REPL_ID`: Replit deployment identifier.
- `REPLIT_DEV_DOMAIN`: Development domain.