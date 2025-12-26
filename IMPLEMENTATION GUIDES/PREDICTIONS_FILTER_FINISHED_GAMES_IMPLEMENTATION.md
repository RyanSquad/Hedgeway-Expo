# Predictions Filter Finished Games Implementation Guide

## Problem

Currently, predictions for games that have already finished are still being displayed on the predictions page. This is problematic because:

1. **Predictions are only useful before games start** - Once a game is finished, the predictions are no longer actionable
2. **User experience** - Users don't want to see predictions for games that have already concluded
3. **Data accuracy** - Finished games may have actual results that make the predictions irrelevant

The predictions page should **automatically filter out predictions for finished games**, regardless of how predictions are fetched (by game ID, all predictions, or value bets).

---

## Root Causes

### 1. No Filtering in `fetchPredictions` Function

The `fetchPredictions` function (lines 455-548 in `app/predictions.tsx`) receives predictions from the API but does not filter out predictions for finished games. It filters predictions based on:
- Selected game ID (if a specific game is selected)
- Value bet criteria (if `showValueBetsOnly` is enabled)
- Prop type filter

However, it **does not check if the associated game has finished**.

### 2. Predictions API May Return Finished Games

The backend API endpoints (`/api/predictions/game/:gameId`, `/api/predictions/value-bets`, etc.) may return predictions for games that have finished, especially if:
- The game finished after predictions were generated
- The backend doesn't filter by game status
- Predictions were cached before the game finished

### 3. Multiple Sources of Game Status Information

Game status can be determined from:
- `prediction.game_status` (optional field on the Prediction object)
- `games` state array (Game objects with `status` field)
- Both sources may need to be checked to ensure accuracy

---

## Solution

The solution involves:
1. Creating a helper function to identify finished games
2. Filtering predictions in `fetchPredictions` to exclude finished games
3. Using both `prediction.game_status` and the `games` list to determine game status

---

## Implementation Steps

### Step 1: Create Helper Function to Identify Finished Games

Add a helper function after the `isValueBet` function (around line 362 in `app/predictions.tsx`):

```typescript
/**
 * Determine if a game status string represents a finished game.
 * Finished games are those that have completed and are no longer in progress.
 * 
 * @param status - The game status string (e.g., "Final", "complete", "finished")
 * @returns true if the game is finished, false otherwise
 */
function isFinishedGameStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  
  const normalized = status.trim().toLowerCase();
  if (!normalized) return false;

  // Keywords that indicate a game is finished
  const finishedKeywords = [
    'final',
    'finished',
    'complete',
    'completed',
    'full time',
    'full-time',
    'ft',
    'ended',
    'over',
  ];

  return finishedKeywords.some((keyword) =>
    normalized.includes(keyword)
  );
}
```

**Location**: Place this function after `isValueBet` (around line 362) and before the `PredictionsPage` component.

### Step 2: Create Helper Function to Check if Prediction is for Finished Game

Add another helper function right after `isFinishedGameStatus`:

```typescript
/**
 * Determine if a prediction is for a finished game.
 * Checks both the prediction's game_status field and the games list.
 * 
 * @param prediction - The prediction object
 * @param gamesList - Array of Game objects from state
 * @returns true if the prediction's game is finished, false otherwise
 */
function isPredictionForFinishedGame(
  prediction: Prediction,
  gamesList: Game[]
): boolean {
  // First, check if prediction has game_status field
  if (prediction.game_status) {
    if (isFinishedGameStatus(prediction.game_status)) {
      return true;
    }
  }
  
  // Also check the games list for the associated game
  const associatedGame = gamesList.find(g => g.id === prediction.game_id);
  if (associatedGame) {
    if (isFinishedGameStatus(associatedGame.status)) {
      return true;
    }
  }
  
  // If we can't find the game and prediction doesn't have status, 
  // assume it's not finished (conservative approach)
  return false;
}
```

**Location**: Place this function immediately after `isFinishedGameStatus`.

### Step 3: Filter Predictions in `fetchPredictions` Function

In the `fetchPredictions` function, add filtering logic to exclude predictions for finished games. The filtering should happen **after** predictions are fetched from the API but **before** any other filtering logic.

Find the section in `fetchPredictions` where `predictionsToSet` is populated (around line 480-496), and add the finished game filter right after the predictions are extracted:

```typescript
// ... existing code to populate predictionsToSet ...

// Filter out predictions for finished games
predictionsToSet = predictionsToSet.filter((pred: Prediction) => 
  !isPredictionForFinishedGame(pred, games)
);

console.log(`[Predictions] Filtered out finished games, remaining: ${predictionsToSet.length} predictions`);
```

**Exact Location**: Add this filter after line 496 (after the else block that handles response data) and before the game selection filter (line 498).

The full sequence should be:
1. Extract predictions from API response (lines 482-496)
2. **NEW: Filter out finished games** (add here)
3. Filter by selected game ID if applicable (lines 498-512)
4. Enrich predictions with opponent_team (lines 514-521)
5. Filter for value bets if enabled (lines 523-533)

### Step 4: Update Function Dependencies

