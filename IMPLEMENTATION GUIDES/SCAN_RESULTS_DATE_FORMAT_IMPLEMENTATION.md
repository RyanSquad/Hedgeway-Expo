## Scan Results Date Format Implementation

This guide describes how to change the date format displayed in the Scan Results table to the format "MMM DD @ HH:MM EST" (e.g., "Jan 15 @ 08:00 EST").

---

## 1. Goals

- **Update date format** in Scan Results table to "MMM DD @ HH:MM EST"
- **Maintain consistency** across all date displays in scan results
- **Preserve timezone information** (EST) in the formatted output
- **Handle edge cases** gracefully (invalid dates, missing timestamps)

**Key idea:** Modify the `formatDate` and `formatGameTime` functions in `app/scan.tsx` to produce the desired format instead of the current locale-based format.

---

## 2. Current Structure

### 2.1. Date Formatting Functions

The scan results use two main date formatting functions in `app/scan.tsx`:

1. **`formatDate` function** (lines 126-139)
   - Formats date strings for display in the ArbCard component
   - Currently uses `toLocaleString` with locale options
   - Produces format like: "Jan 15, 8:00 PM" (varies by locale)

2. **`formatGameTime` function** (lines 141-155)
   - Formats timestamp numbers for display
   - Currently uses `toLocaleString` with locale options
   - Produces format like: "Jan 15, 8:00 PM" (varies by locale)

### 2.2. Current Implementation

**Location:** `app/scan.tsx`, lines 126-155

**Current `formatDate` function:**
```typescript
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return dateString;
  }
}
```

**Current `formatGameTime` function:**
```typescript
function formatGameTime(timestamp: number | null): string {
  if (!timestamp) return 'N/A';
  try {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return 'N/A';
  }
}
```

### 2.3. Where Dates Are Displayed

Dates are displayed in the `ArbCard` component:

**Location:** `app/scan.tsx`, lines 377-380

```typescript
{arb.gameTime && (
  <Text fontSize="$2" color="$colorPress" marginTop="$0.5">
    {arb.gameTime}
  </Text>
)}
```

The `arb.gameTime` value is set in the `processedArbs` memoization (line 716):

```typescript
const formattedGameTime = gameTime ? formatDate(gameTime) : null;
```

---

## 3. Implementation Steps

### 3.1. Update `formatDate` Function

**Location:** `app/scan.tsx`, lines 126-139

**Current:**
```typescript
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return dateString;
  }
}
```

**Change to:**
```typescript
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return dateString;
    }
    
    // Format: "MMM DD @ HH:MM EST"
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[date.getMonth()];
    const day = date.getDate();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    // Get timezone abbreviation (EST, EDT, PST, etc.)
    // Convert to EST/EDT based on the date's timezone
    const timeZone = date.toLocaleString('en-US', { 
      timeZone: 'America/New_York',
      timeZoneName: 'short' 
    }).split(' ').pop() || 'EST';
    
    return `${month} ${day} @ ${hours}:${minutes} ${timeZone}`;
  } catch {
    return dateString;
  }
}
```

**Alternative (if you want to force EST regardless of actual timezone):**
```typescript
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return dateString;
    }
    
    // Convert to Eastern Time
    const easternDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    
    // Format: "MMM DD @ HH:MM EST"
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[easternDate.getMonth()];
    const day = easternDate.getDate();
    const hours = String(easternDate.getHours()).padStart(2, '0');
    const minutes = String(easternDate.getMinutes()).padStart(2, '0');
    
    // Determine if EST or EDT
    const isDST = easternDate.getTimezoneOffset() < date.getTimezoneOffset();
    const timeZone = isDST ? 'EDT' : 'EST';
    
    return `${month} ${day} @ ${hours}:${minutes} ${timeZone}`;
  } catch {
    return dateString;
  }
}
```

**Impact:** Changes the date format from locale-based format to "MMM DD @ HH:MM EST" format.

