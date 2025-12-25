# Market Odds Sorting Implementation Guide

## Problem Statement

Users want to sort predictions by Market Odds to easily identify bets with the best available odds. Currently, the predictions page supports sorting by Value, Confidence, Prop Type, and Player Name, but not by Market Odds.

## Current State

**Available Sort Options:**
- ✅ Value (High to Low / Low to High)
- ✅ Confidence (High to Low / Low to High)
- ✅ Prop Type
- ✅ Player Name

**Available Data Fields:**
- `best_over_odds`: Best available over odds (American format, can be positive or negative)
- `best_under_odds`: Best available under odds (American format, can be positive or negative)

**Current Implementation:**
- Sort options are defined in `sortOptions` array (lines 809-816)
- Sort logic is implemented in `sortedPredictions` useMemo (lines 516-561)
- `SortOption` type is defined on line 252

## Target State

Add two new sort options for Market Odds:
1. **Market Odds (Best to Worst)**: Sort by the best available odds (highest odds value, which is most favorable for bettors)
2. **Market Odds (Worst to Best)**: Sort by the worst available odds (lowest odds value)

**Sorting Logic:**
- For each prediction, use the maximum of `best_over_odds` and `best_under_odds` (the best odds available)
- Handle null values appropriately (predictions with null odds should appear at the end)
- Higher odds values are better for bettors (e.g., +150 is better than -110)

---

## Implementation Steps

### Step 1: Update the SortOption Type

**Location:** `app/predictions.tsx`, line 252

**Current Code:**
```typescript
type SortOption = 'value-desc' | 'value-asc' | 'confidence-desc' | 'confidence-asc' | 'prop-type' | 'player-name';
```

**Updated Code:**
```typescript
type SortOption = 'value-desc' | 'value-asc' | 'confidence-desc' | 'confidence-asc' | 'prop-type' | 'player-name' | 'odds-desc' | 'odds-asc';
```

**Explanation:**
- `odds-desc`: Market Odds (Best to Worst) - highest odds first
- `odds-asc`: Market Odds (Worst to Best) - lowest odds first

---

### Step 2: Add Sort Options to the sortOptions Array

**Location:** `app/predictions.tsx`, lines 809-816

**Current Code:**
```typescript
const sortOptions = [
  { value: 'value-desc', label: 'Value (High to Low)' },
  { value: 'value-asc', label: 'Value (Low to High)' },
  { value: 'confidence-desc', label: 'Confidence (High to Low)' },
  { value: 'confidence-asc', label: 'Confidence (Low to High)' },
  { value: 'prop-type', label: 'Prop Type' },
  { value: 'player-name', label: 'Player Name' },
];
```

**Updated Code:**
```typescript
const sortOptions = [
  { value: 'value-desc', label: 'Value (High to Low)' },
  { value: 'value-asc', label: 'Value (Low to High)' },
  { value: 'confidence-desc', label: 'Confidence (High to Low)' },
  { value: 'confidence-asc', label: 'Confidence (Low to High)' },
  { value: 'prop-type', label: 'Prop Type' },
  { value: 'player-name', label: 'Player Name' },
  { value: 'odds-desc', label: 'Market Odds (Best to Worst)' },
  { value: 'odds-asc', label: 'Market Odds (Worst to Best)' },
];
```

**Explanation:**
- Added two new options at the end of the array
- Labels clearly indicate what each option does

---

### Step 3: Implement Sorting Logic in sortedPredictions useMemo

**Location:** `app/predictions.tsx`, lines 516-561

**Current Code:**
```typescript
// Sort predictions based on selected option
const sortedPredictions = useMemo(() => {
  const sorted = [...predictions];

  switch (sortOption) {
    case 'value-desc':
      return sorted.sort((a, b) => {
        const aValue = Math.max(a.predicted_value_over || 0, a.predicted_value_under || 0);
        const bValue = Math.max(b.predicted_value_over || 0, b.predicted_value_under || 0);
        return bValue - aValue;
      });

    case 'value-asc':
      return sorted.sort((a, b) => {
        const aValue = Math.max(a.predicted_value_over || 0, a.predicted_value_under || 0);
        const bValue = Math.max(b.predicted_value_over || 0, b.predicted_value_under || 0);
        return aValue - bValue;
      });

    case 'confidence-desc':
      return sorted.sort((a, b) => b.confidence_score - a.confidence_score);

    case 'confidence-asc':
      return sorted.sort((a, b) => a.confidence_score - b.confidence_score);

    case 'prop-type':
      return sorted.sort((a, b) => {
        if (a.prop_type !== b.prop_type) {
          return a.prop_type.localeCompare(b.prop_type);
        }
        // Secondary sort by value
        const aValue = Math.max(a.predicted_value_over || 0, a.predicted_value_under || 0);
        const bValue = Math.max(b.predicted_value_over || 0, b.predicted_value_under || 0);
        return bValue - aValue;
      });

    case 'player-name':
      return sorted.sort((a, b) => {
        const aName = `${a.player_first_name} ${a.player_last_name}`;
        const bName = `${b.player_first_name} ${b.player_last_name}`;
        return aName.localeCompare(bName);
      });

    default:
      return sorted;
  }
}, [predictions, sortOption]);
```

