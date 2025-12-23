# Player Stats Sorting Implementation Guide

This guide provides step-by-step instructions for implementing server-side sorting functionality for the player stats API endpoint.

## Problem Statement

The frontend is correctly sending sort parameters (`sortBy` and `sortOrder`) to the backend API, but the backend is not applying the sorting. As a result, the table data remains in the same order regardless of which column header the user clicks.

## Current State

**Frontend Implementation:**
- ✅ Sort parameters are being sent correctly: `?sortBy=player&sortOrder=asc`
- ✅ State management is working
- ✅ UI components are ready to display sorted data

**Backend Implementation:**
- ❌ Sort parameters are not being parsed from query string
- ❌ SQL queries do not include ORDER BY clauses
- ❌ Column name mapping is not implemented

## Target State

The backend API endpoint `GET /api/player-stats` should:
- Accept `sortBy` and `sortOrder` query parameters
- Map frontend column names to database column names
- Apply sorting to SQL queries before pagination
- Return sorted results that persist across pages

---

## Phase 1: Understanding the Column Mapping

### Frontend Column Names → Database Column Names

The frontend uses user-friendly column names that need to be mapped to actual database columns:

| Frontend Column | Database Column(s) | Notes |
|----------------|-------------------|-------|
| `player` | `player_first_name, player_last_name` | Composite sort (two columns) |
| `team` | `team_abbreviation` | Direct mapping |
| `position` | `player_position` | Direct mapping |
| `last_game_date` | `last_game_date` | Direct mapping |
| `last_game_points` | `last_game_points` | Direct mapping |
| `last_game_assists` | `last_game_assists` | Direct mapping |
| `last_game_rebounds` | `last_game_rebounds` | Direct mapping |
| `last_game_steals` | `last_game_steals` | Direct mapping |
| `last_game_blocks` | `last_game_blocks` | Direct mapping |
| `last_game_fg3_made` | `last_game_fg3_made` | Direct mapping |
| `avg_7_points` | `avg_7_points` | Direct mapping |
| `avg_7_assists` | `avg_7_assists` | Direct mapping |
| `avg_7_rebounds` | `avg_7_rebounds` | Direct mapping |
| `avg_7_steals` | `avg_7_steals` | Direct mapping |
| `avg_7_blocks` | `avg_7_blocks` | Direct mapping |
| `avg_7_fg3_made` | `avg_7_fg3_made` | Direct mapping |
| `avg_14_points` | `avg_14_points` | Direct mapping |
| `avg_14_assists` | `avg_14_assists` | Direct mapping |
| `avg_14_rebounds` | `avg_14_rebounds` | Direct mapping |
| `avg_14_steals` | `avg_14_steals` | Direct mapping |
| `avg_14_blocks` | `avg_14_blocks` | Direct mapping |
| `avg_14_fg3_made` | `avg_14_fg3_made` | Direct mapping |
| `avg_30_points` | `avg_30_points` | Direct mapping |
| `avg_30_assists` | `avg_30_assists` | Direct mapping |
| `avg_30_rebounds` | `avg_30_rebounds` | Direct mapping |
| `avg_30_steals` | `avg_30_steals` | Direct mapping |
| `avg_30_blocks` | `avg_30_blocks` | Direct mapping |
| `avg_30_fg3_made` | `avg_30_fg3_made` | Direct mapping |
| `season_avg_points` | `season_avg_points` | Direct mapping |
| `season_avg_assists` | `season_avg_assists` | Direct mapping |
| `season_avg_rebounds` | `season_avg_rebounds` | Direct mapping |
| `season_avg_steals` | `season_avg_steals` | Direct mapping |
| `season_avg_blocks` | `season_avg_blocks` | Direct mapping |
| `season_avg_fg3_made` | `season_avg_fg3_made` | Direct mapping |
| `season_games_played` | `season_games_played` | Direct mapping |

**Special Case: `player` column**
- Requires sorting by both `player_first_name` and `player_last_name`
- SQL: `ORDER BY player_first_name ASC, player_last_name ASC`

---

## Phase 2: Backend Implementation

### Step 2.1: Create Column Mapping Function

Create a helper function to map frontend column names to database column names:

