## Scan Results Table Rows Thinner Implementation

This guide describes how to make the scan results table rows (ArbCard components) slightly thinner on both mobile and web versions by reducing padding, spacing, and font sizes throughout the card layout.

---

## 1. Goals

- **Reduce vertical space** in each scan result card/row
- **Maintain readability** while making the layout more compact
- **Apply consistently** across both mobile and web versions
- **Preserve visual hierarchy** and information clarity

**Key idea:** Reduce padding, margins, spacing, and font sizes proportionally to create a more compact card layout without losing functionality or readability.

---

## 2. Current Structure

### 2.1. Card Component Structure

The `ArbCard` component in `app/scan.tsx` currently uses:

- **Card padding:** `$4` (line 365)
- **Main YStack spacing:** `$3` (line 368)
- **Separator margins:** `marginVertical="$2"` (line 404)
- **Prop section spacing:** `space="$2"` (line 406)
- **OVER/UNDER section spacing:** `space="$4"` (line 413)
- **OVER/UNDER card padding:** `$3` (lines 414, 429)

### 2.2. Font Sizes

Current font sizes in the card:

- **Player name:** `fontSize="$6"` (line 371)
- **Game label:** `fontSize="$4"` (line 374)
- **Game time/status:** `fontSize="$2"` (lines 378, 383)
- **Edge value:** `fontSize="$6"` (line 389)
- **Edge label:** `fontSize="$2"` (line 392)
- **Profit value:** `fontSize="$4"` (line 395)
- **Profit label:** `fontSize="$2"` (line 398)
- **Prop type:** `fontSize="$4"` (line 408)
- **Odds values:** `fontSize="$5"` (lines 418, 433)
- **Bet amounts:** `fontSize="$3"` (lines 421, 436)
- **Vendor names:** `fontSize="$2"` (lines 415, 424, 430, 439)

### 2.3. List Spacing

- **Mobile list spacing:** `space="$4"` (line 886)
- **Web list spacing:** `space="$4"` (line 897)
- **Web card margin bottom:** `marginBottom="$4"` (line 899)

---

## 3. Implementation Steps

### 3.1. Reduce Card Padding

**Location:** `app/scan.tsx`, line 365

**Current:**
```typescript
<Card 
  elevate 
  padding="$4" 
  backgroundColor="$backgroundStrong"
>
```

**Change to:**
```typescript
<Card 
  elevate 
  padding="$3" 
  backgroundColor="$backgroundStrong"
>
```

**Impact:** Reduces outer padding from `$4` to `$3`, making the card more compact.

---

### 3.2. Reduce Main Content Spacing

**Location:** `app/scan.tsx`, line 368

**Current:**
```typescript
<YStack space="$3">
```

**Change to:**
```typescript
<YStack space="$2">
```

**Impact:** Reduces vertical spacing between main sections (header, separator, prop details).

---

### 3.3. Reduce Text Margins

**Location:** `app/scan.tsx`, lines 374, 378, 395

**Current:**
```typescript
<Text fontSize="$4" color="$colorPress" marginTop="$1">
  {arb.gameLabel}
</Text>
{arb.gameTime && (
  <Text fontSize="$2" color="$colorPress" marginTop="$1">
    {arb.gameTime}
  </Text>
)}
// ...
<Text fontSize="$4" fontWeight="600" color="$green10" marginTop="$1">
  {arb.profit}
</Text>
```

**Change to:**
```typescript
<Text fontSize="$4" color="$colorPress" marginTop="$0.5">
  {arb.gameLabel}
</Text>
{arb.gameTime && (
  <Text fontSize="$2" color="$colorPress" marginTop="$0.5">
    {arb.gameTime}
  </Text>
)}
// ...
<Text fontSize="$4" fontWeight="600" color="$green10" marginTop="$0.5">
  {arb.profit}
</Text>
```

**Impact:** Reduces spacing between text elements in the header section.

---

### 3.4. Reduce Separator Margins

**Location:** `app/scan.tsx`, line 404

**Current:**
```typescript
<Separator marginVertical="$2" />
```

**Change to:**
```typescript
<Separator marginVertical="$1.5" />
```

**Impact:** Reduces space above and below the separator line.

---

### 3.5. Reduce Prop Section Spacing

**Location:** `app/scan.tsx`, line 406

**Current:**
```typescript
<YStack space="$2">
```

**Change to:**
```typescript
<YStack space="$1.5">
```

**Impact:** Reduces spacing between prop type and OVER/UNDER sections.

---

### 3.6. Reduce OVER/UNDER Section Spacing

**Location:** `app/scan.tsx`, line 413

**Current:**
```typescript
<XStack justifyContent="space-between" space="$4">
```

**Change to:**
```typescript
<XStack justifyContent="space-between" space="$3">
```

**Impact:** Reduces horizontal spacing between OVER and UNDER cards.

---

