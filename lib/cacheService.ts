/**
 * Client-side Cache Service
 * Provides in-memory caching with TTL (time-to-live) support for API responses
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  accessCount: number;
  lastAccessed: number;
  createdAt: number;
}

// Cache storage: key -> CacheEntry<T>
const cache = new Map<string, CacheEntry<any>>();

// Default configuration
const DEFAULT_TTL_SECONDS = 5;
const DEFAULT_MAX_SIZE = 100;
const DEFAULT_CLEANUP_INTERVAL_MS = 60000; // 60 seconds

/**
 * Generate a cache key from endpoint and optional parameters
 * @param endpoint - API endpoint
 * @param params - Optional request parameters
 * @returns Cache key string
 */
export function generateCacheKey(endpoint: string, params?: Record<string, any>): string {
  const paramString = params ? JSON.stringify(params) : '';
  return `${endpoint}:${paramString}`;
}

/**
 * Get cached value if it exists and hasn't expired
 * @param key - Cache key
 * @returns Cached value or null if not found/expired
 */
export function get<T>(key: string): T | null {
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

  return entry.value as T;
}

/**
 * Set a value in cache with TTL
 * @param key - Cache key
 * @param value - Value to cache
 * @param ttlSeconds - Time-to-live in seconds (optional, uses default if not provided)
 * @returns True if successfully cached
 */
export function set<T>(key: string, value: T, ttlSeconds: number = DEFAULT_TTL_SECONDS): boolean {
  const now = Date.now();
  const expiresAt = now + (ttlSeconds * 1000);

  cache.set(key, {
    value,
    expiresAt,
    accessCount: 0,
    lastAccessed: now,
    createdAt: now,
  });

  // Enforce max cache size
  if (cache.size > DEFAULT_MAX_SIZE) {
    // Remove oldest entries (by last accessed time)
    const entries = Array.from(cache.entries())
      .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);

    const toRemove = cache.size - DEFAULT_MAX_SIZE;
    for (let i = 0; i < toRemove; i++) {
      cache.delete(entries[i][0]);
    }
  }

  return true;
}

/**
 * Delete a cache entry
 * @param key - Cache key
 * @returns True if entry was deleted
 */
export function del(key: string): boolean {
  return cache.delete(key);
}

/**
 * Clear all cache entries
 */
export function clear(): void {
  cache.clear();
}

/**
 * Clean up expired cache entries
 * Should be called periodically
 * @returns Number of entries cleaned up
 */
export function cleanup(): number {
  const now = Date.now();
  const keysToDelete: string[] = [];

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
 * @returns Cache statistics object
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
    maxSize: DEFAULT_MAX_SIZE,
  };
}

/**
 * Get cache key for scan results endpoint
 * @returns Cache key string
 */
export function getScanResultsCacheKey(): string {
  return generateCacheKey('/api/scan/results');
}

// Start periodic cleanup
let cleanupInterval: NodeJS.Timeout | null = null;

export function startCleanupInterval(): void {
  if (cleanupInterval) {
    return; // Already started
  }

  cleanupInterval = setInterval(() => {
    const cleaned = cleanup();
    if (cleaned > 0) {
      console.log(`[Cache] Cleaned up ${cleaned} expired entries`);
    }
  }, DEFAULT_CLEANUP_INTERVAL_MS);
}

export function stopCleanupInterval(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

// Auto-start cleanup on module load
if (typeof window !== 'undefined') {
  // Browser environment
  startCleanupInterval();
} else if (typeof global !== 'undefined') {
  // Node/React Native environment
  startCleanupInterval();
}

