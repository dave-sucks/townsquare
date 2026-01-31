# Food Influencer App - Architecture Proposal

## Executive Summary

This document proposes a **unified component architecture** for a food discovery app where the core UI pattern (map + sidebar with places list) is shared across all views, with specialized sidebar content for different contexts (discover, user profiles, lists).

**Key Decision**: Use **composition over duplication** - build one shared `MapLayout` component that accepts different sidebar implementations rather than building separate page components with duplicated map logic.

---

## Design Philosophy

### The Unified UI Pattern

The app has one core interface pattern that appears everywhere:

```
┌─────────────┬──────────────────────┐
│  SIDEBAR    │                      │
│             │                      │
│  - Header   │       MAP            │
│  - Context  │                      │
│  - Places   │    (with pins)       │
│    List     │                      │
│             │                      │
└─────────────┴──────────────────────┘
```

This pattern appears in **every view**:
- **Home/Discover**: Sidebar shows recommended places + filters
- **User Profile**: Sidebar shows user info + their places/feed
- **List Detail**: Sidebar shows list metadata + places in list
- **Your Profile**: Sidebar shows discovery tools + personalized content

The **map is always the same**. The **sidebar adapts** to context.

---

## Why This Architecture?

### ❌ Problem: Separate Page Components

If we build each page as a separate component:

```tsx
// BAD: Duplicated logic across pages
function UserPage() {
  const [hoveredPlace, setHoveredPlace] = useState();
  const [selectedPlace, setSelectedPlace] = useState();
  const [viewport, setViewport] = useState(DEFAULT_VIEWPORT);
  
  return (
    <>
      <UserSidebar places={places} onHover={setHoveredPlace} />
      <Map places={places} hoveredPlace={hoveredPlace} viewport={viewport} />
    </>
  );
}

function ListPage() {
  // Copy-paste the EXACT same state management 🤮
  const [hoveredPlace, setHoveredPlace] = useState();
  const [selectedPlace, setSelectedPlace] = useState();
  const [viewport, setViewport] = useState(DEFAULT_VIEWPORT);
  
  return (
    <>
      <ListSidebar places={places} onHover={setHoveredPlace} />
      <Map places={places} hoveredPlace={hoveredPlace} viewport={viewport} />
    </>
  );
}
```

**Problems:**
- Map rendering logic duplicated 4+ times
- Hover state management duplicated 4+ times
- Viewport state duplicated 4+ times
- Bug fixes need to be applied to every page
- Adding map features (clustering, filtering) requires touching every file

### ✅ Solution: Shared Layout + Specialized Sidebars

```tsx
// GOOD: Shared map logic, swappable content
function UserPage() {
  const { user, places } = useUserProfile();
  
  return (
    <MapLayout places={places}>
      <UserSidebar user={user} places={places} />
    </MapLayout>
  );
}

function ListPage() {
  const { list, places } = useList();
  
  return (
    <MapLayout places={places}>
      <ListSidebar list={list} places={places} />
    </MapLayout>
  );
}
```

**Benefits:**
- Map logic lives in **one place**
- State management lives in **one place**
- Add map features (clustering, filters) in **one place**
- Each page only defines what makes it **unique** (the sidebar content)

---

## Component Architecture

### Folder Structure

```
/components
  /map
    MapLayout.tsx          ← Core layout: map + sidebar shell (SHARED)
    MapView.tsx            ← Map rendering logic (SHARED)
    PlaceMarkers.tsx       ← Pin rendering and clustering (SHARED)
    
  /sidebars
    DiscoverSidebar.tsx    ← Home page sidebar
    UserSidebar.tsx        ← User profile sidebar
    ListSidebar.tsx        ← List detail sidebar
    ProfileSidebar.tsx     ← Your profile sidebar
    
  /shared
    PlacesList.tsx         ← Reusable places list (SHARED)
    PlaceCard.tsx          ← Individual place card (SHARED)
    
/hooks
  useUserProfile.ts        ← Fetch user data
  useList.ts               ← Fetch list data
  useDiscoverPlaces.ts     ← Fetch recommended places
  
/app
  page.tsx                 ← Home/Discover
  users/[id]/page.tsx      ← User profile
  lists/[id]/page.tsx      ← List detail
  profile/page.tsx         ← Your profile
```

