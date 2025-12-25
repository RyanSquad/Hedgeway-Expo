# Predictions Web 3-Column Layout Implementation Guide

This guide provides step-by-step instructions for displaying predictions in a 3-column grid layout on web while maintaining a single-column layout on mobile devices.

## Overview

**Current State:**
- Predictions are displayed in a single column (vertical stack) on all platforms
- Each prediction card takes full width of the container
- Layout is the same for web and mobile

**Target State:**
- **Web**: Predictions displayed in a 3-column grid layout
- **Mobile**: Predictions remain in a single column (unchanged)
- Responsive design that adapts to screen size
- Maintains all existing functionality (filtering, sorting, grouping by prop type)

---

## Phase 1: Understanding the Current Structure

### Step 1.1: Current Prediction Display Structure

The current implementation renders predictions in a vertical stack:

```1448:1624:app/predictions.tsx
                    {!isCollapsed && (
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
                            <YStack space="$3">
                              {/* Header with Game Context */}
                              <XStack justifyContent="space-between" alignItems="flex-start" flexWrap="wrap">
                                <YStack flex={1} minWidth={200}>
                                  <Text fontSize="$6" fontWeight="bold" color="$color">
                                    {playerName}
                                    {pred.team_abbreviation && ` (${pred.team_abbreviation})`}
                                  </Text>
                                  <Text fontSize="$5" color="$color" textTransform="capitalize">
                                    {pred.prop_type} {pred.line_value}
                                  </Text>
                                  
                                  {/* Game Context */}
                                  {(pred.game_label || pred.game_time || pred.opponent_team) && (
                                    <YStack marginTop="$2" space="$1">
                                      {pred.game_label && (
                                        <Text fontSize="$3" color="$color10">
                                          {pred.game_label}
                                          {pred.opponent_team && ` vs ${pred.opponent_team}`}
                                        </Text>
                                      )}
                                      {pred.game_time && formatGameTime(pred.game_time) && (
                                        <Text fontSize="$3" color="$color10">
                                          {formatGameTime(pred.game_time)}
                                        </Text>
                                      )}
                                      {pred.game_status && (
                                        <Text fontSize="$3" color="$color10" fontStyle="italic">
                                          {pred.game_status}
                                        </Text>
                                      )}
                                    </YStack>
                                  )}
                                </YStack>
                                {isValueBet && (
                                  <Card padding="$2" backgroundColor="$green9">
                                    <Text fontSize="$5" fontWeight="bold" color="white">
                                      VALUE BET
                                    </Text>
                                  </Card>
                                )}
                              </XStack>

                              <Separator />

                              {/* Prediction Details */}
                              <XStack space="$4" flexWrap="wrap">
                                <YStack minWidth={150} space="$2">
                                  <Text fontSize="$4" color="$color11" fontWeight="600">
                                    Prediction
                                  </Text>
                                  <Text color="$color">
                                    {valueSide === 'over' ? 'OVER' : 'UNDER'}: {formatProbability(valueSide === 'over' ? pred.predicted_prob_over : pred.predicted_prob_under)}
                                  </Text>
                                  <Text fontSize="$3" color="$color10">
                                    Confidence: {formatProbability(pred.confidence_score)}
                                  </Text>
                                </YStack>

                                <YStack minWidth={150} space="$2">
                                  <Text fontSize="$4" color="$color11" fontWeight="600">
                                    Market Odds
                                  </Text>
                                  {valueSide === 'over' ? (
                                    <>
                                      <Text color="$color">
                                        OVER: {formatOdds(pred.best_over_odds)} ({formatProbability(pred.implied_prob_over)})
                                      </Text>
                                      {pred.over_vendor && (
                                        <Text fontSize="$3" color="$color10">
                                          {pred.over_vendor}
                                        </Text>
                                      )}
                                    </>
                                  ) : (
                                    <>
                                      <Text color="$color">
                                        UNDER: {formatOdds(pred.best_under_odds)} ({formatProbability(pred.implied_prob_under)})
                                      </Text>
                                      {pred.under_vendor && (
                                        <Text fontSize="$3" color="$color10">
                                          {pred.under_vendor}
                                        </Text>
                                      )}
                                    </>
                                  )}
                                </YStack>

                                <YStack minWidth={150} space="$2">
                                  <Text fontSize="$4" color="$color11" fontWeight="600">
                                    Value
                                  </Text>
                                  <Text 
                                    fontSize="$5" 
                                    fontWeight="bold"
                                    color={bestValue >= 0 ? "$green9" : "$red9"}
                                  >
                                    {formatValue(bestValue)}
                                  </Text>
                                  <Text fontSize="$3" color="$color10">
                                    {valueSide === 'over' 
                                      ? formatValue(pred.predicted_value_over)
                                      : formatValue(pred.predicted_value_under)
                                    } edge
                                  </Text>
                                </YStack>
                              </XStack>

                              {/* Player Stats Context */}
                              {(pred.player_avg_7 !== null || pred.player_season_avg !== null) && (
                                <>
                                  <Separator />
                                  <XStack space="$4" flexWrap="wrap">
                                    {pred.player_avg_7 !== null && (
                                      <Text fontSize="$3" color="$color10">
                                        7-game avg: {formatNumber(pred.player_avg_7)}
                                      </Text>
                                    )}
                                    {pred.player_season_avg !== null && (
                                      <Text fontSize="$3" color="$color10">
                                        Season avg: {formatNumber(pred.player_season_avg)}
                                      </Text>
                                    )}
                                  </XStack>
                                </>
                              )}

                              {/* Actual Outcome (if available) */}
                              {pred.actual_result && (
                                <>
                                  <Separator />
                                  <XStack space="$3" alignItems="center">
                                    <Text fontSize="$4" color="$color11" fontWeight="600">
                                      Result:
                                    </Text>
                                    <Text 
                                      fontSize="$5" 
                                      fontWeight="bold"
                                      color={pred.actual_result === valueSide ? "$green9" : "$red9"}
                                      textTransform="uppercase"
                                    >
                                      {pred.actual_result} {pred.actual_value !== null && `(${pred.actual_value})`}
                                    </Text>
                                    {pred.actual_result === valueSide && (
                                      <Text fontSize="$4" color="$green9">
                                        ✓ Correct
                                      </Text>
                                    )}
                                  </XStack>
                                </>
                              )}
                            </YStack>
                          </Card>
                        );
                      })}
                    </YStack>
                    )}
```

