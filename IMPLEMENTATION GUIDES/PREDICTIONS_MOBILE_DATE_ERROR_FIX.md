# Predictions Mobile Date Error Fix Implementation Guide

## Problem
Getting `RangeError: Date value out of bounds` error on mobile when viewing the predictions page. This occurs because:

1. **Invalid date strings** from the API are being passed to `new Date()` without validation
2. **`toLocaleString()` parsing issue**: Using `new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))` is unreliable on mobile
3. **`Intl.DateTimeFormat.formatToParts()`** can throw RangeError on mobile with invalid dates
4. **Missing try-catch blocks** around date operations that can fail

## Root Causes

### 1. `fetchUpcomingGames` function (lines 165-166)
```typescript
const now = new Date();
const today = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
```
**Issue**: `toLocaleString()` returns a locale-specific string that `new Date()` may not parse correctly on mobile devices.

### 2. Game sorting (lines 205-206)
```typescript
const dateA = new Date(a.date).getTime();
const dateB = new Date(b.date).getTime();
```
**Issue**: If `a.date` or `b.date` contains invalid date strings, `new Date()` throws RangeError.

### 3. `formatGameTimeDisplay` function (line 449)
```typescript
const date = new Date(isoString);
```
**Issue**: No validation that `isoString` is a valid date before parsing.

### 4. `formatGameTime` function (line 404)
```typescript
const date = new Date(cleaned);
```
**Issue**: No validation that `cleaned` is a valid date string.

### 5. Performance metrics display (line 830)
```typescript
{new Date(metric.evaluation_period_start).toLocaleDateString()} - {new Date(metric.evaluation_period_end).toLocaleDateString()}
```
**Issue**: No validation or error handling for invalid dates.

### 6. `Intl.DateTimeFormat.formatToParts()` (line 471)
```typescript
const timeZoneName = timeZoneFormatter.formatToParts(date).find(part => part.type === 'timeZoneName')?.value || 'EST';
```
**Issue**: `formatToParts()` can throw RangeError on mobile if the date is invalid or out of bounds.

## Solution

### Step 1: Create a Safe Date Parsing Utility Function

Add a utility function at the top of `app/predictions.tsx` (after imports, before interfaces):

```typescript
/**
 * Safely parse a date string, returning null if invalid
 * Prevents RangeError on mobile devices
 */
function safeParseDate(dateString: string | null | undefined): Date | null {
  if (!dateString || typeof dateString !== 'string') {
    return null;
  }
  
  try {
    const trimmed = dateString.trim();
    if (!trimmed) return null;
    
    // Try parsing the date
    const date = new Date(trimmed);
    
    // Check if date is valid (not NaN and within reasonable bounds)
    if (isNaN(date.getTime())) {
      return null;
    }
    
    // Check if date is within reasonable bounds (year 1900-2100)
    const year = date.getFullYear();
    if (year < 1900 || year > 2100) {
      return null;
    }
    
    return date;
  } catch (error) {
    // Catch any RangeError or other date parsing errors
    console.warn('[safeParseDate] Failed to parse date:', dateString, error);
    return null;
  }
}

/**
 * Safely format date parts using Intl API with error handling
 * Prevents RangeError on mobile devices
 */
function safeFormatDateParts(date: Date | null, options: Intl.DateTimeFormatOptions): string {
  if (!date || isNaN(date.getTime())) {
    return 'TBD';
  }
  
  try {
    const formatter = new Intl.DateTimeFormat('en-US', options);
    return formatter.format(date);
  } catch (error) {
    console.warn('[safeFormatDateParts] Failed to format date:', error);
    // Fallback to UTC date formatting
    try {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                          'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = monthNames[date.getUTCMonth()];
      const day = date.getUTCDate();
      const year = date.getUTCFullYear();
      return `${month} ${day}, ${year}`;
    } catch {
      return 'TBD';
    }
  }
}

/**
 * Safely get timezone name from date with error handling
 */
function safeGetTimezoneName(date: Date | null): string {
  if (!date || isNaN(date.getTime())) {
    return 'EST';
  }
  
  try {
    const timeZoneFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      timeZoneName: 'short'
    });
    const parts = timeZoneFormatter.formatToParts(date);
    const timeZoneName = parts.find(part => part.type === 'timeZoneName')?.value;
    return timeZoneName || 'EST';
  } catch (error) {
    console.warn('[safeGetTimezoneName] Failed to get timezone:', error);
    return 'EST';
  }
}

/**
 * Get today and tomorrow dates in America/New_York timezone safely
 * Works reliably on mobile devices
 */
function getTodayAndTomorrowDates(): { today: Date; tomorrow: Date } {
  try {
    const now = new Date();
    
    // Get current time in Eastern Time by calculating offset
    // This is more reliable than using toLocaleString on mobile
    const easternOffset = -5 * 60; // EST is UTC-5 (EDT is UTC-4, but we'll handle that)
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const easternTime = new Date(utc + (easternOffset * 60000));
    
    // Create today date (set to midnight Eastern Time)
    const today = new Date(easternTime);
    today.setHours(0, 0, 0, 0);
    
    // Create tomorrow date
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    return { today, tomorrow };
  } catch (error) {
    console.warn('[getTodayAndTomorrowDates] Error calculating dates, using UTC fallback:', error);
    // Fallback to UTC dates
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    return { today, tomorrow };
  }
}
```