```javascript
// In your player stats service or route handler

/**
 * Map frontend column name to database column name(s)
 * @param {string} frontendColumn - Column name from frontend (e.g., "player", "team")
 * @returns {string|string[]} - Database column name(s) or null if invalid
 */
function mapColumnToDatabase(frontendColumn) {
  const columnMap = {
    'player': ['player_first_name', 'player_last_name'], // Special case: composite
    'team': 'team_abbreviation',
    'position': 'player_position',
    'last_game_date': 'last_game_date',
    'last_game_points': 'last_game_points',
    'last_game_assists': 'last_game_assists',
    'last_game_rebounds': 'last_game_rebounds',
    'last_game_steals': 'last_game_steals',
    'last_game_blocks': 'last_game_blocks',
    'last_game_fg3_made': 'last_game_fg3_made',
    'avg_7_points': 'avg_7_points',
    'avg_7_assists': 'avg_7_assists',
    'avg_7_rebounds': 'avg_7_rebounds',
    'avg_7_steals': 'avg_7_steals',
    'avg_7_blocks': 'avg_7_blocks',
    'avg_7_fg3_made': 'avg_7_fg3_made',
    'avg_14_points': 'avg_14_points',
    'avg_14_assists': 'avg_14_assists',
    'avg_14_rebounds': 'avg_14_rebounds',
    'avg_14_steals': 'avg_14_steals',
    'avg_14_blocks': 'avg_14_blocks',
    'avg_14_fg3_made': 'avg_14_fg3_made',
    'avg_30_points': 'avg_30_points',
    'avg_30_assists': 'avg_30_assists',
    'avg_30_rebounds': 'avg_30_rebounds',
    'avg_30_steals': 'avg_30_steals',
    'avg_30_blocks': 'avg_30_blocks',
    'avg_30_fg3_made': 'avg_30_fg3_made',
    'season_avg_points': 'season_avg_points',
    'season_avg_assists': 'season_avg_assists',
    'season_avg_rebounds': 'season_avg_rebounds',
    'season_avg_steals': 'season_avg_steals',
    'season_avg_blocks': 'season_avg_blocks',
    'season_avg_fg3_made': 'season_avg_fg3_made',
    'season_games_played': 'season_games_played',
  };

  return columnMap[frontendColumn] || null;
}
```

### Step 2.2: Validate Sort Parameters

Add validation for sort parameters:

```javascript
/**
 * Validate and sanitize sort parameters
 * @param {string} sortBy - Column name to sort by
 * @param {string} sortOrder - Sort direction ("asc" or "desc")
 * @returns {object|null} - Validated sort config or null if invalid
 */
function validateSortParams(sortBy, sortOrder) {
  // Validate sortBy
  if (!sortBy || typeof sortBy !== 'string') {
    return null;
  }

  const dbColumns = mapColumnToDatabase(sortBy);
  if (!dbColumns) {
    console.warn(`[PlayerStats] Invalid sortBy column: ${sortBy}`);
    return null;
  }

  // Validate sortOrder
  const normalizedOrder = (sortOrder || 'asc').toLowerCase();
  if (normalizedOrder !== 'asc' && normalizedOrder !== 'desc') {
    console.warn(`[PlayerStats] Invalid sortOrder: ${sortOrder}, defaulting to 'asc'`);
    return {
      columns: dbColumns,
      order: 'ASC'
    };
  }

  return {
    columns: Array.isArray(dbColumns) ? dbColumns : [dbColumns],
    order: normalizedOrder.toUpperCase() // 'ASC' or 'DESC'
  };
}
```

### Step 2.3: Build ORDER BY Clause

Create a function to build the SQL ORDER BY clause:

```javascript
/**
 * Build ORDER BY clause for SQL query
 * @param {object} sortConfig - Sort configuration from validateSortParams
 * @returns {string} - ORDER BY clause (e.g., "ORDER BY player_first_name ASC, player_last_name ASC")
 */
function buildOrderByClause(sortConfig) {
  if (!sortConfig || !sortConfig.columns || sortConfig.columns.length === 0) {
    return ''; // No sorting
  }

  const order = sortConfig.order || 'ASC';
  const columns = sortConfig.columns.map(col => {
    // Handle NULL values - put them at the end
    // PostgreSQL syntax: ORDER BY column NULLS LAST
    return `${col} ${order} NULLS LAST`;
  }).join(', ');

  return `ORDER BY ${columns}`;
}
```