### Step 1.2: Required Changes

To implement a 3-column layout on web, we need to:

1. Import `Platform` from `react-native` (already imported)
2. Detect if we're on web using `Platform.OS === 'web'`
3. Wrap predictions in a grid/flex container on web
4. Use responsive layout that adapts to screen size
5. Keep mobile layout unchanged (single column)

---

## Phase 2: Implementation Strategy

### Step 2.1: Layout Options

There are several approaches to achieve a 3-column layout:

**Option 1: CSS Grid (Recommended for Web)**
- Use Tamagui's `flexWrap` with `flexDirection="row"` and `flex={1}` with max width
- Simple and responsive
- Works well with Tamagui components

**Option 2: Flexbox with Fixed Widths**
- Use `XStack` with `flexWrap="wrap"` and fixed widths (e.g., `width="33.33%"`)
- Less flexible but predictable

**Option 3: CSS Grid via Style Props**
- Use web-specific style props if available
- More complex but more control

**Recommended: Option 1** - Using Tamagui's flexbox with responsive widths

### Step 2.2: Responsive Breakpoints

Consider different layouts for different screen sizes:
- **Large screens (desktop)**: 3 columns
- **Medium screens (tablet)**: 2 columns
- **Small screens (mobile)**: 1 column

For this implementation, we'll focus on:
- **Web**: 3 columns
- **Mobile**: 1 column (unchanged)