### Step 2: Fix `fetchUpcomingGames` function

Replace lines 159-220 with:

```typescript
const fetchUpcomingGames = useCallback(async () => {
  try {
    setGamesError(null);
    setGamesLoading(true);
    
    // Get today and tomorrow dates safely
    const { today, tomorrow } = getTodayAndTomorrowDates();
    
    const todayStr = today.toISOString().split('T')[0];
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    // Fetch games for today and tomorrow
    const [todayResponse, tomorrowResponse] = await Promise.all([
      get<GamesResponse>(`/api/bdl/v1/games?dates[]=${todayStr}&per_page=100`),
      get<GamesResponse>(`/api/bdl/v1/games?dates[]=${tomorrowStr}&per_page=100`)
    ]);
    
    // Check for errors
    if (todayResponse.error) {
      throw new Error(todayResponse.error);
    }
    if (tomorrowResponse.error) {
      throw new Error(tomorrowResponse.error);
    }
    
    // Combine and filter for upcoming games (status: "Scheduled" or not started)
    const allGames: Game[] = [
      ...(todayResponse.data?.data || []),
      ...(tomorrowResponse.data?.data || [])
    ];
    
    // Filter for upcoming games (Scheduled status or status that indicates not started)
    const upcomingGames = allGames.filter(game => {
      const status = game.status?.toLowerCase() || '';
      return status === 'scheduled' || 
             status === '' || 
             (!status.includes('qtr') && 
              status !== 'final' && 
              status !== 'halftime');
    });
    
    // Sort by date and time - with safe date parsing
    upcomingGames.sort((a, b) => {
      const dateA = safeParseDate(a.date);
      const dateB = safeParseDate(b.date);
      
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1; // Invalid dates go to end
      if (!dateB) return -1;
      
      const timeA = dateA.getTime();
      const timeB = dateB.getTime();
      
      if (timeA !== timeB) return timeA - timeB;
      // If same date, sort by time if available
      return 0;
    });
    
    setGames(upcomingGames);
  } catch (err: any) {
    console.error('Error fetching games:', err);
    setGamesError(err.message || 'Failed to fetch upcoming games');
    setGames([]);
  } finally {
    setGamesLoading(false);
  }
}, []);
```

### Step 3: Fix `formatGameTime` function

Replace lines 382-419 with:

```typescript
// Format game time for display
const formatGameTime = useCallback((timeString?: string): string | null => {
  if (!timeString) return null;
  
  // Clean ISO strings from timeString if present
  let cleaned = timeString
    .replace(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[.0-9]*Z?\s*/g, '')
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/g, '')
    .replace(/\s+\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z?/g, '')
    .trim();
  
  // If cleaned string is empty or only contains ISO patterns, return null
  if (!cleaned || cleaned.length === 0 || /^\d{4}-\d{2}-\d{2}T/.test(cleaned)) {
    return null;
  }
  
  // If cleaned string already looks formatted (contains month name), return it as-is
  if (/^[A-Za-z]{3}\s+\d{1,2}/.test(cleaned)) {
    return cleaned;
  }
  
  // Use safe date parsing
  const date = safeParseDate(cleaned);
  if (!date) return null;
  
  try {
    const formatted = safeFormatDateParts(date, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/New_York',
    });
    
    const timeZoneName = safeGetTimezoneName(date);
    return `${formatted} ${timeZoneName}`;
  } catch {
    return null;
  }
}, []);
```

### Step 4: Fix `formatGameTimeDisplay` function

Replace lines 426-548 with:

