## Scan Results Row Alignment Implementation

This guide describes how to fix the alignment issue where the second row of scan results cards is not properly aligned with the first row on the Scan Results page.

---

## 1. Problem Description

### 1.1. Current Issue

On the Scan Results page (web view), when scan results are displayed in a grid layout, the second row of cards does not align properly with the first row. This creates a misaligned, staggered appearance.

### 1.2. Root Cause

The current implementation uses:
- `XStack` with `flexWrap="wrap"` for the container
- `YStack` with `flex={1}`, `minWidth="32%"`, and `maxWidth="32%"` for each card wrapper

**Problems with this approach:**
1. **Flexbox with percentages**: Using `flex={1}` combined with percentage-based widths (`minWidth="32%"`, `maxWidth="32%"`) can cause inconsistent column widths when items wrap to a new row
2. **Variable card heights**: Cards have different heights due to variable content (optional game time/status fields, different text lengths), which can affect alignment
3. **Flexbox wrapping behavior**: When flex items wrap, they don't maintain strict column alignment - each row can have different spacing between items

### 1.3. Current Code Location

**File:** `app/scan.tsx`

**Lines:** 1263-1273

**Current implementation:**
```typescript
<XStack flexWrap="wrap" space="$3">
  {processedArbs.map((processed) => (
    <YStack key={processed.key} flex={1} minWidth="32%" maxWidth="32%" marginBottom={Platform.OS === 'web' ? "$3" : undefined}>
      <ArbCard
        arb={processed}
        useDecimalOdds={useDecimalOdds}
        betAmountDisplay={betAmountForCalculation}
      />
    </YStack>
  ))}
</XStack>
```

---

## 2. Solution Overview

### 2.1. Approach

Use **CSS Grid** for web platforms to ensure perfect column alignment, while maintaining the existing flexbox approach for mobile (which uses a single column anyway).

### 2.2. Key Changes

1. **Replace flexbox with CSS Grid on web**: Use CSS Grid's `display: grid` with `grid-template-columns: repeat(3, 1fr)` to create exactly 3 equal-width columns
2. **Remove flex properties**: Remove `flex={1}`, `minWidth`, and `maxWidth` from card wrappers on web
3. **Add gap property**: Use CSS Grid's `gap` property instead of `space` for consistent spacing
4. **Maintain mobile layout**: Keep the existing single-column `YStack` layout for mobile

### 2.3. Benefits

- **Perfect alignment**: CSS Grid ensures all columns align perfectly regardless of card height
- **Consistent spacing**: Grid gap provides uniform spacing between all items
- **Responsive**: Can easily adjust column count based on screen size
- **Better performance**: Grid layout is optimized for 2D layouts

---

## 3. Implementation Steps

### 3.1. Update the Web Grid Container

**Location:** `app/scan.tsx`, line 1263

**Current:**
```typescript
<XStack flexWrap="wrap" space="$3">
  {processedArbs.map((processed) => (
    <YStack key={processed.key} flex={1} minWidth="32%" maxWidth="32%" marginBottom={Platform.OS === 'web' ? "$3" : undefined}>
      <ArbCard
        arb={processed}
        useDecimalOdds={useDecimalOdds}
        betAmountDisplay={betAmountForCalculation}
      />
    </YStack>
  ))}
</XStack>
```

**Change to:**
```typescript
{Platform.OS === 'web' ? (
  <View
    style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: 12, // Equivalent to $3 spacing (12px)
      width: '100%',
    }}
  >
    {processedArbs.map((processed) => (
      <ArbCard
        key={processed.key}
        arb={processed}
        useDecimalOdds={useDecimalOdds}
        betAmountDisplay={betAmountForCalculation}
      />
    ))}
  </View>
) : (
  <XStack flexWrap="wrap" space="$3">
    {processedArbs.map((processed) => (
      <YStack key={processed.key} flex={1} minWidth="32%" maxWidth="32%" marginBottom={Platform.OS === 'web' ? "$3" : undefined}>
        <ArbCard
          arb={processed}
          useDecimalOdds={useDecimalOdds}
          betAmountDisplay={betAmountForCalculation}
        />
      </YStack>
    ))}
  </XStack>
)}
```

**Note:** The `View` component is already imported from `react-native` (line 6), so no additional import is needed.