---

## Phase 3: Implementation Steps

### Step 3.1: Import Platform (Already Done)

The `Platform` import is already present in the file:

```16:16:app/predictions.tsx
import { RefreshControl, Platform, Pressable } from 'react-native';
```

### Step 3.2: Create Platform-Specific Container

Replace the predictions container (around line 1449) with a platform-aware layout:

**Current Code:**
```typescript
{!isCollapsed && (
  <YStack space="$3">
    {predictionsForType.map((pred) => {
      // ... prediction card ...
    })}
  </YStack>
)}
```

**New Code:**
```typescript
{!isCollapsed && (
  Platform.OS === 'web' ? (
    // Web: 3-column grid layout
    <XStack 
      flexWrap="wrap" 
      space="$3"
      gap="$3"
      alignItems="stretch"
    >
      {predictionsForType.map((pred) => {
        const bestValue = Math.max(
          pred.predicted_value_over || 0,
          pred.predicted_value_under || 0
        );
        const isValueBet = bestValue >= parseFloat(minValue);
        const valueSide = (pred.predicted_value_over || 0) > (pred.predicted_value_under || 0) ? 'over' : 'under';
        const playerName = `${pred.player_first_name} ${pred.player_last_name}`;

        return (
          <YStack 
            key={pred.id}
            flex={1}
            minWidth="30%"
            maxWidth="32%"
            space="$3"
          >
            <Card
              padding="$4"
              backgroundColor={isValueBet ? "$green2" : "$backgroundStrong"}
              borderWidth={isValueBet ? 2 : 1}
              borderColor={isValueBet ? "$green9" : "$borderColor"}
              height="100%"
            >
              {/* ... existing card content ... */}
            </Card>
          </YStack>
        );
      })}
    </XStack>
  ) : (
    // Mobile: Single column (unchanged)
    <YStack space="$3">
      {predictionsForType.map((pred) => {
        // ... existing prediction card code ...
      })}
    </YStack>
  )
)}
```

### Step 3.3: Alternative Approach - Using Style Props

If the above approach doesn't work well, use a more explicit width-based approach:

```typescript
{!isCollapsed && (
  <XStack 
    flexWrap="wrap" 
    space="$3"
    gap="$3"
    alignItems="stretch"
    flexDirection={Platform.OS === 'web' ? 'row' : 'column'}
  >
    {predictionsForType.map((pred) => {
      const bestValue = Math.max(
        pred.predicted_value_over || 0,
        pred.predicted_value_under || 0
      );
      const isValueBet = bestValue >= parseFloat(minValue);
      const valueSide = (pred.predicted_value_over || 0) > (pred.predicted_value_under || 0) ? 'over' : 'under';
      const playerName = `${pred.player_first_name} ${pred.player_last_name}`;

      return (
        <YStack 
          key={pred.id}
          width={Platform.OS === 'web' ? '31%' : '100%'}
          space="$3"
        >
          <Card
            padding="$4"
            backgroundColor={isValueBet ? "$green2" : "$backgroundStrong"}
            borderWidth={isValueBet ? 2 : 1}
            borderColor={isValueBet ? "$green9" : "$borderColor"}
            height="100%"
          >
            {/* ... existing card content ... */}
          </Card>
        </YStack>
      );
    })}
  </XStack>
)}
```

### Step 3.4: Complete Code Replacement

Replace the entire predictions rendering section (lines 1448-1624) with:

```typescript
{!isCollapsed && (
  Platform.OS === 'web' ? (
    // Web: 3-column grid layout
    <XStack 
      flexWrap="wrap" 
      space="$3"
      gap="$3"
      alignItems="stretch"
    >
      {predictionsForType.map((pred) => {
        const bestValue = Math.max(
          pred.predicted_value_over || 0,
          pred.predicted_value_under || 0
        );
        const isValueBet = bestValue >= parseFloat(minValue);
        const valueSide = (pred.predicted_value_over || 0) > (pred.predicted_value_under || 0) ? 'over' : 'under';
        const playerName = `${pred.player_first_name} ${pred.player_last_name}`;

        return (
          <YStack 
            key={pred.id}
            flex={1}
            minWidth="30%"
            maxWidth="32%"
            space="$3"
          >
            <Card
              padding="$4"
              backgroundColor={isValueBet ? "$green2" : "$backgroundStrong"}
              borderWidth={isValueBet ? 2 : 1}
              borderColor={isValueBet ? "$green9" : "$borderColor"}
              height="100%"
            >
              <YStack space="$3">
                {/* Header with Game Context */}
                <XStack justifyContent="space-between" alignItems="flex-start" flexWrap="wrap">
                  <YStack flex={1} minWidth={200}>
                    <Text fontSize="$6" fontWeight="bold" color="$color">
                      {playerName}
                      {pred.team_abbreviation && ` (${pred.team_abbreviation})`}
                    </Text>
                    <Text fontSize="$5" color="$color" textTransform="capitalize">
                      {pred.prop_type} {pred.line_value}
                    </Text>
                    
                    {/* Game Context */}
                    {(pred.game_label || pred.game_time || pred.opponent_team) && (
                      <YStack marginTop="$2" space="$1">
                        {pred.game_label && (
                          <Text fontSize="$3" color="$color10">
                            {pred.game_label}
                            {pred.opponent_team && ` vs ${pred.opponent_team}`}
                          </Text>
                        )}
                        {pred.game_time && formatGameTime(pred.game_time) && (
                          <Text fontSize="$3" color="$color10">
                            {formatGameTime(pred.game_time)}
                          </Text>
                        )}
                        {pred.game_status && (
                          <Text fontSize="$3" color="$color10" fontStyle="italic">
                            {pred.game_status}
                          </Text>
                        )}
                      </YStack>
                    )}
                  </YStack>
                  {isValueBet && (
                    <Card padding="$2" backgroundColor="$green9">
                      <Text fontSize="$5" fontWeight="bold" color="white">
                        VALUE BET
                      </Text>
                    </Card>
                  )}
                </XStack>

                <Separator />

                {/* Prediction Details */}
                <XStack space="$4" flexWrap="wrap">
                  <YStack minWidth={150} space="$2">
                    <Text fontSize="$4" color="$color11" fontWeight="600">
                      Prediction
                    </Text>
                    <Text color="$color">
                      {valueSide === 'over' ? 'OVER' : 'UNDER'}: {formatProbability(valueSide === 'over' ? pred.predicted_prob_over : pred.predicted_prob_under)}
                    </Text>
                    <Text fontSize="$3" color="$color10">
                      Confidence: {formatProbability(pred.confidence_score)}
                    </Text>
                  </YStack>

                  <YStack minWidth={150} space="$2">
                    <Text fontSize="$4" color="$color11" fontWeight="600">
                      Market Odds
                    </Text>
                    {valueSide === 'over' ? (
                      <>
                        <Text color="$color">
                          OVER: {formatOdds(pred.best_over_odds)} ({formatProbability(pred.implied_prob_over)})
                        </Text>
                        {pred.over_vendor && (
                          <Text fontSize="$3" color="$color10">
                            {pred.over_vendor}
                          </Text>
                        )}
                      </>
                    ) : (
                      <>
                        <Text color="$color">
                          UNDER: {formatOdds(pred.best_under_odds)} ({formatProbability(pred.implied_prob_under)})
                        </Text>
                        {pred.under_vendor && (
                          <Text fontSize="$3" color="$color10">
                            {pred.under_vendor}
                          </Text>
                        )}
                      </>
                    )}
                  </YStack>

                  <YStack minWidth={150} space="$2">
                    <Text fontSize="$4" color="$color11" fontWeight="600">
                      Value
                    </Text>
                    <Text 
                      fontSize="$5" 
                      fontWeight="bold"
                      color={bestValue >= 0 ? "$green9" : "$red9"}
                    >
                      {formatValue(bestValue)}
                    </Text>
                    <Text fontSize="$3" color="$color10">
                      {valueSide === 'over' 
                        ? formatValue(pred.predicted_value_over)
                        : formatValue(pred.predicted_value_under)
                      } edge
                    </Text>
                  </YStack>
                </XStack>

                {/* Player Stats Context */}
                {(pred.player_avg_7 !== null || pred.player_season_avg !== null) && (
                  <>
                    <Separator />
                    <XStack space="$4" flexWrap="wrap">
                      {pred.player_avg_7 !== null && (
                        <Text fontSize="$3" color="$color10">
                          7-game avg: {formatNumber(pred.player_avg_7)}
                        </Text>
                      )}
                      {pred.player_season_avg !== null && (
                        <Text fontSize="$3" color="$color10">
                          Season avg: {formatNumber(pred.player_season_avg)}
                        </Text>
                      )}
                    </XStack>
                  </>
                )}

                {/* Actual Outcome (if available) */}
                {pred.actual_result && (
                  <>
                    <Separator />
                    <XStack space="$3" alignItems="center">
                      <Text fontSize="$4" color="$color11" fontWeight="600">
                        Result:
                      </Text>
                      <Text 
                        fontSize="$5" 
                        fontWeight="bold"
                        color={pred.actual_result === valueSide ? "$green9" : "$red9"}
                        textTransform="uppercase"
                      >
                        {pred.actual_result} {pred.actual_value !== null && `(${pred.actual_value})`}
                      </Text>
                      {pred.actual_result === valueSide && (
                        <Text fontSize="$4" color="$green9">
                          ✓ Correct
                        </Text>
                      )}
                    </XStack>
                  </>
                )}
              </YStack>
            </Card>
          </YStack>
        );
      })}
    </XStack>
  ) : (
    // Mobile: Single column (unchanged)
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
            <YStack space="$3">
              {/* Header with Game Context */}
              <XStack justifyContent="space-between" alignItems="flex-start" flexWrap="wrap">
                <YStack flex={1} minWidth={200}>
                  <Text fontSize="$6" fontWeight="bold" color="$color">
                    {playerName}
                    {pred.team_abbreviation && ` (${pred.team_abbreviation})`}
                  </Text>
                  <Text fontSize="$5" color="$color" textTransform="capitalize">
                    {pred.prop_type} {pred.line_value}
                  </Text>
                  
                  {/* Game Context */}
                  {(pred.game_label || pred.game_time || pred.opponent_team) && (
                    <YStack marginTop="$2" space="$1">
                      {pred.game_label && (
                        <Text fontSize="$3" color="$color10">
                          {pred.game_label}
                          {pred.opponent_team && ` vs ${pred.opponent_team}`}
                        </Text>
                      )}
                      {pred.game_time && formatGameTime(pred.game_time) && (
                        <Text fontSize="$3" color="$color10">
                          {formatGameTime(pred.game_time)}
                        </Text>
                      )}
                      {pred.game_status && (
                        <Text fontSize="$3" color="$color10" fontStyle="italic">
                          {pred.game_status}
                        </Text>
                      )}
                    </YStack>
                  )}
                </YStack>
                {isValueBet && (
                  <Card padding="$2" backgroundColor="$green9">
                    <Text fontSize="$5" fontWeight="bold" color="white">
                      VALUE BET
                    </Text>
                  </Card>
                )}
              </XStack>

              <Separator />

              {/* Prediction Details */}
              <XStack space="$4" flexWrap="wrap">
                <YStack minWidth={150} space="$2">
                  <Text fontSize="$4" color="$color11" fontWeight="600">
                    Prediction
                  </Text>
                  <Text color="$color">
                    {valueSide === 'over' ? 'OVER' : 'UNDER'}: {formatProbability(valueSide === 'over' ? pred.predicted_prob_over : pred.predicted_prob_under)}
                  </Text>
                  <Text fontSize="$3" color="$color10">
                    Confidence: {formatProbability(pred.confidence_score)}
                  </Text>
                </YStack>

                <YStack minWidth={150} space="$2">
                  <Text fontSize="$4" color="$color11" fontWeight="600">
                    Market Odds
                  </Text>
                  {valueSide === 'over' ? (
                    <>
                      <Text color="$color">
                        OVER: {formatOdds(pred.best_over_odds)} ({formatProbability(pred.implied_prob_over)})
                      </Text>
                      {pred.over_vendor && (
                        <Text fontSize="$3" color="$color10">
                          {pred.over_vendor}
                        </Text>
                      )}
                    </>
                  ) : (
                    <>
                      <Text color="$color">
                        UNDER: {formatOdds(pred.best_under_odds)} ({formatProbability(pred.implied_prob_under)})
                      </Text>
                      {pred.under_vendor && (
                        <Text fontSize="$3" color="$color10">
                          {pred.under_vendor}
                        </Text>
                      )}
                    </>
                  )}
                </YStack>

                <YStack minWidth={150} space="$2">
                  <Text fontSize="$4" color="$color11" fontWeight="600">
                    Value
                  </Text>
                  <Text 
                    fontSize="$5" 
                    fontWeight="bold"
                    color={bestValue >= 0 ? "$green9" : "$red9"}
                  >
                    {formatValue(bestValue)}
                  </Text>
                  <Text fontSize="$3" color="$color10">
                    {valueSide === 'over' 
                      ? formatValue(pred.predicted_value_over)
                      : formatValue(pred.predicted_value_under)
                    } edge
                  </Text>
                </YStack>
              </XStack>

              {/* Player Stats Context */}
              {(pred.player_avg_7 !== null || pred.player_season_avg !== null) && (
                <>
                  <Separator />
                  <XStack space="$4" flexWrap="wrap">
                    {pred.player_avg_7 !== null && (
                      <Text fontSize="$3" color="$color10">
                        7-game avg: {formatNumber(pred.player_avg_7)}
                      </Text>
                    )}
                    {pred.player_season_avg !== null && (
                      <Text fontSize="$3" color="$color10">
                        Season avg: {formatNumber(pred.player_season_avg)}
                      </Text>
                    )}
                  </XStack>
                </>
              )}

              {/* Actual Outcome (if available) */}
              {pred.actual_result && (
                <>
                  <Separator />
                  <XStack space="$3" alignItems="center">
                    <Text fontSize="$4" color="$color11" fontWeight="600">
                      Result:
                    </Text>
                    <Text 
                      fontSize="$5" 
                      fontWeight="bold"
                      color={pred.actual_result === valueSide ? "$green9" : "$red9"}
                      textTransform="uppercase"
                    >
                      {pred.actual_result} {pred.actual_value !== null && `(${pred.actual_value})`}
                    </Text>
                    {pred.actual_result === valueSide && (
                      <Text fontSize="$4" color="$green9">
                        ✓ Correct
                      </Text>
                    )}
                  </XStack>
                </>
              )}
            </YStack>
          </Card>
        );
      })}
    </YStack>
  )
)}
```