The `fetchPredictions` callback already includes `games` in its dependency array (line 548), so no changes are needed there. The `games` state is already available for the filtering logic.

---

## Complete Code Example

Here's the relevant section of code showing where the changes should be made:

```typescript
// ... existing code ...

/**
 * Determine if a game status string represents a finished game.
 */
function isFinishedGameStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  
  const normalized = status.trim().toLowerCase();
  if (!normalized) return false;

  const finishedKeywords = [
    'final',
    'finished',
    'complete',
    'completed',
    'full time',
    'full-time',
    'ft',
    'ended',
    'over',
  ];

  return finishedKeywords.some((keyword) =>
    normalized.includes(keyword)
  );
}

/**
 * Determine if a prediction is for a finished game.
 */
function isPredictionForFinishedGame(
  prediction: Prediction,
  gamesList: Game[]
): boolean {
  // Check prediction's game_status field
  if (prediction.game_status) {
    if (isFinishedGameStatus(prediction.game_status)) {
      return true;
    }
  }
  
  // Check games list for associated game
  const associatedGame = gamesList.find(g => g.id === prediction.game_id);
  if (associatedGame) {
    if (isFinishedGameStatus(associatedGame.status)) {
      return true;
    }
  }
  
  return false;
}

// ... existing code ...

const fetchPredictions = useCallback(async (gameId?: number) => {
  try {
    // ... existing code to fetch from API ...
    
    let predictionsToSet: Prediction[] = [];
    
    if ('predictions' in response.data) {
      predictionsToSet = response.data.predictions || [];
    } else if ('valueBets' in response.data) {
      predictionsToSet = response.data.valueBets || [];
    } else {
      // ... existing warning ...
    }
    
    // NEW: Filter out predictions for finished games
    predictionsToSet = predictionsToSet.filter((pred: Prediction) => 
      !isPredictionForFinishedGame(pred, games)
    );
    
    console.log(`[Predictions] After filtering finished games: ${predictionsToSet.length} predictions`);
    
    // ... rest of existing filtering logic ...
    
  } catch (err: any) {
    // ... existing error handling ...
  }
}, [propTypeFilter, minValue, minConfidence, showValueBetsOnly, selectedGameId, games]);
```

---

## Testing Checklist

After implementing the changes:

1. ✅ **Test with finished games**: 
   - Verify predictions for finished games (status: "Final", "finished", etc.) are not displayed
   - Check that the console log shows the correct count after filtering

2. ✅ **Test with scheduled games**:
   - Verify predictions for scheduled/upcoming games are still displayed
   - Verify predictions for live games are still displayed

3. ✅ **Test with game selector**:
   - Select a finished game from the game selector (if one appears)
   - Verify no predictions are shown for finished games
   - Select a scheduled game and verify predictions appear

4. ✅ **Test with value bets filter**:
   - Enable "Value Bets Only" toggle
   - Verify finished games are still filtered out even when showing value bets

5. ✅ **Test edge cases**:
   - Predictions with `game_status` field present
   - Predictions without `game_status` field (should check games list)
   - Predictions where game is not in the games list (conservative: assume not finished)
   - Multiple status variations: "Final", "final", "FINISHED", "Complete", etc.

6. ✅ **Test console logs**:
   - Check that the log message shows the correct count after filtering
   - Verify no errors are thrown when filtering

---

## Key Improvements

1. **Automatic filtering**: Finished games are automatically excluded from predictions display
2. **Multiple status sources**: Checks both `prediction.game_status` and the `games` list for accuracy
3. **Case-insensitive matching**: Status comparison handles variations in capitalization
4. **Conservative approach**: If status cannot be determined, predictions are kept (assumes not finished)
5. **Comprehensive keyword matching**: Handles various ways games can be marked as finished
6. **Minimal code changes**: Only adds filtering logic without changing existing functionality

---

## Notes

- The filtering happens **client-side** in the `fetchPredictions` function. If desired, this could also be implemented **server-side** in the API endpoints to reduce data transfer, but client-side filtering provides flexibility and immediate feedback.

- The `games` state is fetched separately via `fetchUpcomingGames`, which already filters for upcoming games. However, if a finished game somehow appears in the games list, the prediction filtering will still catch it.

- If a prediction's associated game is not found in the `games` list AND the prediction doesn't have a `game_status` field, the prediction will be kept (not filtered out). This is a conservative approach to avoid hiding valid predictions due to missing data.

- The filtering happens **before** other filters (game selection, value bets, prop type), so finished games are excluded regardless of other filter settings.

- Status keyword matching uses `.includes()` to handle variations like "Game Final", "Final Score", etc. If more precise matching is needed, the logic can be refined.

---

## Related Files

- `app/predictions.tsx` - Main file to modify
- `IMPLEMENTATION GUIDES/HIDE_LIVE_FINISHED_TOGGLE_IMPLEMENTATION.md` - Similar filtering logic for scan page
- `IMPLEMENTATION GUIDES/SCAN_GAME_STATUS_BACKEND_IMPROVEMENTS.md` - Backend improvements for game status (optional future enhancement)