**Alternative approach (using Tamagui's YStack with custom styles):**

If you prefer to stay within Tamagui components, you can use `YStack` with inline styles:

```typescript
{Platform.OS === 'web' ? (
  <YStack
    style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: 12,
      width: '100%',
    }}
  >
    {processedArbs.map((processed) => (
      <ArbCard
        key={processed.key}
        arb={processed}
        useDecimalOdds={useDecimalOdds}
        betAmountDisplay={betAmountForCalculation}
      />
    ))}
  </YStack>
) : (
  <XStack flexWrap="wrap" space="$3">
    {processedArbs.map((processed) => (
      <YStack key={processed.key} flex={1} minWidth="32%" maxWidth="32%" marginBottom={Platform.OS === 'web' ? "$3" : undefined}>
        <ArbCard
          arb={processed}
          useDecimalOdds={useDecimalOdds}
          betAmountDisplay={betAmountForCalculation}
        />
      </YStack>
    ))}
  </XStack>
)}
```

---

## 4. Detailed Implementation

### 4.1. Step-by-Step Changes

#### Step 1: Import View Component (if not already imported)

**Location:** `app/scan.tsx`, line 6

**Check if `View` is imported:**
```typescript
import { RefreshControl, Pressable, View, useWindowDimensions } from 'react-native';
```

If `View` is not in the import, add it:
```typescript
import { RefreshControl, Pressable, View, useWindowDimensions } from 'react-native';
```

#### Step 2: Replace the Grid Layout Section

**Location:** `app/scan.tsx`, lines 1262-1274

**Find the section:**
```typescript
        ) : isMobile ? (
          <YStack space="$3">
            {processedArbs.map((processed) => (
              <ArbCard
                key={processed.key}
                arb={processed}
                useDecimalOdds={useDecimalOdds}
                betAmountDisplay={betAmountForCalculation}
              />
            ))}
          </YStack>
        ) : (
          <XStack flexWrap="wrap" space="$3">
            {processedArbs.map((processed) => (
              <YStack key={processed.key} flex={1} minWidth="32%" maxWidth="32%" marginBottom={Platform.OS === 'web' ? "$3" : undefined}>
                <ArbCard
                  arb={processed}
                  useDecimalOdds={useDecimalOdds}
                  betAmountDisplay={betAmountForCalculation}
                />
              </YStack>
            ))}
          </XStack>
        )}
```

**Replace with:**
```typescript
        ) : isMobile ? (
          <YStack space="$3">
            {processedArbs.map((processed) => (
              <ArbCard
                key={processed.key}
                arb={processed}
                useDecimalOdds={useDecimalOdds}
                betAmountDisplay={betAmountForCalculation}
              />
            ))}
          </YStack>
        ) : (
          <View
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 12, // $3 spacing = 12px
              width: '100%',
            }}
          >
            {processedArbs.map((processed) => (
              <ArbCard
                key={processed.key}
                arb={processed}
                useDecimalOdds={useDecimalOdds}
                betAmountDisplay={betAmountForCalculation}
              />
            ))}
          </View>
        )}
```

**Key changes:**
1. Removed the `XStack` wrapper for web
2. Removed the `YStack` wrapper around each `ArbCard` (no longer needed)
3. Removed `flex={1}`, `minWidth="32%"`, `maxWidth="32%"`, and `marginBottom` props
4. Added CSS Grid container with `display: 'grid'` and `gridTemplateColumns: 'repeat(3, 1fr)'`
5. Used `gap: 12` for spacing (equivalent to Tamagui's `$3` token, which is typically 12px)
6. Moved `key` prop directly to `ArbCard` component

---

## 5. Responsive Considerations

### 5.1. Adjusting Column Count for Different Screen Sizes

If you want to make the grid responsive (e.g., 2 columns on tablets, 3 on desktop), you can use media queries or calculate based on window width:

**Option 1: Use window width calculation**

```typescript
const { width } = useWindowDimensions();
const isMobile = width < 700;
const isTablet = width >= 700 && width < 1200;
const isDesktop = width >= 1200;

// In the render:
{Platform.OS === 'web' ? (
  <View
    style={{
      display: 'grid',
      gridTemplateColumns: isTablet ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
      gap: 12,
      width: '100%',
    }}
  >
    {processedArbs.map((processed) => (
      <ArbCard
        key={processed.key}
        arb={processed}
        useDecimalOdds={useDecimalOdds}
        betAmountDisplay={betAmountForCalculation}
      />
    ))}
  </View>
) : (
  // ... mobile layout
)}
```

**Option 2: Use CSS media queries (more flexible)**

Create a style object that uses CSS media queries:

```typescript
const gridStyle = Platform.OS === 'web' ? {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 12,
  width: '100%',
  '@media (max-width: 1200px)': {
    gridTemplateColumns: 'repeat(2, 1fr)',
  },
  '@media (max-width: 700px)': {
    gridTemplateColumns: '1fr',
  },
} : {};

// Then use:
<View style={gridStyle}>
```

**Note:** React Native's `StyleSheet` doesn't support media queries directly. For web, you may need to use a library like `react-native-web` with CSS-in-JS, or use inline styles with CSS classes.

---

## 6. Testing

### 6.1. Visual Testing Checklist

After implementing the changes, verify:

- [ ] **First row alignment**: All three cards in the first row are perfectly aligned
- [ ] **Second row alignment**: All cards in the second row align perfectly with the first row columns
- [ ] **Third row and beyond**: All subsequent rows maintain perfect alignment
- [ ] **Spacing consistency**: Equal spacing between all cards (both horizontal and vertical)
- [ ] **Card width**: All cards have equal width within each row
- [ ] **Responsive behavior**: Layout adjusts correctly on different screen sizes (if responsive breakpoints are added)
- [ ] **Mobile layout**: Mobile single-column layout remains unchanged and functional

### 6.2. Edge Cases to Test

1. **Fewer than 3 items**: When there are 1 or 2 items, they should still align correctly
2. **Exactly 3 items**: Should display as a single row
3. **4-6 items**: Should display as 2 rows with proper alignment
4. **Variable card heights**: Cards with different content heights should still align in columns
5. **Long text content**: Cards with longer player names or game labels should maintain alignment
6. **Missing optional fields**: Cards without game time or status should still align correctly

---

## 7. Alternative Solutions

### 7.1. Option A: Fixed Width Approach (Simpler, Less Flexible)

If CSS Grid is not available or causes issues, you can use fixed widths:

```typescript
<XStack flexWrap="wrap" space="$3" justifyContent="flex-start">
  {processedArbs.map((processed) => (
    <YStack 
      key={processed.key} 
      width="calc(33.333% - 8px)" // 3 columns with gap
      marginBottom="$3"
    >
      <ArbCard
        arb={processed}
        useDecimalOdds={useDecimalOdds}
        betAmountDisplay={betAmountForCalculation}
      />
    </YStack>
  ))}
</XStack>
```

**Pros:**
- Works with existing flexbox
- No CSS Grid dependency

**Cons:**
- Less flexible for responsive design
- Requires manual gap calculation
- May have slight alignment issues with very long content

### 7.2. Option B: Flexbox with Fixed Basis (Better than Current)

```typescript
<XStack flexWrap="wrap" space="$3">
  {processedArbs.map((processed) => (
    <YStack 
      key={processed.key} 
      flexBasis="calc(33.333% - 8px)"
      flexGrow={0}
      flexShrink={0}
      marginBottom="$3"
    >
      <ArbCard
        arb={processed}
        useDecimalOdds={useDecimalOdds}
        betAmountDisplay={betAmountForCalculation}
      />
    </YStack>
  ))}
</XStack>
```

**Pros:**
- Better than current approach
- Uses flexbox (familiar)

**Cons:**
- Still may have minor alignment issues
- Requires gap calculation

### 7.3. Option C: CSS Grid (Recommended)

This is the solution described in Section 3 and 4 above.

**Pros:**
- Perfect alignment guaranteed
- Clean, semantic code
- Better performance for 2D layouts
- Easy to make responsive

**Cons:**
- Requires CSS Grid support (available in all modern browsers)
- Slightly different approach from flexbox

---

## 8. Summary

### 8.1. Problem

The second row of scan results cards is misaligned with the first row due to using flexbox with percentage-based widths and flex properties.

### 8.2. Solution

Replace the flexbox-based grid layout with CSS Grid on web platforms, which ensures perfect column alignment regardless of card heights.

### 8.3. Key Changes

1. Replace `XStack flexWrap="wrap"` with `View` using CSS Grid
2. Remove `YStack` wrapper around each card
3. Remove `flex={1}`, `minWidth`, `maxWidth` props
4. Use `gridTemplateColumns: 'repeat(3, 1fr)'` for 3 equal columns
5. Use `gap: 12` for consistent spacing
6. Keep mobile layout unchanged (single column)

### 8.4. Files Modified

- `app/scan.tsx` (lines 1262-1274)

### 8.5. Expected Outcome

After implementation, all rows of scan results cards will be perfectly aligned in a 3-column grid on web, with consistent spacing and equal column widths.

---

## 9. Additional Notes

### 9.1. Tamagui Token Values

If you want to use Tamagui's spacing tokens instead of hardcoded pixel values, you can calculate the gap:

- `$3` in Tamagui typically equals `12px`
- You can also use `gap: '$3'` if Tamagui supports it in style objects, but inline styles typically require pixel values

### 9.2. Browser Compatibility

CSS Grid is supported in:
- Chrome 57+
- Firefox 52+
- Safari 10.1+
- Edge 16+

All modern browsers support CSS Grid, so compatibility should not be an issue.

### 9.3. Performance

CSS Grid is optimized for 2D layouts and performs better than flexbox for grid-like structures, especially with many items.

---

## 10. Implementation Verification

After implementing the changes:

1. **Open the Scan Results page** on web
2. **Verify alignment**: Check that all cards in each row align perfectly
3. **Test with different data**: Try with different numbers of results (1, 2, 3, 4, 5, 6+ items)
4. **Check spacing**: Ensure consistent gaps between all cards
5. **Test responsive**: If responsive breakpoints were added, test at different screen sizes
6. **Verify mobile**: Ensure mobile layout still works correctly (single column)

If alignment issues persist, check:
- Browser DevTools to verify CSS Grid is being applied
- That no conflicting styles are overriding the grid layout
- That the `View` component is rendering correctly on web