---

### 3.2. Update `formatGameTime` Function

**Location:** `app/scan.tsx`, lines 141-155

**Current:**
```typescript
function formatGameTime(timestamp: number | null): string {
  if (!timestamp) return 'N/A';
  try {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return 'N/A';
  }
}
```

**Change to:**
```typescript
function formatGameTime(timestamp: number | null): string {
  if (!timestamp) return 'N/A';
  try {
    const date = new Date(timestamp);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'N/A';
    }
    
    // Format: "MMM DD @ HH:MM EST"
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[date.getMonth()];
    const day = date.getDate();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    // Get timezone abbreviation (EST, EDT, PST, etc.)
    const timeZone = date.toLocaleString('en-US', { 
      timeZone: 'America/New_York',
      timeZoneName: 'short' 
    }).split(' ').pop() || 'EST';
    
    return `${month} ${day} @ ${hours}:${minutes} ${timeZone}`;
  } catch {
    return 'N/A';
  }
}
```

**Alternative (if you want to force EST regardless of actual timezone):**
```typescript
function formatGameTime(timestamp: number | null): string {
  if (!timestamp) return 'N/A';
  try {
    const date = new Date(timestamp);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'N/A';
    }
    
    // Convert to Eastern Time
    const easternDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    
    // Format: "MMM DD @ HH:MM EST"
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[easternDate.getMonth()];
    const day = easternDate.getDate();
    const hours = String(easternDate.getHours()).padStart(2, '0');
    const minutes = String(easternDate.getMinutes()).padStart(2, '0');
    
    // Determine if EST or EDT
    const isDST = easternDate.getTimezoneOffset() < date.getTimezoneOffset();
    const timeZone = isDST ? 'EDT' : 'EST';
    
    return `${month} ${day} @ ${hours}:${minutes} ${timeZone}`;
  } catch {
    return 'N/A';
  }
}
```

**Impact:** Ensures timestamp-based dates also use the new format consistently.

---

## 4. Timezone Handling Options

### 4.1. Option A: Use Date's Native Timezone

The first implementation option uses the date's native timezone and converts it to Eastern Time for display. This will automatically handle EST/EDT transitions.

**Pros:**
- Automatically handles daylight saving time (EST vs EDT)
- More accurate representation of the actual time

**Cons:**
- May show EDT during daylight saving time periods
- Requires timezone conversion logic

### 4.2. Option B: Force EST Always

If you want to always show "EST" regardless of daylight saving time:

**Simplified version:**
```typescript
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    
    if (isNaN(date.getTime())) {
      return dateString;
    }
    
    // Convert to Eastern Time
    const easternDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[easternDate.getMonth()];
    const day = easternDate.getDate();
    const hours = String(easternDate.getHours()).padStart(2, '0');
    const minutes = String(easternDate.getMinutes()).padStart(2, '0');
    
    // Always use EST (or determine EDT/EST based on date)
    const timeZone = 'EST'; // Or use logic to determine EST vs EDT
    
    return `${month} ${day} @ ${hours}:${minutes} ${timeZone}`;
  } catch {
    return dateString;
  }
}
```

**Pros:**
- Consistent timezone label
- Simpler logic if EST is always desired

**Cons:**
- May not accurately reflect daylight saving time
- Could be confusing if dates span DST transitions

---

## 5. Helper Function Approach (Recommended)

For better code maintainability, consider creating a shared helper function:

**Location:** Add after line 125 in `app/scan.tsx`

