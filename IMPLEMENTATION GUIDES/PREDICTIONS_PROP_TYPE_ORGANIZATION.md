# Predictions Prop Type Organization Implementation Guide

This guide provides step-by-step instructions for organizing predictions by prop type with appropriate section headings. Predictions will be grouped under their respective prop type headings (Points, Assists, Rebounds, Steals, Blocks, Three-Pointers) for better visual organization and easier navigation.

## Overview

**Current State:**
- Predictions are displayed in a flat list
- Prop type filter exists but doesn't visually organize predictions
- All predictions appear together regardless of prop type
- No visual separation between different prop types

**Target State:**
- Predictions grouped by prop type
- Section headings for each prop type (e.g., "Points", "Assists", "Rebounds")
- Predictions displayed under their respective prop type heading
- Maintain existing sorting and filtering functionality
- Empty prop type sections are hidden or show a message

---

## Phase 1: Understanding the Data Structure

### Step 1.1: Prop Type Values

The `prop_type` field in predictions can have the following values:
- `points` - Points scored
- `assists` - Assists
- `rebounds` - Rebounds
- `steals` - Steals
- `blocks` - Blocks
- `threes` - Three-pointers made

### Step 1.2: Current Prediction Structure

```typescript
interface Prediction {
  id: string;
  game_id: number;
  player_id: number;
  prop_type: string;  // "points", "assists", "rebounds", "steals", "blocks", "threes"
  line_value: number;
  // ... other fields ...
}
```

### Step 1.3: Prop Type Display Names

Create a mapping for user-friendly display names:

```typescript
const propTypeDisplayNames: Record<string, string> = {
  'points': 'Points',
  'assists': 'Assists',
  'rebounds': 'Rebounds',
  'steals': 'Steals',
  'blocks': 'Blocks',
  'threes': 'Three-Pointers',
};
```

---

## Phase 2: Frontend Implementation

### Step 2.1: Create Prop Type Display Name Helper

Add a helper function to get display names for prop types:

```typescript
/**
 * Get display name for prop type
 * @param propType - Raw prop type value (e.g., "points", "threes")
 * @returns User-friendly display name (e.g., "Points", "Three-Pointers")
 */
function getPropTypeDisplayName(propType: string): string {
  const displayNames: Record<string, string> = {
    'points': 'Points',
    'assists': 'Assists',
    'rebounds': 'Rebounds',
    'steals': 'Steals',
    'blocks': 'Blocks',
    'threes': 'Three-Pointers',
  };
  
  return displayNames[propType] || propType.charAt(0).toUpperCase() + propType.slice(1);
}
```

### Step 2.2: Group Predictions by Prop Type

Create a function to group predictions by prop type:

```typescript
/**
 * Group predictions by prop type
 * @param predictions - Array of predictions
 * @returns Object with prop types as keys and arrays of predictions as values
 */
function groupPredictionsByPropType(predictions: Prediction[]): Record<string, Prediction[]> {
  const grouped: Record<string, Prediction[]> = {};
  
  predictions.forEach((pred) => {
    const propType = pred.prop_type;
    if (!grouped[propType]) {
      grouped[propType] = [];
    }
    grouped[propType].push(pred);
  });
  
  return grouped;
}
```

### Step 2.3: Define Prop Type Display Order

Define the order in which prop types should be displayed:

```typescript
/**
 * Get ordered list of prop types for display
 * This determines the order sections appear on the page
 */
const PROP_TYPE_ORDER = ['points', 'assists', 'rebounds', 'steals', 'blocks', 'threes'];

/**
 * Get prop types in display order
 * @param groupedPredictions - Grouped predictions object
 * @returns Array of prop types in display order that have predictions
 */
function getPropTypesInOrder(groupedPredictions: Record<string, Prediction[]>): string[] {
  return PROP_TYPE_ORDER.filter(propType => 
    groupedPredictions[propType] && groupedPredictions[propType].length > 0
  );
}
```

### Step 2.4: Update sortedPredictions Logic