### The Layers

```
┌─────────────────────────────────────────┐
│         Page Component                  │  ← Fetches data
│  (Minimal - just data fetching)         │
└───────────────┬─────────────────────────┘
                │
                ↓ passes { places, metadata }
                │
┌───────────────┴─────────────────────────┐
│         MapLayout                       │  ← Shared map + state
│  • Map rendering                        │
│  • Hover state                          │
│  • Selection state                      │
│  • Viewport management                  │
└───────────────┬─────────────────────────┘
                │
                ↓ injects shared state
                │
┌───────────────┴─────────────────────────┐
│      Specialized Sidebar                │  ← Context-specific UI
│  • UserSidebar                          │
│  • ListSidebar                          │
│  • DiscoverSidebar                      │
└───────────────┬─────────────────────────┘
                │
                ↓ uses
                │
┌───────────────┴─────────────────────────┐
│      PlacesList (reusable)              │  ← Presentation
│  • Renders place cards                  │
│  • Handles hover                        │
│  • Shows status (Been/Want)             │
└─────────────────────────────────────────┘
```

---

## Implementation Details

### 1. MapLayout (The Foundation)

This is the **only** component that knows about:
- Map rendering
- Hover interactions
- Place selection
- Viewport state

```tsx
// components/map/MapLayout.tsx
interface MapLayoutProps {
  places: Place[];
  children: React.ReactNode;
  initialViewport?: Viewport;
  onPlaceSelect?: (place: Place) => void;
}

export function MapLayout({ 
  places, 
  children,
  initialViewport = DEFAULT_NYC_VIEWPORT,
  onPlaceSelect,
}: MapLayoutProps) {
  // ========================================
  // ALL map state lives here (nowhere else)
  // ========================================
  const [hoveredPlaceId, setHoveredPlaceId] = useState<string>();
  const [selectedPlaceId, setSelectedPlaceId] = useState<string>();
  const [viewport, setViewport] = useState(initialViewport);

  const handlePlaceSelect = (place: Place) => {
    setSelectedPlaceId(place.id);
    onPlaceSelect?.(place);
  };

  return (
    <div className="flex h-screen">
      {/* Sidebar - accepts any content */}
      <aside className="w-[400px] overflow-y-auto border-r bg-white">
        {/* Inject shared state into sidebar children */}
        {React.cloneElement(children as React.ReactElement, {
          hoveredPlaceId,
          onPlaceHover: setHoveredPlaceId,
          selectedPlaceId,
          onPlaceSelect: handlePlaceSelect,
        })}
      </aside>

      {/* Map - always the same */}
      <main className="flex-1 relative">
        <MapView
          places={places}
          viewport={viewport}
          onViewportChange={setViewport}
          hoveredPlaceId={hoveredPlaceId}
          selectedPlaceId={selectedPlaceId}
          onMarkerClick={handlePlaceSelect}
          onMarkerHover={setHoveredPlaceId}
        />
      </main>
    </div>
  );
}
```

