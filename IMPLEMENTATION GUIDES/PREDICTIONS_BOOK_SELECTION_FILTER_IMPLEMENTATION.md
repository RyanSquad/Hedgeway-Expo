# Predictions Book Selection Filter Implementation Guide

This guide provides step-by-step instructions for adding a book selection filter to the predictions view. Users will be able to select one or more sportsbooks (books) to filter predictions, showing only predictions where either the over or under odds are offered by the selected book(s).

## Overview

**Current State:**
- Predictions page displays all predictions with vendor information (`over_vendor`, `under_vendor`)
- No ability to filter predictions by sportsbook/vendor
- Vendors are displayed in prediction cards but cannot be used for filtering
- Existing filters include: prop type, min value, sort options, value bets only toggle

**Target State:**
- Add a book selection filter UI component
- Allow users to select one or more books from available options
- Filter predictions to show only those where `over_vendor` OR `under_vendor` matches at least one selected book
- When no books are selected, show all predictions (no filtering)
- Maintain existing UI look and feel for all other components
- Integrate seamlessly with existing filters (prop type, min value, sorting, value bets toggle)

---

## Phase 1: Understanding Data Structures

### Step 1.1: Prediction Vendor Fields

Each prediction has two vendor fields that indicate which sportsbook offers the best odds:

```typescript
interface Prediction {
  // ... other fields ...
  best_over_odds: number | null;
  best_under_odds: number | null;
  over_vendor: string | null;      // Sportsbook offering best over odds
  under_vendor: string | null;     // Sportsbook offering best under odds
  // ... other fields ...
}
```

**Key Points:**
- `over_vendor`: The sportsbook (book) offering the best over odds (e.g., "fanduel", "draftkings")
- `under_vendor`: The sportsbook offering the best under odds (may be different from over_vendor)
- Both fields are nullable (may be `null` if no odds are available)
- Vendor names are lowercase strings matching book identifiers

### Step 1.2: Available Books

The available books are defined in the codebase. Reference the `AVAILABLE_BOOKS` constant from `app/admin.tsx`:

```typescript
const AVAILABLE_BOOKS = [
  'betmgm',
  'bet365',
  'ballybet',
  'betparx',
  'betrivers',
  'caesars',
  'draftkings',
  'fanduel',
  'rebet',
];
```

**Note:** You should use the same book list in the predictions filter to maintain consistency across the application.

### Step 1.3: Filtering Logic

The book filter should work as follows:

1. **When no books are selected**: Show all predictions (no filtering by vendor)
2. **When one or more books are selected**: Show only predictions where:
   - `over_vendor` matches at least one selected book, OR
   - `under_vendor` matches at least one selected book
3. **Filtering should be case-insensitive** (though vendor names are stored in lowercase)
4. **Filter should handle null values**: If both `over_vendor` and `under_vendor` are `null`, the prediction should be excluded when books are selected

**Pseudocode:**
```typescript
const filteredPredictions = selectedBooks.length === 0
  ? allPredictions  // No filtering when no books selected
  : allPredictions.filter(pred => {
      const overMatch = pred.over_vendor && selectedBooks.includes(pred.over_vendor.toLowerCase());
      const underMatch = pred.under_vendor && selectedBooks.includes(pred.under_vendor.toLowerCase());
      return overMatch || underMatch;  // Show if either vendor matches
    });
```

---

## Phase 2: Frontend Implementation

### Step 2.1: Add Book List Constant

Add the available books constant near the top of `app/predictions.tsx` (after imports, before the component):

```typescript
// Available books for filtering (should match admin.tsx)
const AVAILABLE_BOOKS = [
  'betmgm',
  'bet365',
  'ballybet',
  'betparx',
  'betrivers',
  'caesars',
  'draftkings',
  'fanduel',
  'rebet',
];

// Display names for books (human-readable)
const BOOK_DISPLAY_NAMES: Record<string, string> = {
  'betmgm': 'BetMGM',
  'bet365': 'Bet365',
  'ballybet': 'Bally Bet',
  'betparx': 'BetParx',
  'betrivers': 'BetRivers',
  'caesars': 'Caesars',
  'draftkings': 'DraftKings',
  'fanduel': 'FanDuel',
  'rebet': 'Rebet',
};
```

### Step 2.2: Add State Management

Add state variables to track selected books in the `PredictionsPage` component:

```typescript
export default function PredictionsPage() {
  // ... existing state ...
  const [selectedBooks, setSelectedBooks] = useState<string[]>([]);
  // ... rest of component ...
}
```

