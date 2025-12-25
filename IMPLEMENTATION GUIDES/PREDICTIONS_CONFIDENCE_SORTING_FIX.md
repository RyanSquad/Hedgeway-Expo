# Predictions Confidence Sorting Fix Implementation Guide

## Problem Description

The "Sort by Confidence" feature is not working correctly. When users select "Confidence (High to Low)" or "Confidence (Low to High)", the predictions are sorted by confidence score, but then they are grouped by prop type and displayed in a fixed prop type order (`PROP_TYPE_ORDER`), which disrupts the confidence-based sorting.

### Current Behavior

1. Predictions are correctly sorted by `confidence_score` in the `sortedPredictions` useMemo (lines 582-586)
2. Sorted predictions are then grouped by prop type using `groupPredictionsByPropType` (line 662-664)
3. The `getPropTypesInOrder` function (lines 307-320) returns prop types in a fixed order: `['points', 'assists', 'rebounds', 'steals', 'blocks', 'threes']`
4. Predictions are displayed grouped by prop type in this fixed order, regardless of the confidence sort

### Example of the Issue

If you have predictions with these confidence scores:
- Prediction A: confidence 0.9, prop_type: 'rebounds'
- Prediction B: confidence 0.8, prop_type: 'points'
- Prediction C: confidence 0.7, prop_type: 'assists'

**Expected behavior (confidence-desc):**
- Should show: Rebounds (A), Points (B), Assists (C) - ordered by highest confidence first

**Actual behavior:**
- Shows: Points (B), Assists (C), Rebounds (A) - ordered by fixed PROP_TYPE_ORDER

The predictions within each group ARE correctly sorted by confidence, but the groups themselves are displayed in the wrong order.

## Root Cause

The `getPropTypesInOrder` function always returns prop types in `PROP_TYPE_ORDER` regardless of the current sort option. When sorting by confidence, the prop type groups should be ordered by the highest (or lowest) confidence score in each group, not by the fixed prop type order.

## Solution

Modify the code to:
1. Pass the `sortOption` to `getPropTypesInOrder` function
2. When sorting by confidence, order prop type groups by the confidence scores within each group
3. When sorting by other criteria (value, odds, etc.), also order groups appropriately
4. Only use `PROP_TYPE_ORDER` when sorting by 'prop-type' or when no specific sort is applied

## Implementation Steps

### Step 1: Update `getPropTypesInOrder` Function Signature

**Location:** Lines 307-320 in `app/predictions.tsx`

**Current:**
```typescript
function getPropTypesInOrder(
  groupedPredictions: Record<string, Prediction[]>,
  propTypeFilter: string
): string[] {
```

**Change to:**
```typescript
function getPropTypesInOrder(
  groupedPredictions: Record<string, Prediction[]>,
  propTypeFilter: string,
  sortOption?: SortOption
): string[] {
```

### Step 2: Implement Confidence-Based Group Ordering

**Location:** Inside `getPropTypesInOrder` function, replace lines 311-319

**Current implementation:**
```typescript
const allPropTypes = PROP_TYPE_ORDER.filter(propType => 
  groupedPredictions[propType] && groupedPredictions[propType].length > 0
);

if (propTypeFilter !== 'all') {
  return allPropTypes.filter(propType => propType === propTypeFilter);
}

return allPropTypes;
```

**New implementation:**
```typescript
// Get all prop types that have predictions
const allPropTypes = Object.keys(groupedPredictions).filter(propType => 
  groupedPredictions[propType] && groupedPredictions[propType].length > 0
);

// Apply prop type filter if needed
const filteredPropTypes = propTypeFilter !== 'all'
  ? allPropTypes.filter(propType => propType === propTypeFilter)
  : allPropTypes;

// If sorting by prop-type, use PROP_TYPE_ORDER
if (sortOption === 'prop-type') {
  return PROP_TYPE_ORDER.filter(propType => filteredPropTypes.includes(propType));
}

// If sorting by confidence, order groups by confidence scores
if (sortOption === 'confidence-desc' || sortOption === 'confidence-asc') {
  return filteredPropTypes.sort((a, b) => {
    const groupA = groupedPredictions[a];
    const groupB = groupedPredictions[b];
    
    // Get the highest confidence in each group (for desc) or lowest (for asc)
    const getGroupConfidence = (group: Prediction[]) => {
      if (sortOption === 'confidence-desc') {
        return Math.max(...group.map(p => p.confidence_score));
      } else {
        return Math.min(...group.map(p => p.confidence_score));
      }
    };
    
    const confidenceA = getGroupConfidence(groupA);
    const confidenceB = getGroupConfidence(groupB);
    
    // Sort descending for confidence-desc, ascending for confidence-asc
    return sortOption === 'confidence-desc' 
      ? confidenceB - confidenceA 
      : confidenceA - confidenceB;
  });
}

// If sorting by value, order groups by highest value in each group
if (sortOption === 'value-desc' || sortOption === 'value-asc') {
  return filteredPropTypes.sort((a, b) => {
    const groupA = groupedPredictions[a];
    const groupB = groupedPredictions[b];
    
    // Get the highest value in each group
    const getGroupMaxValue = (group: Prediction[]) => {
      return Math.max(...group.map(p => 
        Math.max(p.predicted_value_over || 0, p.predicted_value_under || 0)
      ));
    };
    
    const valueA = getGroupMaxValue(groupA);
    const valueB = getGroupMaxValue(groupB);
    
    return sortOption === 'value-desc' 
      ? valueB - valueA 
      : valueA - valueB;
  });
}

// If sorting by odds, order groups by best odds in each group
if (sortOption === 'odds-desc' || sortOption === 'odds-asc') {
  return filteredPropTypes.sort((a, b) => {
    const groupA = groupedPredictions[a];
    const groupB = groupedPredictions[b];
    
    // Get the best odds in each group
    const getGroupBestOdds = (group: Prediction[]) => {
      return Math.max(...group.map(p => 
        Math.max(
          p.best_over_odds ?? Number.NEGATIVE_INFINITY,
          p.best_under_odds ?? Number.NEGATIVE_INFINITY
        )
      ));
    };
    
    const oddsA = getGroupBestOdds(groupA);
    const oddsB = getGroupBestOdds(groupB);
    
    // Handle null odds
    if (oddsA === Number.NEGATIVE_INFINITY && oddsB === Number.NEGATIVE_INFINITY) return 0;
    if (oddsA === Number.NEGATIVE_INFINITY) return 1;
    if (oddsB === Number.NEGATIVE_INFINITY) return -1;
    
    return sortOption === 'odds-desc' 
      ? oddsB - oddsA 
      : oddsA - oddsB;
  });
}

// If sorting by player name, maintain alphabetical order of prop types
if (sortOption === 'player-name') {
  return filteredPropTypes.sort((a, b) => a.localeCompare(b));
}

// Default: use PROP_TYPE_ORDER for any other sort option or no sort
return PROP_TYPE_ORDER.filter(propType => filteredPropTypes.includes(propType));
```