**Key Points:**
- State is **internal** - pages don't manage it
- Children receive state via `cloneElement` (React's dependency injection)
- Map and sidebar stay **in sync automatically**

---

### 2. Specialized Sidebars

Each sidebar implements the same interface but renders different content.

#### UserSidebar - Profile with Places/Feed tabs

```tsx
// components/sidebars/UserSidebar.tsx
interface UserSidebarProps {
  user: User;
  places: Place[];
  
  // Injected by MapLayout
  hoveredPlaceId?: string;
  onPlaceHover?: (id: string) => void;
  selectedPlaceId?: string;
  onPlaceSelect?: (place: Place) => void;
}

export function UserSidebar({ 
  user, 
  places,
  hoveredPlaceId,
  onPlaceHover,
  selectedPlaceId,
  onPlaceSelect,
}: UserSidebarProps) {
  const [activeTab, setActiveTab] = useState<'places' | 'feed'>('places');

  return (
    <div className="flex flex-col h-full">
      {/* User Profile Header */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarImage src={user.profile_image_url} />
            <AvatarFallback>{user.first_name[0]}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="font-semibold">{user.first_name} {user.last_name}</h1>
            <p className="text-sm text-muted-foreground">@{user.username}</p>
          </div>
        </div>
        <p className="mt-2 text-sm">{user.bio}</p>
        <div className="flex gap-4 mt-2 text-sm">
          <span>{user.following_count} following</span>
          <span>{user.follower_count} followers</span>
        </div>
      </div>
      
      {/* Tabs - unique to user view */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
        <TabsList className="w-full">
          <TabsTrigger value="places" className="flex-1">Places</TabsTrigger>
          <TabsTrigger value="feed" className="flex-1">Feed</TabsTrigger>
        </TabsList>
        
        <TabsContent value="places" className="h-full overflow-y-auto">
          <PlacesList 
            places={places}
            hoveredPlaceId={hoveredPlaceId}
            onPlaceHover={onPlaceHover}
            selectedPlaceId={selectedPlaceId}
            onPlaceSelect={onPlaceSelect}
          />
        </TabsContent>
        
        <TabsContent value="feed" className="h-full overflow-y-auto">
          <ActivityFeed userId={user.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

#### ListSidebar - List metadata + editable places

```tsx
// components/sidebars/ListSidebar.tsx
interface ListSidebarProps {
  list: List;
  places: Place[];
  allowEdit?: boolean;
  
  // Injected by MapLayout
  hoveredPlaceId?: string;
  onPlaceHover?: (id: string) => void;
  selectedPlaceId?: string;
  onPlaceSelect?: (place: Place) => void;
}

export function ListSidebar({ 
  list, 
  places,
  allowEdit = false,
  hoveredPlaceId,
  onPlaceHover,
  selectedPlaceId,
  onPlaceSelect,
}: ListSidebarProps) {
  return (
    <div className="flex flex-col h-full">
      {/* List Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">{list.name}</h1>
          {allowEdit && (
            <Button variant="ghost" size="sm">
              <Pencil className="h-4 w-4" />
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {list.description}
        </p>
        <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
          <span>{places.length} places</span>
          <span>•</span>
          <span>{list.visibility === 'PUBLIC' ? 'Public' : 'Private'}</span>
        </div>
      </div>
      
      {/* Optional: Rich content for blog-like lists */}
      {list.content && (
        <div className="p-4 border-b prose prose-sm">
          <RichTextRenderer content={list.content} />
        </div>
      )}
      
      {/* Places in this list */}
      <div className="flex-1 overflow-y-auto">
        <PlacesList 
          places={places}
          hoveredPlaceId={hoveredPlaceId}
          onPlaceHover={onPlaceHover}
          selectedPlaceId={selectedPlaceId}
          onPlaceSelect={onPlaceSelect}
          sortable={allowEdit}
          showNotes
        />
      </div>
    </div>
  );
}
```

#### DiscoverSidebar - Recommendations + filters

```tsx
// components/sidebars/DiscoverSidebar.tsx
interface DiscoverSidebarProps {
  places: Place[];
  showFilters?: boolean;
  showRecommended?: boolean;
  
  // Injected by MapLayout
  hoveredPlaceId?: string;
  onPlaceHover?: (id: string) => void;
  selectedPlaceId?: string;
  onPlaceSelect?: (place: Place) => void;
}

export function DiscoverSidebar({ 
  places,
  showFilters = true,
  showRecommended = true,
  hoveredPlaceId,
  onPlaceHover,
  selectedPlaceId,
  onPlaceSelect,
}: DiscoverSidebarProps) {
  const [filters, setFilters] = useState({
    status: 'all' as 'all' | 'been' | 'want',
    type: 'all' as 'all' | 'restaurant' | 'bar' | 'cafe',
  });

  const filteredPlaces = places.filter(place => {
    // Apply filter logic
    return true;
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b">
        <h1 className="text-xl font-bold">Discover</h1>
        <p className="text-sm text-muted-foreground">
          Places people love in NYC
        </p>
      </div>
      
      {/* Filters */}
      {showFilters && (
        <div className="p-4 border-b space-y-3">
          <Select 
            value={filters.status} 
            onValueChange={(v) => setFilters({ ...filters, status: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Places</SelectItem>
              <SelectItem value="been">Been</SelectItem>
              <SelectItem value="want">Want to Go</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      
      {/* Recommended Section */}
      {showRecommended && (
        <div className="p-4 border-b">
          <h3 className="font-semibold mb-2">Trending This Week</h3>
          <div className="space-y-2">
            {places.slice(0, 3).map(place => (
              <PlaceCard 
                key={place.id} 
                place={place} 
                compact 
                onHover={() => onPlaceHover?.(place.id)}
              />
            ))}
          </div>
        </div>
      )}
      
      {/* All Places */}
      <div className="flex-1 overflow-y-auto">
        <PlacesList 
          places={filteredPlaces}
          hoveredPlaceId={hoveredPlaceId}
          onPlaceHover={onPlaceHover}
          selectedPlaceId={selectedPlaceId}
          onPlaceSelect={onPlaceSelect}
        />
      </div>
    </div>
  );
}
```

---

### 3. Reusable PlacesList Component

This component is **completely dumb** - it just renders places and calls callbacks.

```tsx
// components/shared/PlacesList.tsx
interface PlacesListProps {
  places: Place[];
  hoveredPlaceId?: string;
  onPlaceHover?: (id: string) => void;
  selectedPlaceId?: string;
  onPlaceSelect?: (place: Place) => void;
  sortable?: boolean;
  showNotes?: boolean;
}

export function PlacesList({
  places,
  hoveredPlaceId,
  onPlaceHover,
  selectedPlaceId,
  onPlaceSelect,
  sortable = false,
  showNotes = false,
}: PlacesListProps) {
  return (
    <div className="divide-y">
      {places.map((place) => (
        <PlaceCard
          key={place.id}
          place={place}
          isHovered={hoveredPlaceId === place.id}
          isSelected={selectedPlaceId === place.id}
          onHover={() => onPlaceHover?.(place.id)}
          onClick={() => onPlaceSelect?.(place)}
          showNote={showNotes}
          draggable={sortable}
        />
      ))}
    </div>
  );
}
```

---

### 4. Page Components (Minimal)

Pages become **extremely simple** - they just fetch data and compose.

```tsx
// app/page.tsx (Home/Discover)
export default function HomePage() {
  const { places, isLoading } = useDiscoverPlaces();
  
  if (isLoading) return <LoadingSpinner />;
  
  return (
    <MapLayout places={places}>
      <DiscoverSidebar 
        places={places}
        showFilters
        showRecommended
      />
    </MapLayout>
  );
}

// app/users/[id]/page.tsx (User Profile)
export default function UserPage({ params }: { params: { id: string } }) {
  const { user, places, isLoading } = useUserProfile(params.id);
  
  if (isLoading) return <LoadingSpinner />;
  
  return (
    <MapLayout places={places}>
      <UserSidebar user={user} places={places} />
    </MapLayout>
  );
}

// app/lists/[id]/page.tsx (List Detail)
export default function ListPage({ params }: { params: { id: string } }) {
  const { list, places, isLoading } = useList(params.id);
  const { user } = useAuth();
  
  if (isLoading) return <LoadingSpinner />;
  
  return (
    <MapLayout places={places}>
      <ListSidebar 
        list={list} 
        places={places}
        allowEdit={list.user_id === user?.id}
      />
    </MapLayout>
  );
}

// app/profile/page.tsx (Your Profile)
export default function ProfilePage() {
  const { user } = useAuth();
  const { places, isLoading } = useUserPlaces(user.id);
  
  if (isLoading) return <LoadingSpinner />;
  
  return (
    <MapLayout places={places}>
      <ProfileSidebar 
        user={user} 
        places={places}
        isOwnProfile
      />
    </MapLayout>
  );
}
```

**Notice:**
- Pages are 10-15 lines each
- No map logic
- No state management
- Just data fetching + composition

---

## Data Flow

### How Data Flows Through the System

```
1. Page fetches data
   ↓
2. Page normalizes to { places[], metadata }
   ↓
3. Page passes to MapLayout
   ↓
4. MapLayout manages spatial state (hover, selection, viewport)
   ↓
5. MapLayout injects state into sidebar
   ↓
6. Sidebar uses PlacesList to render
   ↓
7. User interactions trigger callbacks
   ↓
8. Callbacks update MapLayout state
   ↓
9. State changes re-render map + sidebar (synchronized)
```

### Example: User Hovers a Place Card

```
User hovers place card
  ↓
PlaceCard calls onHover(placeId)
  ↓
PlacesList forwards to onPlaceHover(placeId)
  ↓
Sidebar forwards to onPlaceHover (injected by MapLayout)
  ↓
MapLayout updates hoveredPlaceId state
  ↓
MapLayout re-renders:
  • PlaceCard gets isHovered={true}
  • Map pin gets highlighted
```

**Both update in sync** because they share the same state source.

---

## Benefits of This Architecture

### 1. DRY (Don't Repeat Yourself)

Map logic exists in **exactly one place**:
- ✅ Bug fix map clustering → affects all pages
- ✅ Add map filters → affects all pages
- ✅ Improve hover performance → affects all pages

### 2. Type Safety

TypeScript ensures all sidebars implement the same interface:

```tsx
interface SidebarInjectedProps {
  hoveredPlaceId?: string;
  onPlaceHover?: (id: string) => void;
  selectedPlaceId?: string;
  onPlaceSelect?: (place: Place) => void;
}
```

Every sidebar gets these props. Compile-time safety.

### 3. Easy to Extend

Want a new view? Just create a new sidebar:

```tsx
// components/sidebars/CollectionSidebar.tsx
export function CollectionSidebar({ collection, places, ...injectedProps }) {
  return (
    <div>
      <CollectionHeader collection={collection} />
      <PlacesList places={places} {...injectedProps} />
    </div>
  );
}

// app/collections/[id]/page.tsx
export default function CollectionPage({ params }) {
  const { collection, places } = useCollection(params.id);
  return (
    <MapLayout places={places}>
      <CollectionSidebar collection={collection} places={places} />
    </MapLayout>
  );
}
```

That's it. Map "just works".

### 4. Testable

Each layer can be tested independently:

```tsx
// Test MapLayout
it('highlights hovered place on map and sidebar', () => {
  render(
    <MapLayout places={mockPlaces}>
      <TestSidebar />
    </MapLayout>
  );
  // Test hover behavior
});

// Test sidebar in isolation
it('renders user profile correctly', () => {
  render(<UserSidebar user={mockUser} places={mockPlaces} />);
  // Test UI without map
});
```

### 5. Performance

Optimization happens once:

```tsx
// Optimize MapLayout once
const MapLayout = memo(function MapLayout({ places, children }) {
  // Memoize expensive operations
  const clusteredPlaces = useMemo(() => 
    clusterPlaces(places, viewport),
    [places, viewport]
  );
  
  // ... rest of component
});
```

All pages benefit from optimization.

---

## Trade-offs & Considerations

### ⚠️ Sidebar Props Injection

**Approach**: Using `React.cloneElement` to inject props

**Pros:**
- Sidebars don't need to know about MapLayout
- Clean separation of concerns
- Easy to understand

**Cons:**
- Slightly "magical" - props appear from nowhere
- Must document the injected props interface

**Alternative**: Context API
```tsx
// Could use context instead
const MapContext = createContext<MapState>();

function UserSidebar() {
  const { hoveredPlaceId, onPlaceHover } = useMapContext();
  // ...
}
```

Both work. `cloneElement` is simpler for this use case.

---

### ⚠️ Sidebar State Coordination

**Question**: What if a sidebar needs to control the map (e.g., "fit bounds to list")?

**Solution**: Add optional callbacks to MapLayout

```tsx
interface MapLayoutProps {
  places: Place[];
  children: React.ReactNode;
  onFitBounds?: (bounds: Bounds) => void; // Allow sidebar to control viewport
}

// Then sidebar can call it
<Button onClick={() => onFitBounds(calculateBounds(places))}>
  Show All
</Button>
```

---

### ⚠️ Multiple Maps Per Page?

**Question**: What if we want a detail view with multiple maps?

**Answer**: This architecture is for the **primary view**. Detail modals/drawers would use a different pattern (likely a simpler `<StaticMap>` component).

---

## Implementation Plan

### Phase 1: Foundation
1. Build `MapLayout` component with basic state
2. Build `MapView` component (just the map)
3. Build `PlacesList` component (just the list)
4. Test these three together

### Phase 2: First Sidebar
1. Build `DiscoverSidebar` (simplest - no user data)
2. Wire up to home page
3. Verify hover/selection works end-to-end

### Phase 3: Other Sidebars
1. Build `UserSidebar` with tabs
2. Build `ListSidebar` with edit mode
3. Build `ProfileSidebar` with discovery features

### Phase 4: Polish
1. Add map clustering
2. Add filters
3. Add animations
4. Performance optimization

---

## API Design

Keep data fetching **separate by domain**:

```tsx
// hooks/useUserProfile.ts
export function useUserProfile(userId: string) {
  return useQuery({
    queryKey: ['user', userId],
    queryFn: () => api.users.get(userId),
    select: (data) => ({
      user: data.user,
      places: data.saved_places.map(normalizePlaceFromAPI),
      stats: {
        savedCount: data.saved_places.length,
        listsCount: data.lists.length,
      },
    }),
  });
}

// hooks/useList.ts
export function useList(listId: string) {
  return useQuery({
    queryKey: ['list', listId],
    queryFn: () => api.lists.get(listId),
    select: (data) => ({
      list: data,
      places: data.list_places.map(normalizePlaceFromAPI),
    }),
  });
}
```

Each hook returns **normalized data** in a consistent format. Pages don't care about the API structure.

---

## File Size Comparison

### ❌ Without Shared Architecture

```
pages/
  user.tsx           → 450 lines (map logic + UI)
  list.tsx           → 520 lines (map logic + UI)
  discover.tsx       → 380 lines (map logic + UI)
  profile.tsx        → 490 lines (map logic + UI)
TOTAL: ~1,840 lines
DUPLICATION: ~70% (map logic repeated)
```

### ✅ With Shared Architecture

```
components/
  map/
    MapLayout.tsx    → 150 lines (ALL map logic)
  sidebars/
    UserSidebar.tsx      → 120 lines
    ListSidebar.tsx      → 100 lines
    DiscoverSidebar.tsx  → 80 lines
    ProfileSidebar.tsx   → 110 lines
pages/
  user.tsx         → 15 lines (just composition)
  list.tsx         → 15 lines (just composition)
  discover.tsx     → 12 lines (just composition)
  profile.tsx      → 15 lines (just composition)
TOTAL: ~617 lines
DUPLICATION: 0%
```

**67% less code. Zero duplication.**

---

## Conclusion

This architecture follows React's core principle: **composition over inheritance**.

Instead of building 4 separate page components that duplicate map logic, we build:
1. **One MapLayout** that handles all spatial interactions
2. **Four specialized sidebars** that handle context-specific UI
3. **Reusable components** (PlacesList, PlaceCard) that work everywhere

**Result:**
- Less code
- Easier to maintain
- Easier to extend
- Better performance
- Type-safe
- Testable

This is exactly how apps like Beli, Yelp, and Google Maps are architected. One map component, swappable content.

---

## Next Steps

1. **Start with MapLayout** - Get the foundation right
2. **Build one sidebar** - Prove the pattern works
3. **Replicate** - Copy pattern for other views
4. **Polish** - Add features to MapLayout, all pages benefit

Questions? Let's discuss specific implementation details.