Modify the existing `sortedPredictions` useMemo to work with grouped predictions. The grouping should happen after sorting if you want to maintain sort order within each group:

```typescript
// In the component, after existing sortedPredictions useMemo:

// Group sorted predictions by prop type
const groupedPredictions = useMemo(() => {
  return groupPredictionsByPropType(sortedPredictions);
}, [sortedPredictions]);

// Get prop types in display order
const propTypesInOrder = useMemo(() => {
  return getPropTypesInOrder(groupedPredictions);
}, [groupedPredictions]);
```

### Step 2.5: Update Render Logic

Replace the existing flat list rendering with grouped rendering:

**Current Code (around line 1245-1423):**
```typescript
{!loading && sortedPredictions.length > 0 && (
  <YStack space="$3">
    <Text fontSize="$6" fontWeight="600" color="$color">
      {sortedPredictions.length} Prediction{sortedPredictions.length !== 1 ? 's' : ''}
    </Text>

    {sortedPredictions.map((pred) => {
      // ... prediction card rendering ...
    })}
  </YStack>
)}
```

**New Code:**
```typescript
{!loading && sortedPredictions.length > 0 && (
  <YStack space="$4">
    <Text fontSize="$6" fontWeight="600" color="$color">
      {sortedPredictions.length} Prediction{sortedPredictions.length !== 1 ? 's' : ''}
    </Text>

    {propTypesInOrder.map((propType) => {
      const predictionsForType = groupedPredictions[propType];
      const displayName = getPropTypeDisplayName(propType);
      
      return (
        <YStack key={propType} space="$3">
          {/* Prop Type Heading */}
          <Card padding="$3" backgroundColor="$backgroundStrong">
            <XStack justifyContent="space-between" alignItems="center">
              <Text fontSize="$6" fontWeight="bold" color="$color">
                {displayName}
              </Text>
              <Text fontSize="$4" color="$color10">
                {predictionsForType.length} prediction{predictionsForType.length !== 1 ? 's' : ''}
              </Text>
            </XStack>
          </Card>

          {/* Predictions for this prop type */}
          <YStack space="$3">
            {predictionsForType.map((pred) => {
              const bestValue = Math.max(
                pred.predicted_value_over || 0,
                pred.predicted_value_under || 0
              );
              const isValueBet = bestValue >= parseFloat(minValue);
              const valueSide = (pred.predicted_value_over || 0) > (pred.predicted_value_under || 0) ? 'over' : 'under';
              const playerName = `${pred.player_first_name} ${pred.player_last_name}`;

              return (
                <Card
                  key={pred.id}
                  padding="$4"
                  backgroundColor={isValueBet ? "$green2" : "$backgroundStrong"}
                  borderWidth={isValueBet ? 2 : 1}
                  borderColor={isValueBet ? "$green9" : "$borderColor"}
                >
                  {/* ... existing prediction card content ... */}
                </Card>
              );
            })}
          </YStack>
        </YStack>
      );
    })}
  </YStack>
)}
```

---

## Phase 3: Handling Edge Cases

### Step 3.1: Empty Prop Type Sections

If a prop type has no predictions (after filtering), it won't appear in `propTypesInOrder` because of the filter in `getPropTypesInOrder`. This is the desired behavior.

### Step 3.2: Unknown Prop Types

Handle cases where a prediction has an unknown prop type:

```typescript
function getPropTypeDisplayName(propType: string): string {
  const displayNames: Record<string, string> = {
    'points': 'Points',
    'assists': 'Assists',
    'rebounds': 'Rebounds',
    'steals': 'Steals',
    'blocks': 'Blocks',
    'threes': 'Three-Pointers',
  };
  
  // Fallback: capitalize first letter and use as-is
  return displayNames[propType] || 
         (propType.charAt(0).toUpperCase() + propType.slice(1));
}
```

### Step 3.3: Prop Type Filter Interaction

When the prop type filter is active (not "all"), only that prop type section should appear:

```typescript
// Update getPropTypesInOrder to respect filter
function getPropTypesInOrder(
  groupedPredictions: Record<string, Prediction[]>,
  propTypeFilter: string
): string[] {
  const allPropTypes = PROP_TYPE_ORDER.filter(propType => 
    groupedPredictions[propType] && groupedPredictions[propType].length > 0
  );
  
  // If filter is set to a specific prop type, only show that one
  if (propTypeFilter !== 'all') {
    return allPropTypes.filter(propType => propType === propTypeFilter);
  }
  
  return allPropTypes;
}
```

Update the useMemo:
```typescript
const propTypesInOrder = useMemo(() => {
  return getPropTypesInOrder(groupedPredictions, propTypeFilter);
}, [groupedPredictions, propTypeFilter]);
```

---

## Phase 4: UI/UX Enhancements

### Step 4.1: Prop Type Heading Styling

Make prop type headings visually distinct:

```typescript
<Card padding="$3" backgroundColor="$backgroundStrong" borderWidth={1} borderColor="$borderColor">
  <XStack justifyContent="space-between" alignItems="center">
    <XStack alignItems="center" space="$2">
      <Text fontSize="$6" fontWeight="bold" color="$color">
        {displayName}
      </Text>
      {/* Optional: Add icon or visual indicator */}
    </XStack>
    <Card padding="$2" backgroundColor="$blue2" borderRadius="$2">
      <Text fontSize="$4" fontWeight="600" color="$color">
        {predictionsForType.length}
      </Text>
    </Card>
  </XStack>
</Card>
```

### Step 4.2: Spacing Between Sections

Ensure adequate spacing between prop type sections:

```typescript
<YStack space="$4">  {/* Increased from $3 for better separation */}
  {propTypesInOrder.map((propType) => {
    // ... section content ...
  })}
</YStack>
```

### Step 4.3: Collapsible Sections (Optional)

For future enhancement, consider making sections collapsible:

```typescript
const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

// In the render:
<Pressable
  onPress={() => {
    const newCollapsed = new Set(collapsedSections);
    if (newCollapsed.has(propType)) {
      newCollapsed.delete(propType);
    } else {
      newCollapsed.add(propType);
    }
    setCollapsedSections(newCollapsed);
  }}
>
  <Card padding="$3" backgroundColor="$backgroundStrong">
    <XStack justifyContent="space-between" alignItems="center">
      <Text fontSize="$6" fontWeight="bold" color="$color">
        {displayName}
      </Text>
      <Text>{collapsedSections.has(propType) ? '▼' : '▲'}</Text>
    </XStack>
  </Card>
</Pressable>

{!collapsedSections.has(propType) && (
  <YStack space="$3">
    {/* Predictions for this prop type */}
  </YStack>
)}
```

---

## Phase 5: Maintaining Sort Order

### Step 5.1: Sort Within Groups

The existing `sortedPredictions` useMemo already sorts all predictions. When grouping, the sort order is preserved within each group because we're grouping already-sorted predictions.

### Step 5.2: Sort Groups Themselves

If you want to sort prop type sections by a different criteria (e.g., by number of predictions), modify `getPropTypesInOrder`:

```typescript
function getPropTypesInOrder(
  groupedPredictions: Record<string, Prediction[]>,
  propTypeFilter: string,
  sortBy: 'default' | 'count' = 'default'
): string[] {
  let propTypes = PROP_TYPE_ORDER.filter(propType => 
    groupedPredictions[propType] && groupedPredictions[propType].length > 0
  );
  
  if (propTypeFilter !== 'all') {
    propTypes = propTypes.filter(propType => propType === propTypeFilter);
  }
  
  if (sortBy === 'count') {
    propTypes.sort((a, b) => {
      const countA = groupedPredictions[a].length;
      const countB = groupedPredictions[b].length;
      return countB - countA; // Descending order
    });
  }
  
  return propTypes;
}
```

---

## Phase 6: Implementation Checklist

### Step 6.1: Core Functionality