### Step 3: Update `propTypesInOrder` useMemo to Pass sortOption

**Location:** Lines 667-669 in `app/predictions.tsx`

**Current:**
```typescript
const propTypesInOrder = useMemo(() => {
  return getPropTypesInOrder(groupedPredictions, propTypeFilter);
}, [groupedPredictions, propTypeFilter]);
```

**Change to:**
```typescript
const propTypesInOrder = useMemo(() => {
  return getPropTypesInOrder(groupedPredictions, propTypeFilter, sortOption);
}, [groupedPredictions, propTypeFilter, sortOption]);
```

## Testing Checklist

After implementing the fix, verify the following:

1. **Confidence Descending Sort:**
   - Select "Confidence (High to Low)"
   - Verify that prop type groups are ordered by the highest confidence score in each group
   - Verify that predictions within each group are still sorted by confidence (highest first)

2. **Confidence Ascending Sort:**
   - Select "Confidence (Low to High)"
   - Verify that prop type groups are ordered by the lowest confidence score in each group
   - Verify that predictions within each group are still sorted by confidence (lowest first)

3. **Value Sort:**
   - Select "Value (High to Low)" or "Value (Low to High)"
   - Verify that prop type groups are ordered by the highest value in each group
   - Verify that predictions within each group maintain their value sort

4. **Odds Sort:**
   - Select "Market Odds (Best to Worst)" or "Market Odds (Worst to Best)"
   - Verify that prop type groups are ordered appropriately
   - Verify that predictions within each group maintain their odds sort

5. **Prop Type Sort:**
   - Select "Prop Type"
   - Verify that prop type groups are displayed in PROP_TYPE_ORDER (points, assists, rebounds, etc.)
   - This should remain unchanged from current behavior

6. **Player Name Sort:**
   - Select "Player Name"
   - Verify that prop type groups are in alphabetical order
   - Verify that predictions within each group are sorted by player name

7. **Filtering:**
   - Apply prop type filter (e.g., "Points only")
   - Verify that sorting still works correctly with the filter applied

## Additional Considerations

### Edge Cases to Handle

1. **Empty Groups:** The code already filters out empty groups, so this should be handled.

2. **Null Confidence Scores:** The `confidence_score` field is defined as `number` (not nullable) in the Prediction interface, so this shouldn't be an issue. However, if the API ever returns null/undefined, add a fallback:
   ```typescript
   const getGroupConfidence = (group: Prediction[]) => {
     const scores = group.map(p => p.confidence_score ?? 0);
     if (sortOption === 'confidence-desc') {
       return Math.max(...scores);
     } else {
       return Math.min(...scores);
     }
   };
   ```

3. **Single Prediction Groups:** When a group has only one prediction, the group ordering should still work correctly.

### Performance Considerations

The sorting of prop type groups happens in a useMemo, so it will only recalculate when `groupedPredictions`, `propTypeFilter`, or `sortOption` changes. This should be performant even with many predictions.

## Files to Modify

- `app/predictions.tsx`
  - Update `getPropTypesInOrder` function (lines 307-320)
  - Update `propTypesInOrder` useMemo (lines 667-669)

## Expected Outcome

After implementing this fix:
- When sorting by confidence, prop type groups will be ordered by the confidence scores within each group
- When sorting by value, prop type groups will be ordered by the highest value in each group
- When sorting by odds, prop type groups will be ordered by the best odds in each group
- When sorting by prop-type, the original PROP_TYPE_ORDER will be used
- Predictions within each group will maintain their sorted order
- The user experience will be consistent and intuitive

## Related Code References

- Sorting logic: Lines 564-659 (`sortedPredictions` useMemo)
- Grouping logic: Lines 662-664 (`groupedPredictions` useMemo)
- Display logic: Lines 1463-1888 (rendering of grouped predictions)
- Prop type order constant: Line 268 (`PROP_TYPE_ORDER`)

