# Predictions Game Selector Implementation Guide

This guide provides step-by-step instructions for updating the predictions view to show upcoming games and filter predictions by selected game. When a user selects a game, only predictions for players on either team in that game will be displayed.

## Overview

**Current State:**
- Predictions page shows all predictions or value bets across all games
- No game selection interface
- Predictions are fetched via `/api/predictions/value-bets` or `/api/predictions/game/:gameId`
- Game context (game_label, game_time, opponent_team) is optionally included in prediction data

**Target State:**
- Display list of upcoming games at the top of the predictions page
- Allow users to select a game from the list
- When a game is selected, show only predictions for players on either team in that game
- When no game is selected, show all predictions (or maintain current "all predictions" behavior)
- Game selector should be visually clear and easy to use

---

## Phase 1: Understanding Data Structures

### Step 1.1: Game Data Structure

Games can be fetched from the BallDontLie API via the proxy endpoint:
- **Endpoint:** `GET /api/bdl/v1/games?dates[]=YYYY-MM-DD&per_page=100`
- **Authentication:** Required (uses Bearer token)

**Example Game Response:**
```json
{
  "data": [
    {
      "id": 12345,
      "date": "2024-01-15T00:00:00.000Z",
      "season": 2024,
      "status": "Scheduled",
      "time": "8:00 PM ET",
      "home_team": {
        "id": 14,
        "abbreviation": "BOS",
        "city": "Boston",
        "conference": "East",
        "division": "Atlantic",
        "full_name": "Boston Celtics",
        "name": "Celtics"
      },
      "visitor_team": {
        "id": 13,
        "abbreviation": "LAL",
        "city": "Los Angeles",
        "conference": "West",
        "division": "Pacific",
        "full_name": "Los Angeles Lakers",
        "name": "Lakers"
      },
      "home_team_score": null,
      "visitor_team_score": null,
      "period": null,
      "postseason": false
    }
  ],
  "meta": {
    "total_pages": 1,
    "current_page": 1,
    "next_page": null,
    "per_page": 25,
    "total_count": 1
  }
}
```

**Key Fields:**
- `id`: Game ID (used to fetch predictions)
- `date`: Game date (ISO string)
- `status`: Game status ("Scheduled", "1st Qtr", "2nd Qtr", "Halftime", "3rd Qtr", "4th Qtr", "Final", etc.)
- `time`: Game time string (e.g., "8:00 PM ET")
- `home_team.abbreviation`: Home team abbreviation (e.g., "BOS")
- `visitor_team.abbreviation`: Visitor team abbreviation (e.g., "LAL")
- `home_team.full_name`: Full team name
- `visitor_team.full_name`: Full team name

### Step 1.2: Prediction Data Structure

Predictions already include game context when available:
```typescript
interface Prediction {
  id: string;
  game_id: number;
  player_id: number;
  prop_type: string;
  // ... other prediction fields ...
  player_first_name: string;
  player_last_name: string;
  team_abbreviation: string | null;  // Player's team
  // Game context fields (from API)
  game_label?: string;      // e.g., "LAL at BOS"
  game_time?: string;       // ISO timestamp
  game_status?: string;    // e.g., "Scheduled", "1st Qtr"
  opponent_team?: string;   // Opponent team abbreviation
}
```

**Key Points:**
- `game_id`: Links prediction to a game
- `team_abbreviation`: Player's team (must match either home_team or visitor_team for the selected game)
- Predictions endpoint `/api/predictions/game/:gameId` already exists and filters by game_id

### Step 1.3: Filtering Logic

When a game is selected:
1. Fetch predictions for that game: `/api/predictions/game/:gameId`
2. Backend should already filter predictions by `game_id`
3. Frontend should verify that `team_abbreviation` matches either:
   - `home_team.abbreviation` OR
   - `visitor_team.abbreviation`
4. If backend doesn't filter by team, frontend can filter client-side

---

## Phase 2: Frontend Implementation

### Step 2.1: Add Game Interface

Add a new interface for game data in `app/predictions.tsx`:

```typescript
interface Game {
  id: number;
  date: string;
  status: string;
  time: string;
  home_team: {
    id: number;
    abbreviation: string;
    full_name: string;
    city: string;
    name: string;
  };
  visitor_team: {
    id: number;
    abbreviation: string;
    full_name: string;
    city: string;
    name: string;
  };
  home_team_score: number | null;
  visitor_team_score: number | null;
}

interface GamesResponse {
  data: Game[];
  meta: {
    total_pages: number;
    current_page: number;
    next_page: number | null;
    per_page: number;
    total_count: number;
  };
}
```

### Step 2.2: Add State Management

Add state variables to track games and selected game:

```typescript
export default function PredictionsPage() {
  // ... existing state ...
  const [games, setGames] = useState<Game[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);
  const [gamesLoading, setGamesLoading] = useState(false);
  const [gamesError, setGamesError] = useState<string | null>(null);
  
  // ... rest of component ...
}
```

### Step 2.3: Fetch Upcoming Games

Create a function to fetch upcoming games (today and tomorrow):

```typescript
const fetchUpcomingGames = useCallback(async () => {
  try {
    setGamesError(null);
    setGamesLoading(true);
    
    // Get today and tomorrow dates in America/New_York timezone
    const now = new Date();
    const today = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const todayStr = today.toISOString().split('T')[0];
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    // Fetch games for today and tomorrow
    const [todayResponse, tomorrowResponse] = await Promise.all([
      get<GamesResponse>(`/api/bdl/v1/games?dates[]=${todayStr}&per_page=100`),
      get<GamesResponse>(`/api/bdl/v1/games?dates[]=${tomorrowStr}&per_page=100`)
    ]);
    
    // Combine and filter for upcoming games (status: "Scheduled" or not started)
    const allGames: Game[] = [
      ...(todayResponse.data?.data || []),
      ...(tomorrowResponse.data?.data || [])
    ];
    
    // Filter for upcoming games (Scheduled status or status that indicates not started)
    const upcomingGames = allGames.filter(game => {
      const status = game.status?.toLowerCase() || '';
      return status === 'scheduled' || 
             status === '' || 
             !status.includes('qtr') && 
             status !== 'final' && 
             status !== 'halftime';
    });
    
    // Sort by date and time
    upcomingGames.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateA !== dateB) return dateA - dateB;
      // If same date, sort by time if available
      return 0;
    });
    
    setGames(upcomingGames);
  } catch (err: any) {
    console.error('Error fetching games:', err);
    setGamesError(err.message || 'Failed to fetch upcoming games');
    setGames([]);
  } finally {
    setGamesLoading(false);
  }
}, []);
```

### Step 2.4: Update fetchPredictions to Use Selected Game

Modify the existing `fetchPredictions` function to use `selectedGameId`:

```typescript
const fetchPredictions = useCallback(async (gameId?: number) => {
  try {
    setError(null);
    setLoading(true);
    
    // Use selectedGameId if provided, otherwise use gameId parameter
    const targetGameId = selectedGameId || gameId;
    
    // Fetch predictions - when not showing value bets only, use game endpoint or all predictions
    const endpoint = showValueBetsOnly 
      ? `/api/predictions/value-bets?minValue=${minValue}&minConfidence=${minConfidence || '0'}${propTypeFilter !== 'all' ? `&propType=${propTypeFilter}` : ''}`
      : targetGameId 
        ? `/api/predictions/game/${targetGameId}${propTypeFilter !== 'all' ? `?propType=${propTypeFilter}` : ''}`
        : `/api/predictions/value-bets?minValue=${minValue}&minConfidence=${minConfidence || '0'}${propTypeFilter !== 'all' ? `&propType=${propTypeFilter}` : ''}`;
    
    console.log(`[Predictions] Fetching from endpoint: ${endpoint}`);
    const response = await get<PredictionsResponse>(endpoint);
    
    // ... existing response handling ...
    
    // If a game is selected, filter predictions to only include players from that game's teams
    if (targetGameId && response.data) {
      const selectedGame = games.find(g => g.id === targetGameId);
      if (selectedGame) {
        const homeTeam = selectedGame.home_team.abbreviation;
        const visitorTeam = selectedGame.visitor_team.abbreviation;
        
        // Filter predictions to only include players from either team
        if ('predictions' in response.data) {
          response.data.predictions = (response.data.predictions || []).filter(
            (pred: Prediction) => 
              pred.team_abbreviation === homeTeam || 
              pred.team_abbreviation === visitorTeam
          );
        } else if ('valueBets' in response.data) {
          response.data.valueBets = (response.data.valueBets || []).filter(
            (pred: Prediction) => 
              pred.team_abbreviation === homeTeam || 
              pred.team_abbreviation === visitorTeam
          );
        }
      }
    }
    
    // ... rest of existing response handling ...
  } catch (err: any) {
    // ... existing error handling ...
  } finally {
    setLoading(false);
    setRefreshing(false);
  }
}, [propTypeFilter, minValue, minConfidence, showValueBetsOnly, selectedGameId, games]);
```

### Step 2.5: Add useEffect to Fetch Games on Mount

Add a useEffect to fetch games when the component mounts:

```typescript
useEffect(() => {
  fetchUpcomingGames();
}, [fetchUpcomingGames]);

// Update predictions when selected game changes
useEffect(() => {
  fetchPredictions();
}, [fetchPredictions]);
```

### Step 2.6: Create Game Selector UI Component

Add a game selector component before the filters section:

```typescript
// Format game label (e.g., "LAL at BOS")
const formatGameLabel = (game: Game): string => {
  return `${game.visitor_team.abbreviation} at ${game.home_team.abbreviation}`;
};

// Format game time for display
const formatGameTimeDisplay = (game: Game): string => {
  if (game.time) return game.time;
  try {
    const date = new Date(game.date);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/New_York',
    }) + ' EST';
  } catch {
    return 'TBD';
  }
};
```

Add the game selector UI in the render section (after the title, before filters):

```typescript
{/* Game Selector */}
<Card padding="$3" backgroundColor="$backgroundStrong">
  <YStack space="$3">
    <XStack justifyContent="space-between" alignItems="center">
      <Text fontSize="$5" fontWeight="600" color="$color">
        Select Game
      </Text>
      <Button
        onPress={() => {
          setSelectedGameId(null);
          fetchPredictions();
        }}
        backgroundColor={selectedGameId === null ? "$blue9" : "$gray5"}
        color="white"
        size="$3"
      >
        All Games
      </Button>
    </XStack>
    
    {gamesLoading && (
      <YStack alignItems="center" padding="$2">
        <Spinner size="small" color="$blue9" />
        <Text marginTop="$2" fontSize="$3" color="$color10">
          Loading games...
        </Text>
      </YStack>
    )}
    
    {gamesError && (
      <Card padding="$2" backgroundColor="$red5">
        <Text color="white" fontSize="$3">{gamesError}</Text>
      </Card>
    )}
    
    {!gamesLoading && games.length === 0 && !gamesError && (
      <Text fontSize="$3" color="$color10" textAlign="center">
        No upcoming games found.
      </Text>
    )}
    
    {!gamesLoading && games.length > 0 && (
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingVertical: 8 }}
      >
        <XStack space="$2" flexWrap="wrap">
          {games.map((game) => {
            const isSelected = selectedGameId === game.id;
            const gameLabel = formatGameLabel(game);
            const gameTime = formatGameTimeDisplay(game);
            
            return (
              <Pressable
                key={game.id}
                onPress={() => {
                  setSelectedGameId(game.id);
                }}
              >
                <Card
                  padding="$3"
                  backgroundColor={isSelected ? "$blue9" : "$background"}
                  borderWidth={isSelected ? 2 : 1}
                  borderColor={isSelected ? "$blue11" : "$borderColor"}
                  minWidth={200}
                >
                  <YStack space="$1">
                    <Text 
                      fontSize="$4" 
                      fontWeight={isSelected ? "bold" : "600"}
                      color={isSelected ? "white" : "$color"}
                    >
                      {gameLabel}
                    </Text>
                    <Text 
                      fontSize="$2" 
                      color={isSelected ? "white" : "$color10"}
                    >
                      {gameTime}
                    </Text>
                    <Text 
                      fontSize="$2" 
                      color={isSelected ? "white" : "$color10"}
                      textTransform="capitalize"
                    >
                      {game.status || 'Scheduled'}
                    </Text>
                  </YStack>
                </Card>
              </Pressable>
            );
          })}
        </XStack>
      </ScrollView>
    )}
    
    {selectedGameId && (
      <Card padding="$2" backgroundColor="$blue2">
        <Text fontSize="$3" color="$color">
          Showing predictions for: {formatGameLabel(games.find(g => g.id === selectedGameId)!)}
        </Text>
      </Card>
    )}
  </YStack>
</Card>
```

### Step 2.7: Update Refresh Handler

Update the refresh handler to also refresh games:

```typescript
const onRefresh = useCallback(() => {
  setRefreshing(true);
  fetchUpcomingGames();
  fetchPredictions();
}, [fetchUpcomingGames, fetchPredictions]);
```

---

## Phase 3: Backend Considerations (Optional)

### Step 3.1: Verify Backend Filtering

The backend endpoint `/api/predictions/game/:gameId` should already filter predictions by `game_id`. Verify that:

1. The endpoint exists and works correctly
2. It returns predictions only for the specified game
3. Predictions include `team_abbreviation` field

### Step 3.2: Optional Backend Enhancement