**Add helper function:**
```typescript
function formatDateToEST(date: Date): string {
  // Check if date is valid
  if (isNaN(date.getTime())) {
    return 'Invalid Date';
  }
  
  // Convert to Eastern Time
  const easternDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  
  // Format: "MMM DD @ HH:MM EST"
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[easternDate.getMonth()];
  const day = easternDate.getDate();
  const hours = String(easternDate.getHours()).padStart(2, '0');
  const minutes = String(easternDate.getMinutes()).padStart(2, '0');
  
  // Determine if EST or EDT based on the date
  // Check if date is in daylight saving time period (roughly March-November)
  const monthNum = easternDate.getMonth();
  const isDST = monthNum >= 2 && monthNum <= 10; // March (2) to November (10)
  const timeZone = isDST ? 'EDT' : 'EST';
  
  return `${month} ${day} @ ${hours}:${minutes} ${timeZone}`;
}
```

**Then update both functions to use it:**
```typescript
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return formatDateToEST(date);
  } catch {
    return dateString;
  }
}

function formatGameTime(timestamp: number | null): string {
  if (!timestamp) return 'N/A';
  try {
    const date = new Date(timestamp);
    return formatDateToEST(date);
  } catch {
    return 'N/A';
  }
}
```

**Benefits:**
- Single source of truth for date formatting
- Easier to maintain and update
- Consistent formatting across all date displays

---

## 6. Expected Output Format

After implementation, dates should display as:

- **Example 1:** "Jan 15 @ 08:00 EST"
- **Example 2:** "Dec 25 @ 14:30 EST"
- **Example 3:** "Mar 20 @ 09:15 EDT" (during daylight saving time)
- **Example 4:** "Feb 10 @ 23:45 EST"

**Format breakdown:**
- `MMM` = 3-letter month abbreviation (Jan, Feb, Mar, etc.)
- `DD` = Day of month (1-31, no leading zero)
- `@` = Literal "@" symbol
- `HH:MM` = 24-hour format time with leading zeros (00:00 - 23:59)
- `EST/EDT` = Timezone abbreviation

---

## 7. Testing Recommendations

After implementing these changes, test the following:

### 7.1. Date Formatting Tests

- **Valid dates:** Verify dates display in the new format
- **Invalid dates:** Verify error handling (should return original string or 'N/A')
- **Null/undefined:** Verify `formatGameTime(null)` returns 'N/A'
- **Edge cases:** Test dates at midnight (00:00), noon (12:00), end of day (23:59)

### 7.2. Timezone Tests

- **EST period:** Verify dates show "EST" during standard time (November-March)
- **EDT period:** Verify dates show "EDT" during daylight saving time (March-November)
- **Different timezones:** If dates come from different timezones, verify conversion to Eastern Time

### 7.3. Visual Testing

- **Mobile view:** Verify date displays correctly in ArbCard on mobile
- **Web view:** Verify date displays correctly in ArbCard on web
- **Long dates:** Verify formatting doesn't break with longer month names
- **Multiple results:** Verify all scan results show consistent date formatting

### 7.4. Integration Testing

- **Scan results loading:** Verify dates format correctly when scan results are loaded
- **Auto-refresh:** Verify dates format correctly after auto-refresh
- **Manual refresh:** Verify dates format correctly after manual refresh
- **CSV export:** Note that CSV export uses `formatGameTimeForCSV` which may need separate consideration

---

## 8. CSV Export Consideration

**Note:** The CSV export functionality uses a separate function `formatGameTimeForCSV` (lines 219-240). If you want CSV exports to also use the new format, you'll need to update that function as well.

**Location:** `app/scan.tsx`, lines 219-240

**Current CSV format:** Uses `MM/DD HH:MM timezone` format

If you want CSV to match the new format, update `formatGameTimeForCSV`:

```typescript
function formatGameTimeForCSV(gameTime: string | null): string {
  if (!gameTime || gameTime === 'N/A') return 'N/A';
  try {
    const date = new Date(gameTime);
    if (isNaN(date.getTime())) {
      return gameTime;
    }
    
    // Use the same formatting as display
    return formatDateToEST(date);
  } catch {
    return gameTime;
  }
}
```

Or keep CSV format separate if you prefer the current `MM/DD HH:MM timezone` format for CSV exports.