---

## Phase 4: Responsive Design Considerations

### Step 4.1: Adjust Column Widths for Different Screen Sizes

For better responsiveness, you can adjust column widths based on screen size:

```typescript
// Add this helper function at the top of the component
const getColumnWidth = () => {
  if (Platform.OS !== 'web') return '100%';
  
  // You can use window width if available
  if (typeof window !== 'undefined') {
    const width = window.innerWidth;
    if (width < 768) return '100%';      // Mobile: 1 column
    if (width < 1024) return '48%';      // Tablet: 2 columns
    return '31%';                        // Desktop: 3 columns
  }
  
  return '31%'; // Default: 3 columns on web
};

// Then use it in the render:
<YStack 
  key={pred.id}
  width={getColumnWidth()}
  space="$3"
>
```

### Step 4.2: Using Media Queries (Web Only)

For more advanced responsive behavior, you can use CSS media queries via style props:

```typescript
<XStack 
  flexWrap="wrap" 
  space="$3"
  gap="$3"
  alignItems="stretch"
  $web={{
    '@media (max-width: 768px)': {
      flexDirection: 'column',
    },
    '@media (min-width: 769px) and (max-width: 1024px)': {
      // 2 columns
    },
    '@media (min-width: 1025px)': {
      // 3 columns
    },
  }}
>
```