### 3.7. Reduce OVER/UNDER Card Padding

**Location:** `app/scan.tsx`, lines 414, 429

**Current:**
```typescript
<YStack flex={1} padding="$3" backgroundColor="$green2" borderRadius="$2">
  <Text fontSize="$2" color="$green11" marginBottom="$1">
    OVER
  </Text>
  // ...
</YStack>
// ...
<YStack flex={1} padding="$3" backgroundColor="$red2" borderRadius="$2">
  <Text fontSize="$2" color="$red11" marginBottom="$1">
    UNDER
  </Text>
  // ...
</YStack>
```

**Change to:**
```typescript
<YStack flex={1} padding="$2.5" backgroundColor="$green2" borderRadius="$2">
  <Text fontSize="$2" color="$green11" marginBottom="$0.5">
    OVER
  </Text>
  // ...
</YStack>
// ...
<YStack flex={1} padding="$2.5" backgroundColor="$red2" borderRadius="$2">
  <Text fontSize="$2" color="$red11" marginBottom="$0.5">
    UNDER
  </Text>
  // ...
</YStack>
```

**Impact:** Reduces padding inside OVER/UNDER cards and spacing below labels.

---

### 3.8. Reduce Odds Section Text Margins

**Location:** `app/scan.tsx`, lines 421, 436

**Current:**
```typescript
<Text fontSize="$3" fontWeight="600" color="$green11" marginTop="$1">
  {formatProfit(arb.betAmounts.over)}
</Text>
<Text fontSize="$2" color="$green11" marginTop="$1">
  {arb.over.vendor}
</Text>
// ...
<Text fontSize="$3" fontWeight="600" color="$red11" marginTop="$1">
  {formatProfit(arb.betAmounts.under)}
</Text>
<Text fontSize="$2" color="$red11" marginTop="$1">
  {arb.under.vendor}
</Text>
```

**Change to:**
```typescript
<Text fontSize="$3" fontWeight="600" color="$green11" marginTop="$0.5">
  {formatProfit(arb.betAmounts.over)}
</Text>
<Text fontSize="$2" color="$green11" marginTop="$0.5">
  {arb.over.vendor}
</Text>
// ...
<Text fontSize="$3" fontWeight="600" color="$red11" marginTop="$0.5">
  {formatProfit(arb.betAmounts.under)}
</Text>
<Text fontSize="$2" color="$red11" marginTop="$0.5">
  {arb.under.vendor}
</Text>
```

**Impact:** Reduces vertical spacing between odds, bet amounts, and vendor names.

---

### 3.9. Reduce Font Sizes (Optional - Subtle Reduction)

**Location:** `app/scan.tsx`, lines 371, 389, 408, 418, 433

**Current:**
```typescript
<Text fontSize="$6" fontWeight="bold" color="$color">
  {arb.playerName}
</Text>
// ...
<Text fontSize="$6" fontWeight="bold" color="$green10">
  {arb.edge}
</Text>
// ...
<Text fontSize="$4" fontWeight="600" color="$color">
  {arb.propTypeDisplay} {arb.lineValue}
</Text>
// ...
<Text fontSize="$5" fontWeight="bold" color="$green11">
  {formatOdds(arb.over.odds, useDecimalOdds)}
</Text>
// ...
<Text fontSize="$5" fontWeight="bold" color="$red11">
  {formatOdds(arb.under.odds, useDecimalOdds)}
</Text>
```

**Change to:**
```typescript
<Text fontSize="$5" fontWeight="bold" color="$color">
  {arb.playerName}
</Text>
// ...
<Text fontSize="$5" fontWeight="bold" color="$green10">
  {arb.edge}
</Text>
// ...
<Text fontSize="$3.5" fontWeight="600" color="$color">
  {arb.propTypeDisplay} {arb.lineValue}
</Text>
// ...
<Text fontSize="$4" fontWeight="bold" color="$green11">
  {formatOdds(arb.over.odds, useDecimalOdds)}
</Text>
// ...
<Text fontSize="$4" fontWeight="bold" color="$red11">
  {formatOdds(arb.under.odds, useDecimalOdds)}
</Text>
```

**Impact:** Slightly reduces font sizes for key elements. Note: Tamagui may not support `$3.5`, so use `$3` or `$4` instead.

**Alternative (if `$3.5` is not supported):**
```typescript
<Text fontSize="$3" fontWeight="600" color="$color">
  {arb.propTypeDisplay} {arb.lineValue}
</Text>
```

---

### 3.10. Reduce List Spacing (Mobile)

**Location:** `app/scan.tsx`, line 886

**Current:**
```typescript
<YStack space="$4">
```

**Change to:**
```typescript
<YStack space="$3">
```

**Impact:** Reduces vertical spacing between cards in mobile view.

---

### 3.11. Reduce List Spacing (Web)

**Location:** `app/scan.tsx`, line 897