**Note:** 
- `selectedBooks` is an array of book identifiers (strings)
- Empty array means no filtering (show all predictions)
- Multiple books can be selected simultaneously

### Step 2.3: Add Book Filtering Logic

Add a `useMemo` hook to filter predictions based on selected books. This should be applied after other filters (prop type, min value, etc.) but before sorting:

```typescript
// Filter predictions by selected books
const bookFilteredPredictions = useMemo(() => {
  // If no books selected, return all predictions
  if (selectedBooks.length === 0) {
    return predictions;
  }

  // Filter predictions where either over_vendor or under_vendor matches selected books
  return predictions.filter(pred => {
    const overMatch = pred.over_vendor 
      ? selectedBooks.includes(pred.over_vendor.toLowerCase())
      : false;
    const underMatch = pred.under_vendor
      ? selectedBooks.includes(pred.under_vendor.toLowerCase())
      : false;
    
    return overMatch || underMatch;
  });
}, [predictions, selectedBooks]);
```

**Update the sorted predictions useMemo** to use `bookFilteredPredictions` instead of `predictions`:

```typescript
// Sort predictions based on selected option
const sortedPredictions = useMemo(() => {
  const sorted = [...bookFilteredPredictions];  // Use bookFilteredPredictions instead of predictions
  // ... rest of sorting logic remains the same ...
}, [bookFilteredPredictions, sortOption]);  // Update dependency array
```

### Step 2.4: Add Book Toggle Function

Add a helper function to toggle book selection (similar to how admin panel handles book selection):

```typescript
const toggleBook = useCallback((book: string) => {
  setSelectedBooks((prev) => {
    if (prev.includes(book)) {
      // Remove book if already selected
      return prev.filter((b) => b !== book);
    } else {
      // Add book if not selected
      return [...prev, book];
    }
  });
}, []);
```

### Step 2.5: Create Book Filter UI Component

Add the book selection filter UI in the filters section. Place it alongside the existing filters (prop type, min value, sort by). The UI should match the existing filter style.

**Option 1: Multi-select Dropdown (Recommended)**

Add a dropdown similar to the existing prop type and min value dropdowns:

```typescript
// In the filters section (around line 1151-1328), add:

<YStack flex={1} minWidth={150} position="relative" zIndex={openDropdown === 'books' ? 100 : 1}>
  <Label htmlFor="books">Sportsbooks</Label>
  <Button
    data-dropdown
    width="100%"
    justifyContent="space-between"
    backgroundColor="$background"
    borderWidth={1}
    borderColor="$borderColor"
    onPress={() => setOpenDropdown(openDropdown === 'books' ? null : 'books')}
  >
    <Text color="$color">
      {selectedBooks.length === 0 
        ? 'All Books' 
        : selectedBooks.length === 1
          ? BOOK_DISPLAY_NAMES[selectedBooks[0]] || selectedBooks[0]
          : `${selectedBooks.length} Selected`}
    </Text>
    <Text color="$color">▼</Text>
  </Button>
  {openDropdown === 'books' && (
    <Card
      data-dropdown
      position="absolute"
      top="100%"
      left={0}
      right={0}
      marginTop="$1"
      padding="$2"
      backgroundColor="$backgroundStrong"
      borderWidth={1}
      borderColor="$borderColor"
      zIndex={100}
      elevation={4}
      maxHeight={300}
    >
      <ScrollView>
        <YStack space="$1">
          {/* "Clear All" / "Select All" option */}
          <Pressable
            onPress={() => {
              setSelectedBooks([]);
              setOpenDropdown(null);
            }}
          >
            <YStack
              padding="$2"
              backgroundColor={selectedBooks.length === 0 ? "$blue3" : "transparent"}
              borderRadius="$2"
              hoverStyle={{ backgroundColor: "$blue2" }}
            >
              <Text color="$color">All Books</Text>
            </YStack>
          </Pressable>
          <Separator />
          
          {/* Individual book options */}
          {AVAILABLE_BOOKS.map((book) => (
            <Pressable
              key={book}
              onPress={() => toggleBook(book)}
            >
              <YStack
                padding="$2"
                backgroundColor={selectedBooks.includes(book) ? "$blue3" : "transparent"}
                borderRadius="$2"
                hoverStyle={{ backgroundColor: "$blue2" }}
              >
                <XStack alignItems="center" space="$2">
                  <Text color="$color">
                    {selectedBooks.includes(book) ? '✓' : ' '}
                  </Text>
                  <Text color="$color">{BOOK_DISPLAY_NAMES[book] || book}</Text>
                </XStack>
              </YStack>
            </Pressable>
          ))}
        </YStack>
      </ScrollView>
    </Card>
  )}
</YStack>
```