---

## Phase 5: Styling Adjustments

### Step 5.1: Card Height Consistency

To ensure cards in the same row have equal height, add `height="100%"` to the Card component:

```typescript
<Card
  padding="$4"
  backgroundColor={isValueBet ? "$green2" : "$backgroundStrong"}
  borderWidth={isValueBet ? 2 : 1}
  borderColor={isValueBet ? "$green9" : "$borderColor"}
  height="100%"  // Add this for equal height cards
>
```

### Step 5.2: Spacing and Gaps

Use `gap` prop along with `space` for consistent spacing:

```typescript
<XStack 
  flexWrap="wrap" 
  space="$3"
  gap="$3"  // Adds gap between items
  alignItems="stretch"  // Ensures equal height
>
```

### Step 5.3: Minimum Width Constraints

Set minimum widths to prevent columns from becoming too narrow:

```typescript
<YStack 
  key={pred.id}
  flex={1}
  minWidth="30%"  // Minimum 30% width
  maxWidth="32%"  // Maximum 32% width (allows 3 columns)
  space="$3"
>
```

---

## Phase 6: Testing Checklist

### Step 6.1: Functional Testing

- [ ] **Web Layout**: Verify predictions display in 3 columns on web
- [ ] **Mobile Layout**: Verify predictions remain in single column on mobile
- [ ] **Filtering**: Verify filters still work correctly with 3-column layout
- [ ] **Sorting**: Verify sorting still works correctly with 3-column layout
- [ ] **Prop Type Grouping**: Verify prop type sections still work correctly
- [ ] **Collapsible Sections**: Verify collapsible sections work with new layout
- [ ] **Value Bet Highlighting**: Verify value bets are still highlighted correctly
- [ ] **Card Content**: Verify all card content displays correctly in narrower columns