**Updated Code:**
```typescript
// Sort predictions based on selected option
const sortedPredictions = useMemo(() => {
  const sorted = [...predictions];

  switch (sortOption) {
    case 'value-desc':
      return sorted.sort((a, b) => {
        const aValue = Math.max(a.predicted_value_over || 0, a.predicted_value_under || 0);
        const bValue = Math.max(b.predicted_value_over || 0, b.predicted_value_under || 0);
        return bValue - aValue;
      });

    case 'value-asc':
      return sorted.sort((a, b) => {
        const aValue = Math.max(a.predicted_value_over || 0, a.predicted_value_under || 0);
        const bValue = Math.max(b.predicted_value_over || 0, b.predicted_value_under || 0);
        return aValue - bValue;
      });

    case 'confidence-desc':
      return sorted.sort((a, b) => b.confidence_score - a.confidence_score);

    case 'confidence-asc':
      return sorted.sort((a, b) => a.confidence_score - b.confidence_score);

    case 'prop-type':
      return sorted.sort((a, b) => {
        if (a.prop_type !== b.prop_type) {
          return a.prop_type.localeCompare(b.prop_type);
        }
        // Secondary sort by value
        const aValue = Math.max(a.predicted_value_over || 0, a.predicted_value_under || 0);
        const bValue = Math.max(b.predicted_value_over || 0, b.predicted_value_under || 0);
        return bValue - aValue;
      });

    case 'player-name':
      return sorted.sort((a, b) => {
        const aName = `${a.player_first_name} ${a.player_last_name}`;
        const bName = `${b.player_first_name} ${b.player_last_name}`;
        return aName.localeCompare(bName);
      });

    case 'odds-desc':
      return sorted.sort((a, b) => {
        // Get best odds for each prediction (highest value is best)
        const aBestOdds = Math.max(
          a.best_over_odds ?? Number.NEGATIVE_INFINITY,
          a.best_under_odds ?? Number.NEGATIVE_INFINITY
        );
        const bBestOdds = Math.max(
          b.best_over_odds ?? Number.NEGATIVE_INFINITY,
          b.best_under_odds ?? Number.NEGATIVE_INFINITY
        );
        
        // If both have null odds, maintain order
        if (aBestOdds === Number.NEGATIVE_INFINITY && bBestOdds === Number.NEGATIVE_INFINITY) {
          return 0;
        }
        
        // Predictions with null odds go to the end
        if (aBestOdds === Number.NEGATIVE_INFINITY) return 1;
        if (bBestOdds === Number.NEGATIVE_INFINITY) return -1;
        
        // Sort descending (best odds first)
        return bBestOdds - aBestOdds;
      });

    case 'odds-asc':
      return sorted.sort((a, b) => {
        // Get best odds for each prediction (highest value is best)
        const aBestOdds = Math.max(
          a.best_over_odds ?? Number.NEGATIVE_INFINITY,
          a.best_under_odds ?? Number.NEGATIVE_INFINITY
        );
        const bBestOdds = Math.max(
          b.best_over_odds ?? Number.NEGATIVE_INFINITY,
          b.best_under_odds ?? Number.NEGATIVE_INFINITY
        );
        
        // If both have null odds, maintain order
        if (aBestOdds === Number.NEGATIVE_INFINITY && bBestOdds === Number.NEGATIVE_INFINITY) {
          return 0;
        }
        
        // Predictions with null odds go to the end
        if (aBestOdds === Number.NEGATIVE_INFINITY) return 1;
        if (bBestOdds === Number.NEGATIVE_INFINITY) return -1;
        
        // Sort ascending (worst odds first)
        return aBestOdds - bBestOdds;
      });

    default:
      return sorted;
  }
}, [predictions, sortOption]);
```

**Explanation:**
- **`odds-desc` (Best to Worst)**: 
  - Uses `Math.max()` to get the best odds from either over or under
  - Sorts descending (highest odds first)
  - Predictions with null odds are placed at the end
  
- **`odds-asc` (Worst to Best)**:
  - Uses the same logic to get best odds
  - Sorts ascending (lowest odds first)
  - Predictions with null odds are placed at the end

**Note on Odds Values:**
- In American odds format:
  - Positive odds (e.g., +150) are better than negative odds (e.g., -110)
  - Higher positive numbers are better (e.g., +200 is better than +150)
  - Less negative numbers are better (e.g., -105 is better than -110)
- By using `Math.max()`, we correctly identify the best odds regardless of whether they're positive or negative

---

## Testing Checklist

After implementing the changes:

1. ✅ **Test Sort Dropdown**
   - Verify "Market Odds (Best to Worst)" appears in the dropdown
   - Verify "Market Odds (Worst to Best)" appears in the dropdown
   - Verify both options are selectable

