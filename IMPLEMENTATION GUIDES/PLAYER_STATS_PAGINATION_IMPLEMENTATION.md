# Player Stats Pagination Implementation Guide

This guide provides step-by-step instructions for implementing pagination in the Player Stats page, displaying 50 players at a time while maintaining full search functionality across all players in the current season.

## Overview

**Current State:**
- All players are displayed at once (potentially hundreds of players)
- Search filters through all loaded players
- Performance may degrade with large datasets
- User must scroll through entire list to find players

**Target State:**
- Display 50 players per page
- Pagination controls (Previous/Next, page numbers)
- Search functionality searches across ALL players in the season (not just visible page)
- Improved performance and user experience
- Backend handles pagination efficiently

---

## Phase 1: Backend API Updates

### Step 1.1: Update GET /api/player-stats Endpoint

The backend endpoint should support pagination query parameters while maintaining the ability to return all players for search functionality.

**Current Endpoint Structure:**
```
GET /api/player-stats?season={season}
```

**Updated Endpoint Structure:**
```
GET /api/player-stats?season={season}&page={page}&limit={limit}&search={search}
```

**Query Parameters:**
- `season` (required): Season year (e.g., 2024)
- `page` (optional): Page number (default: 1)
- `limit` (optional): Players per page (default: 50)
- `search` (optional): Search query to filter players by name, team, or position

**Response Structure:**

**Paginated Response (when page/limit provided):**
```json
{
  "data": [
    {
      "id": "uuid",
      "player_id": 237,
      "season": 2024,
      "player_first_name": "LeBron",
      "player_last_name": "James",
      "player_position": "F",
      "team_abbreviation": "LAL",
      // ... other stats fields
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 20,
    "totalPlayers": 987,
    "limit": 50,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

**Search Response (when search parameter provided):**
```json
{
  "data": [
    // All matching players (not paginated)
  ],
  "pagination": {
    "totalResults": 5,
    "searchQuery": "lebron"
  }
}
```

### Step 1.2: Backend Implementation Example

**Example Backend Route (Node.js/Express):**

```javascript
// GET /api/player-stats
// Note: Import sqlQuery from your database module
// import { sqlQuery } from '../config/database.js'; // or wherever your database module is

app.get('/api/player-stats', async (req, res) => {
  try {
    const { season, page, limit, search } = req.query;
    
    // Validate season
    if (!season) {
      return res.status(400).json({ error: 'Season parameter is required' });
    }
    
    const seasonNum = parseInt(season, 10);
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 50;
    const searchQuery = search ? search.trim().toLowerCase() : null;
    
    // Validate pagination parameters
    if (pageNum < 1) {
      return res.status(400).json({ error: 'Page must be >= 1' });
    }
    if (limitNum < 1 || limitNum > 100) {
      return res.status(400).json({ error: 'Limit must be between 1 and 100' });
    }
    
    // Build base query
    let query = `
      SELECT 
        id, player_id, season,
        player_first_name, player_last_name,
        player_position, team_abbreviation,
        last_game_date, last_game_points,
        last_game_assists, last_game_rebounds,
        last_game_steals, last_game_blocks,
        avg_7_points, avg_7_assists, avg_7_rebounds,
        avg_7_steals, avg_7_blocks,
        avg_14_points, avg_14_assists, avg_14_rebounds,
        avg_14_steals, avg_14_blocks,
        avg_30_points, avg_30_assists, avg_30_rebounds,
        avg_30_steals, avg_30_blocks,
        season_avg_points, season_avg_assists,
        season_avg_rebounds, season_avg_steals,
        season_avg_blocks, season_games_played,
        games_played_7, games_played_14, games_played_30,
        last_updated
      FROM player_stats
      WHERE season = $1
    `;
    
    const queryParams = [seasonNum];
    let paramIndex = 2;
    
    // Add search filter if provided
    if (searchQuery) {
      query += ` AND (
        LOWER(player_first_name || ' ' || player_last_name) LIKE $${paramIndex} OR
        LOWER(player_first_name) LIKE $${paramIndex} OR
        LOWER(player_last_name) LIKE $${paramIndex} OR
        LOWER(team_abbreviation) LIKE $${paramIndex} OR
        LOWER(player_position) LIKE $${paramIndex}
      )`;
      queryParams.push(`%${searchQuery}%`);
      paramIndex++;
    }
    
    // Get total count for pagination (only if not searching)
    let totalCount = 0;
    if (!searchQuery) {
      const countQuery = `
        SELECT COUNT(*) as total
        FROM player_stats
        WHERE season = $1
      `;
      const countResult = await sqlQuery(countQuery, [seasonNum]);
      totalCount = parseInt(countResult.rows[0].total, 10);
    }
    
    // Add ordering
    query += ` ORDER BY player_last_name ASC, player_first_name ASC`;
    
    // Add pagination (only if not searching - search returns all results)
    if (!searchQuery) {
      const offset = (pageNum - 1) * limitNum;
      query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      queryParams.push(limitNum, offset);
    }
    
    // Execute query - use sqlQuery instead of db.query
    const result = await sqlQuery(query, queryParams);
    const players = result.rows;
    
    // Build response
    if (searchQuery) {
      // Search mode: return all matching results
      return res.json({
        data: players,
        pagination: {
          totalResults: players.length,
          searchQuery: searchQuery
        }
      });
    } else {
      // Pagination mode: return paginated results
      const totalPages = Math.ceil(totalCount / limitNum);
      
      return res.json({
        data: players,
        pagination: {
          currentPage: pageNum,
          totalPages: totalPages,
          totalPlayers: totalCount,
          limit: limitNum,
          hasNextPage: pageNum < totalPages,
          hasPreviousPage: pageNum > 1
        }
      });
    }
  } catch (error) {
    console.error('[Player Stats API] Error:', error);
    res.status(500).json({ error: 'Failed to fetch player stats' });
  }
});
```

### Step 1.3: Database Indexes

Ensure proper indexes exist for efficient querying:

```sql
-- Index for season filtering (should already exist)
CREATE INDEX IF NOT EXISTS idx_player_stats_season ON player_stats(season);