### Step 6.2: Responsive Testing

- [ ] **Desktop (1920px+)**: Verify 3 columns display correctly
- [ ] **Laptop (1366px)**: Verify 3 columns display correctly
- [ ] **Tablet (768px-1024px)**: Verify layout adapts appropriately (if responsive breakpoints added)
- [ ] **Mobile (< 768px)**: Verify single column layout
- [ ] **Window Resize**: Verify layout adjusts when resizing browser window

### Step 6.3: Edge Cases

- [ ] **Few Predictions**: Verify layout works with 1-2 predictions
- [ ] **Many Predictions**: Verify layout works with 10+ predictions
- [ ] **Uneven Counts**: Verify layout works when prediction count is not divisible by 3
- [ ] **Long Text**: Verify long player names/text don't break layout
- [ ] **Different Prop Types**: Verify layout works across all prop types

### Step 6.4: Visual Testing

- [ ] **Card Heights**: Verify cards in the same row have equal height
- [ ] **Spacing**: Verify consistent spacing between cards
- [ ] **Alignment**: Verify cards are properly aligned
- [ ] **Overflow**: Verify content doesn't overflow cards
- [ ] **Value Bet Styling**: Verify value bet cards stand out correctly

---

## Phase 7: Troubleshooting

### Issue 1: Cards Not Aligning in 3 Columns