- [ ] Add `getPropTypeDisplayName()` helper function
- [ ] Add `groupPredictionsByPropType()` helper function
- [ ] Add `PROP_TYPE_ORDER` constant
- [ ] Add `getPropTypesInOrder()` helper function
- [ ] Create `groupedPredictions` useMemo
- [ ] Create `propTypesInOrder` useMemo
- [ ] Update render logic to use grouped predictions
- [ ] Add prop type section headings
- [ ] Display prediction count per section

### Step 6.2: Filter Integration

- [ ] Update `getPropTypesInOrder()` to respect `propTypeFilter`
- [ ] Test with "All Props" filter
- [ ] Test with specific prop type filter
- [ ] Verify only filtered prop type appears

### Step 6.3: Sort Integration

- [ ] Verify existing sort order is maintained within groups
- [ ] Test all sort options (value, confidence, prop-type, player-name)
- [ ] Verify predictions appear in correct order within each section

### Step 6.4: Edge Cases

- [ ] Handle empty prop type sections (should not appear)
- [ ] Handle unknown prop types (fallback display name)
- [ ] Handle case when all predictions are filtered out
- [ ] Handle case when only one prop type has predictions

### Step 6.5: UI/UX

- [ ] Verify prop type headings are visually distinct
- [ ] Verify adequate spacing between sections
- [ ] Verify prediction count displays correctly
- [ ] Test on mobile and web
- [ ] Verify responsive layout

---

## Phase 7: Code Location Reference

### Files to Modify

1. **`app/predictions.tsx`**
   - Add helper functions (after existing helper functions, around line 250)
   - Add `PROP_TYPE_ORDER` constant (near top of component or in constants section)
   - Add `groupedPredictions` and `propTypesInOrder` useMemo (after `sortedPredictions` useMemo, around line 504)
   - Update render section (replace lines 1245-1423)

### Key Code Sections

**Helper Functions Location:** After line 250 (after existing helper functions)

**useMemo Location:** After line 504 (after `sortedPredictions` useMemo)

**Render Location:** Replace lines 1245-1423 (predictions list rendering)

---

## Phase 8: Testing

### Step 8.1: Functional Testing

1. **Test with multiple prop types:**
   - Verify each prop type appears as a separate section
   - Verify predictions are grouped correctly
   - Verify section headings display correct names

2. **Test with prop type filter:**
   - Select "Points" filter → only Points section should appear
   - Select "All Props" → all prop types with predictions should appear
   - Verify filter works correctly with grouping

3. **Test with sorting:**
   - Sort by value → verify predictions within each section are sorted
   - Sort by prop-type → verify sections still appear in order
   - Sort by player-name → verify alphabetical order within sections

4. **Test with empty sections:**
   - Filter to show only one prop type → verify other sections don't appear
   - Verify no empty sections are displayed

### Step 8.2: Edge Case Testing

1. **Test with no predictions:**
   - Verify appropriate empty state message
   - Verify no prop type sections appear

2. **Test with single prop type:**
   - When only one prop type has predictions → verify single section appears
   - Verify heading and count display correctly

3. **Test with unknown prop type:**
   - If a prediction has an unknown prop type → verify fallback display name
   - Verify section still appears and functions correctly

### Step 8.3: UI Testing

1. **Visual verification:**
   - Prop type headings are clearly visible
   - Adequate spacing between sections
   - Prediction count displays correctly
   - Value bet highlighting still works

2. **Responsive testing:**
   - Test on mobile device
   - Test on tablet
   - Test on desktop
   - Verify horizontal scrolling works if needed

---

## Phase 9: Example Implementation

### Complete Helper Functions