**Option 2: Checkbox List (Alternative)**

If you prefer checkboxes similar to the admin panel, you can use a checkbox-based UI:

```typescript
// In the filters section, add:

<YStack space="$2">
  <Label fontSize="$4" color="$colorPress">Sportsbooks</Label>
  <Card padding="$3" backgroundColor="$backgroundStrong" maxHeight={200}>
    <ScrollView>
      <YStack space="$2">
        {AVAILABLE_BOOKS.map((book) => (
          <XStack key={book} alignItems="center" space="$2">
            <Switch
              checked={selectedBooks.includes(book)}
              onCheckedChange={() => toggleBook(book)}
              size="$3"
            />
            <Text color="$color" onPress={() => toggleBook(book)}>
              {BOOK_DISPLAY_NAMES[book] || book}
            </Text>
          </XStack>
        ))}
      </YStack>
    </ScrollView>
  </Card>
</YStack>
```

**Recommendation:** Use Option 1 (dropdown) to maintain consistency with existing filter UI (prop type, min value, sort by).

### Step 2.6: Update openDropdown State

The `openDropdown` state already exists in the component. You just need to ensure it handles the 'books' value. No changes needed if the existing implementation uses string values.

Verify the dropdown closing logic works for the books dropdown:

```typescript
// Existing code should already handle this, but verify:
const [openDropdown, setOpenDropdown] = useState<string | null>(null);
```

### Step 2.7: Update Filter Dependencies

Update the `fetchPredictions` dependency array if needed. The book filtering happens client-side, so `fetchPredictions` doesn't need to be updated. However, ensure that when predictions are fetched, they include the vendor fields.

**Note:** Book filtering is purely client-side. No backend changes are required.

---

## Phase 3: Integration with Existing Filters

### Step 3.1: Filter Order

Ensure filters are applied in the correct order:

1. **Fetch predictions** (from API)
2. **Apply book filter** (client-side, based on selectedBooks)
3. **Apply prop type filter** (if needed, though this may already be in API call)
4. **Apply min value / value bets filter** (client-side)
5. **Sort predictions** (client-side)

The book filter should be applied early in the pipeline, after fetching but before sorting.

### Step 3.2: Update useMemo Dependencies

Ensure all useMemo hooks have correct dependencies:

```typescript
// Book filtering depends on predictions and selectedBooks
const bookFilteredPredictions = useMemo(() => {
  // ... filtering logic ...
}, [predictions, selectedBooks]);

// Sorting depends on bookFilteredPredictions (not predictions)
const sortedPredictions = useMemo(() => {
  // ... sorting logic using bookFilteredPredictions ...
}, [bookFilteredPredictions, sortOption]);

// Grouping depends on sortedPredictions
const groupedPredictions = useMemo(() => {
  return groupPredictionsByPropType(sortedPredictions);
}, [sortedPredictions]);
```

### Step 3.3: Clear Selection on Refresh

Consider whether book selection should persist across refreshes or be cleared. For consistency with other filters, you may want to preserve the selection (which React state will do automatically).

If you want to clear selection on refresh, add to the refresh handler:

```typescript
const onRefresh = useCallback(() => {
  setRefreshing(true);
  fetchUpcomingGames();
  fetchPredictions();
  // Optional: Uncomment to clear book selection on refresh
  // setSelectedBooks([]);
}, [fetchUpcomingGames, fetchPredictions]);
```

