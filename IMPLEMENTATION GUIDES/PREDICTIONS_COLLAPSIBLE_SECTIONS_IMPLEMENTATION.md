# Predictions Collapsible Sections Implementation Guide

This guide provides step-by-step instructions for making prop type sections collapsible. When users click on a prop type header, the section will expand or collapse to show or hide the predictions underneath. This improves navigation and allows users to focus on specific prop types.

## Overview

**Current State:**
- Predictions are organized by prop type with section headings
- All sections are always expanded
- Users must scroll through all predictions to find specific prop types
- No way to collapse sections to reduce visual clutter

**Target State:**
- Prop type headers are clickable
- Sections can be collapsed/expanded by clicking the header
- Visual indicator (icon) shows collapsed/expanded state
- Smooth transitions when expanding/collapsing
- Option to collapse/expand all sections at once
- Remember collapsed state during session (optional)

---

## Phase 1: Understanding the Current Structure

### Step 1.1: Current Section Structure

The current implementation has prop type sections structured as:

```typescript
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
          // ... prediction cards ...
        })}
      </YStack>
    </YStack>
  );
})}
```

### Step 1.2: Required Changes

To make sections collapsible, we need to:
1. Add state to track which sections are collapsed
2. Make the header clickable
3. Add visual indicator (chevron/arrow icon)
4. Conditionally render predictions based on collapsed state
5. Add smooth animations (optional but recommended)

---

## Phase 2: State Management

### Step 2.1: Add Collapsed State

Add state to track which prop type sections are collapsed. Use a `Set` to efficiently track multiple collapsed sections:

```typescript
export default function PredictionsPage() {
  // ... existing state ...
  
  // Track collapsed prop type sections
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  
  // ... rest of component ...
}
```

**Why use a Set?**
- Efficient lookups: `O(1)` to check if a section is collapsed
- Easy to add/remove sections: `set.add()` and `set.delete()`
- Clean API for checking state: `collapsedSections.has(propType)`

### Step 2.2: Toggle Function

Create a function to toggle a section's collapsed state:

```typescript
/**
 * Toggle collapsed state for a prop type section
 * @param propType - The prop type to toggle (e.g., "points", "assists")
 */
const toggleSection = useCallback((propType: string) => {
  setCollapsedSections((prev) => {
    const newSet = new Set(prev);
    if (newSet.has(propType)) {
      newSet.delete(propType); // Expand (remove from collapsed set)
    } else {
      newSet.add(propType); // Collapse (add to collapsed set)
    }
    return newSet;
  });
}, []);
```

### Step 2.3: Collapse/Expand All Function (Optional)

Add functions to collapse or expand all sections at once:

```typescript
/**
 * Collapse all prop type sections
 */
const collapseAll = useCallback(() => {
  setCollapsedSections(new Set(propTypesInOrder));
}, [propTypesInOrder]);

/**
 * Expand all prop type sections
 */
const expandAll = useCallback(() => {
  setCollapsedSections(new Set());
}, []);
```

---

## Phase 3: UI Implementation

### Step 3.1: Make Header Clickable

Wrap the header Card in a `Pressable` component to make it clickable:

```typescript
{propTypesInOrder.map((propType) => {
  const predictionsForType = groupedPredictions[propType];
  const displayName = getPropTypeDisplayName(propType);
  const isCollapsed = collapsedSections.has(propType);
  
  return (
    <YStack key={propType} space="$3">
      {/* Prop Type Heading - Clickable */}
      <Pressable onPress={() => toggleSection(propType)}>
        <Card 
          padding="$3" 
          backgroundColor="$backgroundStrong" 
          borderWidth={1} 
          borderColor="$borderColor"
          hoverStyle={{ backgroundColor: "$backgroundHover" }} // Optional: web hover effect
        >
          <XStack justifyContent="space-between" alignItems="center">
            <XStack alignItems="center" space="$2" flex={1}>
              {/* Collapse/Expand Icon */}
              <Text fontSize="$4" color="$color10">
                {isCollapsed ? '▶' : '▼'}
              </Text>
              <Text fontSize="$6" fontWeight="bold" color="$color">
                {displayName}
              </Text>
            </XStack>
            <Card padding="$2" backgroundColor="$blue2" borderRadius="$2">
              <Text fontSize="$4" fontWeight="600" color="$color">
                {predictionsForType.length}
              </Text>
            </Card>
          </XStack>
        </Card>
      </Pressable>

      {/* Predictions for this prop type - Conditionally rendered */}
      {!isCollapsed && (
        <YStack space="$3">
          {predictionsForType.map((pred) => {
            // ... existing prediction card rendering ...
          })}
        </YStack>
      )}
    </YStack>
  );
})}
```