```typescript
// Prop type display order
const PROP_TYPE_ORDER = ['points', 'assists', 'rebounds', 'steals', 'blocks', 'threes'];

/**
 * Get display name for prop type
 */
function getPropTypeDisplayName(propType: string): string {
  const displayNames: Record<string, string> = {
    'points': 'Points',
    'assists': 'Assists',
    'rebounds': 'Rebounds',
    'steals': 'Steals',
    'blocks': 'Blocks',
    'threes': 'Three-Pointers',
  };
  
  return displayNames[propType] || 
         (propType.charAt(0).toUpperCase() + propType.slice(1));
}

/**
 * Group predictions by prop type
 */
function groupPredictionsByPropType(predictions: Prediction[]): Record<string, Prediction[]> {
  const grouped: Record<string, Prediction[]> = {};
  
  predictions.forEach((pred) => {
    const propType = pred.prop_type;
    if (!grouped[propType]) {
      grouped[propType] = [];
    }
    grouped[propType].push(pred);
  });
  
  return grouped;
}

/**
 * Get prop types in display order
 */
function getPropTypesInOrder(
  groupedPredictions: Record<string, Prediction[]>,
  propTypeFilter: string
): string[] {
  const allPropTypes = PROP_TYPE_ORDER.filter(propType => 
    groupedPredictions[propType] && groupedPredictions[propType].length > 0
  );
  
  if (propTypeFilter !== 'all') {
    return allPropTypes.filter(propType => propType === propTypeFilter);
  }
  
  return allPropTypes;
}
```

### Complete useMemo Implementation

```typescript
// Group sorted predictions by prop type
const groupedPredictions = useMemo(() => {
  return groupPredictionsByPropType(sortedPredictions);
}, [sortedPredictions]);

// Get prop types in display order
const propTypesInOrder = useMemo(() => {
  return getPropTypesInOrder(groupedPredictions, propTypeFilter);
}, [groupedPredictions, propTypeFilter]);
```

### Complete Render Section

```typescript
{!loading && sortedPredictions.length > 0 && (
  <YStack space="$4">
    <Text fontSize="$6" fontWeight="600" color="$color">
      {sortedPredictions.length} Prediction{sortedPredictions.length !== 1 ? 's' : ''}
    </Text>

    {propTypesInOrder.map((propType) => {
      const predictionsForType = groupedPredictions[propType];
      const displayName = getPropTypeDisplayName(propType);
      
      return (
        <YStack key={propType} space="$3">
          {/* Prop Type Heading */}
          <Card padding="$3" backgroundColor="$backgroundStrong" borderWidth={1} borderColor="$borderColor">
            <XStack justifyContent="space-between" alignItems="center">
              <Text fontSize="$6" fontWeight="bold" color="$color">
                {displayName}
              </Text>
              <Card padding="$2" backgroundColor="$blue2" borderRadius="$2">
                <Text fontSize="$4" fontWeight="600" color="$color">
                  {predictionsForType.length}
                </Text>
              </Card>
            </XStack>
          </Card>

          {/* Predictions for this prop type */}
          <YStack space="$3">
            {predictionsForType.map((pred) => {
              // ... existing prediction card rendering code ...
            })}
          </YStack>
        </YStack>
      );
    })}
  </YStack>
)}
```

---

## Phase 10: Future Enhancements (Optional)

### Step 10.1: Collapsible Sections

Add ability to collapse/expand prop type sections to reduce scrolling.

### Step 10.2: Section Statistics

Display aggregate statistics for each prop type section (e.g., average value, total value bets).

### Step 10.3: Quick Navigation

Add a sticky navigation bar that allows jumping to specific prop type sections.

### Step 10.4: Section Icons

Add icons for each prop type to make sections more visually distinct.

---

## Notes

- This implementation maintains all existing functionality (filtering, sorting, value bet highlighting)
- Grouping happens after sorting, so sort order is preserved within each group
- Empty prop type sections are automatically hidden
- The implementation is backward compatible - if grouping fails, predictions will still display
- Prop type filter works seamlessly with grouping - only filtered sections appear
- All existing prediction card styling and functionality is preserved

---

## Summary

This implementation adds visual organization to predictions by:

1. **Grouping** predictions by their `prop_type` field
2. **Displaying** section headings for each prop type with user-friendly names
3. **Showing** prediction counts per section
4. **Maintaining** existing sort and filter functionality
5. **Hiding** empty sections automatically
6. **Preserving** all existing prediction card functionality

The result is a more organized and navigable predictions view that makes it easier for users to find predictions for specific prop types.