If you want the backend to also filter by team (to ensure only players from the game's teams are returned), you could enhance the endpoint:

```javascript
// In routes/predictionRoutes.js (example enhancement)
router.get('/game/:gameId', authenticateToken, requirePermission(PERMISSIONS.SCAN_READ), async (req, res) => {
  try {
    const { gameId } = req.params;
    const { propType } = req.query;
    
    // Optional: Fetch game data to get team abbreviations
    // This ensures we only return predictions for players on either team
    // For now, frontend filtering is sufficient
    
    let query = `
      SELECT 
        p.*,
        ps.player_first_name,
        ps.player_last_name,
        ps.team_abbreviation
      FROM predictions p
      JOIN player_stats ps ON p.player_id = ps.player_id AND p.season = ps.season
      WHERE p.game_id = $1
        AND p.prediction_date = CURRENT_DATE
    `;
    const params = [gameId];
    
    if (propType) {
      query += ` AND p.prop_type = $${params.length + 1}`;
      params.push(propType);
    }
    
    // Execute query and return results
    // ... existing implementation ...
  } catch (error) {
    // ... error handling ...
  }
});
```

**Note:** Frontend filtering is sufficient for this feature. Backend enhancement is optional and only needed if you want to ensure data consistency at the API level.

---

## Phase 4: UI/UX Enhancements

### Step 4.1: Visual Feedback

- Selected game card should have distinct styling (blue background, white text)
- Unselected games should have subtle styling
- Show loading state while fetching games
- Show error state if games fail to load
- Display count of predictions for selected game

### Step 4.2: Mobile Responsiveness

- Game selector should scroll horizontally on mobile
- Cards should be appropriately sized for touch targets
- Consider stacking games vertically on very small screens

### Step 4.3: Empty States

- Show message when no upcoming games found
- Show message when no predictions for selected game
- Provide clear indication when "All Games" is selected

### Step 4.4: Performance Considerations

- Cache games data (don't refetch on every render)
- Debounce game selection if needed
- Consider memoizing game list rendering

---

## Phase 5: Testing Checklist

### Step 5.1: Functional Testing

- [ ] Games list loads on page mount
- [ ] Games are filtered to show only upcoming games
- [ ] Games are sorted by date/time
- [ ] Selecting a game filters predictions correctly
- [ ] "All Games" button clears selection and shows all predictions
- [ ] Predictions only show players from selected game's teams
- [ ] Filters (prop type, min value) still work with game selection
- [ ] Refresh button updates both games and predictions

### Step 5.2: Edge Cases

- [ ] Handle case when no upcoming games exist
- [ ] Handle case when selected game has no predictions
- [ ] Handle API errors gracefully
- [ ] Handle games with missing team data
- [ ] Handle predictions with missing team_abbreviation

### Step 5.3: UI Testing

- [ ] Game selector is visually clear
- [ ] Selected game is clearly indicated
- [ ] Mobile scrolling works correctly
- [ ] Loading states display properly
- [ ] Error states display properly

---

## Phase 6: Implementation Summary

### Files to Modify

1. **`app/predictions.tsx`**
   - Add `Game` and `GamesResponse` interfaces
   - Add state for games, selectedGameId, gamesLoading, gamesError
   - Add `fetchUpcomingGames` function
   - Update `fetchPredictions` to use selectedGameId and filter by team
   - Add game selector UI component
   - Update refresh handler

### API Endpoints Used

1. **`GET /api/bdl/v1/games?dates[]=YYYY-MM-DD&per_page=100`**
   - Fetches games for a specific date
   - Requires authentication
   - Returns game data with team information

2. **`GET /api/predictions/game/:gameId`** (existing)
   - Fetches predictions for a specific game
   - Requires authentication
   - Returns predictions filtered by game_id

### Key Features

1. **Game Selection**: Users can select from upcoming games
2. **Team Filtering**: Only predictions for players on either team are shown
3. **All Games Option**: Users can view all predictions by selecting "All Games"
4. **Automatic Updates**: Games and predictions refresh together
5. **Visual Feedback**: Clear indication of selected game

---

## Phase 7: Future Enhancements (Optional)

### Step 7.1: Game Status Indicators

- Show visual indicators for game status (Scheduled, Live, Finished)
- Color-code games by status
- Filter out finished games from selector

### Step 7.2: Date Range Selection

- Allow users to select date range for games
- Show games for next 7 days instead of just today/tomorrow

### Step 7.3: Game Details Modal

- Click game card to see full game details
- Show team rosters
- Show game statistics if available

### Step 7.4: Prediction Counts

- Show number of predictions per game in the game card
- Highlight games with most value bets

---

## Notes

- This implementation assumes the backend `/api/predictions/game/:gameId` endpoint exists and works correctly
- Frontend team filtering is a safety measure; backend should already filter by game_id
- Games are fetched for today and tomorrow in America/New_York timezone
- The implementation maintains backward compatibility with existing prediction viewing (all games)
- No changes to existing prediction display logic are required beyond filtering