### Step 3.2: Alternative Icon Options

Instead of simple text characters, you can use more sophisticated icons:

**Option 1: Unicode Characters**
```typescript
{isCollapsed ? '▶' : '▼'}  // Simple arrow
{isCollapsed ? '▷' : '▽'}  // Alternative style
{isCollapsed ? '◀' : '▼'}  // Left-pointing when collapsed
```

**Option 2: Tamagui Icons (if available)**
```typescript
import { ChevronDown, ChevronRight } from '@tamagui/lucide-icons';

// In render:
{isCollapsed ? (
  <ChevronRight size={20} color="$color10" />
) : (
  <ChevronDown size={20} color="$color10" />
)}
```

**Option 3: Custom SVG Icons**
```typescript
const ChevronIcon = ({ isCollapsed }: { isCollapsed: boolean }) => (
  <Svg width={16} height={16} viewBox="0 0 16 16">
    <Path
      d={isCollapsed ? "M6 4l4 4-4 4" : "M4 6l4 4 4-4"}
      stroke="currentColor"
      strokeWidth={2}
      fill="none"
    />
  </Svg>
);
```

### Step 3.3: Enhanced Header Styling

Improve the visual feedback when hovering/clicking:

```typescript
<Pressable onPress={() => toggleSection(propType)}>
  {({ pressed }) => (
    <Card 
      padding="$3" 
      backgroundColor={pressed ? "$backgroundHover" : "$backgroundStrong"}
      borderWidth={1} 
      borderColor="$borderColor"
      opacity={pressed ? 0.8 : 1}
      animation="quick"
    >
      <XStack justifyContent="space-between" alignItems="center">
        <XStack alignItems="center" space="$2" flex={1}>
          <Text 
            fontSize="$4" 
            color="$color10"
            animation="quick"
            transform={isCollapsed ? [{ rotate: '0deg' }] : [{ rotate: '90deg' }]}
          >
            ▶
          </Text>
          <Text fontSize="$6" fontWeight="bold" color="$color">
            {displayName}
          </Text>
        </XStack>
        <Card padding="$2" backgroundColor="$blue2" borderRadius="$2">
          <Text fontSize="$4" fontWeight="600" color="$color">
            {predictionsForType.length}
          </Text>
        </Card>
      </XStack>
    </Card>
  )}
</Pressable>
```

---

## Phase 4: Animation (Optional but Recommended)

### Step 4.1: Using Tamagui Animations

Tamagui supports built-in animations. Use the `AnimatePresence` pattern for smooth expand/collapse:

```typescript
import { AnimatePresence } from 'tamagui';

// In render:
<AnimatePresence>
  {!isCollapsed && (
    <YStack
      space="$3"
      animation="quick"
      enterStyle={{ opacity: 0, height: 0 }}
      exitStyle={{ opacity: 0, height: 0 }}
      opacity={1}
      height="auto"
    >
      {predictionsForType.map((pred) => {
        // ... prediction cards ...
      })}
    </YStack>
  )}
</AnimatePresence>
```

### Step 4.2: Simple Fade Animation

For a simpler approach, use opacity animation:

```typescript
<YStack
  space="$3"
  opacity={isCollapsed ? 0 : 1}
  height={isCollapsed ? 0 : 'auto'}
  overflow="hidden"
  animation="quick"
>
  {predictionsForType.map((pred) => {
    // ... prediction cards ...
  })}
</YStack>
```

**Note:** The `height: 'auto'` animation may not work smoothly on all platforms. Consider using a fixed height or omitting height animation for better performance.

### Step 4.3: React Native Animated API (Advanced)

For more control, use React Native's Animated API:

```typescript
import { Animated } from 'react-native';
import { useRef, useEffect } from 'react';

// In component:
const sectionAnimations = useRef<Record<string, Animated.Value>>({});

// Initialize animation value for each section
useEffect(() => {
  propTypesInOrder.forEach((propType) => {
    if (!sectionAnimations.current[propType]) {
      sectionAnimations.current[propType] = new Animated.Value(1); // 1 = expanded, 0 = collapsed
    }
  });
}, [propTypesInOrder]);

// Update animation when collapsed state changes
useEffect(() => {
  propTypesInOrder.forEach((propType) => {
    const isCollapsed = collapsedSections.has(propType);
    Animated.timing(sectionAnimations.current[propType], {
      toValue: isCollapsed ? 0 : 1,
      duration: 300,
      useNativeDriver: false, // Height animations require layout driver
    }).start();
  });
}, [collapsedSections, propTypesInOrder]);
```