-- Composite index for search queries
CREATE INDEX IF NOT EXISTS idx_player_stats_season_names ON player_stats(season, player_last_name, player_first_name);

-- Index for team abbreviation searches
CREATE INDEX IF NOT EXISTS idx_player_stats_team_abbreviation ON player_stats(team_abbreviation) WHERE team_abbreviation IS NOT NULL;
```

---

## Phase 2: Frontend Implementation

### Step 2.1: Update TypeScript Interfaces

Add pagination types to `app/player-stats.tsx`:

```typescript
interface PlayerStats {
  id: string;
  player_id: number;
  season: number;
  player_first_name: string;
  player_last_name: string;
  player_position: string | null;
  team_abbreviation: string | null;
  // ... other fields
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalPlayers: number;
  limit: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

interface PlayerStatsResponse {
  data: PlayerStats[];
  pagination: PaginationInfo;
}
```

### Step 2.2: Update State Management

Add pagination state to the component:

```typescript
export default function PlayerStatsPage() {
  const [playerStats, setPlayerStats] = useState<PlayerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Add pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [paginationInfo, setPaginationInfo] = useState<PaginationInfo | null>(null);
  const [isSearchMode, setIsSearchMode] = useState(false);
  
  const PLAYERS_PER_PAGE = 50;
```

### Step 2.3: Update fetchPlayerStats Function

Modify the fetch function to handle both pagination and search:

```typescript
const fetchPlayerStats = useCallback(async (page: number = 1, search: string = '') => {
  try {
    setError(null);
    setLoading(true);
    const currentSeason = getCurrentSeason();
    
    // Build endpoint with pagination or search
    let endpoint = `/api/player-stats?season=${currentSeason}`;
    
    if (search.trim()) {
      // Search mode: fetch all matching players
      endpoint += `&search=${encodeURIComponent(search.trim())}`;
      setIsSearchMode(true);
    } else {
      // Pagination mode: fetch specific page
      endpoint += `&page=${page}&limit=${PLAYERS_PER_PAGE}`;
      setIsSearchMode(false);
    }
    
    console.log(`[PlayerStats] Fetching: ${endpoint}`);
    
    const response = await get<PlayerStatsResponse>(endpoint);
    
    if (response.error) {
      const errorMsg = response.error.toLowerCase();
      if (errorMsg.includes('not found') || errorMsg.includes('404') || errorMsg.includes('route')) {
        setError(
          'API endpoint not found. The backend route GET /api/player-stats needs to be implemented. ' +
          'Please check the backend implementation or contact an administrator.'
        );
      } else {
        setError(response.error);
      }
      setPlayerStats([]);
      setPaginationInfo(null);
    } else if (response.data) {
      const players = Array.isArray(response.data.data) ? response.data.data : [];
      setPlayerStats(players);
      
      if (response.data.pagination) {
        setPaginationInfo(response.data.pagination);
      } else {
        setPaginationInfo(null);
      }
      
      if (players.length === 0) {
        setError(null); // Clear error, just show empty state message
      }
    } else {
      setError('No data received from server');
      setPlayerStats([]);
      setPaginationInfo(null);
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to fetch player stats';
    console.error('[PlayerStats] Error fetching stats:', err);
    setError(errorMsg);
    setPlayerStats([]);
    setPaginationInfo(null);
  } finally {
    setLoading(false);
    setRefreshing(false);
  }
}, []);
```

### Step 2.4: Update Search Handler

Modify search to trigger API call instead of client-side filtering:

```typescript
// Handle search input with debouncing
const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

const handleSearchChange = useCallback((text: string) => {
  setSearchQuery(text);
  
  // Clear existing timeout
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }
  
  // Debounce search: wait 300ms after user stops typing
  const timeout = setTimeout(() => {
    if (text.trim()) {
      // Search mode: fetch all matching players
      setCurrentPage(1); // Reset to first page when searching
      fetchPlayerStats(1, text.trim());
    } else {
      // Clear search: return to pagination mode
      setCurrentPage(1);
      fetchPlayerStats(1, '');
    }
  }, 300);
  
  setSearchTimeout(timeout);
}, [fetchPlayerStats, searchTimeout]);

// Cleanup timeout on unmount
useEffect(() => {
  return () => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
  };
}, [searchTimeout]);
```

### Step 2.5: Update useEffect for Initial Load

```typescript
useEffect(() => {
  fetchPlayerStats(currentPage, searchQuery);
}, [fetchPlayerStats]); // Only run on mount, not on every page change

// Separate effect for page changes
useEffect(() => {
  if (!isSearchMode) {
    fetchPlayerStats(currentPage, '');
  }
}, [currentPage, isSearchMode, fetchPlayerStats]);
```

### Step 2.6: Remove Client-Side Filtering

Remove the `filteredStats` useMemo since filtering now happens on the backend:

```typescript
// REMOVE THIS - filtering is now done on backend
// const filteredStats = useMemo(() => { ... }, [playerStats, searchQuery]);
```

Update all references to `filteredStats` to use `playerStats` directly.

### Step 2.7: Add Pagination Controls Component

Add pagination UI component:

```typescript
const PaginationControls = () => {
  if (!paginationInfo || isSearchMode) {
    return null; // Don't show pagination in search mode
  }
  
  const { currentPage: page, totalPages, hasNextPage, hasPreviousPage } = paginationInfo;
  
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      // Scroll to top when page changes
      // You may need to add a ref to ScrollView for this
    }
  };
  
  // Calculate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Show first page
      pages.push(1);
      
      if (page > 3) {
        pages.push('...');
      }
      
      // Show pages around current page
      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      
      if (page < totalPages - 2) {
        pages.push('...');
      }
      
      // Show last page
      pages.push(totalPages);
    }
    
    return pages;
  };
  
  return (
    <Card elevate padding="$3" backgroundColor="$backgroundStrong" marginTop="$4">
      <XStack space="$3" alignItems="center" justifyContent="center" flexWrap="wrap">
        <Button
          size="$3"
          disabled={!hasPreviousPage}
          onPress={() => handlePageChange(page - 1)}
          opacity={hasPreviousPage ? 1 : 0.5}
        >
          Previous
        </Button>
        
        {getPageNumbers().map((pageNum, index) => {
          if (pageNum === '...') {
            return (
              <Text key={`ellipsis-${index}`} fontSize="$4" color="$colorPress" paddingHorizontal="$2">
                ...
              </Text>
            );
          }
          
          const isCurrentPage = pageNum === page;
          
          return (
            <Button
              key={pageNum}
              size="$3"
              variant={isCurrentPage ? 'outlined' : 'outlined'}
              backgroundColor={isCurrentPage ? '$blue5' : 'transparent'}
              onPress={() => handlePageChange(pageNum as number)}
            >
              <Text color={isCurrentPage ? '$color' : '$colorPress'}>
                {pageNum}
              </Text>
            </Button>
          );
        })}
        
        <Button
          size="$3"
          disabled={!hasNextPage}
          onPress={() => handlePageChange(page + 1)}
          opacity={hasNextPage ? 1 : 0.5}
        >
          Next
        </Button>
      </XStack>
      
      <Text fontSize="$2" color="$colorPress" textAlign="center" marginTop="$2">
        Page {page} of {totalPages} ({paginationInfo.totalPlayers} total players)
      </Text>
    </Card>
  );
};
```

### Step 2.8: Update UI to Use Pagination

Update the search input and stats display:

```typescript
// In the render section, update the search input:
<Input
  value={searchQuery}
  onChangeText={handleSearchChange} // Use new handler
  placeholder="Search by name, team, or position..."
  size="$4"
  backgroundColor="$background"