**Current:**
```typescript
<XStack flexWrap="wrap" space="$4">
```

**Change to:**
```typescript
<XStack flexWrap="wrap" space="$3">
```

**Impact:** Reduces horizontal spacing between cards in web view.

---

### 3.12. Reduce Web Card Margin Bottom

**Location:** `app/scan.tsx`, line 899

**Current:**
```typescript
<YStack key={processed.key} flex={1} minWidth="48%" maxWidth="48%" marginBottom={Platform.OS === 'web' ? "$4" : undefined}>
```

**Change to:**
```typescript
<YStack key={processed.key} flex={1} minWidth="48%" maxWidth="48%" marginBottom={Platform.OS === 'web' ? "$3" : undefined}>
```

**Impact:** Reduces bottom margin for cards in web view.

---

## 4. Summary of Changes

### 4.1. Padding Reductions

| Element | Current | New | Location |
|---------|---------|-----|----------|
| Card padding | `$4` | `$3` | Line 365 |
| OVER/UNDER card padding | `$3` | `$2.5` | Lines 414, 429 |

### 4.2. Spacing Reductions

| Element | Current | New | Location |
|---------|---------|-----|----------|
| Main YStack space | `$3` | `$2` | Line 368 |
| Prop section space | `$2` | `$1.5` | Line 406 |
| OVER/UNDER section space | `$4` | `$3` | Line 413 |
| Mobile list space | `$4` | `$3` | Line 886 |
| Web list space | `$4` | `$3` | Line 897 |
| Web card margin bottom | `$4` | `$3` | Line 899 |

### 4.3. Margin Reductions

| Element | Current | New | Location |
|---------|---------|-----|----------|
| Separator margin vertical | `$2` | `$1.5` | Line 404 |
| Text marginTop (multiple) | `$1` | `$0.5` | Lines 374, 378, 395, 421, 436 |
| OVER/UNDER label marginBottom | `$1` | `$0.5` | Lines 415, 430 |

### 4.4. Font Size Reductions (Optional)

| Element | Current | New | Location |
|---------|---------|-----|----------|
| Player name | `$6` | `$5` | Line 371 |
| Edge value | `$6` | `$5` | Line 389 |
| Prop type | `$4` | `$3` or `$3.5` | Line 408 |
| Odds values | `$5` | `$4` | Lines 418, 433 |

---

## 5. Testing Recommendations

After implementing these changes, test the following:

### 5.1. Visual Testing

- **Mobile view:** Verify cards are more compact but still readable
- **Web view:** Verify two-column layout maintains proper spacing
- **Text readability:** Ensure all text remains legible with reduced sizes
- **Touch targets:** On mobile, ensure interactive elements are still easily tappable

### 5.2. Responsive Testing

- **Small screens (< 700px):** Verify mobile layout works correctly
- **Medium screens (700px - 1200px):** Verify web layout spacing
- **Large screens (> 1200px):** Verify cards don't become too spread out

### 5.3. Content Testing

- **Long player names:** Ensure they don't overflow with reduced padding
- **Long game labels:** Verify text wrapping works correctly
- **Multiple arbs:** Verify list scrolling and spacing between items

---

## 6. Implementation Notes

### 6.1. Tamagui Token Values

Tamagui spacing tokens typically follow this scale:
- `$0.5` = 2px
- `$1` = 4px
- `$1.5` = 6px
- `$2` = 8px
- `$2.5` = 10px
- `$3` = 12px
- `$4` = 16px
- `$5` = 20px
- `$6` = 24px

Verify these values in your `tamagui.config.ts` if custom spacing is defined.

### 6.2. Font Size Considerations

If `$3.5` is not available in your Tamagui configuration, use `$3` or `$4` instead. The goal is a subtle reduction, not a dramatic change.

### 6.3. Gradual Implementation

Consider implementing changes in phases:

1. **Phase 1:** Reduce padding and spacing (sections 3.1-3.8, 3.10-3.12)
2. **Phase 2:** Reduce margins (section 3.3, 3.7, 3.8)
3. **Phase 3:** Optionally reduce font sizes (section 3.9)

This allows you to test each phase and adjust as needed.

---

## 7. Expected Results

After implementing all changes:

- **Card height reduction:** Approximately 15-25% reduction in card height
- **More items visible:** More scan results visible without scrolling
- **Maintained readability:** All text and information remains clear and accessible
- **Consistent appearance:** Both mobile and web versions have proportional reductions

---

## 8. Rollback Plan

If the changes make the cards too compact or reduce readability:

1. **Partial rollback:** Keep padding/spacing reductions but revert font size changes
2. **Gradual adjustment:** Increase values slightly (e.g., `$2` → `$2.5`, `$3` → `$3.5`)
3. **Full rollback:** Revert all changes to original values

All changes are straightforward to revert by restoring the original values listed in section 2.