### Step 2.4: Update API Route Handler

Modify your existing `GET /api/player-stats` route handler:

```javascript
// Example route handler (adjust based on your framework)

app.get('/api/player-stats', async (req, res) => {
  try {
    const { season, page, limit, search, sortBy, sortOrder } = req.query;

    // Validate required parameters
    if (!season) {
      return res.status(400).json({ error: 'Season parameter is required' });
    }

    // Parse and validate sort parameters
    const sortConfig = validateSortParams(sortBy, sortOrder);

    // Build base query
    let query = 'SELECT * FROM player_stats WHERE season = $1';
    const queryParams = [season];
    let paramIndex = 2;

    // Add search filter if provided
    if (search && search.trim()) {
      query += ` AND (
        player_first_name ILIKE $${paramIndex} OR 
        player_last_name ILIKE $${paramIndex} OR
        team_abbreviation ILIKE $${paramIndex} OR
        player_position ILIKE $${paramIndex}
      )`;
      queryParams.push(`%${search.trim()}%`);
      paramIndex++;
    }

    // Add sorting BEFORE pagination
    if (sortConfig) {
      const orderByClause = buildOrderByClause(sortConfig);
      query += ` ${orderByClause}`;
    } else {
      // Default sort: by player name if no sort specified
      query += ' ORDER BY player_first_name ASC, player_last_name ASC';
    }

    // Add pagination (AFTER sorting)
    if (page && limit && !search) {
      // Only paginate if not in search mode
      const offset = (parseInt(page) - 1) * parseInt(limit);
      query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      queryParams.push(parseInt(limit));
      queryParams.push(offset);
    }

    console.log(`[PlayerStats] Executing query:`, query);
    console.log(`[PlayerStats] Query params:`, queryParams);

    // Execute query
    const result = await db.query(query, queryParams);

    // Get total count for pagination (if not in search mode)
    let totalCount = null;
    if (page && limit && !search) {
      const countQuery = 'SELECT COUNT(*) FROM player_stats WHERE season = $1';
      const countParams = [season];
      const countResult = await db.query(countQuery, countParams);
      totalCount = parseInt(countResult.rows[0].count);
    } else if (search) {
      // In search mode, total is the result count
      totalCount = result.rows.length;
    }

    // Build pagination info
    const pagination = (page && limit && totalCount !== null) ? {
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalCount / parseInt(limit)),
      totalPlayers: totalCount,
      limit: parseInt(limit),
      hasNextPage: parseInt(page) < Math.ceil(totalCount / parseInt(limit)),
      hasPreviousPage: parseInt(page) > 1
    } : null;

    // Return response
    res.json({
      data: result.rows,
      pagination: pagination
    });

  } catch (error) {
    console.error('[PlayerStats] Error fetching player stats:', error);
    res.status(500).json({ error: 'Failed to fetch player stats' });
  }
});
```

---

## Phase 3: SQL Query Examples

### Example 1: Sort by Player Name (Ascending)

**Frontend Request:**
```
GET /api/player-stats?season=2025&page=1&limit=50&sortBy=player&sortOrder=asc
```

**Generated SQL:**
```sql
SELECT * FROM player_stats 
WHERE season = 2025 
ORDER BY player_first_name ASC NULLS LAST, player_last_name ASC NULLS LAST
LIMIT 50 OFFSET 0;
```

### Example 2: Sort by Season Average Points (Descending)

**Frontend Request:**
```
GET /api/player-stats?season=2025&page=1&limit=50&sortBy=season_avg_points&sortOrder=desc
```

**Generated SQL:**
```sql
SELECT * FROM player_stats 
WHERE season = 2025 
ORDER BY season_avg_points DESC NULLS LAST
LIMIT 50 OFFSET 0;
```

### Example 3: Sort with Search

**Frontend Request:**
```
GET /api/player-stats?season=2025&search=James&sortBy=season_avg_points&sortOrder=desc
```

**Generated SQL:**
```sql
SELECT * FROM player_stats 
WHERE season = 2025 
AND (
  player_first_name ILIKE '%James%' OR 
  player_last_name ILIKE '%James%' OR
  team_abbreviation ILIKE '%James%' OR
  player_position ILIKE '%James%'
)
ORDER BY season_avg_points DESC NULLS LAST;
```

---

## Phase 4: Error Handling

