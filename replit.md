# Beli Clone - Place Saving Application

## Overview

This is a web-first clone of the Beli app, focused on discovering, saving, and viewing places on a map. The application allows users to search for places using Google Places API, save them with a status (WANT to visit or BEEN there), and view all saved places on an interactive Google Map.

Core features:
- User authentication (email/password signup and login)
- Google Places search with autocomplete
- Save places with WANT/BEEN status
- Interactive map displaying saved places with pins
- Place detail pages with status management

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript, using Vite as the build tool
- **Routing**: Wouter for client-side routing (lightweight alternative to React Router)
- **State Management**: TanStack React Query for server state, React Context for auth state
- **UI Components**: shadcn/ui component library with Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming, class-variance-authority (cva) for component variants

The frontend follows a page-based structure under `client/src/pages/` with shared components in `client/src/components/`. All UI must use shadcn/ui components exclusively - no other UI libraries.

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Session Management**: express-session with PostgreSQL session store (connect-pg-simple)
- **Authentication**: Custom session-based auth with bcryptjs for password hashing
- **API Structure**: RESTful endpoints under `/api/` prefix

The server uses a storage abstraction layer (`server/storage.ts`) that implements `IStorage` interface for database operations, making it easier to test and swap implementations.

### Data Storage
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with drizzle-zod for schema validation
- **Schema Location**: `shared/schema.ts` (shared between client and server)

Database tables:
- `users`: User accounts with email, username, password hash
- `places`: Cached place data from Google Places API (uses Google Place ID as unique identifier)
- `saved_places`: Junction table linking users to places with status (WANT/BEEN enum)

### Authentication Flow
- Session-based authentication stored in PostgreSQL
- Protected routes check `req.session.userId` 
- Frontend uses AuthContext provider to manage user state
- Auth state is fetched on app load via `/api/auth/me`

### External Integrations
- **Google Places API**: Used for place search autocomplete and fetching place details
- **Google Maps JavaScript API**: Renders interactive map with saved place markers

### Build System
- Development: Vite dev server with HMR, proxied through Express
- Production: Vite builds static assets to `dist/public`, esbuild bundles server to `dist/index.cjs`
- Build script in `script/build.ts` handles both client and server bundling

## External Dependencies

### APIs and Services
- **Google Places API**: Required for place search functionality. Needs `GOOGLE_PLACES_API_KEY` environment variable.
- **Google Maps JavaScript API**: Required for map display. Uses same API key.
- **PostgreSQL Database**: Required. Connection via `DATABASE_URL` environment variable.

### Key npm Dependencies
- `drizzle-orm` + `drizzle-kit`: Database ORM and migrations
- `express` + `express-session`: HTTP server and session handling
- `connect-pg-simple`: PostgreSQL session store
- `bcryptjs`: Password hashing
- `@tanstack/react-query`: Server state management
- `zod` + `drizzle-zod`: Schema validation
- `wouter`: Client-side routing
- shadcn/ui components (various `@radix-ui/*` packages)

### Environment Variables Required
- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: Secret key for session encryption (defaults to a placeholder in dev)
- `GOOGLE_PLACES_API_KEY`: API key for Google Places and Maps APIs

### Database Migrations
Run `npm run db:push` to push schema changes to the database using Drizzle Kit.