---

## 9. Summary of Changes

### 9.1. Functions to Modify

| Function | Location | Purpose |
|----------|----------|---------|
| `formatDate` | Lines 126-139 | Formats date strings for display |
| `formatGameTime` | Lines 141-155 | Formats timestamps for display |
| `formatDateToEST` (new) | After line 125 | Shared helper function (optional) |
| `formatGameTimeForCSV` | Lines 219-240 | CSV export formatting (optional) |

### 9.2. Format Changes

| Element | Current Format | New Format |
|---------|---------------|------------|
| Date display | "Jan 15, 8:00 PM" (locale-based) | "Jan 15 @ 08:00 EST" |
| Time format | 12-hour with AM/PM | 24-hour with leading zeros |
| Timezone | Not shown or locale-based | Explicit EST/EDT |
| Separator | Comma | "@" symbol |

---

## 10. Implementation Notes

### 10.1. Month Names Array

The implementation uses a hardcoded array of month abbreviations. This ensures consistent formatting regardless of locale settings.

### 10.2. Timezone Conversion

The implementation converts dates to Eastern Time using `America/New_York` timezone. This automatically handles:
- EST (Eastern Standard Time) - November to March
- EDT (Eastern Daylight Time) - March to November

### 10.3. Date Validation

Both functions include validation to handle:
- Invalid date strings
- Invalid timestamps
- Null/undefined values
- Edge cases

### 10.4. Leading Zeros

Hours and minutes are padded with leading zeros using `padStart(2, '0')` to ensure consistent formatting (e.g., "08:00" instead of "8:0").

---

## 11. Rollback Plan

If the new format causes issues or needs adjustment:

1. **Revert functions:** Restore the original `formatDate` and `formatGameTime` functions
2. **Adjust format:** Modify the format string in the helper function to change the output
3. **Timezone adjustment:** Change timezone handling if EST conversion causes issues

All changes are isolated to the formatting functions and can be easily reverted or modified.

---

## 12. Additional Considerations

### 12.1. Internationalization

If the app needs to support multiple locales in the future, consider:
- Making the format configurable
- Using a date formatting library (e.g., `date-fns`, `moment.js`)
- Storing format preferences in user settings

### 12.2. Performance

The current implementation is performant for typical use cases. If you notice performance issues with many dates:
- Consider memoizing formatted dates
- Cache timezone conversions
- Use a date formatting library optimized for performance

### 12.3. Accessibility

Ensure the date format is:
- Readable by screen readers
- Clear and unambiguous
- Consistent across all displays

---

## 13. Example Implementation

Here's a complete example of the recommended implementation:

```typescript
// Helper function for consistent date formatting
function formatDateToEST(date: Date): string {
  if (isNaN(date.getTime())) {
    return 'Invalid Date';
  }
  
  // Convert to Eastern Time
  const easternDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[easternDate.getMonth()];
  const day = easternDate.getDate();
  const hours = String(easternDate.getHours()).padStart(2, '0');
  const minutes = String(easternDate.getMinutes()).padStart(2, '0');
  
  // Determine EST or EDT (simplified - can be improved with proper DST detection)
  const monthNum = easternDate.getMonth();
  const isDST = monthNum >= 2 && monthNum <= 10;
  const timeZone = isDST ? 'EDT' : 'EST';
  
  return `${month} ${day} @ ${hours}:${minutes} ${timeZone}`;
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return formatDateToEST(date);
  } catch {
    return dateString;
  }
}

function formatGameTime(timestamp: number | null): string {
  if (!timestamp) return 'N/A';
  try {
    const date = new Date(timestamp);
    return formatDateToEST(date);
  } catch {
    return 'N/A';
  }
}
```

This implementation provides:
- Consistent formatting across all date displays
- Proper timezone handling (EST/EDT)
- Error handling for invalid dates
- Maintainable code structure