2. ✅ **Test Sorting Logic - Best to Worst**
   - Select "Market Odds (Best to Worst)"
   - Verify predictions with highest odds appear first
   - Verify predictions with null odds appear at the end
   - Verify sorting works correctly with both positive and negative odds

3. ✅ **Test Sorting Logic - Worst to Best**
   - Select "Market Odds (Worst to Best)"
   - Verify predictions with lowest odds appear first
   - Verify predictions with null odds appear at the end
   - Verify sorting works correctly with both positive and negative odds

4. ✅ **Test Edge Cases**
   - Predictions with only `best_over_odds` (null `best_under_odds`)
   - Predictions with only `best_under_odds` (null `best_over_odds`)
   - Predictions with both odds null
   - Predictions with positive odds vs negative odds
   - Predictions with same odds values

5. ✅ **Test Integration with Other Features**
   - Verify sorting works with prop type filter
   - Verify sorting works with value threshold filter
   - Verify sorting works with game selector
   - Verify sorting persists when refreshing data
   - Verify sorting works with collapsed/expanded sections

6. ✅ **Test UI/UX**
   - Verify dropdown closes after selection
   - Verify selected sort option is highlighted
   - Verify sort option persists across page refreshes (if applicable)
   - Verify mobile responsiveness

---

## Example Test Scenarios

### Scenario 1: Basic Sorting Test

**Setup:**
- Predictions with odds: +150, -110, +200, -105, null

**Expected Result (Best to Worst):**
- +200 (best)
- +150
- -105
- -110
- null (at end)

**Expected Result (Worst to Best):**
- -110 (worst)
- -105
- +150
- +200
- null (at end)

### Scenario 2: Mixed Over/Under Odds

**Setup:**
- Prediction A: `best_over_odds: +150`, `best_under_odds: -110` → Best: +150
- Prediction B: `best_over_odds: -105`, `best_under_odds: +120` → Best: +120
- Prediction C: `best_over_odds: +200`, `best_under_odds: null` → Best: +200

**Expected Result (Best to Worst):**
- Prediction C (+200)
- Prediction A (+150)
- Prediction B (+120)

### Scenario 3: Null Odds Handling

**Setup:**
- Prediction A: `best_over_odds: +150`, `best_under_odds: -110`
- Prediction B: `best_over_odds: null`, `best_under_odds: null`
- Prediction C: `best_over_odds: +200`, `best_under_odds: null`

**Expected Result (Best to Worst):**
- Prediction C (+200)
- Prediction A (+150)
- Prediction B (null, at end)

---

## Key Implementation Details

### Odds Comparison Logic

The implementation uses `Math.max()` to determine the best odds for each prediction:

```typescript
const bestOdds = Math.max(
  best_over_odds ?? Number.NEGATIVE_INFINITY,
  best_under_odds ?? Number.NEGATIVE_INFINITY
);
```

**Why this works:**
- For positive odds: Higher is better (+200 > +150)
- For negative odds: Less negative is better (-105 > -110)
- `Math.max()` correctly handles both cases:
  - `Math.max(+150, -110)` = +150 ✓
  - `Math.max(-105, -110)` = -105 ✓
  - `Math.max(+200, +150)` = +200 ✓

### Null Handling

- Predictions with both odds null use `Number.NEGATIVE_INFINITY` as a sentinel value
- These predictions are always sorted to the end, regardless of sort direction
- This ensures predictions without odds data don't interfere with the sorting

### Secondary Sort Consideration

Currently, other sort options (like `prop-type`) use a secondary sort by value. For Market Odds sorting, you may want to consider:
- **Option 1**: No secondary sort (current implementation)
- **Option 2**: Secondary sort by value when odds are equal
- **Option 3**: Secondary sort by confidence when odds are equal

The current implementation uses no secondary sort, which is consistent with the `confidence-desc` and `confidence-asc` options. If you want to add a secondary sort, you can modify the cases like this:

```typescript
case 'odds-desc':
  return sorted.sort((a, b) => {
    // ... existing odds comparison logic ...
    
    // If odds are equal, secondary sort by value
    if (aBestOdds === bBestOdds) {
      const aValue = Math.max(a.predicted_value_over || 0, a.predicted_value_under || 0);
      const bValue = Math.max(b.predicted_value_over || 0, b.predicted_value_under || 0);
      return bValue - aValue;
    }
    
    return bBestOdds - aBestOdds;
  });
```

---

## Notes

- The sorting is client-side only (no backend changes required)
- The implementation follows the existing pattern used for other sort options
- Odds are stored in American format (can be positive or negative integers)
- The sort options will appear in the dropdown in the order they're defined in the `sortOptions` array
- Consider user feedback on whether a secondary sort would be helpful for Market Odds sorting

---

## Related Files

- `app/predictions.tsx` - Main predictions page component
- `IMPLEMENTATION GUIDES/PREDICTIONS_PROP_TYPE_ORGANIZATION.md` - Related sorting implementation
- `IMPLEMENTATION GUIDES/PLAYER_STATS_SORTING_IMPLEMENTATION.md` - Reference for sorting patterns