/>

// Update the player count text:
<Text fontSize="$2" color="$colorPress">
  {isSearchMode 
    ? `${playerStats.length} player${playerStats.length !== 1 ? 's' : ''} found`
    : paginationInfo 
      ? `Showing ${((currentPage - 1) * PLAYERS_PER_PAGE) + 1}-${Math.min(currentPage * PLAYERS_PER_PAGE, paginationInfo.totalPlayers)} of ${paginationInfo.totalPlayers} players`
      : `${playerStats.length} players`
  }
</Text>

// Add pagination controls after the stats table:
{!isSearchMode && <PaginationControls />}
```

### Step 2.9: Update Refresh Handler

```typescript
const onRefresh = useCallback(() => {
  setRefreshing(true);
  fetchPlayerStats(currentPage, searchQuery);
}, [fetchPlayerStats, currentPage, searchQuery]);
```

---

## Phase 3: Testing

### Step 3.1: Test Pagination

1. **Load First Page:**
   - Verify 50 players are displayed
   - Check pagination shows "Page 1 of X"
   - Verify "Previous" button is disabled

2. **Navigate Pages:**
   - Click "Next" to go to page 2
   - Verify new 50 players load
   - Click "Previous" to return to page 1
   - Click a specific page number (e.g., page 5)

3. **Edge Cases:**
   - Test last page (Next should be disabled)
   - Test with fewer than 50 total players
   - Test with exactly 50 players (should show 1 page)

### Step 3.2: Test Search Functionality

1. **Search All Players:**
   - Type "LeBron" in search
   - Verify results show all matching players (not just current page)
   - Verify pagination controls are hidden during search
   - Verify search works across all players in season

2. **Search Edge Cases:**
   - Search for player not in current season (should return empty)
   - Search for team abbreviation (e.g., "LAL")
   - Search for position (e.g., "PG")
   - Clear search (should return to pagination mode, page 1)

3. **Search Performance:**
   - Type quickly - verify debouncing works (doesn't search on every keystroke)
   - Verify search completes within reasonable time (< 1 second)

### Step 3.3: Test Combined Scenarios

1. **Search Then Paginate:**
   - Search for "James"
   - Clear search
   - Verify returns to page 1 of all players

2. **Paginate Then Search:**
   - Navigate to page 5
   - Enter search query
   - Verify search results show (pagination resets)

3. **Refresh During Search:**
   - Enter search query
   - Pull to refresh
   - Verify search results refresh correctly

---

## Phase 4: Performance Considerations

### Step 4.1: Backend Optimization

1. **Database Queries:**
   - Ensure indexes are properly used
   - Use `EXPLAIN ANALYZE` to verify query performance
   - Consider materialized views for complex aggregations

2. **Caching:**
   - Consider caching total player count (changes infrequently)
   - Cache search results for common queries (optional)

### Step 4.2: Frontend Optimization

1. **Debouncing:**
   - Search debounce delay: 300ms (adjustable)
   - Prevents excessive API calls while typing

2. **Loading States:**
   - Show loading spinner during page changes
   - Show loading spinner during search
   - Maintain scroll position where possible

3. **Memory Management:**
   - Only store current page of players in state
   - Clear previous results when fetching new page

---

## Phase 5: Optional Enhancements

### Step 5.1: Advanced Pagination Features

1. **Jump to Page:**
   - Add input field to jump directly to a specific page
   - Validate page number input

2. **Items Per Page Selector:**
   - Allow users to choose 25, 50, or 100 players per page
   - Store preference in localStorage

3. **Sort Options:**
   - Add sorting by name, points, team, etc.
   - Maintain sort across page changes

### Step 5.2: Search Enhancements

1. **Search History:**
   - Store recent searches
   - Show autocomplete suggestions

2. **Advanced Filters:**
   - Filter by team
   - Filter by position
   - Filter by minimum stats (e.g., > 20 PPG)

3. **Search Highlighting:**
   - Highlight matching text in search results

---

## Summary

This implementation provides:

✅ **Pagination:** 50 players displayed per page  
✅ **Full Search:** Searches across ALL players in the season, not just visible page  
✅ **Performance:** Efficient backend queries with proper indexing  
✅ **User Experience:** Smooth navigation, loading states, and responsive design  
✅ **Scalability:** Handles large datasets efficiently  

**Key Points:**
- Backend handles both pagination and search
- Search mode returns all matching results (not paginated)
- Pagination mode shows 50 players per page
- Frontend manages state and UI interactions
- Debouncing prevents excessive API calls during typing

---

## Troubleshooting

**Issue: Search only finds players on current page**
- **Solution:** Ensure search parameter triggers backend search, not client-side filtering

**Issue: Pagination shows wrong total count**
- **Solution:** Verify backend count query includes all filters (season, etc.)

**Issue: Performance issues with large datasets**
- **Solution:** Check database indexes, consider adding composite indexes for common queries

**Issue: Search is too slow**
- **Solution:** Add database indexes on searchable columns, consider full-text search for names

**Issue: Page doesn't update when navigating**
- **Solution:** Verify `currentPage` state updates trigger `fetchPlayerStats` call

---

## Related Files

- `app/player-stats.tsx` - Frontend component
- Backend route: `GET /api/player-stats` - API endpoint
- Database: `player_stats` table

---

*Last Updated: [Current Date]*

