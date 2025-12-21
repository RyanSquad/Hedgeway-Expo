# Scan Reload Delay Implementation Guide

This guide provides step-by-step instructions for implementing a 1-2 second delay on scan reload requests to prevent server overload. This helps protect against rapid polling, reduces database/API load, and provides consistent response timing.

## Overview

**Current State:**
- Scan endpoints (`/api/scan/results`, `/api/scan/run`) respond immediately
- Frontend can rapidly poll the results endpoint
- Manual scan triggers can be spammed
- No protection against request flooding
- Potential for server overload under high traffic

**Target State:**
- Consistent 1-2 second delay for scan reload requests
- Prevents rapid polling and request flooding
- Reduces server load and API rate limit issues
- Configurable delay duration via environment variable
- Maintains good user experience with predictable timing

---

## Phase 1: Environment Variables

### Step 1.1: Add to `.env` file

Add the following configuration to your `.env` file:

```env
# Scan reload delay configuration (in milliseconds)
SCAN_RELOAD_DELAY_MS=1500          # 1.5 seconds delay (recommended)
# SCAN_RELOAD_DELAY_MS=1000        # Alternative: 1 second (minimum)
# SCAN_RELOAD_DELAY_MS=2000        # Alternative: 2 seconds (more protection)
```

**Recommended Values:**
- **1500ms (1.5 seconds)**: Good balance between protection and UX
- **1000ms (1 second)**: Minimum for effective protection, better UX
- **2000ms (2 seconds)**: Maximum protection, slightly slower UX
- **< 1000ms**: Not recommended as it may not provide adequate protection
- **> 2000ms**: Not recommended as it degrades user experience

---

## Phase 2: Backend Implementation

### Step 2.1: Update Utility Function

Extend `utils/timing.js` to include scan reload delay functions:

**Current `utils/timing.js` structure:**
```javascript
export function delay(ms) { ... }
export function getLoginDelay() { ... }
```

**Add to `utils/timing.js`:**

```javascript
/**
 * Get scan reload delay from environment variable
 * @returns {number} Delay in milliseconds (default: 1500)
 */
export function getScanReloadDelay() {
  const delayMs = parseInt(process.env.SCAN_RELOAD_DELAY_MS, 10);
  
  // Validate delay is a reasonable number
  if (isNaN(delayMs) || delayMs < 0) {
    console.warn('[Scan Reload Delay] Invalid SCAN_RELOAD_DELAY_MS, using default 1500ms');
    return 1500;
  }
  
  // Enforce minimum delay of 500ms for protection
  if (delayMs < 500) {
    console.warn('[Scan Reload Delay] SCAN_RELOAD_DELAY_MS too short, using minimum 500ms');
    return 500;
  }
  
  // Enforce maximum delay of 5 seconds to prevent excessive delays
  if (delayMs > 5000) {
    console.warn('[Scan Reload Delay] SCAN_RELOAD_DELAY_MS too long, using maximum 5000ms');
    return 5000;
  }
  
  return delayMs;
}
```

**Full updated `utils/timing.js` should look like:**

```javascript
/**
 * Utility function to create a delay/pause
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise<void>}
 */
export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get login delay from environment variable
 * @returns {number} Delay in milliseconds (default: 2000)
 */
export function getLoginDelay() {
  const delayMs = parseInt(process.env.LOGIN_DELAY_MS, 10);
  
  // Validate delay is a reasonable number
  if (isNaN(delayMs) || delayMs < 0) {
    console.warn('[Login Delay] Invalid LOGIN_DELAY_MS, using default 2000ms');
    return 2000;
  }
  
  // Enforce minimum delay of 500ms for security
  if (delayMs < 500) {
    console.warn('[Login Delay] LOGIN_DELAY_MS too short, using minimum 500ms');
    return 500;
  }
  
  // Enforce maximum delay of 10 seconds to prevent abuse
  if (delayMs > 10000) {
    console.warn('[Login Delay] LOGIN_DELAY_MS too long, using maximum 10000ms');
    return 10000;
  }
  
  return delayMs;
}

/**
 * Get scan reload delay from environment variable
 * @returns {number} Delay in milliseconds (default: 1500)
 */
export function getScanReloadDelay() {
  const delayMs = parseInt(process.env.SCAN_RELOAD_DELAY_MS, 10);
  
  // Validate delay is a reasonable number
  if (isNaN(delayMs) || delayMs < 0) {
    console.warn('[Scan Reload Delay] Invalid SCAN_RELOAD_DELAY_MS, using default 1500ms');
    return 1500;
  }
  
  // Enforce minimum delay of 500ms for protection
  if (delayMs < 500) {
    console.warn('[Scan Reload Delay] SCAN_RELOAD_DELAY_MS too short, using minimum 500ms');
    return 500;
  }
  
  // Enforce maximum delay of 5 seconds to prevent excessive delays
  if (delayMs > 5000) {
    console.warn('[Scan Reload Delay] SCAN_RELOAD_DELAY_MS too long, using maximum 5000ms');
    return 5000;
  }
  
  return delayMs;
}
```