---

## Phase 5: Collapse/Expand All Controls

### Step 5.1: Add Control Buttons

Add buttons above the predictions list to collapse/expand all:

```typescript
{!loading && sortedPredictions.length > 0 && (
  <YStack space="$4">
    <XStack justifyContent="space-between" alignItems="center">
      <Text fontSize="$6" fontWeight="600" color="$color">
        {sortedPredictions.length} Prediction{sortedPredictions.length !== 1 ? 's' : ''}
      </Text>
      <XStack space="$2">
        <Button
          size="$3"
          onPress={expandAll}
          backgroundColor="$blue9"
          color="white"
        >
          Expand All
        </Button>
        <Button
          size="$3"
          onPress={collapseAll}
          backgroundColor="$gray5"
          color="white"
        >
          Collapse All
        </Button>
      </XStack>
    </XStack>

    {/* Prop type sections */}
    {propTypesInOrder.map((propType) => {
      // ... section rendering ...
    })}
  </YStack>
)}
```

### Step 5.2: Smart Toggle Button

Instead of separate buttons, use a single toggle button:

```typescript
const allCollapsed = propTypesInOrder.length > 0 && 
                     propTypesInOrder.every(propType => collapsedSections.has(propType));

<Button
  size="$3"
  onPress={allCollapsed ? expandAll : collapseAll}
  backgroundColor={allCollapsed ? "$blue9" : "$gray5"}
  color="white"
>
  {allCollapsed ? 'Expand All' : 'Collapse All'}
</Button>
```

---

## Phase 6: Persistence (Optional)

### Step 6.1: Remember Collapsed State

Save collapsed state to localStorage (web) or AsyncStorage (mobile) to persist across page refreshes:

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

const COLLAPSED_SECTIONS_KEY = '@predictions:collapsedSections';

// Load collapsed sections on mount
useEffect(() => {
  const loadCollapsedSections = async () => {
    try {
      const stored = await AsyncStorage.getItem(COLLAPSED_SECTIONS_KEY);
      if (stored) {
        setCollapsedSections(new Set(JSON.parse(stored)));
      }
    } catch (error) {
      console.warn('Failed to load collapsed sections:', error);
    }
  };
  loadCollapsedSections();
}, []);

// Save collapsed sections when they change
useEffect(() => {
  const saveCollapsedSections = async () => {
    try {
      await AsyncStorage.setItem(
        COLLAPSED_SECTIONS_KEY,
        JSON.stringify(Array.from(collapsedSections))
      );
    } catch (error) {
      console.warn('Failed to save collapsed sections:', error);
    }
  };
  saveCollapsedSections();
}, [collapsedSections]);
```

### Step 6.2: Web-Only Persistence

For web-only, use localStorage:

```typescript
const COLLAPSED_SECTIONS_KEY = 'predictions:collapsedSections';

// Load on mount
useEffect(() => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(COLLAPSED_SECTIONS_KEY);
      if (stored) {
        setCollapsedSections(new Set(JSON.parse(stored)));
      }
    } catch (error) {
      console.warn('Failed to load collapsed sections:', error);
    }
  }
}, []);

// Save on change
useEffect(() => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      localStorage.setItem(
        COLLAPSED_SECTIONS_KEY,
        JSON.stringify(Array.from(collapsedSections))
      );
    } catch (error) {
      console.warn('Failed to save collapsed sections:', error);
    }
  }
}, [collapsedSections]);
```

---

## Phase 7: Default Collapsed State

### Step 7.1: Collapse All by Default

If you want all sections collapsed by default:

```typescript
// Initialize with all sections collapsed
const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() => {
  // This will be set after propTypesInOrder is available
  return new Set();
});

// Collapse all when predictions first load
useEffect(() => {
  if (propTypesInOrder.length > 0 && collapsedSections.size === 0) {
    setCollapsedSections(new Set(propTypesInOrder));
  }
}, [propTypesInOrder]);
```

### Step 7.2: Collapse Specific Sections by Default

Collapse only certain prop types by default:

```typescript
const DEFAULT_COLLAPSED = new Set(['steals', 'blocks']); // Collapse less common props