**Problem:** Cards are not displaying in a proper 3-column grid.

**Solutions:**
- Ensure `flexWrap="wrap"` is set on the container
- Check that `minWidth` and `maxWidth` are set correctly (e.g., `minWidth="30%"`, `maxWidth="32%"`)
- Verify `flex={1}` is set on child containers
- Check for conflicting width styles

### Issue 2: Cards Have Unequal Heights

**Problem:** Cards in the same row have different heights.

**Solutions:**
- Add `height="100%"` to the Card component
- Ensure parent container has `alignItems="stretch"`
- Check that inner content doesn't have fixed heights

### Issue 3: Layout Breaks on Mobile

**Problem:** 3-column layout appears on mobile devices.

**Solutions:**
- Verify `Platform.OS === 'web'` check is working correctly
- Ensure mobile branch uses `YStack` with `space` prop
- Check that mobile code path is not accidentally using web layout

### Issue 4: Cards Overflow Container

**Problem:** Cards extend beyond the container width.

**Solutions:**
- Reduce `maxWidth` percentage (e.g., from `32%` to `31%`)
- Add `padding` to parent container to account for spacing
- Check that `gap` and `space` props aren't causing overflow

### Issue 5: Content Too Narrow in Columns

**Problem:** Text and content appear cramped in 3-column layout.

**Solutions:**
- Adjust font sizes for web if needed
- Consider reducing padding on cards for web
- Ensure `minWidth` constraints allow enough space
- Consider using 2 columns on medium screens

---

## Phase 8: Code Location Reference

### Files to Modify

1. **`app/predictions.tsx`**
   - Modify predictions rendering section (around lines 1448-1624)
   - Add platform check for web vs mobile layout
   - Update container from `YStack` to conditional `XStack`/`YStack`

### Key Code Sections

**Location:** Lines 1448-1624 (predictions rendering within prop type sections)

**Changes Required:**
- Replace `YStack` container with conditional rendering
- Add `Platform.OS === 'web'` check
- Use `XStack` with `flexWrap` for web layout
- Keep `YStack` for mobile layout

---

## Phase 9: Implementation Summary

### Required Changes

1. ✅ Add platform check using `Platform.OS === 'web'`
2. ✅ Replace single `YStack` with conditional rendering
3. ✅ Use `XStack` with `flexWrap="wrap"` for web
4. ✅ Set column widths using `minWidth`/`maxWidth` or `width` props
5. ✅ Add `height="100%"` to cards for equal heights
6. ✅ Keep mobile layout unchanged (single column)

### Optional Enhancements

- [ ] Add responsive breakpoints (2 columns on tablet)
- [ ] Adjust font sizes for narrower columns
- [ ] Add smooth transitions when switching layouts
- [ ] Optimize card padding for web layout
- [ ] Add hover effects for web cards

---

## Notes

- The implementation maintains all existing functionality (filtering, sorting, grouping)
- Mobile experience remains unchanged (single column)
- Cards automatically wrap to new rows when needed
- Equal height cards ensure clean alignment
- The layout adapts to different screen sizes automatically (if using flex-based approach)
- Consider testing with various prediction counts to ensure layout stability

---

## Summary

This implementation adds a 3-column grid layout for predictions on web while maintaining the single-column layout on mobile. The key changes are:

1. **Platform Detection**: Using `Platform.OS === 'web'` to differentiate web and mobile
2. **Conditional Layout**: Rendering `XStack` with flex wrap for web, `YStack` for mobile
3. **Column Sizing**: Using `minWidth`/`maxWidth` or percentage widths to create 3 columns
4. **Equal Heights**: Adding `height="100%"` to cards for consistent row heights
5. **Responsive Design**: Layout automatically adapts to content and screen size

The result is a more efficient use of screen space on web while preserving the mobile-friendly single-column experience.