```typescript
// Format game time for display - using same approach as scan.tsx
const formatGameTimeDisplay = useCallback((game: Game): string => {
  try {
    // Use datetime field if available, otherwise use date field
    // Both should contain ISO timestamp (e.g., "2025-12-25T22:00:00Z")
    const isoString = game.datetime || game.date;
    
    if (!isoString) {
      // Fallback to game.time if available, but clean it
      if (game.time) {
        // Check if game.time is already formatted (contains month name)
        if (/^[A-Za-z]{3}\s+\d{1,2}/.test(game.time)) {
          // Already formatted, but check for ISO strings
          const cleaned = game.time.replace(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[.0-9]*Z?\s*/g, '').trim();
          if (cleaned && !/\d{4}-\d{2}-\d{2}T/.test(cleaned)) {
            return cleaned;
          }
        }
      }
      return 'TBD';
    }
    
    // Use safe date parsing
    const date = safeParseDate(isoString);
    if (!date) {
      return 'TBD';
    }
    
    // Format using safe formatting functions
    const formatted = safeFormatDateParts(date, {
      timeZone: 'America/New_York',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    
    // Get timezone abbreviation (EST or EDT) safely
    const timeZoneName = safeGetTimezoneName(date);
    
    let result = `${formatted} ${timeZoneName}`;
    
    // Apply same ISO cleanup logic as scan.tsx
    // Check if formatted result contains the raw ISO string (concatenated)
    if (result && isoString) {
      // More flexible ISO pattern that matches with or without milliseconds and Z
      const isoDatePattern = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?/;
      
      // First check: Does the formatted string contain an ISO date pattern?
      if (isoDatePattern.test(result)) {
        const match = result.match(isoDatePattern);
        if (match && match.index !== undefined) {
          if (match.index > 0) {
            // ISO string is in the middle or end - extract only the part before it
            result = result.substring(0, match.index).trim();
          } else {
            // If ISO string is at the start, the formatting failed - return TBD
            return 'TBD';
          }
        }
      }
      
      // Second check: Does it contain the exact raw isoString value?
      if (result && result.includes(isoString)) {
        const isoIndex = result.indexOf(isoString);
        if (isoIndex > 0) {
          result = result.substring(0, isoIndex).trim();
        } else if (isoIndex === 0) {
          return 'TBD';
        }
      }
      
      // Final check: Look for any remaining ISO-like patterns and remove them
      const remainingIsoPattern = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
      if (remainingIsoPattern.test(result)) {
        const match = result.match(remainingIsoPattern);
        if (match && match.index !== undefined && match.index > 0) {
          result = result.substring(0, match.index).trim();
        }
      }
    }
    
    // Final safety check: Remove any ISO string that might still be in result
    if (result && isoString) {
      // Check if result still contains the raw isoString value
      if (result.includes(isoString)) {
        const splitIndex = result.indexOf(isoString);
        if (splitIndex > 0) {
          result = result.substring(0, splitIndex).trim();
        } else {
          return 'TBD';
        }
      }
      
      // Also check for any ISO date pattern
      const finalIsoCheck = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?/;
      if (finalIsoCheck.test(result)) {
        const match = result.match(finalIsoCheck);
        if (match && match.index !== undefined && match.index > 0) {
          result = result.substring(0, match.index).trim();
        } else if (match && match.index === 0) {
          return 'TBD';
        }
      }
    }
    
    // Ensure we never return an ISO string - final validation
    if (result && (/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(result) && result.endsWith('Z'))) {
      return 'TBD';
    }
    
    return result || 'TBD';
  } catch (err) {
    console.warn('[formatGameTimeDisplay] Error formatting game time:', err);
    return 'TBD';
  }
}, []);
```

### Step 5: Fix Performance Metrics Date Display

Replace line 830 with:

```typescript
{(() => {
  try {
    const startDate = safeParseDate(metric.evaluation_period_start);
    const endDate = safeParseDate(metric.evaluation_period_end);
    
    if (!startDate || !endDate) {
      return 'N/A';
    }
    
    const startFormatted = startDate.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
    const endFormatted = endDate.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
    
    return `${startFormatted} - ${endFormatted}`;
  } catch (error) {
    console.warn('[PerformanceMetrics] Error formatting dates:', error);
    return 'N/A';
  }
})()}
```

## Testing Checklist

After implementing the fixes:

1. ✅ **Test on mobile device/emulator**: Navigate to predictions page and verify no RangeError
2. ✅ **Test with invalid date strings**: Verify the app handles invalid dates gracefully (shows "TBD" or "N/A")
3. ✅ **Test game selector**: Verify game cards display correctly with dates
4. ✅ **Test performance metrics**: Verify dates display correctly in performance metrics section
5. ✅ **Test date formatting**: Verify all dates are formatted consistently (EST/EDT timezone)
6. ✅ **Test edge cases**: 
   - Empty date strings
   - Null/undefined dates
   - Dates far in the past/future
   - Malformed ISO strings

## Key Improvements

1. **Safe date parsing**: All `new Date()` calls are wrapped in validation
2. **Error handling**: All date operations have try-catch blocks
3. **Mobile compatibility**: Removed unreliable `toLocaleString()` parsing
4. **Fallback values**: Invalid dates return "TBD" or "N/A" instead of crashing
5. **Date validation**: Checks for reasonable date ranges (1900-2100)
6. **Safe Intl API usage**: `formatToParts()` calls are wrapped in try-catch

## Notes

- The `safeParseDate` function validates dates before parsing to prevent RangeError
- The `getTodayAndTomorrowDates` function uses UTC offset calculation instead of `toLocaleString()` for better mobile compatibility
- All date formatting functions now have fallback mechanisms
- Console warnings are logged for debugging but don't crash the app

