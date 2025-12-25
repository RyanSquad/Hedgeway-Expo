# Predictions Page Header Order Fix

## Problem Description

When a sort filter is applied on the predictions page, the prop type headers (Points, Assists, Rebounds, etc.) are being reordered based on the sort criteria. This causes the headers to jump around when different sort options are selected, making it difficult for users to find specific prop types.

**Expected Behavior:**
- Prop type headers should always maintain a consistent order (Points, Assists, Rebounds, Steals, Blocks, Three-Pointers)
- Sorting should only affect the order of predictions **within** each prop type group
- Headers should remain in the same position regardless of sort option

**Current Behavior:**
- Headers are reordered when sorting by value, confidence, odds, or player name
- This creates a disorienting user experience

---

## Root Cause

The issue is in the `getPropTypesInOrder` function (lines 307-442 in `app/predictions.tsx`). This function currently reorders the prop type groups based on the sort option:

- **Value sorting** (lines 384-402): Orders groups by highest value in each group
- **Confidence sorting** (lines 328-380): Orders groups by confidence scores
- **Odds sorting** (lines 406-432): Orders groups by best odds in each group
- **Player name sorting** (lines 436-437): Orders groups alphabetically

The sorting logic should only apply to predictions **within** each group, not to the groups themselves.

---

## Solution

Modify the `getPropTypesInOrder` function to **always** return prop types in the `PROP_TYPE_ORDER` regardless of the sort option. The sort option should only affect the order of predictions within each prop type group, which is already handled by the `sortedPredictions` useMemo.

---

## Implementation Steps

### Step 1: Simplify `getPropTypesInOrder` Function

**Location:** `app/predictions.tsx`, lines 307-442

**Current Code:**
```typescript
function getPropTypesInOrder(
  groupedPredictions: Record<string, Prediction[]>,
  propTypeFilter: string,
  sortOption?: SortOption
): string[] {
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
    // ... 50+ lines of sorting logic ...
    return sorted;
  }

  // If sorting by value, order groups by highest value in each group
  if (sortOption === 'value-desc' || sortOption === 'value-asc') {
    // ... sorting logic ...
    return filteredPropTypes.sort(...);
  }

  // If sorting by odds, order groups by best odds in each group
  if (sortOption === 'odds-desc' || sortOption === 'odds-asc') {
    // ... sorting logic ...
    return filteredPropTypes.sort(...);
  }

  // If sorting by player name, maintain alphabetical order of prop types
  if (sortOption === 'player-name') {
    return filteredPropTypes.sort((a, b) => a.localeCompare(b));
  }

  // Default: use PROP_TYPE_ORDER for any other sort option or no sort
  return PROP_TYPE_ORDER.filter(propType => filteredPropTypes.includes(propType));
}
```

**Updated Code:**
```typescript
function getPropTypesInOrder(
  groupedPredictions: Record<string, Prediction[]>,
  propTypeFilter: string,
  sortOption?: SortOption
): string[] {
  // Get all prop types that have predictions
  const allPropTypes = Object.keys(groupedPredictions).filter(propType => 
    groupedPredictions[propType] && groupedPredictions[propType].length > 0
  );

  // Apply prop type filter if needed
  const filteredPropTypes = propTypeFilter !== 'all'
    ? allPropTypes.filter(propType => propType === propTypeFilter)
    : allPropTypes;

  // Always use PROP_TYPE_ORDER to maintain consistent header order
  // The sortOption only affects the order of predictions within each group,
  // not the order of the groups themselves
  return PROP_TYPE_ORDER.filter(propType => filteredPropTypes.includes(propType));
}
```

**Explanation:**
- Removed all sorting logic that reordered prop type groups
- Always return prop types in `PROP_TYPE_ORDER` regardless of sort option
- The `sortOption` parameter can be kept for potential future use, but it's no longer used in this function
- The actual sorting of predictions within each group is already handled by the `sortedPredictions` useMemo (lines 686-801)

---

## Verification Steps

After implementing the fix, verify the following:

1. **Default View (No Sort):**
   - Headers should appear in order: Points, Assists, Rebounds, Steals, Blocks, Three-Pointers

2. **Value Sorting (High to Low / Low to High):**
   - Headers should remain in the same order
   - Only predictions within each group should be reordered

3. **Confidence Sorting (High to Low / Low to High):**
   - Headers should remain in the same order
   - Only predictions within each group should be reordered

4. **Odds Sorting (Best to Worst / Worst to Best):**
   - Headers should remain in the same order
   - Only predictions within each group should be reordered

5. **Player Name Sorting:**
   - Headers should remain in the same order
   - Only predictions within each group should be reordered alphabetically

6. **Prop Type Filtering:**
   - When filtering to a single prop type, only that header should appear
   - When filtering to "All Props", all headers should appear in order

7. **Prop Type Sort Option:**
   - When "Prop Type" is selected as the sort option, headers should still maintain `PROP_TYPE_ORDER`
   - Predictions within each group should be sorted by prop type (though they're already grouped)

---

## Code Changes Summary

**File:** `app/predictions.tsx`

**Function Modified:** `getPropTypesInOrder` (lines 307-442)

**Lines Removed:** ~135 lines of sorting logic

**Lines Added:** ~5 lines (simplified return statement)

**Net Change:** ~130 lines removed, significantly simplifying the function

---

## Testing Checklist

- [ ] Headers maintain consistent order when switching between sort options
- [ ] Predictions within each group are correctly sorted based on selected sort option
- [ ] Prop type filtering still works correctly
- [ ] All sort options (value, confidence, odds, player name, prop type) work as expected
- [ ] No console errors or warnings
- [ ] UI remains responsive and performant

---

## Additional Notes

1. **Performance:** This change actually improves performance by removing unnecessary sorting operations on the prop type groups.

2. **User Experience:** Users will have a much better experience with consistent header positioning, making it easier to find specific prop types.

3. **Future Enhancements:** If there's a need to sort prop type groups in the future, consider adding a separate "Group Sort" option rather than mixing it with prediction sorting.

4. **Backward Compatibility:** This change is fully backward compatible - it only affects the display order of headers, not the functionality of sorting predictions.

---

## Related Code References

- **Prop Type Order Constant:** Line 268 - `PROP_TYPE_ORDER`
- **Grouped Predictions:** Lines 803-806 - `groupedPredictions` useMemo
- **Prop Types in Order:** Lines 809-811 - `propTypesInOrder` useMemo
- **Prediction Sorting:** Lines 686-801 - `sortedPredictions` useMemo (this already handles sorting within groups correctly)

---

## Implementation Date

[To be filled in when implemented]

## Implemented By

[To be filled in when implemented]