### Invalid Column Names

If an invalid `sortBy` value is provided, the backend should:
1. Log a warning
2. Fall back to default sorting (by player name)
3. Still return results (don't fail the request)

```javascript
if (!sortConfig) {
  console.warn(`[PlayerStats] Invalid sortBy: ${sortBy}, using default sort`);
  // Use default sort
  query += ' ORDER BY player_first_name ASC, player_last_name ASC';
}
```

### Invalid Sort Order

If an invalid `sortOrder` is provided:
1. Default to 'ASC'
2. Log a warning
3. Continue processing

```javascript
if (normalizedOrder !== 'asc' && normalizedOrder !== 'desc') {
  console.warn(`[PlayerStats] Invalid sortOrder: ${sortOrder}, defaulting to 'asc'`);
  return { columns: dbColumns, order: 'ASC' };
}
```

### SQL Injection Prevention

**CRITICAL:** Always use parameterized queries. Never concatenate user input directly into SQL:

```javascript
// ❌ BAD - Vulnerable to SQL injection
const query = `SELECT * FROM player_stats ORDER BY ${sortBy} ${sortOrder}`;

// ✅ GOOD - Safe parameterized query
const sortConfig = validateSortParams(sortBy, sortOrder);
const orderByClause = buildOrderByClause(sortConfig); // Uses whitelisted columns
const query = `SELECT * FROM player_stats ${orderByClause}`;
```

---

## Phase 5: Testing

### Step 5.1: Test Basic Sorting

1. **Test ascending sort:**
   ```bash
   curl "http://localhost:3000/api/player-stats?season=2025&page=1&limit=5&sortBy=player&sortOrder=asc"
   ```
   - Verify first player is alphabetically first (e.g., "Achiuwa, Precious")
   - Verify last player is alphabetically last

2. **Test descending sort:**
   ```bash
   curl "http://localhost:3000/api/player-stats?season=2025&page=1&limit=5&sortBy=player&sortOrder=desc"
   ```
   - Verify first player is alphabetically last (e.g., "Zubac, Ivica")
   - Verify order is reversed from ascending

### Step 5.2: Test Numeric Sorting

1. **Test points sorting:**
   ```bash
   curl "http://localhost:3000/api/player-stats?season=2025&page=1&limit=5&sortBy=season_avg_points&sortOrder=desc"
   ```
   - Verify players are sorted by points (highest first)
   - Verify NULL values appear at the end

### Step 5.3: Test Composite Sorting (Player Name)

1. **Test player name sorting:**
   ```bash
   curl "http://localhost:3000/api/player-stats?season=2025&page=1&limit=10&sortBy=player&sortOrder=asc"
   ```
   - Verify sorting by first name, then last name
   - Verify "Aaron Gordon" comes before "Aaron Holiday"

### Step 5.4: Test with Search

1. **Test sorting with search:**
   ```bash
   curl "http://localhost:3000/api/player-stats?season=2025&search=James&sortBy=season_avg_points&sortOrder=desc"
   ```
   - Verify search results are sorted correctly
   - Verify all results match search criteria

### Step 5.5: Test Pagination with Sorting

1. **Test that sorting persists across pages:**
   ```bash
   # Page 1
   curl "http://localhost:3000/api/player-stats?season=2025&page=1&limit=50&sortBy=season_avg_points&sortOrder=desc"
   
   # Page 2
   curl "http://localhost:3000/api/player-stats?season=2025&page=2&limit=50&sortBy=season_avg_points&sortOrder=desc"
   ```
   - Verify page 2 continues from where page 1 ended
   - Verify no duplicates between pages
   - Verify sort order is maintained

### Step 5.6: Test Error Cases

1. **Test invalid column name:**
   ```bash
   curl "http://localhost:3000/api/player-stats?season=2025&sortBy=invalid_column&sortOrder=asc"
   ```
   - Should fall back to default sort
   - Should not return an error
   - Should log a warning

2. **Test invalid sort order:**
   ```bash
   curl "http://localhost:3000/api/player-stats?season=2025&sortBy=player&sortOrder=invalid"
   ```
   - Should default to 'ASC'
   - Should not return an error
   - Should log a warning

---

## Phase 6: Performance Considerations

### Database Indexes

Ensure indexes exist on commonly sorted columns:

```sql
-- Indexes for sorting (if not already created)
CREATE INDEX IF NOT EXISTS idx_player_stats_player_first_name ON player_stats(player_first_name);
CREATE INDEX IF NOT EXISTS idx_player_stats_player_last_name ON player_stats(player_last_name);
CREATE INDEX IF NOT EXISTS idx_player_stats_season_avg_points ON player_stats(season_avg_points DESC);
CREATE INDEX IF NOT EXISTS idx_player_stats_avg_7_points ON player_stats(avg_7_points DESC);
CREATE INDEX IF NOT EXISTS idx_player_stats_team_abbreviation ON player_stats(team_abbreviation);
```

### Composite Index for Player Name Sorting

For efficient sorting by player name:

```sql
CREATE INDEX IF NOT EXISTS idx_player_stats_player_name 
ON player_stats(player_first_name, player_last_name);
```

### Query Performance

- Sorting should happen **before** pagination (LIMIT/OFFSET)
- Use `EXPLAIN ANALYZE` to verify index usage:
  ```sql
  EXPLAIN ANALYZE 
  SELECT * FROM player_stats 
  WHERE season = 2025 
  ORDER BY season_avg_points DESC NULLS LAST
  LIMIT 50 OFFSET 0;
  ```

---

## Phase 7: Implementation Checklist

- [ ] Create `mapColumnToDatabase()` function
- [ ] Create `validateSortParams()` function
- [ ] Create `buildOrderByClause()` function
- [ ] Update route handler to parse `sortBy` and `sortOrder` from query string
- [ ] Add sorting to SQL query (before pagination)
- [ ] Handle special case: `player` column (composite sort)
- [ ] Add NULL handling (`NULLS LAST`)
- [ ] Add error handling for invalid parameters
- [ ] Add default sort when no sort specified
- [ ] Test all column types (string, numeric, date)
- [ ] Test ascending and descending
- [ ] Test with search
- [ ] Test with pagination
- [ ] Test error cases
- [ ] Verify SQL injection prevention
- [ ] Check database indexes
- [ ] Test performance with large datasets

---

## Phase 8: Verification

After implementation, verify the following:

1. **Frontend logs show correct API calls:**
   ```
   [PlayerStats] Fetching: /api/player-stats?season=2025&page=1&limit=50&sortBy=player&sortOrder=asc
   ```

2. **Backend logs show SQL with ORDER BY:**
   ```
   [PlayerStats] Executing query: SELECT * FROM player_stats WHERE season = $1 ORDER BY player_first_name ASC NULLS LAST, player_last_name ASC NULLS LAST LIMIT $2 OFFSET $3
   ```

3. **Response data is actually sorted:**
   - First player in response matches expected sort order
   - Last player in response matches expected sort order
   - Order is consistent across pages

4. **Frontend table updates:**
   - Table rows re-render when sort changes
   - Visual sort indicators (↑ ↓) appear correctly
   - Data order matches sort direction

---

## Troubleshooting

### Issue: Sorting not working

**Check:**
1. Are sort parameters being parsed from query string?
2. Is `validateSortParams()` returning a valid config?
3. Is `buildOrderByClause()` generating correct SQL?
4. Is ORDER BY clause being added to query?
5. Check backend logs for SQL query

### Issue: NULL values appearing first

**Solution:** Use `NULLS LAST` in ORDER BY clause:
```sql
ORDER BY season_avg_points DESC NULLS LAST
```

### Issue: Player name sorting incorrect

**Solution:** Ensure composite sort is used:
```sql
ORDER BY player_first_name ASC, player_last_name ASC
```

### Issue: Performance is slow

**Solution:**
1. Check if indexes exist on sorted columns
2. Use `EXPLAIN ANALYZE` to verify index usage
3. Consider adding composite indexes for common sorts

---

## Summary

The backend needs to:
1. ✅ Parse `sortBy` and `sortOrder` from query parameters
2. ✅ Map frontend column names to database column names
3. ✅ Validate sort parameters
4. ✅ Build ORDER BY clause
5. ✅ Apply sorting BEFORE pagination in SQL query
6. ✅ Handle NULL values appropriately
7. ✅ Provide default sorting when no sort specified
8. ✅ Handle error cases gracefully

Once implemented, the frontend will receive properly sorted data, and the table will update correctly when users click column headers.

