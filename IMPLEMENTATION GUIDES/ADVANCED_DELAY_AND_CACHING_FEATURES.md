# Advanced Delay and Caching Features Implementation Guide

This guide provides step-by-step instructions for implementing advanced rate limiting and performance optimization features:
1. **Progressive Delays**: Increase delay only after multiple rapid requests
2. **Jitter**: Add random variation (±200ms) to delay to prevent thundering herd
3. **Adaptive Delays**: Longer delays during high server load
4. **Caching**: Cache results for short periods to reduce processing

These features work together to provide intelligent rate limiting that adapts to usage patterns and server conditions, while reducing unnecessary processing through caching.

## Overview

**Current State:**
- Fixed delay applied to all scan requests (from `SCAN_RELOAD_DELAY_MS`)
- No variation in delay timing
- No tracking of rapid request patterns
- No server load awareness
- No caching of results
- All requests processed regardless of recency

**Target State:**
- Progressive delays that increase only after detecting rapid requests
- Random jitter (±200ms) to prevent synchronized requests
- Adaptive delays that scale with server load
- Short-term caching to reduce redundant processing
- Better user experience for normal users
- Enhanced protection against abuse

---

## Phase 1: Environment Variables

### Step 1.1: Add to `.env` file

Add the following configuration to your `.env` file:

```env
# Advanced Delay Configuration
SCAN_RELOAD_DELAY_MS=1500                    # Base delay (ms)
PROGRESSIVE_DELAY_ENABLED=true               # Enable progressive delays
PROGRESSIVE_DELAY_THRESHOLD=3                # Number of rapid requests before increasing delay
PROGRESSIVE_DELAY_WINDOW_MS=5000             # Time window to detect rapid requests (5 seconds)
PROGRESSIVE_DELAY_MULTIPLIER=1.5             # Multiplier for each progressive level (1.5x, 2.25x, 3.375x...)
PROGRESSIVE_DELAY_MAX_LEVEL=5                # Maximum progressive delay level
PROGRESSIVE_DELAY_RESET_SECONDS=30           # Seconds of inactivity before resetting level

# Jitter Configuration
JITTER_ENABLED=true                          # Enable random jitter
JITTER_RANGE_MS=200                          # ±200ms random variation

# Adaptive Delay Configuration
ADAPTIVE_DELAY_ENABLED=true                  # Enable adaptive delays based on load
ADAPTIVE_DELAY_CPU_THRESHOLD=0.7             # CPU usage threshold (0.0-1.0) to trigger adaptive delays
ADAPTIVE_DELAY_MEMORY_THRESHOLD=0.8          # Memory usage threshold (0.0-1.0) to trigger adaptive delays
ADAPTIVE_DELAY_ACTIVE_REQUESTS_THRESHOLD=10  # Number of concurrent requests to trigger adaptive delays
ADAPTIVE_DELAY_MULTIPLIER=2.0                # Multiplier when load is high (2x base delay)

# Caching Configuration
CACHE_ENABLED=true                           # Enable result caching
CACHE_TTL_SECONDS=5                          # Cache time-to-live in seconds (5 seconds default)
CACHE_MAX_SIZE=100                           # Maximum number of cached entries
CACHE_CLEANUP_INTERVAL_SECONDS=60           # Interval to clean up expired cache entries
```

**Recommended Values:**
- **Progressive Delays**: Start with threshold=3, window=5000ms, multiplier=1.5
- **Jitter**: ±200ms is a good balance (prevents thundering herd without noticeable UX impact)
- **Adaptive Delays**: CPU threshold 0.7, memory threshold 0.8, active requests threshold 10
- **Caching**: 5-10 seconds TTL for scan results (balances freshness with performance)

---

## Phase 2: Progressive Delays Implementation

### Step 2.1: Create Progressive Delay Service

Create a new service file `services/progressiveDelayService.js`:

```javascript
/**
 * Progressive Delay Service
 * Tracks request patterns and increases delays for rapid requests
 */

// In-memory storage: userId -> { count, firstRequestTime, level, lastRequestTime }
const requestHistory = new Map();

/**
 * Get progressive delay level for a user
 * @param {string} userId - User identifier (from req.user.id or req.ip)
 * @returns {number} Current delay level (0 = no progression, 1+ = progressive levels)
 */
function getProgressiveLevel(userId) {
  const now = Date.now();
  const history = requestHistory.get(userId);
  
  if (!history) {
    return 0; // No history, start at level 0
  }
  
  // Reset if user has been inactive for reset period
  const resetWindowMs = (parseInt(process.env.PROGRESSIVE_DELAY_RESET_SECONDS, 10) || 30) * 1000;
  if (now - history.lastRequestTime > resetWindowMs) {
    requestHistory.delete(userId);
    return 0;
  }
  
  return history.level || 0;
}

/**
 * Record a request and update progressive level
 * @param {string} userId - User identifier
 * @returns {number} Updated delay level
 */
export function recordRequest(userId) {
  const enabled = process.env.PROGRESSIVE_DELAY_ENABLED === 'true';
  if (!enabled) {
    return 0;
  }
  
  const now = Date.now();
  const threshold = parseInt(process.env.PROGRESSIVE_DELAY_THRESHOLD, 10) || 3;
  const windowMs = parseInt(process.env.PROGRESSIVE_DELAY_WINDOW_MS, 10) || 5000;
  const maxLevel = parseInt(process.env.PROGRESSIVE_DELAY_MAX_LEVEL, 10) || 5;
  
  let history = requestHistory.get(userId);
  
  if (!history) {
    // First request from this user
    history = {
      count: 1,
      firstRequestTime: now,
      level: 0,
      lastRequestTime: now
    };
    requestHistory.set(userId, history);
    return 0;
  }
  
  // Check if requests are within the detection window
  const timeSinceFirst = now - history.firstRequestTime;
  
  if (timeSinceFirst <= windowMs) {
    // Still within the window, increment count
    history.count++;
    
    // If count exceeds threshold, increase level
    if (history.count > threshold && history.level < maxLevel) {
      history.level = Math.min(history.level + 1, maxLevel);
      history.count = 1; // Reset count for next level
      history.firstRequestTime = now; // Reset window
    }
  } else {
    // Window expired, reset
    history.count = 1;
    history.firstRequestTime = now;
    // Level persists but count resets
  }
  
  history.lastRequestTime = now;
  return history.level;
}

/**
 * Calculate progressive delay based on level
 * @param {number} baseDelay - Base delay in milliseconds
 * @param {number} level - Progressive delay level
 * @returns {number} Calculated delay in milliseconds
 */
export function calculateProgressiveDelay(baseDelay, level) {
  if (level === 0) {
    return baseDelay;
  }
  
  const multiplier = parseFloat(process.env.PROGRESSIVE_DELAY_MULTIPLIER, 10) || 1.5;
  const maxLevel = parseInt(process.env.PROGRESSIVE_DELAY_MAX_LEVEL, 10) || 5;
  
  // Cap level at max
  const cappedLevel = Math.min(level, maxLevel);
  
  // Calculate: baseDelay * (multiplier ^ level)
  // Level 1: baseDelay * 1.5
  // Level 2: baseDelay * 2.25
  // Level 3: baseDelay * 3.375
  // etc.
  return Math.round(baseDelay * Math.pow(multiplier, cappedLevel));
}

/**
 * Get current progressive delay for a user
 * @param {string} userId - User identifier
 * @param {number} baseDelay - Base delay in milliseconds
 * @returns {number} Progressive delay in milliseconds
 */
export function getProgressiveDelay(userId, baseDelay) {
  const enabled = process.env.PROGRESSIVE_DELAY_ENABLED === 'true';
  if (!enabled) {
    return baseDelay;
  }
  
  const level = getProgressiveLevel(userId);
  return calculateProgressiveDelay(baseDelay, level);
}

/**
 * Reset progressive delay for a user (useful for testing or admin actions)
 * @param {string} userId - User identifier
 */
export function resetProgressiveDelay(userId) {
  requestHistory.delete(userId);
}

/**
 * Get statistics for monitoring (optional)
 * @returns {Object} Statistics about progressive delays
 */
export function getProgressiveDelayStats() {
  const stats = {
    totalUsers: requestHistory.size,
    usersByLevel: {}
  };
  
  for (const [userId, history] of requestHistory.entries()) {
    const level = history.level || 0;
    stats.usersByLevel[level] = (stats.usersByLevel[level] || 0) + 1;
  }
  
  return stats;
}
```

### Step 2.2: Update Timing Utility

Extend `utils/timing.js` to include progressive delay functions:

```javascript
// ... existing code ...

import { getProgressiveDelay, recordRequest } from '../services/progressiveDelayService.js';

/**
 * Get scan reload delay with progressive delays applied
 * @param {string} userId - User identifier (from req.user.id or req.ip)
 * @returns {number} Delay in milliseconds with progressive delays
 */
export function getScanReloadDelayWithProgression(userId) {
  const baseDelay = getScanReloadDelay();
  
  // Record the request to track patterns
  recordRequest(userId);
  
  // Get progressive delay based on user's request pattern
  return getProgressiveDelay(userId, baseDelay);
}
```

---

## Phase 3: Jitter Implementation

### Step 3.1: Add Jitter to Timing Utility

Extend `utils/timing.js` to include jitter:

```javascript
// ... existing code ...

/**
 * Add random jitter to a delay value
 * @param {number} delayMs - Base delay in milliseconds
 * @returns {number} Delay with jitter applied
 */
export function addJitter(delayMs) {
  const enabled = process.env.JITTER_ENABLED === 'true';
  if (!enabled) {
    return delayMs;
  }
  
  const jitterRange = parseInt(process.env.JITTER_RANGE_MS, 10) || 200;
  
  // Generate random value between -jitterRange and +jitterRange
  const jitter = Math.floor(Math.random() * (jitterRange * 2 + 1)) - jitterRange;
  
  // Apply jitter and ensure minimum delay of 0
  const jitteredDelay = Math.max(0, delayMs + jitter);
  
  return jitteredDelay;
}

/**
 * Get scan reload delay with progressive delays and jitter applied
 * @param {string} userId - User identifier (from req.user.id or req.ip)
 * @returns {number} Delay in milliseconds with progression and jitter
 */
export function getScanReloadDelayWithProgressionAndJitter(userId) {
  const progressiveDelay = getScanReloadDelayWithProgression(userId);
  return addJitter(progressiveDelay);
}
```

---

## Phase 4: Adaptive Delays Implementation

### Step 4.1: Create Server Load Monitor Service

Create a new service file `services/serverLoadService.js`:

```javascript
/**
 * Server Load Monitor Service
 * Monitors CPU, memory, and active request count to determine server load
 */

import os from 'os';

// Track active requests
let activeRequestCount = 0;
let requestStartTimes = new Map();

/**
 * Increment active request counter
 * @param {string} requestId - Unique request identifier
 */
export function startRequest(requestId) {
  activeRequestCount++;
  requestStartTimes.set(requestId, Date.now());
}

/**
 * Decrement active request counter
 * @param {string} requestId - Unique request identifier
 */
export function endRequest(requestId) {
  activeRequestCount = Math.max(0, activeRequestCount - 1);
  requestStartTimes.delete(requestId);
}

/**
 * Get current active request count
 * @returns {number} Number of active requests
 */
export function getActiveRequestCount() {
  return activeRequestCount;
}

/**
 * Get current CPU usage (0.0 to 1.0)
 * Note: This is a simplified implementation. For production, consider using
 * a library like 'os-utils' or 'systeminformation' for more accurate readings.
 * @returns {Promise<number>} CPU usage as a decimal (0.0 = 0%, 1.0 = 100%)
 */
export async function getCpuUsage() {
  return new Promise((resolve) => {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;
    
    cpus.forEach((cpu) => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });
    
    // Wait a bit and measure again
    setTimeout(() => {
      const cpus2 = os.cpus();
      let totalIdle2 = 0;
      let totalTick2 = 0;
      
      cpus2.forEach((cpu) => {
        for (const type in cpu.times) {
          totalTick2 += cpu.times[type];
        }
        totalIdle2 += cpu.times.idle;
      });
      
      const idle = totalIdle2 - totalIdle;
      const total = totalTick2 - totalTick;
      const usage = 1 - (idle / total);
      
      resolve(Math.max(0, Math.min(1, usage))); // Clamp between 0 and 1
    }, 100);
  });
}

/**
 * Get current memory usage (0.0 to 1.0)
 * @returns {number} Memory usage as a decimal (0.0 = 0%, 1.0 = 100%)
 */
export function getMemoryUsage() {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  return usedMemory / totalMemory;
}

/**
 * Check if server is under high load
 * @returns {Promise<boolean>} True if server load is high
 */
export async function isHighLoad() {
  const enabled = process.env.ADAPTIVE_DELAY_ENABLED === 'true';
  if (!enabled) {
    return false;
  }
  
  const cpuThreshold = parseFloat(process.env.ADAPTIVE_DELAY_CPU_THRESHOLD, 10) || 0.7;
  const memoryThreshold = parseFloat(process.env.ADAPTIVE_DELAY_MEMORY_THRESHOLD, 10) || 0.8;
  const activeRequestsThreshold = parseInt(process.env.ADAPTIVE_DELAY_ACTIVE_REQUESTS_THRESHOLD, 10) || 10;
  
  // Check active requests (fastest check)
  if (activeRequestCount >= activeRequestsThreshold) {
    return true;
  }
  
  // Check memory (fast check)
  const memoryUsage = getMemoryUsage();
  if (memoryUsage >= memoryThreshold) {
    return true;
  }
  
  // Check CPU (slower check, async)
  try {
    const cpuUsage = await getCpuUsage();
    if (cpuUsage >= cpuThreshold) {
      return true;
    }
  } catch (error) {
    // If CPU check fails, don't trigger adaptive delay
    console.warn('[ServerLoad] Failed to get CPU usage:', error.message);
  }
  
  return false;
}

/**
 * Get adaptive delay multiplier based on server load
 * @returns {Promise<number>} Multiplier for base delay (1.0 = no change, 2.0 = double delay)
 */
export async function getAdaptiveDelayMultiplier() {
  const highLoad = await isHighLoad();
  
  if (!highLoad) {
    return 1.0; // No multiplier under normal load
  }
  
  const multiplier = parseFloat(process.env.ADAPTIVE_DELAY_MULTIPLIER, 10) || 2.0;
  return multiplier;
}

/**
 * Get server load statistics for monitoring
 * @returns {Promise<Object>} Current server load metrics
 */
export async function getLoadStats() {
  const cpuUsage = await getCpuUsage().catch(() => null);
  const memoryUsage = getMemoryUsage();
  const activeRequests = getActiveRequestCount();
  
  return {
    cpuUsage: cpuUsage !== null ? Math.round(cpuUsage * 100) / 100 : null,
    memoryUsage: Math.round(memoryUsage * 100) / 100,
    activeRequests,
    highLoad: await isHighLoad()
  };
}
```

### Step 4.2: Update Timing Utility with Adaptive Delays

Extend `utils/timing.js` to include adaptive delays:

```javascript
// ... existing code ...

import { getAdaptiveDelayMultiplier } from '../services/serverLoadService.js';

/**
 * Get scan reload delay with all features applied (progressive, jitter, adaptive)
 * @param {string} userId - User identifier (from req.user.id or req.ip)
 * @returns {Promise<number>} Final delay in milliseconds
 */
export async function getScanReloadDelayAdvanced(userId) {
  // Start with base delay
  let delay = getScanReloadDelay();
  
  // Apply progressive delays
  const progressiveDelay = getScanReloadDelayWithProgression(userId);
  delay = progressiveDelay;
  
  // Apply adaptive delays based on server load
  const adaptiveMultiplier = await getAdaptiveDelayMultiplier();
  delay = Math.round(delay * adaptiveMultiplier);
  
  // Apply jitter last
  delay = addJitter(delay);
  
  return delay;
}
```

---

## Phase 5: Caching Implementation

### Step 5.1: Create Cache Service

Create a new service file `services/cacheService.js`:

```javascript
/**
 * Cache Service
 * Provides in-memory caching with TTL (time-to-live) support
 */

// Cache storage: key -> { value, expiresAt, accessCount, lastAccessed }
const cache = new Map();

/**
 * Generate a cache key from request parameters
 * @param {string} endpoint - API endpoint
 * @param {Object} params - Request parameters (optional)
 * @returns {string} Cache key
 */
function generateCacheKey(endpoint, params = {}) {
  const paramString = JSON.stringify(params);
  return `${endpoint}:${paramString}`;
}

/**
 * Get cached value if it exists and hasn't expired
 * @param {string} key - Cache key
 * @returns {Object|null} Cached value or null if not found/expired
 */
export function get(key) {
  const enabled = process.env.CACHE_ENABLED === 'true';
  if (!enabled) {
    return null;
  }
  
  const entry = cache.get(key);
  
  if (!entry) {
    return null; // Not in cache
  }
  
  const now = Date.now();
  
  // Check if expired
  if (now >= entry.expiresAt) {
    cache.delete(key);
    return null; // Expired
  }
  
  // Update access statistics
  entry.accessCount = (entry.accessCount || 0) + 1;
  entry.lastAccessed = now;
  
  return entry.value;
}

/**
 * Set a value in cache with TTL
 * @param {string} key - Cache key
 * @param {*} value - Value to cache
 * @param {number} ttlSeconds - Time-to-live in seconds (optional, uses default if not provided)
 * @returns {boolean} True if successfully cached
 */
export function set(key, value, ttlSeconds = null) {
  const enabled = process.env.CACHE_ENABLED === 'true';
  if (!enabled) {
    return false;
  }
  
  const defaultTtl = parseInt(process.env.CACHE_TTL_SECONDS, 10) || 5;
  const ttl = ttlSeconds !== null ? ttlSeconds : defaultTtl;
  
  const now = Date.now();
  const expiresAt = now + (ttl * 1000);
  
  cache.set(key, {
    value,
    expiresAt,
    accessCount: 0,
    lastAccessed: now,
    createdAt: now
  });
  
  // Enforce max cache size
  const maxSize = parseInt(process.env.CACHE_MAX_SIZE, 10) || 100;
  if (cache.size > maxSize) {
    // Remove oldest entries (by last accessed time)
    const entries = Array.from(cache.entries())
      .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
    
    const toRemove = cache.size - maxSize;
    for (let i = 0; i < toRemove; i++) {
      cache.delete(entries[i][0]);
    }
  }
  
  return true;
}

/**
 * Delete a cache entry
 * @param {string} key - Cache key
 * @returns {boolean} True if entry was deleted
 */
export function del(key) {
  return cache.delete(key);
}

/**
 * Clear all cache entries
 */
export function clear() {
  cache.clear();
}

/**
 * Clean up expired cache entries
 * Should be called periodically
 */
export function cleanup() {
  const now = Date.now();
  const keysToDelete = [];
  
  for (const [key, entry] of cache.entries()) {
    if (now >= entry.expiresAt) {
      keysToDelete.push(key);
    }
  }
  
  keysToDelete.forEach(key => cache.delete(key));
  
  return keysToDelete.length;
}

/**
 * Get cache statistics
 * @returns {Object} Cache statistics
 */
export function getStats() {
  const now = Date.now();
  let expiredCount = 0;
  let totalAccessCount = 0;
  
  for (const entry of cache.values()) {
    if (now >= entry.expiresAt) {
      expiredCount++;
    }
    totalAccessCount += (entry.accessCount || 0);
  }
  
  return {
    size: cache.size,
    expiredCount,
    activeCount: cache.size - expiredCount,
    totalAccessCount,
    maxSize: parseInt(process.env.CACHE_MAX_SIZE, 10) || 100
  };
}

/**
 * Get cache key for scan results endpoint
 * @param {string} userId - User identifier (optional, for user-specific caching)
 * @returns {string} Cache key
 */
export function getScanResultsCacheKey(userId = null) {
  if (userId) {
    return generateCacheKey('/api/scan/results', { userId });
  }
  return generateCacheKey('/api/scan/results', {});
}

// Start periodic cleanup
const cleanupInterval = setInterval(() => {
  const cleaned = cleanup();
  if (cleaned > 0) {
    console.log(`[Cache] Cleaned up ${cleaned} expired entries`);
  }
}, (parseInt(process.env.CACHE_CLEANUP_INTERVAL_SECONDS, 10) || 60) * 1000);

// Cleanup on process exit
process.on('SIGTERM', () => {
  clearInterval(cleanupInterval);
  clear();
});

process.on('SIGINT', () => {
  clearInterval(cleanupInterval);
  clear();
});
```

### Step 5.2: Update Scan Routes with Caching

Modify `routes/scanRoutes.js` to use caching:

```javascript
// ... existing imports ...
import { getScanResultsCacheKey } from '../services/cacheService.js';
import { get, set } from '../services/cacheService.js';
import { startRequest, endRequest } from '../services/serverLoadService.js';
import { getScanReloadDelayAdvanced } from '../utils/timing.js';

export function registerScanRoutes(app, { apiKey }) {
  // Get latest scan results - requires scan:read (all users)
  app.get("/api/scan/results", authenticateToken, requirePermission(PERMISSIONS.SCAN_READ), async (req, res) => {
    const requestId = `${req.user?.id || req.ip}-${Date.now()}-${Math.random()}`;
    startRequest(requestId);
    
    try {
      // Check cache first
      const cacheKey = getScanResultsCacheKey(req.user?.id);
      const cachedResult = get(cacheKey);
      
      if (cachedResult) {
        // Return cached result immediately (no delay for cached responses)
        return res.json(cachedResult);
      }
      
      // Get advanced delay (progressive + adaptive + jitter)
      const userId = req.user?.id || req.ip;
      const reloadDelay = await getScanReloadDelayAdvanced(userId);
      
      // Delay before returning results to prevent rapid polling
      await delay(reloadDelay);
      
      const results = getLatestResults();
      const responseData = results || {
        arbs: [],
        gameMap: {},
        playerNameMap: {},
        gameTimeMap: {},
        gameStatusMap: {},
        date: null,
        timestamp: null,
        nextRefreshSeconds: 60
      };
      
      // Cache the results
      set(cacheKey, responseData);
      
      res.json(responseData);
    } catch (error) {
      res.status(500).json({ error: error.message });
    } finally {
      endRequest(requestId);
    }
  });

  // Trigger a manual scan - requires scan:run (basic_user+)
  app.post("/api/scan/run", authenticateToken, requirePermission(PERMISSIONS.SCAN_RUN), async (req, res) => {
    const requestId = `${req.user?.id || req.ip}-${Date.now()}-${Math.random()}`;
    startRequest(requestId);
    
    try {
      // Get advanced delay
      const userId = req.user?.id || req.ip;
      const reloadDelay = await getScanReloadDelayAdvanced(userId);
      
      // Delay before starting scan to prevent rapid triggering
      await delay(reloadDelay);
      
      // Clear cache when new scan is triggered
      const cacheKey = getScanResultsCacheKey(req.user?.id);
      del(cacheKey);
      
      // Run scan
      const results = await runScan(apiKey);
      
      // Cache the new results
      if (results) {
        set(cacheKey, results);
      }
      
      res.json(results);
    } catch (error) {
      res.status(500).json({ error: error.message });
    } finally {
      endRequest(requestId);
    }
  });

  // ... rest of routes remain the same ...
}
```

---

## Phase 6: Integration and Testing

### Step 6.1: Update Imports in Timing Utility

Ensure `utils/timing.js` has all necessary imports:

```javascript
/**
 * Utility function to create a delay/pause
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise<void>}
 */
export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ... existing getLoginDelay and getScanReloadDelay functions ...

import { getProgressiveDelay, recordRequest } from '../services/progressiveDelayService.js';
import { getAdaptiveDelayMultiplier } from '../services/serverLoadService.js';

// ... rest of the functions as described in previous phases ...
```

### Step 6.2: Create Monitoring Endpoint (Optional)

Add a monitoring endpoint to view system status in `routes/scanRoutes.js`:

```javascript
// Add this route for monitoring (admin only)
app.get("/api/scan/stats", authenticateToken, requirePermission(PERMISSIONS.SCAN_CONTROL), async (req, res) => {
  try {
    const { getProgressiveDelayStats } = await import('../services/progressiveDelayService.js');
    const { getLoadStats } = await import('../services/serverLoadService.js');
    const { getStats } = await import('../services/cacheService.js');
    
    const stats = {
      progressiveDelays: getProgressiveDelayStats(),
      serverLoad: await getLoadStats(),
      cache: getStats(),
      timestamp: Date.now()
    };
    
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

---

## Phase 7: Testing

### Step 7.1: Test Progressive Delays

1. **Test normal user (no progression):**
   ```bash
   # Make 2 requests within 5 seconds (below threshold of 3)
   curl -X GET http://localhost:3002/api/scan/results \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -w "\nTime: %{time_total}s\n"
   
   # Expected: ~1.5 seconds (base delay + jitter)
   ```

2. **Test rapid requests (progressive delay):**
   ```bash
   # Make 4 rapid requests within 5 seconds
   for i in {1..4}; do
     curl -X GET http://localhost:3002/api/scan/results \
       -H "Authorization: Bearer YOUR_TOKEN" \
       -w "\nRequest $i: %{time_total}s\n" &
   done
   wait
   
   # Expected: 
   # Request 1-3: ~1.5 seconds (base delay)
   # Request 4+: ~2.25 seconds (1.5x multiplier)
   # Request 5+: ~3.375 seconds (2.25x multiplier)
   ```

3. **Test reset after inactivity:**
   ```bash
   # Make rapid requests
   # Wait 30+ seconds
   # Make another request
   # Expected: Back to base delay
   ```

### Step 7.2: Test Jitter

```javascript
// Test script to verify jitter variation
async function testJitter() {
  const delays = [];
  for (let i = 0; i < 10; i++) {
    const start = Date.now();
    await fetch('/api/scan/results', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const duration = Date.now() - start;
    delays.push(duration);
  }
  
  const min = Math.min(...delays);
  const max = Math.max(...delays);
  const variance = max - min;
  
  console.log(`Min: ${min}ms, Max: ${max}ms, Variance: ${variance}ms`);
  console.log('Expected variance: ~400ms (200ms jitter range * 2)');
}
```

### Step 7.3: Test Adaptive Delays

1. **Simulate high load:**
   ```javascript
   // Create many concurrent requests to trigger adaptive delays
   const requests = Array(20).fill(0).map(() => 
     fetch('/api/scan/results', {
       headers: { 'Authorization': `Bearer ${token}` }
     })
   );
   
   const start = Date.now();
   await Promise.all(requests);
   const duration = Date.now() - start;
   
   console.log(`20 concurrent requests took ${duration}ms`);
   console.log('Expected: Longer delays due to adaptive multiplier');
   ```

2. **Monitor server load:**
   ```bash
   curl -X GET http://localhost:3002/api/scan/stats \
     -H "Authorization: Bearer ADMIN_TOKEN" | jq
   
   # Check serverLoad.cpuUsage, memoryUsage, activeRequests
   ```

### Step 7.4: Test Caching

1. **Test cache hit (fast response):**
   ```bash
   # First request (cache miss)
   time curl -X GET http://localhost:3002/api/scan/results \
     -H "Authorization: Bearer YOUR_TOKEN"
   
   # Second request within 5 seconds (cache hit)
   time curl -X GET http://localhost:3002/api/scan/results \
     -H "Authorization: Bearer YOUR_TOKEN"
   
   # Expected: Second request is much faster (< 100ms)
   ```

2. **Test cache expiration:**
   ```bash
   # Make request
   # Wait 6+ seconds (past TTL)
   # Make another request
   # Expected: Cache miss, full delay applied
   ```

3. **Test cache invalidation on scan:**
   ```bash
   # Get cached results
   # Trigger new scan: POST /api/scan/run
   # Get results again
   # Expected: Fresh results, cache updated
   ```

---

## Phase 8: Monitoring and Logging

### Step 8.1: Add Logging

Add logging to track feature usage:

```javascript
// In routes/scanRoutes.js, add logging:
app.get("/api/scan/results", authenticateToken, requirePermission(PERMISSIONS.SCAN_READ), async (req, res) => {
  const requestId = `${req.user?.id || req.ip}-${Date.now()}-${Math.random()}`;
  const startTime = Date.now();
  startRequest(requestId);
  
  try {
    const userId = req.user?.id || req.ip;
    const cacheKey = getScanResultsCacheKey(userId);
    const cachedResult = get(cacheKey);
    
    if (cachedResult) {
      const duration = Date.now() - startTime;
      console.log(`[Scan] Cache hit for user ${userId} - Duration: ${duration}ms`);
      return res.json(cachedResult);
    }
    
    const reloadDelay = await getScanReloadDelayAdvanced(userId);
    const { getProgressiveLevel } = await import('../services/progressiveDelayService.js');
    const { getAdaptiveDelayMultiplier } = await import('../services/serverLoadService.js');
    
    const level = getProgressiveLevel(userId);
    const adaptiveMultiplier = await getAdaptiveDelayMultiplier();
    
    console.log(`[Scan] Cache miss for user ${userId} - Delay: ${reloadDelay}ms (Level: ${level}, Adaptive: ${adaptiveMultiplier}x)`);
    
    await delay(reloadDelay);
    
    const results = getLatestResults();
    const responseData = results || { /* empty */ };
    
    set(cacheKey, responseData);
    
    const duration = Date.now() - startTime;
    console.log(`[Scan] Results fetched for user ${userId} - Duration: ${duration}ms`);
    
    res.json(responseData);
  } catch (error) {
    console.error(`[Scan] Error for user ${req.user?.id || req.ip}:`, error);
    res.status(500).json({ error: error.message });
  } finally {
    endRequest(requestId);
  }
});
```

### Step 8.2: Metrics to Track

Monitor these metrics:
- Average delay times (base, progressive, adaptive)
- Cache hit rate
- Progressive delay level distribution
- Server load metrics (CPU, memory, active requests)
- Request patterns (rapid requests detected)

---

## Summary

### Files Created

1. **`services/progressiveDelayService.js`** - Progressive delay tracking and calculation
2. **`services/serverLoadService.js`** - Server load monitoring and adaptive delays
3. **`services/cacheService.js`** - In-memory caching with TTL

### Files Modified

1. **`utils/timing.js`** - Added progressive, jitter, and adaptive delay functions
2. **`routes/scanRoutes.js`** - Integrated all features into scan endpoints
3. **`.env`** - Added configuration variables

### Key Benefits

✅ **Progressive Delays**: Only penalize users making rapid requests  
✅ **Jitter**: Prevents synchronized requests (thundering herd)  
✅ **Adaptive Delays**: Automatically scales with server load  
✅ **Caching**: Reduces processing for frequently accessed data  
✅ **Better UX**: Normal users experience minimal delays  
✅ **Enhanced Protection**: Multiple layers of rate limiting  
✅ **Configurable**: All features can be enabled/disabled via environment variables

### Configuration Summary

- **Progressive Delays**: Enabled by default, increases delay after 3 rapid requests
- **Jitter**: ±200ms random variation to prevent synchronization
- **Adaptive Delays**: 2x multiplier when CPU > 70%, memory > 80%, or >10 active requests
- **Caching**: 5-second TTL, max 100 entries, auto-cleanup every 60 seconds

### Next Steps

1. Implement all service files
2. Update timing utility and routes
3. Add environment variables
4. Test each feature individually
5. Test feature interactions
6. Monitor in production
7. Adjust thresholds based on usage patterns

---

## Troubleshooting

### Issue: Progressive delays not working

**Solution:** 
- Check `PROGRESSIVE_DELAY_ENABLED=true` in `.env`
- Verify `recordRequest()` is called before delay calculation
- Check that user identification (userId) is consistent

### Issue: Jitter causing delays to be too long

**Solution:** 
- Reduce `JITTER_RANGE_MS` (default 200ms)
- Set `JITTER_ENABLED=false` to disable
- Jitter is applied last, so it adds to already-progressive/adaptive delays

### Issue: Adaptive delays always active

**Solution:** 
- Check server load thresholds (may be too low)
- Verify CPU/memory monitoring is working correctly
- Consider increasing thresholds if server is consistently under load

### Issue: Cache not working

**Solution:** 
- Check `CACHE_ENABLED=true` in `.env`
- Verify cache key generation is consistent
- Check cache TTL is appropriate for your use case
- Monitor cache stats via `/api/scan/stats` endpoint

### Issue: Memory usage increasing

**Solution:** 
- Reduce `CACHE_MAX_SIZE` (default 100)
- Reduce `PROGRESSIVE_DELAY_RESET_SECONDS` to clean up history faster
- Monitor cache cleanup is running (check logs)

### Issue: Delays too aggressive

**Solution:** 
- Reduce `PROGRESSIVE_DELAY_MULTIPLIER` (default 1.5)
- Reduce `ADAPTIVE_DELAY_MULTIPLIER` (default 2.0)
- Increase `PROGRESSIVE_DELAY_THRESHOLD` (default 3)
- Increase `PROGRESSIVE_DELAY_WINDOW_MS` (default 5000)

---

## References

- [Rate Limiting Best Practices](https://www.cloudflare.com/learning/bots/what-is-rate-limiting/)
- [Exponential Backoff](https://en.wikipedia.org/wiki/Exponential_backoff)
- [Thundering Herd Problem](https://en.wikipedia.org/wiki/Thundering_herd_problem)
- [Cache-Aside Pattern](https://docs.microsoft.com/en-us/azure/architecture/patterns/cache-aside)
- [Node.js os Module](https://nodejs.org/api/os.html)

