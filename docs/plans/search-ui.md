# Search UI for Interface App

## Overview

Add a semantic search interface to the Engram Neural Observatory that allows users to search across all indexed thoughts and code using hybrid search (dense + SPLADE sparse vectors).

## Current State

- **Search API exists**: `/api/search` route in interface app already uses `SearchRetriever` from `@engram/search-core`
- **Hybrid search ready**: SPLADE integration complete with synonym handling and vocabulary mismatch improvements
- **UI framework**: Next.js 16 with glassmorphism design system, Orbitron/JetBrains Mono fonts
- **Homepage**: Has UUID input form + SessionBrowser grid, plenty of room for search

## Design Approach

### Option A: Replace UUID Input with Unified Search (Recommended)

Transform the existing UUID input into a smart search bar that:
- Detects UUIDs and navigates directly to session (current behavior)
- Detects natural language and performs semantic search
- Shows search results inline below the input

**Pros**: Clean single input, progressive enhancement, minimal UI changes
**Cons**: Slightly magic behavior

### Option B: Dedicated Search Tab/Section

Add a tabbed interface: "Sessions" | "Search" switching between SessionBrowser and SearchResults

**Pros**: Clear separation of concerns
**Cons**: More complex navigation, breaks current flow

### Option C: Search Modal/Overlay

Keyboard shortcut (⌘K) opens search overlay similar to Spotlight/Raycast

**Pros**: Doesn't change main page, power-user friendly
**Cons**: Less discoverable, separate from main flow

---

## Recommended Plan: Option A (Unified Search Bar)

### Phase 1: SearchInput Component

Create `app/components/SearchInput.tsx`:

```
┌─────────────────────────────────────────────────────────┐
│ 🔍  Search thoughts, code, or enter session UUID...    │
└─────────────────────────────────────────────────────────┘
```

**Behavior:**
1. On input change, debounce 300ms
2. If input matches UUID pattern (`/^[0-9a-f-]{36}$/i`), show "Go to session" action
3. Otherwise, call `/api/search` with hybrid strategy
4. Display results below input

**State:**
- `query: string`
- `results: SearchResult[]`
- `isSearching: boolean`
- `mode: 'idle' | 'uuid' | 'search'`

### Phase 2: SearchResults Component

Create `app/components/SearchResults.tsx`:

Results grid matching SessionBrowser's glassmorphism style:

```
┌─────────────────────────────────────────────────────────┐
│ ● SEARCH RESULTS                          3 matches    │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │
│ │ 💭 Thought  │ │ 💻 Code     │ │ 💭 Thought  │        │
│ │ "user auth" │ │ auth.ts     │ │ "JWT token" │        │
│ │ ━━━━░░░░    │ │ ━━━━━░░░    │ │ ━━━░░░░░    │        │
│ │ 92% match   │ │ 88% match   │ │ 76% match   │        │
│ │ session abc │ │ session def │ │ session abc │        │
│ └─────────────┘ └─────────────┘ └─────────────┘        │
└─────────────────────────────────────────────────────────┘
```

**SearchResultCard props:**
- `type`: 'thought' | 'code' | 'doc'
- `content`: string (truncated preview)
- `score`: number (0-1, displayed as percentage)
- `sessionId`: string
- `nodeId`: string (for deep linking)
- `timestamp`: number

**Actions:**
- Click card → navigate to `/session/{sessionId}` (optionally with `?highlight={nodeId}`)
- Show content type icon (💭 thought, 💻 code, 📄 doc)
- Score visualization bar similar to activity bars

### Phase 3: API Integration

**useSearch hook** (`app/hooks/useSearch.ts`):

```typescript
interface UseSearchOptions {
  debounceMs?: number;  // default 300
  limit?: number;       // default 10
  filters?: {
    type?: 'thought' | 'code' | 'doc';
    session_id?: string;
  };
}

interface SearchResult {
  id: string;
  score: number;
  payload: {
    content: string;
    node_id: string;
    session_id: string;
    type: string;
    timestamp: number;
    file_path?: string;
  };
}

function useSearch(query: string, options?: UseSearchOptions): {
  results: SearchResult[];
  isLoading: boolean;
  error: string | null;
}
```

Uses SWR for caching and deduplication.

### Phase 4: Homepage Integration

Update `app/page.tsx`:

1. Replace current UUID input form with `<SearchInput />`
2. Conditionally render `<SearchResults />` or `<SessionBrowser />` based on search state
3. Add keyboard shortcut: `/` to focus search (common pattern)

**Layout:**
```
┌──────────────────────────────────────────────────────────┐
│  ENGRAM  Neural Observatory                    [header]  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│     ┌──────────────────────────────────────────────┐     │
│     │ 🔍  Search or enter UUID...                  │     │
│     └──────────────────────────────────────────────┘     │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  [SearchResults if query]  OR  [SessionBrowser]   │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
├──────────────────────────────────────────────────────────┤
│  ● System Online | v1.0.0 | READY              [footer]  │
└──────────────────────────────────────────────────────────┘
```

---

## File Changes

### New Files
1. `app/components/SearchInput.tsx` - Smart search bar component
2. `app/components/SearchResults.tsx` - Results grid with cards
3. `app/hooks/useSearch.ts` - Search API hook with SWR

### Modified Files
1. `app/page.tsx` - Integrate SearchInput, conditionally show results
2. `app/globals.css` - Add any new animations/styles (minimal)

---

## Design Details

### Colors (matching existing system)
- Search icon: `rgb(148, 163, 184)` (muted)
- Input focus: `rgb(0, 245, 212)` (cyan accent)
- Result cards: Same glassmorphism as SessionCard
- Score bar: Gradient from cyan to amber based on score
- Type badges:
  - Thought: `rgb(139, 92, 246)` (violet)
  - Code: `rgb(251, 191, 36)` (amber)
  - Doc: `rgb(59, 130, 246)` (blue)

### Animations
- Results fade in with staggered delay (like SessionCards)
- Loading: Pulsing search icon
- Score bar: Subtle fill animation on reveal

### Empty/Error States
- No results: "No matches found. Try different keywords."
- Error: "Search unavailable. Check connection."
- Loading: Skeleton cards with pulse animation

---

## Testing Considerations

1. **UUID detection**: Regex for standard UUID format
2. **Debouncing**: Prevent excessive API calls
3. **Result ranking**: Verify hybrid search returns relevant results
4. **Deep linking**: Session navigation with optional node highlight
5. **Responsive**: Grid adapts to viewport width

---

## Future Enhancements (Out of Scope)

- Filters dropdown (by type, date range, session)
- Search history/suggestions
- Keyboard navigation through results
- Advanced query syntax ("type:code auth")
- Search within specific session context