const [collapsedSections, setCollapsedSections] = useState<Set<string>>(DEFAULT_COLLAPSED);
```

---

## Phase 8: Complete Implementation Example

### Step 8.1: Full Component Code

Here's a complete example combining all features:

```typescript
export default function PredictionsPage() {
  // ... existing state ...
  
  // Collapsed sections state
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  
  // Toggle section
  const toggleSection = useCallback((propType: string) => {
    setCollapsedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(propType)) {
        newSet.delete(propType);
      } else {
        newSet.add(propType);
      }
      return newSet;
    });
  }, []);
  
  // Collapse/Expand all
  const collapseAll = useCallback(() => {
    setCollapsedSections(new Set(propTypesInOrder));
  }, [propTypesInOrder]);
  
  const expandAll = useCallback(() => {
    setCollapsedSections(new Set());
  }, []);
  
  // Check if all are collapsed
  const allCollapsed = propTypesInOrder.length > 0 && 
                       propTypesInOrder.every(propType => collapsedSections.has(propType));
  
  // ... existing code ...
  
  return (
    <>
      {/* ... existing JSX ... */}
      
      {!loading && sortedPredictions.length > 0 && (
        <YStack space="$4">
          <XStack justifyContent="space-between" alignItems="center" flexWrap="wrap">
            <Text fontSize="$6" fontWeight="600" color="$color">
              {sortedPredictions.length} Prediction{sortedPredictions.length !== 1 ? 's' : ''}
            </Text>
            <Button
              size="$3"
              onPress={allCollapsed ? expandAll : collapseAll}
              backgroundColor={allCollapsed ? "$blue9" : "$gray5"}
              color="white"
            >
              {allCollapsed ? 'Expand All' : 'Collapse All'}
            </Button>
          </XStack>

          {propTypesInOrder.map((propType) => {
            const predictionsForType = groupedPredictions[propType];
            const displayName = getPropTypeDisplayName(propType);
            const isCollapsed = collapsedSections.has(propType);
            
            return (
              <YStack key={propType} space="$3">
                {/* Clickable Header */}
                <Pressable onPress={() => toggleSection(propType)}>
                  <Card 
                    padding="$3" 
                    backgroundColor="$backgroundStrong" 
                    borderWidth={1} 
                    borderColor="$borderColor"
                  >
                    <XStack justifyContent="space-between" alignItems="center">
                      <XStack alignItems="center" space="$2" flex={1}>
                        <Text fontSize="$4" color="$color10">
                          {isCollapsed ? '▶' : '▼'}
                        </Text>
                        <Text fontSize="$6" fontWeight="bold" color="$color">
                          {displayName}
                        </Text>
                      </XStack>
                      <Card padding="$2" backgroundColor="$blue2" borderRadius="$2">
                        <Text fontSize="$4" fontWeight="600" color="$color">
                          {predictionsForType.length}
                        </Text>
                      </Card>
                    </XStack>
                  </Card>
                </Pressable>

                {/* Predictions - Conditionally rendered */}
                {!isCollapsed && (
                  <YStack space="$3">
                    {predictionsForType.map((pred) => {
                      // ... existing prediction card code ...
                    })}
                  </YStack>
                )}
              </YStack>
            );
          })}
        </YStack>
      )}
    </>
  );
}
```

---

## Phase 9: Testing Checklist

### Step 9.1: Functional Testing

- [ ] Clicking a header toggles the section's collapsed state
- [ ] Collapsed sections hide their predictions
- [ ] Expanded sections show their predictions
- [ ] Icon changes correctly (▶ when collapsed, ▼ when expanded)
- [ ] "Collapse All" button collapses all sections
- [ ] "Expand All" button expands all sections
- [ ] Toggle button text changes based on state
- [ ] Multiple sections can be collapsed independently
- [ ] Filtering still works correctly with collapsed sections
- [ ] Sorting still works correctly with collapsed sections

### Step 9.2: Edge Cases

- [ ] Works when only one prop type has predictions
- [ ] Works when all prop types have predictions
- [ ] Works when prop type filter is active (only one section visible)
- [ ] Works when no predictions exist
- [ ] State persists correctly if persistence is implemented
- [ ] No errors when rapidly clicking headers

### Step 9.3: UI/UX Testing

- [ ] Headers are clearly clickable (visual feedback on hover/press)
- [ ] Icons are visible and correctly positioned
- [ ] Animations are smooth (if implemented)
- [ ] Layout doesn't shift when sections collapse/expand
- [ ] Works on mobile (touch targets are adequate)
- [ ] Works on web (hover states work correctly)
- [ ] Accessibility: Screen readers can identify clickable headers

---

## Phase 10: Accessibility Considerations

### Step 10.1: ARIA Attributes

Add ARIA attributes for screen readers:

```typescript
<Pressable 
  onPress={() => toggleSection(propType)}
  accessibilityRole="button"
  accessibilityLabel={`${isCollapsed ? 'Expand' : 'Collapse'} ${displayName} section`}
  accessibilityState={{ expanded: !isCollapsed }}