### Step 2.2: Update Scan Routes

Modify the scan routes in `routes/scanRoutes.js` to include delays before responses.

**Current scan routes structure:**

```javascript
// Get latest scan results
app.get("/api/scan/results", authenticateToken, requirePermission(PERMISSIONS.SCAN_READ), (req, res) => {
  try {
    const results = getLatestResults();
    // ... return results immediately
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Trigger a manual scan
app.post("/api/scan/run", authenticateToken, requirePermission(PERMISSIONS.SCAN_RUN), async (req, res) => {
  try {
    const results = await runScan(apiKey);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

**Updated scan routes with delays:**

```javascript
import {
  runScan,
  getLatestResults,
  updateConfig,
  getConfig,
  startAutoRefresh,
  stopAutoRefresh
} from "../services/scanService.js";
import { authenticateToken } from "../middleware/jwtAuth.js";
import { requirePermission } from "../middleware/permissions.js";
import { PERMISSIONS } from "../config/permissions.js";
import { delay, getScanReloadDelay } from "../utils/timing.js"; // Add this import

export function registerScanRoutes(app, { apiKey }) {
  // Get latest scan results - requires scan:read (all users)
  app.get("/api/scan/results", authenticateToken, requirePermission(PERMISSIONS.SCAN_READ), async (req, res) => {
    try {
      // Get configured delay duration
      const reloadDelay = getScanReloadDelay();
      
      // Delay before returning results to prevent rapid polling
      await delay(reloadDelay);
      
      const results = getLatestResults();
      if (!results) {
        return res.json({
          arbs: [],
          gameMap: {},
          playerNameMap: {},
          gameTimeMap: {},
          gameStatusMap: {},
          date: null,
          timestamp: null,
          nextRefreshSeconds: 60
        });
      }
      res.json(results);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Trigger a manual scan - requires scan:run (basic_user+)
  app.post("/api/scan/run", authenticateToken, requirePermission(PERMISSIONS.SCAN_RUN), async (req, res) => {
    try {
      // Get configured delay duration
      const reloadDelay = getScanReloadDelay();
      
      // Delay before starting scan to prevent rapid triggering
      await delay(reloadDelay);
      
      // Check if scan is already running (from scanService)
      // Note: runScan already has isScanning protection, but we add delay first
      const results = await runScan(apiKey);
      res.json(results);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update scan configuration - requires scan:config:write (premium_user+)
  app.post("/api/scan/config", authenticateToken, requirePermission(PERMISSIONS.SCAN_CONFIG_WRITE), async (req, res) => {
    try {
      // Optional: Add small delay here too if config changes are frequent
      // const reloadDelay = getScanReloadDelay();
      // await delay(reloadDelay);
      
      updateConfig(req.body);
      res.json({ success: true, config: getConfig() });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get current scan configuration - requires scan:config:read (basic_user+)
  app.get("/api/scan/config", authenticateToken, requirePermission(PERMISSIONS.SCAN_CONFIG_READ), (req, res) => {
    try {
      res.json(getConfig());
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Start auto-refresh - requires scan:control (moderator+)
  app.post("/api/scan/start", authenticateToken, requirePermission(PERMISSIONS.SCAN_CONTROL), (req, res) => {
    try {
      startAutoRefresh(apiKey);
      res.json({ success: true, message: "Auto-refresh started" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Stop auto-refresh - requires scan:control (moderator+)
  app.post("/api/scan/stop", authenticateToken, requirePermission(PERMISSIONS.SCAN_CONTROL), (req, res) => {
    try {
      stopAutoRefresh();
      res.json({ success: true, message: "Auto-refresh stopped" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}
```

**Key Changes:**
1. Import `delay` and `getScanReloadDelay` from `utils/timing.js`
2. Make the GET `/api/scan/results` handler `async`
3. Add delay before returning results in GET endpoint
4. Add delay before starting scan in POST `/api/scan/run` endpoint
5. Keep error handling without delays (to prevent DoS)

---

## Phase 3: Frontend Implementation Considerations

While the delay is handled entirely on the backend, the frontend should be aware of the delay and handle it appropriately. No changes are strictly required, but the following considerations improve user experience.

### Step 3.1: Update Frontend Polling Logic

The frontend should account for the 1-2 second delay when polling scan results:

#### React/JavaScript Example

```javascript
// Before: Rapid polling every 500ms
const pollScanResults = () => {
  setInterval(async () => {
    const response = await fetch('/api/scan/results', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();
    setResults(data);
  }, 500); // Too frequent!
};

// After: Account for delay, poll less frequently
const pollScanResults = () => {
  // Poll every 3-5 seconds (accounting for 1.5s delay + processing time)
  setInterval(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/scan/results', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error('Failed to fetch scan results:', error);
    } finally {
      setLoading(false);
    }
  }, 3000); // Poll every 3 seconds (backend delay + buffer)
};
```

### Step 3.2: Disable Reload Button During Delay

Prevent users from clicking reload multiple times:

```javascript
const [isReloading, setIsReloading] = useState(false);
const [lastReloadTime, setLastReloadTime] = useState(0);
const MIN_RELOAD_INTERVAL = 2000; // 2 seconds minimum between reloads

const handleManualReload = async () => {
  const now = Date.now();
  const timeSinceLastReload = now - lastReloadTime;
  
  if (timeSinceLastReload < MIN_RELOAD_INTERVAL) {
    const remaining = Math.ceil((MIN_RELOAD_INTERVAL - timeSinceLastReload) / 1000);
    alert(`Please wait ${remaining} second(s) before reloading again`);
    return;
  }
  
  setIsReloading(true);
  setLastReloadTime(now);
  
  try {
    const response = await fetch('/api/scan/run', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();
    setResults(data);
  } catch (error) {
    console.error('Failed to reload scan:', error);
  } finally {
    setIsReloading(false);
  }
};

// In JSX:
<button 
  onClick={handleManualReload} 
  disabled={isReloading}
>
  {isReloading ? 'Reloading...' : 'Reload Scan'}
</button>
```

### Step 3.3: Use Results Timestamp for Smart Polling

Instead of fixed intervals, use the `nextRefreshSeconds` from results:

```javascript
const [pollInterval, setPollInterval] = useState(null);

const startSmartPolling = () => {
  const poll = async () => {
    try {
      const response = await fetch('/api/scan/results', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setResults(data);
      
      // Use nextRefreshSeconds from server response
      // Add buffer for delay + processing time
      const pollInterval = (data.nextRefreshSeconds || 60) * 1000 + 2000;
      
      // Clear old interval and set new one
      if (pollInterval) clearInterval(pollInterval);
      const newInterval = setInterval(poll, pollInterval);
      setPollInterval(newInterval);
    } catch (error) {
      console.error('Polling error:', error);
      // Retry after 5 seconds on error
      setTimeout(poll, 5000);
    }
  };
  
  // Initial poll
  poll();
};
```

### Step 3.4: Loading States and User Feedback

Show appropriate feedback during the delay:

```javascript
const [isLoading, setIsLoading] = useState(false);
const [loadingMessage, setLoadingMessage] = useState('');

const fetchResults = async () => {
  setIsLoading(true);
  setLoadingMessage('Loading scan results...');
  
  try {
    const startTime = Date.now();
    const response = await fetch('/api/scan/results', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();
    
    const duration = Date.now() - startTime;
    console.log(`Results loaded in ${duration}ms (includes ${duration - 1500}ms delay)`);
    
    setResults(data);
  } catch (error) {
    setError(error.message);
  } finally {
    setIsLoading(false);
    setLoadingMessage('');
  }
};
```

---

## Phase 4: Testing

### Step 4.1: Test Results Endpoint Delay

1. **Test GET `/api/scan/results` with delay:**
   ```bash
   curl -X GET http://localhost:3002/api/scan/results \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -w "\nTime: %{time_total}s\n"
   ```
   
   Expected: Response takes approximately 1.5 seconds (plus network time)

2. **Verify response time consistency:**
   - Use browser DevTools Network tab
   - Check that response time is consistently ~1.5 seconds
   - Verify results are returned correctly

### Step 4.2: Test Manual Scan Delay

1. **Test POST `/api/scan/run` with delay:**
   ```bash
   curl -X POST http://localhost:3002/api/scan/run \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -w "\nTime: %{time_total}s\n"
   ```
   
   Expected: Response starts after ~1.5 seconds delay, then scan processing time

2. **Test rapid requests:**
   ```bash
   # Send 5 rapid requests
   for i in {1..5}; do
     curl -X GET http://localhost:3002/api/scan/results \
       -H "Authorization: Bearer YOUR_TOKEN" \
       -w "\nRequest $i: %{time_total}s\n" &
   done
   wait
   ```
   
   Expected: Each request takes ~1.5 seconds, preventing rapid polling

### Step 4.3: Test Configuration

1. **Test with different delay values:**
   ```bash
   # Set SCAN_RELOAD_DELAY_MS=1000
   # Test and verify ~1 second delay
   
   # Set SCAN_RELOAD_DELAY_MS=2000
   # Test and verify ~2 second delay
   ```

2. **Test with invalid values:**
   ```bash
   # Set SCAN_RELOAD_DELAY_MS=100 (too short)
   # Should default to 500ms minimum
   
   # Set SCAN_RELOAD_DELAY_MS=10000 (too long)
   # Should default to 5000ms maximum
   ```

### Step 4.4: Load Testing

Test server behavior under load:

```javascript
// Test script to verify delay prevents overload
async function testScanReloadDelay() {
  const requests = 10;
  const start = Date.now();
  
  const promises = Array(requests).fill(0).map(async (_, i) => {
    const reqStart = Date.now();
    try {
      await fetch('/api/scan/results', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (e) {
      // Ignore errors
    }
    const duration = Date.now() - reqStart;
    console.log(`Request ${i + 1}: ${duration}ms`);
    return duration;
  });
  
  const durations = await Promise.all(promises);
  const totalTime = Date.now() - start;
  const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
  
  console.log(`Total time: ${totalTime}ms`);
  console.log(`Average request time: ${avgDuration}ms`);
  console.log(`Expected: ~${1500}ms per request`);
};
```

**Expected Result:** Each request should take approximately the configured delay time, preventing server overload from rapid requests.

---

## Phase 5: Additional Protection Measures

### Step 5.1: Rate Limiting (Recommended Addition)

While the delay helps, consider adding rate limiting for additional protection:

```javascript
// Install: npm install express-rate-limit
import rateLimit from 'express-rate-limit';

// Rate limiter for scan results (1 request per 2 seconds per IP)
const scanResultsLimiter = rateLimit({
  windowMs: 2000, // 2 second window
  max: 1, // 1 request per window
  message: 'Too many scan requests, please wait before reloading',
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for manual scans (1 request per 5 seconds per IP)
const scanRunLimiter = rateLimit({
  windowMs: 5000, // 5 second window
  max: 1, // 1 request per window
  message: 'Please wait before triggering another scan',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply to routes
app.get("/api/scan/results", 
  scanResultsLimiter, // Add rate limiter
  authenticateToken, 
  requirePermission(PERMISSIONS.SCAN_READ), 
  async (req, res) => {
    // ... handler
  }
);

app.post("/api/scan/run", 
  scanRunLimiter, // Add rate limiter
  authenticateToken, 
  requirePermission(PERMISSIONS.SCAN_RUN), 
  async (req, res) => {
    // ... handler
  }
);
```

### Step 5.2: Request Debouncing (Alternative Approach)

Track last request time per user to prevent rapid requests:

```javascript
// In scanRoutes.js or middleware
const lastRequestTime = new Map(); // userId -> timestamp

const debounceScanRequest = (req, res, next) => {
  const userId = req.user?.id || req.ip;
  const now = Date.now();
  const lastTime = lastRequestTime.get(userId) || 0;
  const timeSinceLastRequest = now - lastTime;
  const minInterval = getScanReloadDelay();
  
  if (timeSinceLastRequest < minInterval) {
    const remaining = Math.ceil((minInterval - timeSinceLastRequest) / 1000);
    return res.status(429).json({ 
      error: `Please wait ${remaining} second(s) before reloading`,
      retryAfter: Math.ceil((minInterval - timeSinceLastRequest) / 1000)
    });
  }
  
  lastRequestTime.set(userId, now);
  next();
};

// Apply middleware
app.get("/api/scan/results", 
  authenticateToken, 
  requirePermission(PERMISSIONS.SCAN_READ),
  debounceScanRequest, // Add debouncing
  async (req, res) => {
    // ... handler
  }
);
```

### Step 5.3: Delay Configuration Best Practices

- **Minimum Delay (500ms):** Prevents trivial request flooding
- **Recommended Delay (1500ms):** Good balance of protection and UX
- **Maximum Delay (5000ms):** Prevents excessive delays that degrade UX
- **Adjust based on:**
  - Server capacity
  - Expected user count
  - API rate limits
  - User experience requirements

---

## Phase 6: Performance Impact

### Step 6.1: Resource Usage

The delay is implemented using `setTimeout`, which is non-blocking:
- **Memory:** Minimal (Promise + timeout handle per request)
- **CPU:** Negligible (event loop handles it)
- **Connection:** HTTP connection remains open for 1-2 seconds
- **Concurrent Requests:** Each request holds a connection during delay

### Step 6.2: Scalability Considerations

- Each scan request will hold a connection for ~1.5 seconds
- Under high load, consider:
  - Connection pooling
  - Load balancing
  - Adjusting delay for high-traffic periods (via env var)
  - Rate limiting in addition to delays

### Step 6.3: Alternative Approaches

If 1-2 second delays become problematic at scale, consider:

1. **Progressive Delays:** Increase delay only after multiple rapid requests
2. **Jitter:** Add random variation (±200ms) to delay to prevent thundering herd
3. **Adaptive Delays:** Longer delays during high server load
4. **Caching:** Cache results for short periods to reduce processing

---

## Phase 7: Monitoring and Logging

### Step 7.1: Add Logging (Optional)

To monitor scan reload delays in production:

```javascript
app.get("/api/scan/results", authenticateToken, requirePermission(PERMISSIONS.SCAN_READ), async (req, res) => {
  const startTime = Date.now();
  const userId = req.user?.id || 'anonymous';
  
  try {
    const reloadDelay = getScanReloadDelay();
    await delay(reloadDelay);
    
    const results = getLatestResults();
    const duration = Date.now() - startTime;
    
    console.log(`[Scan Reload] Results fetched for user ${userId} - Duration: ${duration}ms`);
    
    if (!results) {
      return res.json({ /* empty results */ });
    }
    res.json(results);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Scan Reload] Error for user ${userId} - Duration: ${duration}ms`, error);
    res.status(500).json({ error: error.message });
  }
});
```

### Step 7.2: Metrics to Track

- Average scan reload response time
- Number of requests per minute/hour
- Server load during peak times
- API rate limit usage
- User experience metrics (time to first result)

---

## Summary

### Files Modified

1. **Backend:**
   - `utils/timing.js` - Add `getScanReloadDelay()` function
   - `routes/scanRoutes.js` - Add delay logic to scan routes
   - `.env` - Add `SCAN_RELOAD_DELAY_MS` configuration

2. **Frontend (Recommended):**
   - Scan component/handler - Update polling intervals
   - Add reload button debouncing
   - Update loading states
   - Use smart polling based on `nextRefreshSeconds`

### Key Benefits

✅ Prevents server overload from rapid polling  
✅ Reduces API rate limit issues  
✅ Consistent response timing  
✅ Configurable delay duration  
✅ Minimal code changes required  
✅ Backward compatible (no API changes)

### Next Steps

1. Implement backend delay logic
2. Test timing consistency
3. Update frontend to handle delay gracefully
4. Consider adding rate limiting for additional protection
5. Monitor performance in production
6. Adjust delay based on server capacity and user feedback

---

## Troubleshooting

### Issue: Delay not working

**Solution:** Check that `SCAN_RELOAD_DELAY_MS` is set in `.env` and the delay function is properly imported. Verify the route handlers are `async`.

### Issue: Delay too long/short

**Solution:** Adjust `SCAN_RELOAD_DELAY_MS` in `.env` file. Minimum: 500ms, Recommended: 1500ms, Maximum: 5000ms.

### Issue: Frontend shows error immediately

**Solution:** Frontend should wait for response. Check network timeout settings and loading state handling. Ensure frontend accounts for the delay in polling intervals.

### Issue: High memory usage under load

**Solution:** Consider reducing delay, implementing rate limiting, or adding request queuing to reduce concurrent connections.

### Issue: Users complaining about slow responses

**Solution:** 
- Reduce delay to 1000ms if 1500ms feels too slow
- Implement caching to reduce processing time
- Use smart polling based on `nextRefreshSeconds` instead of fixed intervals
- Consider progressive delays (only delay after rapid requests)

---

## References

- [Express.js Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Node.js setTimeout Documentation](https://nodejs.org/api/timers.html#timers_settimeout_callback_delay_args)
- [Rate Limiting Best Practices](https://www.cloudflare.com/learning/bots/what-is-rate-limiting/)
- [Throttling and Debouncing](https://css-tricks.com/debouncing-throttling-explained-examples/)

