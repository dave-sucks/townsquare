# Beli Clone - Place Saving Application

## Overview

This is a web-first clone of the Beli app, focused on discovering, saving, and viewing places on a map. The application allows users to search for places using Google Places API, save them with a status (WANT to visit or BEEN there), and view all saved places on an interactive Google Map.

Core features:
- User authentication via Replit Auth (OIDC)
- Google Places search with autocomplete
- Save places with WANT/BEEN status
- Interactive map displaying saved places with color-coded pins (red=WANT, green=BEEN)
- Tabs to filter saved places

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
