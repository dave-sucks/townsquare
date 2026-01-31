# Beli Clone - Place Saving Application

## Overview
This project is a web-first clone of the Beli app, designed to enable users to discover, save, and visualize places on an interactive map. Users can search for places using the Google Places API, categorize them with a "WANT to visit" or "BEEN there" status, and view all their saved locations on a Google Map with color-coded pins. The application aims to provide a seamless experience for managing personal place collections, fostering social interaction through following other users and sharing activities, and organizing places into custom lists. Key capabilities include user authentication, Google Places search with autocomplete, status-based saving, interactive map display, and a responsive UI that adapts to desktop and mobile. The long-term vision is to become a comprehensive platform for personal travel and exploration planning, enhancing user engagement through social features and personalized content.

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
- **Lists**: Users can create private or public lists to organize saved places, with a dedicated management page and individual list detail views.
- **Place Details**: Dedicated full-page and modal views for place details, including photos, user reviews, and social context (friends who saved).
- **Social Features**: User profiles, a people directory, and an activity feed displaying actions from the user and followed accounts.

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