>
  <Card>
    {/* ... header content ... */}
  </Card>
</Pressable>
```

### Step 10.2: Keyboard Navigation

Ensure keyboard navigation works:

```typescript
<Pressable 
  onPress={() => toggleSection(propType)}
  onKeyPress={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleSection(propType);
    }
  }}
>
  {/* ... */}
</Pressable>
```

---

## Phase 11: Performance Considerations

### Step 11.1: Memoization

Memoize the toggle function and section rendering:

```typescript
// Memoize toggle function
const toggleSection = useCallback((propType: string) => {
  setCollapsedSections((prev) => {
    const newSet = new Set(prev);
    if (newSet.has(propType)) {
      newSet.delete(propType);
    } else {
      newSet.add(propType);
    }
    return newSet;
  });
}, []);

// Memoize section component (optional, for complex sections)
const PropTypeSection = React.memo(({ propType, predictions, isCollapsed, onToggle }) => {
  // ... section rendering ...
});
```

### Step 11.2: Conditional Rendering vs Visibility

**Option 1: Conditional Rendering (Current)**
- Pros: Doesn't render DOM elements when collapsed (better performance)
- Cons: Loses scroll position, may cause layout shifts

**Option 2: Visibility (CSS/Opacity)**
- Pros: Maintains scroll position, smoother transitions
- Cons: Still renders DOM elements (slightly worse performance)

Choose based on your needs. For most cases, conditional rendering is fine.

---

## Phase 12: Code Location Reference

### Files to Modify

1. **`app/predictions.tsx`**
   - Add `collapsedSections` state (after existing state declarations, around line 270)
   - Add `toggleSection`, `collapseAll`, `expandAll` functions (after state, around line 570)
   - Update render section (modify lines 1316-1337 to make headers clickable)
   - Add collapse/expand all button (around line 1312, in the header area)

### Key Code Sections

**State Location:** After line 270 (with other useState declarations)

**Toggle Functions Location:** After line 570 (after useMemo hooks)

**Render Location:** Modify lines 1316-1337 (prop type section rendering)

---

## Phase 13: Implementation Summary

### Required Changes

1. ✅ Add `collapsedSections` state (Set<string>)
2. ✅ Add `toggleSection` function
3. ✅ Make header Card clickable (wrap in Pressable)
4. ✅ Add collapse/expand icon indicator
5. ✅ Conditionally render predictions based on `isCollapsed`
6. ✅ Add "Collapse All" / "Expand All" button (optional but recommended)

### Optional Enhancements

- [ ] Smooth animations
- [ ] Persist collapsed state (localStorage/AsyncStorage)
- [ ] Default collapsed state
- [ ] Enhanced hover/press styling
- [ ] Accessibility improvements
- [ ] Keyboard navigation support

---

## Notes

- Using a `Set` for collapsed sections provides efficient lookups
- Conditional rendering is simpler than animations but may cause layout shifts
- Consider user preferences: some may want all expanded by default
- Mobile users may benefit from larger touch targets
- Persistence is optional but improves UX if users frequently collapse the same sections
- The implementation maintains all existing functionality (filtering, sorting, etc.)

---

## Summary

This implementation adds collapsible functionality to prop type sections by:

1. **Tracking State**: Using a Set to efficiently track which sections are collapsed
2. **Toggle Function**: Simple function to add/remove sections from the collapsed set
3. **Clickable Headers**: Wrapping headers in Pressable components
4. **Visual Indicators**: Icons showing collapsed/expanded state
5. **Conditional Rendering**: Only rendering predictions when section is expanded
6. **Bulk Controls**: Optional buttons to collapse/expand all sections at once

The result is a more navigable predictions view where users can focus on specific prop types by collapsing others, reducing visual clutter and improving the overall user experience.