**Recommendation:** Keep book selection persistent (don't clear on refresh) for better UX.

---

## Phase 4: UI/UX Considerations

### Step 4.1: Visual Feedback

- Show count of selected books in dropdown button (e.g., "3 Selected" or individual book name if only one)
- Highlight selected books in dropdown list
- Consider adding a visual indicator in the filter section showing active filters

### Step 4.2: Empty States

- When book filter results in no predictions, show appropriate empty state message
- Consider showing message like "No predictions found for selected sportsbooks. Try selecting different books or clearing the filter."

### Step 4.3: Mobile Responsiveness

- Ensure dropdown works well on mobile devices
- Consider touch-friendly sizing for book selection items
- Test dropdown scrolling on small screens

### Step 4.4: Accessibility

- Ensure dropdown is keyboard accessible
- Use proper labels for screen readers
- Maintain focus management when opening/closing dropdown

---

## Phase 5: Testing Checklist

### Step 5.1: Functional Testing

- [ ] Book dropdown opens and closes correctly
- [ ] Books can be selected and deselected
- [ ] Multiple books can be selected simultaneously
- [ ] "All Books" option clears selection
- [ ] Predictions filter correctly when books are selected
- [ ] Predictions show when either over_vendor OR under_vendor matches selected books
- [ ] No filtering occurs when no books are selected (shows all predictions)
- [ ] Filter works correctly with null vendor values
- [ ] Book filter works in combination with other filters (prop type, min value, value bets toggle)
- [ ] Sorting still works correctly with book filter applied
- [ ] Book selection persists across re-renders (doesn't reset unexpectedly)

### Step 5.2: Edge Cases

- [ ] Handle predictions where both over_vendor and under_vendor are null
- [ ] Handle predictions where only over_vendor is null
- [ ] Handle predictions where only under_vendor is null
- [ ] Handle vendor names with different casing (should be case-insensitive)
- [ ] Handle vendor names not in AVAILABLE_BOOKS list
- [ ] Handle empty predictions list after filtering
- [ ] Handle rapid toggling of book selections

### Step 5.3: UI Testing

- [ ] Dropdown matches existing filter UI styling
- [ ] Selected books are visually distinct
- [ ] Dropdown scrolls correctly when many books are shown
- [ ] Dropdown closes when clicking outside (if implemented)
- [ ] Mobile touch interactions work correctly
- [ ] Loading states don't interfere with book selection
- [ ] Error states don't interfere with book selection

### Step 5.4: Integration Testing

- [ ] Book filter + prop type filter work together
- [ ] Book filter + min value filter work together
- [ ] Book filter + value bets toggle work together
- [ ] Book filter + sorting work together
- [ ] Book filter + game selection (if implemented) work together
- [ ] All filters reset correctly when needed
- [ ] Filter combinations produce expected results

---

## Phase 6: Implementation Summary

### Files to Modify

1. **`app/predictions.tsx`**
   - Add `AVAILABLE_BOOKS` constant
   - Add `BOOK_DISPLAY_NAMES` constant
   - Add `selectedBooks` state
   - Add `toggleBook` function
   - Add `bookFilteredPredictions` useMemo
   - Update `sortedPredictions` useMemo to use `bookFilteredPredictions`
   - Add book selection filter UI component
   - Update `openDropdown` handling for 'books' value

### No Backend Changes Required

- Book filtering is performed client-side
- Existing prediction API endpoints work as-is
- Vendor fields (`over_vendor`, `under_vendor`) are already included in prediction data

### Key Features

1. **Multi-select Book Filter**: Users can select one or more sportsbooks
2. **OR Logic**: Shows predictions where either over OR under vendor matches selected books
3. **No Selection = All**: When no books selected, shows all predictions
4. **UI Consistency**: Matches existing filter dropdown style
5. **Filter Integration**: Works seamlessly with existing filters (prop type, min value, sorting, value bets toggle)

---

## Phase 7: Code Examples

### Complete Book Filtering Implementation

Here's a complete example of the key code changes:

```typescript
// 1. Add constants (near top of file, after imports)
const AVAILABLE_BOOKS = [
  'betmgm',
  'bet365',
  'ballybet',
  'betparx',
  'betrivers',
  'caesars',
  'draftkings',
  'fanduel',
  'rebet',
];

const BOOK_DISPLAY_NAMES: Record<string, string> = {
  'betmgm': 'BetMGM',
  'bet365': 'Bet365',
  'ballybet': 'Bally Bet',
  'betparx': 'BetParx',
  'betrivers': 'BetRivers',
  'caesars': 'Caesars',
  'draftkings': 'DraftKings',
  'fanduel': 'FanDuel',
  'rebet': 'Rebet',
};

// 2. Add state (in component)
const [selectedBooks, setSelectedBooks] = useState<string[]>([]);

// 3. Add toggle function (in component)
const toggleBook = useCallback((book: string) => {
  setSelectedBooks((prev) => {
    if (prev.includes(book)) {
      return prev.filter((b) => b !== book);
    } else {
      return [...prev, book];
    }
  });
}, []);

// 4. Add filtering logic (in component, after predictions state)
const bookFilteredPredictions = useMemo(() => {
  if (selectedBooks.length === 0) {
    return predictions;
  }
  
  return predictions.filter(pred => {
    const overMatch = pred.over_vendor 
      ? selectedBooks.includes(pred.over_vendor.toLowerCase())
      : false;
    const underMatch = pred.under_vendor
      ? selectedBooks.includes(pred.under_vendor.toLowerCase())
      : false;
    
    return overMatch || underMatch;
  });
}, [predictions, selectedBooks]);

// 5. Update sortedPredictions to use bookFilteredPredictions
const sortedPredictions = useMemo(() => {
  const sorted = [...bookFilteredPredictions];  // Changed from predictions
  // ... existing sorting logic ...
}, [bookFilteredPredictions, sortOption]);  // Updated dependency
```

### UI Component Integration

Add the book filter dropdown in the filters section (around line 1151, with other filters):

```typescript
{/* Book Selection Filter */}
<YStack flex={1} minWidth={150} position="relative" zIndex={openDropdown === 'books' ? 100 : 1}>
  <Label htmlFor="books">Sportsbooks</Label>
  <Button
    data-dropdown
    width="100%"
    justifyContent="space-between"
    backgroundColor="$background"
    borderWidth={1}
    borderColor="$borderColor"
    onPress={() => setOpenDropdown(openDropdown === 'books' ? null : 'books')}
  >
    <Text color="$color">
      {selectedBooks.length === 0 
        ? 'All Books' 
        : selectedBooks.length === 1
          ? BOOK_DISPLAY_NAMES[selectedBooks[0]] || selectedBooks[0]
          : `${selectedBooks.length} Selected`}
    </Text>
    <Text color="$color">▼</Text>
  </Button>
  {openDropdown === 'books' && (
    <Card
      data-dropdown
      position="absolute"
      top="100%"
      left={0}
      right={0}
      marginTop="$1"
      padding="$2"
      backgroundColor="$backgroundStrong"
      borderWidth={1}
      borderColor="$borderColor"
      zIndex={100}
      elevation={4}
      maxHeight={300}
    >
      <ScrollView>
        <YStack space="$1">
          <Pressable
            onPress={() => {
              setSelectedBooks([]);
              setOpenDropdown(null);
            }}
          >
            <YStack
              padding="$2"
              backgroundColor={selectedBooks.length === 0 ? "$blue3" : "transparent"}
              borderRadius="$2"
              hoverStyle={{ backgroundColor: "$blue2" }}
            >
              <Text color="$color">All Books</Text>
            </YStack>
          </Pressable>
          <Separator />
          {AVAILABLE_BOOKS.map((book) => (
            <Pressable
              key={book}
              onPress={() => toggleBook(book)}
            >
              <YStack
                padding="$2"
                backgroundColor={selectedBooks.includes(book) ? "$blue3" : "transparent"}
                borderRadius="$2"
                hoverStyle={{ backgroundColor: "$blue2" }}
              >
                <XStack alignItems="center" space="$2">
                  <Text color="$color">
                    {selectedBooks.includes(book) ? '✓' : ' '}
                  </Text>
                  <Text color="$color">{BOOK_DISPLAY_NAMES[book] || book}</Text>
                </XStack>
              </YStack>
            </Pressable>
          ))}
        </YStack>
      </ScrollView>
    </Card>
  )}
</YStack>
```

---

## Phase 8: Future Enhancements (Optional)

### Step 8.1: Persist Book Selection

- Save selected books to localStorage
- Restore selection when user returns to predictions page
- Sync across browser tabs if needed

### Step 8.2: Book Selection Shortcuts

- Add "Select All" / "Clear All" buttons
- Add preset book combinations (e.g., "Major Books" = FanDuel, DraftKings, BetMGM)
- Add quick filter buttons for individual books

### Step 8.3: Enhanced Filter Display

- Show count of predictions matching selected books
- Highlight which vendor(s) match in prediction cards
- Add filter chips showing active book filters

### Step 8.4: Backend Optimization (Optional)

- If performance becomes an issue, move filtering to backend
- Add `vendor` query parameter to prediction endpoints
- Filter at database level for better performance with large datasets

---

## Notes

- This implementation maintains backward compatibility - existing functionality remains unchanged
- Book filtering is purely client-side, requiring no backend changes
- The filter uses OR logic (over OR under vendor matches) - consider if AND logic would be more useful in some cases
- Vendor names should match exactly (case-insensitive comparison is recommended)
- The implementation follows the existing filter pattern (dropdown style) for UI consistency
- No changes to prediction data model are required - vendor fields already exist
- Filter works seamlessly with existing filters without conflicts

