# Value Bets Only Filter Fix Implementation Guide

## Problem
The "Value Bets Only" filter currently doesn't hide bets that aren't value bets. When the filter is enabled, all predictions are still displayed regardless of whether they meet the value bet criteria.

## Root Causes

### 1. Missing Client-Side Filtering
The frontend relies entirely on the backend API to filter value bets, but there's no additional client-side filtering to ensure only value bets are displayed when `showValueBetsOnly` is true.

**Location**: `app/predictions.tsx` - `fetchPredictions` function (lines 451-532)

**Current Behavior**:
- When `showValueBetsOnly` is true, the code calls `/api/predictions/value-bets` endpoint
- The predictions are set directly from the API response without additional filtering
- If the backend returns non-value bets (due to bugs, edge cases, or API inconsistencies), they will be displayed

### 2. Value Bet Determination Logic
A value bet is determined by checking if either `predicted_value_over` or `predicted_value_under` meets the minimum value threshold. The current code calculates this in the display logic but doesn't use it for filtering.

**Location**: `app/predictions.tsx` - Display logic (lines 1536-1540, 1730-1734)

**Current Logic**:
```typescript
const bestValue = Math.max(
  pred.predicted_value_over || 0,
  pred.predicted_value_under || 0
);
const isValueBet = bestValue >= parseFloat(minValue);
```

This logic is only used for styling/highlighting, not for filtering out non-value bets.

### 3. Backend Dependency
The code assumes the backend `/api/predictions/value-bets` endpoint always returns only value bets, but there's no guarantee or validation on the frontend.

## Solution

### Step 1: Add Client-Side Filtering Function

Add a helper function to determine if a prediction is a value bet. This should be placed near the top of the file, after the utility functions and before the main component.

**Location**: After line 355 (after `getOpponentTeam` function, before `export default function PredictionsPage`)

```typescript
/**
 * Determine if a prediction is a value bet
 * A value bet has either predicted_value_over or predicted_value_under >= minValue
 * AND the corresponding confidence_score >= minConfidence
 */
function isValueBet(
  prediction: Prediction,
  minValue: number,
  minConfidence: number
): boolean {
  const valueOver = prediction.predicted_value_over ?? 0;
  const valueUnder = prediction.predicted_value_under ?? 0;
  const confidence = prediction.confidence_score ?? 0;
  
  // Check if over side is a value bet
  const overIsValueBet = valueOver >= minValue && confidence >= minConfidence;
  
  // Check if under side is a value bet
  const underIsValueBet = valueUnder >= minValue && confidence >= minConfidence;
  
  // A prediction is a value bet if either side meets the criteria
  return overIsValueBet || underIsValueBet;
}
```

### Step 2: Filter Predictions After Fetching

Modify the `fetchPredictions` function to filter predictions when `showValueBetsOnly` is true.

**Location**: `app/predictions.tsx` - `fetchPredictions` function, after setting `predictionsToSet` (around line 517)

**Current Code** (lines 510-519):
```typescript
// Enrich predictions with opponent_team if not already provided
predictionsToSet = predictionsToSet.map((pred: Prediction) => {
  const opponentTeam = getOpponentTeam(pred, games);
  if (opponentTeam && !pred.opponent_team) {
    return { ...pred, opponent_team: opponentTeam };
  }
  return pred;
});

setPredictions(predictionsToSet);
```

**Replace with**:
```typescript
// Enrich predictions with opponent_team if not already provided
predictionsToSet = predictionsToSet.map((pred: Prediction) => {
  const opponentTeam = getOpponentTeam(pred, games);
  if (opponentTeam && !pred.opponent_team) {
    return { ...pred, opponent_team: opponentTeam };
  }
  return pred;
});

// Filter for value bets only if showValueBetsOnly is enabled
if (showValueBetsOnly) {
  const minValueNum = parseFloat(minValue);
  const minConfidenceNum = parseFloat(minConfidence || '0');
  
  predictionsToSet = predictionsToSet.filter((pred: Prediction) => 
    isValueBet(pred, minValueNum, minConfidenceNum)
  );
  
  console.log(`[Predictions] Filtered to ${predictionsToSet.length} value bets (minValue=${minValueNum}, minConfidence=${minConfidenceNum})`);
}

setPredictions(predictionsToSet);
```

### Step 3: Update Dependencies

Ensure the `fetchPredictions` callback includes `minConfidence` in its dependency array if it's not already there.

**Location**: `app/predictions.tsx` - `fetchPredictions` useCallback dependencies (line 532)

**Current**:
```typescript
}, [propTypeFilter, minValue, minConfidence, showValueBetsOnly, selectedGameId, games]);
```

**Verify** that `minConfidence` is included (it should already be there based on the current code).

## Implementation Steps

1. **Add the `isValueBet` helper function** (Step 1)
   - Place it after the `getOpponentTeam` function (around line 355)
   - This function will be used to determine if a prediction qualifies as a value bet

2. **Modify `fetchPredictions` to filter predictions** (Step 2)
   - Add the filtering logic after enriching predictions with opponent_team
   - Only filter when `showValueBetsOnly` is true
   - Use the `isValueBet` helper function to determine which predictions to keep

3. **Test the implementation**:
   - Enable "Value Bets Only" filter
   - Verify that only predictions with `predicted_value_over >= minValue` OR `predicted_value_under >= minValue` are displayed
   - Verify that predictions with both values below the threshold are hidden
   - Test with different `minValue` settings (0%, 3%, 5%, etc.)
   - Test with different `minConfidence` settings
   - Verify that disabling the filter shows all predictions again

## Expected Behavior After Fix

### When "Value Bets Only" is Enabled:
- Only predictions where at least one side (over or under) has:
  - `predicted_value_over >= minValue` OR `predicted_value_under >= minValue`
  - AND `confidence_score >= minConfidence`
- All other predictions are hidden

### When "Value Bets Only" is Disabled:
- All predictions are shown (no filtering based on value)

## Edge Cases to Handle

1. **Null Values**: The `isValueBet` function handles null values by defaulting to 0, which means predictions with null value fields won't be considered value bets (correct behavior).

2. **Zero MinValue**: When `minValue` is 0, all predictions with any positive value (or zero) will be shown. This is expected behavior.

3. **Zero MinConfidence**: When `minConfidence` is 0, the confidence check is effectively disabled, and only the value threshold matters.

4. **Both Sides Below Threshold**: If both `predicted_value_over` and `predicted_value_under` are below `minValue`, the prediction should be hidden when the filter is enabled.

5. **One Side Above, One Side Below**: If either side meets the criteria, the prediction should be shown (this is the correct behavior - the user can choose which side to bet on).

## Testing Checklist

- [ ] Enable "Value Bets Only" filter
- [ ] Verify only value bets are displayed
- [ ] Change `minValue` filter and verify predictions update correctly
- [ ] Change `minConfidence` filter and verify predictions update correctly
- [ ] Disable "Value Bets Only" filter and verify all predictions are shown
- [ ] Test with a selected game (should still filter correctly)
- [ ] Test with different prop type filters (should still filter correctly)
- [ ] Verify console logs show correct filtering counts
- [ ] Test on both web and mobile platforms

## Notes

- This fix adds client-side filtering as a safety measure, but the backend should still be filtering correctly. If the backend is returning non-value bets when it shouldn't, that's a separate issue that should be investigated.
- The filtering happens after all other processing (game filtering, opponent enrichment) to ensure consistency.
- The `isValueBet` function matches the backend logic: a prediction is a value bet if EITHER side meets the criteria (not both).
- This implementation ensures that even if the backend has bugs or inconsistencies, the frontend will correctly filter value bets.

