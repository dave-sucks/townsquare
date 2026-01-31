# Map Details Popover

A floating control panel for customizing map appearance. Sits in the bottom-left corner of the map as a small thumbnail button that expands into a settings popover.

![Component Preview](https://placeholder-for-screenshot.png)

---

## What It Does

A single button on the map that opens a popover with these controls:

| Control | What It Does |
|---------|--------------|
| **Map Style** | Switch between Standard, Satellite, Terrain (and custom themes) |
| **Map Radius** | Slider that adjusts zoom level based on visible distance (¼ mi to 10 mi) |
| **Labels** | Dropdown to control label density (None → Streets → POIs → All) |
| **Traffic** | Toggle real-time traffic overlay |
| **Transit** | Toggle public transit routes overlay |

---

## Design Specs

### Trigger Button (Bottom-Left of Map)

```
┌──────────┐
│  [map    │  40×40px button
│  thumb]  │  2px white border, rounded-lg
└──────────┘  Shows mini preview of current map style
```

- Position: `absolute bottom-3 left-3`
- On click: Opens popover above it
- Shows current map type as SVG thumbnail

### Expanded Popover

```
┌─────────────────────────────────┐
│ Map details              [X]   │  ← Header with close button
├─────────────────────────────────┤
│ MAP STYLE                       │
│ ┌────┐ ┌────┐ ┌────┐ ┌────┐    │
│ │Std │ │Sat │ │Ter │ │Silv│    │  ← 4-column grid of style options
│ └────┘ └────┘ └────┘ └────┘    │
│ ┌────┐ ┌────┐ ┌────┐ ┌────┐    │
│ │Ret │ │Dark│ │Nite│ │Aub │    │
│ └────┘ └────┘ └────┘ └────┘    │
├─────────────────────────────────┤
│ Map radius              1 mi   │
│ ○━━━━━━━━●━━━━━━━━━━━━━━━━○    │  ← Slider
│ ¼ mi                    10 mi  │
├─────────────────────────────────┤
│ LABELS                          │
│ ┌─────────────────────────────┐│
│ │ Standard ▾                  ││  ← Dropdown
│ └─────────────────────────────┘│
├─────────────────────────────────┤
│ OVERLAYS                        │
│ 🚗 Traffic              [═══]  │  ← Toggle switches
│ 🚆 Transit              [   ]  │
└─────────────────────────────────┘
```

**Panel specs:**
- Width: 300px fixed
- Position: 8px above the trigger button
- Style: Glass panel with backdrop blur
- Animation: Fade in + slide up (200ms)

### Glass Panel CSS

```css
.glass-panel {
  background: rgba(250, 250, 250, 0.88);
  backdrop-filter: blur(12px) saturate(180%);
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 12px;
  box-shadow: 
    0 1px 3px rgba(0, 0, 0, 0.04),
    0 8px 24px rgba(0, 0, 0, 0.08);
}

/* Dark mode */
.dark .glass-panel {
  background: rgba(23, 23, 23, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 
    0 1px 3px rgba(0, 0, 0, 0.2),
    0 8px 24px rgba(0, 0, 0, 0.4);
}
```

---

## How Each Control Works

### 1. Map Style Selector

**What the user sees:** Grid of thumbnail previews for each style

**How it works:**

```typescript
// For satellite/terrain - change the Google Maps mapTypeId
map.setMapTypeId('satellite') // or 'terrain' or 'roadmap'

// For custom themes (Silver, Dark, etc) - apply JSON styles
map.setOptions({ styles: SILVER_STYLE })
```

**The style definitions** are arrays of rules that change colors:

```typescript
const SILVER_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
  { featureType: 'water', stylers: [{ color: '#c9c9c9' }] },
  { featureType: 'road', stylers: [{ color: '#ffffff' }] },
  // ... more rules for parks, labels, etc.
]
```

Full theme definitions are in the appendix below.

---

### 2. Map Radius Slider

**What the user sees:** Slider from ¼ mile to 10 miles with current value displayed

**How it works:**

The slider maps to predefined radius values, then converts to a zoom level:

```typescript
// Non-linear steps for better UX (more granular at close range)
const RADIUS_STEPS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 5, 7, 10] // miles

// Slider position (0-100) → Radius value
function sliderToRadius(sliderValue: number): number {
  const index = Math.round((sliderValue / 100) * (RADIUS_STEPS.length - 1))
  return RADIUS_STEPS[index]
}

// Radius → Zoom level
function getZoomForRadius(miles: number): number {
  if (miles <= 0.25) return 15.5
  if (miles <= 0.5) return 14.5
  if (miles <= 0.75) return 14
  if (miles <= 1) return 13.5
  if (miles <= 1.5) return 13
  if (miles <= 2) return 12.5
  if (miles <= 3) return 12
  if (miles <= 4) return 11.5
  if (miles <= 5) return 11
  if (miles <= 7) return 10.5
  return 10
}

// Apply to map
map.setZoom(getZoomForRadius(radius))
```

**Visual feedback while dragging:** Show a circle overlay on the map:

```typescript
const circle = new google.maps.Circle({
  map: map,
  center: mapCenter,
  radius: radiusMiles * 1609.34, // Convert to meters
  strokeColor: '#3b82f6',
  strokeWeight: 2,
  fillColor: '#3b82f6',
  fillOpacity: 0.1,
})

// Remove circle when user releases slider
circle.setMap(null)
```

---

### 3. Labels Dropdown

**What the user sees:** Dropdown with 4 options

| Option | Shows |
|--------|-------|
| Clean | No labels at all |
| Minimal | Street names only |
| Standard | Streets + major POIs |
| Detailed | Everything |

**How it works:**

Labels are controlled via Google Cloud Map IDs. Each Map ID is pre-configured in Google Cloud Console with different feature visibility settings.

```typescript
// You need to create these in Google Cloud Console
const MAP_IDS = {
  CLEAN: 'your-clean-map-id',
  MINIMAL: 'your-minimal-map-id', 
  STANDARD: 'your-standard-map-id',
  DETAILED: 'your-detailed-map-id',
}

// To change labels, you must recreate the map with the new Map ID
const newMap = new google.maps.Map(container, {
  mapId: MAP_IDS.MINIMAL,
  center: oldMap.getCenter(),
  zoom: oldMap.getZoom(),
  // ... preserve other settings
})
```

> **Note:** Changing Map ID requires recreating the map instance. Save the current center/zoom/tilt/heading before recreating, then restore them.

**Alternative (no Cloud setup):** Use JSON styling to hide labels:

```typescript
// Hide all labels
map.setOptions({
  styles: [{ elementType: 'labels', stylers: [{ visibility: 'off' }] }]
})

// Hide just POI labels
map.setOptions({
  styles: [{ featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }]
})
```

---

### 4. Traffic Toggle

**What the user sees:** Switch that shows/hides real-time traffic

**How it works:**

```typescript
// Create once, reuse
const trafficLayer = new google.maps.TrafficLayer()

// Show traffic
trafficLayer.setMap(map)

// Hide traffic
trafficLayer.setMap(null)
```

---

### 5. Transit Toggle

**What the user sees:** Switch that shows/hides public transit routes

**How it works:**

```typescript
const transitLayer = new google.maps.TransitLayer()

// Show transit
transitLayer.setMap(map)

// Hide transit  
transitLayer.setMap(null)
```

---

## Component Structure

```tsx
function BasemapSwitcher({ map, mapCenter, currentMapType, onMapTypeChange, ... }) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  // Layer refs (create once, toggle on/off)
  const trafficLayerRef = useRef<google.maps.TrafficLayer | null>(null)
  const transitLayerRef = useRef<google.maps.TransitLayer | null>(null)
  
  return (
    <div className="absolute bottom-3 left-3 z-10">
      {/* Expanded Panel */}
      {isExpanded && (
        <div className="absolute bottom-[calc(100%+8px)] left-0 w-[300px] glass-panel">
          {/* Header */}
          {/* Map Style Grid */}
          {/* Radius Slider */}
          {/* Labels Dropdown */}
          {/* Overlay Toggles */}
        </div>
      )}
      
      {/* Trigger Button */}
      <button onClick={() => setIsExpanded(!isExpanded)}>
        <MapThumbnail type={currentMapType} />
      </button>
    </div>
  )
}
```

---

## Behavior Details

### Opening/Closing

```typescript
// Close on click outside
useEffect(() => {
  const handleClickOutside = (e: MouseEvent) => {
    if (!containerRef.current?.contains(e.target as Node)) {
      setIsExpanded(false)
    }
  }
  
  if (isExpanded) {
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }
}, [isExpanded])

// Close on Escape
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') setIsExpanded(false)
  }
  
  if (isExpanded) {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }
}, [isExpanded])
```

### Don't Close When Using Dropdowns

```typescript
// In click-outside handler, ignore clicks on dropdown portals
const handleClickOutside = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  if (target.closest('[data-radix-popper-content-wrapper]')) return // Dropdown portal
  // ... rest of handler
}
```

---

## Map Thumbnail SVGs

Small preview images for the trigger button and style selector grid.

### Standard (Roadmap)

```tsx
<svg viewBox="0 0 80 60" className="w-full h-full">
  {/* Base */}
  <rect fill="#f5f5f5" width="80" height="60" />
  {/* Water */}
  <path d="M0 42 Q25 36, 50 44 Q68 52, 80 48 L80 60 L0 60 Z" fill="#aadaff" opacity="0.8" />
  {/* Parks */}
  <rect fill="#c8e4c8" x="52" y="6" width="16" height="12" rx="2" />
  <rect fill="#c8e4c8" x="6" y="24" width="10" height="10" rx="2" />
  {/* Roads */}
  <path d="M0 18 L80 18" stroke="#e8e8e8" strokeWidth="3.5" />
  <path d="M35 0 L35 42" stroke="#e8e8e8" strokeWidth="3.5" />
</svg>
```

### Satellite

```tsx
<svg viewBox="0 0 80 60" className="w-full h-full">
  <defs>
    <linearGradient id="sat-base" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="#1e3a2a" />
      <stop offset="50%" stopColor="#2a4a38" />
      <stop offset="100%" stopColor="#152a20" />
    </linearGradient>
  </defs>
  <rect fill="url(#sat-base)" width="80" height="60" />
  {/* Water */}
  <path d="M0 45 Q30 38, 50 48 Q65 55, 80 50 L80 60 L0 60 Z" fill="#1a3040" opacity="0.7" />
  {/* Urban blocks */}
  <rect fill="#4a5058" x="6" y="8" width="18" height="14" opacity="0.85" />
  <rect fill="#4a5058" x="46" y="14" width="20" height="16" opacity="0.85" />
  {/* Roads */}
  <path d="M0 22 L80 22" stroke="#5a6068" strokeWidth="1.5" opacity="0.5" />
</svg>
```

### Terrain

```tsx
<svg viewBox="0 0 80 60" className="w-full h-full">
  <defs>
    <linearGradient id="terrain-base" x1="0%" y1="100%" x2="0%" y2="0%">
      <stop offset="0%" stopColor="#d8e8c8" />
      <stop offset="50%" stopColor="#e0d8c0" />
      <stop offset="100%" stopColor="#f0e8dc" />
    </linearGradient>
  </defs>
  <rect fill="url(#terrain-base)" width="80" height="60" />
  {/* Mountains */}
  <path d="M50 60 L65 20 L80 60 Z" fill="#d0c8b8" opacity="0.6" />
  <path d="M0 60 L20 35 L40 60 Z" fill="#d0c8b8" opacity="0.4" />
  {/* Contour lines */}
  <path d="M0 44 Q25 38, 50 44 T80 40" fill="none" stroke="#b8c0a8" strokeWidth="0.6" />
  <path d="M0 36 Q30 28, 55 34 T80 30" fill="none" stroke="#b8c0a8" strokeWidth="0.6" />
</svg>
```

---

## Appendix: Full Theme Style Definitions

### Silver Theme
```typescript
const SILVER_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f5f5f5' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#dadada' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c9c9c9' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#e5e5e5' }] },
]
```

### Dark Theme
```typescript
const DARK_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#212121' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#212121' }] },
  { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#2c2c2c' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3c3c3c' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#000000' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#181818' }] },
]
```

### Night Theme
```typescript
const NIGHT_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#38414e' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#746855' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#263c3f' }] },
]
```

### Retro Theme
```typescript
const RETRO_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#ebe3cd' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#523735' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f5f1e6' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#f5f1e6' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#f8c967' }] },
  { featureType: 'water', elementType: 'geometry.fill', stylers: [{ color: '#b9d3c2' }] },
  { featureType: 'poi.park', elementType: 'geometry.fill', stylers: [{ color: '#a5b076' }] },
]
```

### Aubergine Theme
```typescript
const AUBERGINE_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2c6675' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#283d6a' }] },
]
```

---

## UI Components Needed

- **Slider** - For radius control
- **Switch** - For traffic/transit toggles  
- **Select/Dropdown** - For labels preset
- **Tooltip** - For help icons and "Coming Soon" states

If using shadcn/ui, these are: `Slider`, `Switch`, `Select`, `Tooltip`
