# Refresh Token Implementation Guide

This guide provides step-by-step instructions for implementing refresh tokens in the Hedgeway Server to enable longer user sessions without frequent re-logins.

## Overview

**Current State:**
- Single JWT token with 24-hour expiration
- Stateless authentication
- Users must re-login when token expires

**Target State:**
- Short-lived access tokens (15-60 minutes)
- Long-lived refresh tokens (7-30 days)
- Automatic token refresh on frontend
- Token revocation support

---

## Phase 1: Database Schema Changes

### Step 1.1: Create Refresh Tokens Table

Add this to `database/schema.sql` or create a migration:

```sql
-- Refresh tokens table
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL, -- bcrypt hash for verification
  lookup_hash VARCHAR(255) NOT NULL UNIQUE, -- SHA-256 hash for fast lookup
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  device_info VARCHAR(255), -- Optional: browser/device identifier
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT valid_expiry CHECK (expires_at > created_at)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_lookup_hash ON refresh_tokens(lookup_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

-- Cleanup function for expired tokens (optional, can be run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM refresh_tokens WHERE expires_at < CURRENT_TIMESTAMP;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
```

### Step 1.2: Run Database Migration

Execute the SQL above in your database, or add it to your initialization script.

---

## Phase 2: Environment Variables

### Step 2.1: Add to `.env` file

```env
# Existing
JWT_SECRET=your-existing-secret

# New - Refresh token configuration
JWT_REFRESH_SECRET=your-refresh-token-secret-different-from-jwt-secret
JWT_ACCESS_EXPIRES_IN=15m          # Short-lived access token (15 minutes)
JWT_REFRESH_EXPIRES_IN=7d          # Long-lived refresh token (7 days)

# Optional: Token rotation
JWT_REFRESH_ROTATION=true          # Enable refresh token rotation
```

**Important:** Use a different secret for refresh tokens than access tokens for better security.

---

## Phase 3: Backend Implementation

### Step 3.1: Create Refresh Token Service

Create `services/refreshTokenService.js`:

```javascript
import bcrypt from 'bcrypt';
import { query } from '../config/database.js';
import crypto from 'crypto';

/**
 * Generate a secure random refresh token
 */
export function generateRefreshToken() {
  return crypto.randomBytes(64).toString('hex');
}

/**
 * Parse expiration string (e.g., "7d", "30d", "24h") and return Date
 */
export function parseExpiration(expiresIn) {
  const date = new Date();
  const match = expiresIn.match(/^(\d+)([dhms])$/);
  
  if (!match) {
    throw new Error(`Invalid expiration format: ${expiresIn}. Use format like "7d", "24h", "30m"`);
  }
  
  const value = parseInt(match[1]);
  const unit = match[2];
  
  switch (unit) {
    case 'd':
      date.setDate(date.getDate() + value);
      break;
    case 'h':
      date.setHours(date.getHours() + value);
      break;
    case 'm':
      date.setMinutes(date.getMinutes() + value);
      break;
    case 's':
      date.setSeconds(date.getSeconds() + value);
      break;
    default:
      throw new Error(`Unknown time unit: ${unit}`);
  }
  
  return date;
}

/**
 * Create a lookup hash (SHA-256) for fast database lookup
 * This is deterministic and allows us to find the token quickly
 */
export function createLookupHash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Hash a refresh token for secure storage (bcrypt with salt)
 */
export async function hashRefreshToken(token) {
  return await bcrypt.hash(token, 10);
}

/**
 * Verify a refresh token against its hash
 */
export async function verifyRefreshToken(token, hash) {
  return await bcrypt.compare(token, hash);
}

/**
 * Store a refresh token in the database
 * We store both a lookup hash (for fast search) and verification hash (for security)
 */
export async function storeRefreshToken(userId, token, expiresAt, deviceInfo = null) {
  const lookupHash = createLookupHash(token);
  const verificationHash = await hashRefreshToken(token);
  
  const result = await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, lookup_hash, expires_at, device_info)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, user_id, expires_at, created_at`,
    [userId, verificationHash, lookupHash, expiresAt, deviceInfo]
  );
  return result.rows[0];
}

/**
 * Find a refresh token by lookup hash and verify it
 */
export async function findAndVerifyRefreshToken(token) {
  const lookupHash = createLookupHash(token);
  
  const result = await query(
    `SELECT id, user_id, token_hash, expires_at, device_info, created_at, last_used_at
     FROM refresh_tokens
     WHERE lookup_hash = $1 AND expires_at > CURRENT_TIMESTAMP`,
    [lookupHash]
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const storedToken = result.rows[0];
  
  // Verify the token against the stored bcrypt hash
  const isValid = await verifyRefreshToken(token, storedToken.token_hash);
  
  if (!isValid) {
    return null;
  }
  
  return storedToken;
}

/**
 * Update last_used_at timestamp
 */
export async function updateTokenLastUsed(tokenId) {
  await query(
    `UPDATE refresh_tokens
     SET last_used_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [tokenId]
  );
}

/**
 * Delete a refresh token (logout)
 */
export async function deleteRefreshToken(token) {
  const lookupHash = createLookupHash(token);
  const result = await query(
    `DELETE FROM refresh_tokens WHERE lookup_hash = $1 RETURNING id`,
    [lookupHash]
  );
  return result.rows.length > 0;
}

/**
 * Delete all refresh tokens for a user (logout all devices)
 */
export async function deleteAllUserRefreshTokens(userId) {
  const result = await query(
    `DELETE FROM refresh_tokens WHERE user_id = $1 RETURNING id`,
    [userId]
  );
  return result.rowCount;
}

/**
 * Delete expired tokens (cleanup)
 */
export async function cleanupExpiredTokens() {
  const result = await query(
    `DELETE FROM refresh_tokens WHERE expires_at < CURRENT_TIMESTAMP`
  );
  return result.rowCount;
}

/**
 * Get all active refresh tokens for a user
 */
export async function getUserRefreshTokens(userId) {
  const result = await query(
    `SELECT id, device_info, created_at, last_used_at, expires_at
     FROM refresh_tokens
     WHERE user_id = $1 AND expires_at > CURRENT_TIMESTAMP
     ORDER BY last_used_at DESC`,
    [userId]
  );
  return result.rows;
}
```

### Step 3.2: Update JWT Auth Middleware

Update `middleware/jwtAuth.js`:

**Add these new functions:**

```javascript
import jwt from 'jsonwebtoken';
import { config } from '@dotenvx/dotenvx';

config();

const JWT_SECRET = process.env.JWT_SECRET?.trim();
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET?.trim();
const JWT_ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

// ... existing authenticateToken function stays the same ...

/**
 * Generate access token (short-lived)
 */
export function generateAccessToken(user) {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET not configured');
  }

  const payload = {
    userId: user.id || user.userId,
    role: user.role,
    permissions: user.permissions || [],
    email: user.email,
    type: 'access' // Token type identifier
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_ACCESS_EXPIRES_IN });
}

/**
 * Generate refresh token JWT (optional - if you want JWT-based refresh tokens)
 * OR use the service function for random tokens
 */
export function generateRefreshTokenJWT(user) {
  if (!JWT_REFRESH_SECRET) {
    throw new Error('JWT_REFRESH_SECRET not configured');
  }

  const payload = {
    userId: user.id || user.userId,
    type: 'refresh'
  };

  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN });
}

/**
 * Verify refresh token JWT (if using JWT-based refresh tokens)
 */
export function verifyRefreshTokenJWT(token) {
  if (!JWT_REFRESH_SECRET) {
    throw new Error('JWT_REFRESH_SECRET not configured');
  }
  return jwt.verify(token, JWT_REFRESH_SECRET);
}

// Keep existing generateToken for backward compatibility (or remove if migrating fully)
export function generateToken(user) {
  return generateAccessToken(user);
}
```

### Step 3.3: Update Auth Routes

Update `routes/authRoutes.js`:

**Add imports at the top:**

```javascript
import {
  generateRefreshToken,
  storeRefreshToken,
  findAndVerifyRefreshToken,
  updateTokenLastUsed,
  deleteRefreshToken,
  deleteAllUserRefreshTokens,
  parseExpiration
} from '../services/refreshTokenService.js';
import { generateAccessToken } from '../middleware/jwtAuth.js';
import { findUserById } from '../services/userService.js';
```

**Update the `/register` endpoint:**

```javascript
router.post('/register', validateRegister, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, role = 'free_user' } = req.body;

    const user = await createUser(email, password, role);
    
    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshTokenValue = generateRefreshToken();
    
    // Calculate expiration
    const expiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
    const expiresAt = parseExpiration(expiresIn);
    
    // Store refresh token (service handles hashing)
    await storeRefreshToken(user.id, refreshTokenValue, expiresAt);

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      accessToken,
      refreshToken: refreshTokenValue, // Send plain token to client (only time it's visible)
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
```

**Update the `/login` endpoint:**

```javascript
router.post('/login', validateLogin, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find user
    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password
    const isValid = await verifyPassword(user, password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshTokenValue = generateRefreshToken();
    
    // Calculate expiration
    const expiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
    const expiresAt = parseExpiration(expiresIn);
    
    // Optional: Extract device info from request
    const deviceInfo = req.headers['user-agent'] || null;
    
    // Store refresh token (service handles hashing)
    await storeRefreshToken(user.id, refreshTokenValue, expiresAt, deviceInfo);

    res.json({
      success: true,
      message: 'Login successful',
      accessToken,
      refreshToken: refreshTokenValue,
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

**Add new `/refresh` endpoint:**

```javascript
/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    // Find and verify the token (handles lookup and verification)
    const storedToken = await findAndVerifyRefreshToken(refreshToken);
    
    if (!storedToken) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    // Get user information
    const user = await findUserById(storedToken.user_id);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Update last used timestamp
    await updateTokenLastUsed(storedToken.id);

    // Generate new access token
    const accessToken = generateAccessToken(user);

    // Optional: Token rotation - generate new refresh token
    let newRefreshToken = null;
    if (process.env.JWT_REFRESH_ROTATION === 'true') {
      const newRefreshTokenValue = generateRefreshToken();
      
      // Calculate new expiration
      const expiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
      const expiresAt = parseExpiration(expiresIn);
      
      // Store new token
      await storeRefreshToken(user.id, newRefreshTokenValue, expiresAt, storedToken.device_info);
      
      // Delete old token
      await deleteRefreshToken(refreshToken);
      
      newRefreshToken = newRefreshTokenValue;
    }

    res.json({
      success: true,
      accessToken,
      ...(newRefreshToken && { refreshToken: newRefreshToken }),
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

**Add `/logout` endpoint:**

```javascript
/**
 * POST /api/auth/logout
 * Logout and invalidate refresh token
 */
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      // Delete specific token
      await deleteRefreshToken(refreshToken);
    } else {
      // If no token provided, could delete all tokens for user (logout all devices)
      // await deleteAllUserRefreshTokens(req.user.userId);
    }

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

**Add `/logout-all` endpoint (optional):**

```javascript
/**
 * POST /api/auth/logout-all
 * Logout from all devices (invalidate all refresh tokens)
 */
router.post('/logout-all', authenticateToken, async (req, res) => {
  try {
    const deletedCount = await deleteAllUserRefreshTokens(req.user.userId);
    
    res.json({
      success: true,
      message: `Logged out from ${deletedCount} device(s)`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

**Add `/devices` endpoint (optional - list active sessions):**

```javascript
/**
 * GET /api/auth/devices
 * Get list of active refresh tokens (devices)
 */
router.get('/devices', authenticateToken, async (req, res) => {
  try {
    const tokens = await getUserRefreshTokens(req.user.userId);
    
    res.json({
      devices: tokens.map(token => ({
        id: token.id,
        deviceInfo: token.device_info,
        createdAt: token.created_at,
        lastUsedAt: token.last_used_at,
        expiresAt: token.expires_at
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

---

## Phase 4: Frontend Implementation

### Step 4.1: Token Storage Utility

Create a token storage utility (example for web):

**Web (JavaScript/TypeScript):**

```javascript
// utils/tokenStorage.js

const ACCESS_TOKEN_KEY = 'hedgeway_access_token';
const REFRESH_TOKEN_KEY = 'hedgeway_refresh_token';
const TOKEN_EXPIRY_KEY = 'hedgeway_token_expiry';

export const tokenStorage = {
  // Store tokens
  setTokens(accessToken, refreshToken, expiresIn) {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    
    // Calculate expiry timestamp
    const expiresAt = Date.now() + (parseInt(expiresIn) * 1000);
    localStorage.setItem(TOKEN_EXPIRY_KEY, expiresAt.toString());
  },

  // Get access token
  getAccessToken() {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  },

  // Get refresh token
  getRefreshToken() {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },

  // Check if token is expired or about to expire (within 1 minute)
  isTokenExpired() {
    const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
    if (!expiry) return true;
    
    const expiryTime = parseInt(expiry);
    const now = Date.now();
    const buffer = 60 * 1000; // 1 minute buffer
    
    return now >= (expiryTime - buffer);
  },

  // Clear all tokens
  clearTokens() {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
  },

  // Check if user is logged in
  isAuthenticated() {
    return !!this.getAccessToken() && !!this.getRefreshToken();
  }
};
```

**React Native (Mobile):**

```javascript
// utils/tokenStorage.js
import AsyncStorage from '@react-native-async-storage/async-storage';

const ACCESS_TOKEN_KEY = 'hedgeway_access_token';
const REFRESH_TOKEN_KEY = 'hedgeway_refresh_token';
const TOKEN_EXPIRY_KEY = 'hedgeway_token_expiry';

export const tokenStorage = {
  async setTokens(accessToken, refreshToken, expiresIn) {
    await AsyncStorage.multiSet([
      [ACCESS_TOKEN_KEY, accessToken],
      [REFRESH_TOKEN_KEY, refreshToken],
      [TOKEN_EXPIRY_KEY, (Date.now() + parseInt(expiresIn) * 1000).toString()]
    ]);
  },

  async getAccessToken() {
    return await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
  },

  async getRefreshToken() {
    return await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
  },

  async isTokenExpired() {
    const expiry = await AsyncStorage.getItem(TOKEN_EXPIRY_KEY);
    if (!expiry) return true;
    
    const expiryTime = parseInt(expiry);
    const now = Date.now();
    const buffer = 60 * 1000;
    
    return now >= (expiryTime - buffer);
  },

  async clearTokens() {
    await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, TOKEN_EXPIRY_KEY]);
  },

  async isAuthenticated() {
    const accessToken = await this.getAccessToken();
    const refreshToken = await this.getRefreshToken();
    return !!accessToken && !!refreshToken;
  }
};
```

### Step 4.2: API Client with Auto-Refresh

Create an API client that handles token refresh automatically:

**Web (JavaScript/TypeScript):**

```javascript
// utils/apiClient.js
import { tokenStorage } from './tokenStorage.js';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3002';

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  
  failedQueue = [];
};

// Refresh token function
async function refreshAccessToken() {
  const refreshToken = tokenStorage.getRefreshToken();
  
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to refresh token');
    }

    const data = await response.json();
    
    // Update stored tokens
    tokenStorage.setTokens(
      data.accessToken,
      data.refreshToken || refreshToken, // Use new refresh token if rotation enabled
      data.expiresIn || '900' // Default 15 minutes
    );

    return data.accessToken;
  } catch (error) {
    // Refresh failed - clear tokens and redirect to login
    tokenStorage.clearTokens();
    window.location.href = '/login';
    throw error;
  }
}

// Main API request function
export async function apiRequest(url, options = {}) {
  // Check if token is expired and refresh if needed
  if (tokenStorage.isTokenExpired() && !isRefreshing) {
    isRefreshing = true;
    try {
      await refreshAccessToken();
    } catch (error) {
      processQueue(error, null);
      throw error;
    } finally {
      isRefreshing = false;
    }
  }

  // If refresh is in progress, queue this request
  if (isRefreshing) {
    return new Promise((resolve, reject) => {
      failedQueue.push({ resolve, reject });
    }).then(token => {
      return apiRequest(url, { ...options, token });
    });
  }

  const accessToken = tokenStorage.getAccessToken();
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  let response = await fetch(`${API_BASE_URL}${url}`, {
    ...options,
    headers,
  });

  // If 401, try to refresh token once
  if (response.status === 401 && accessToken) {
    if (!isRefreshing) {
      isRefreshing = true;
      
      try {
        const newAccessToken = await refreshAccessToken();
        
        // Retry original request with new token
        headers['Authorization'] = `Bearer ${newAccessToken}`;
        response = await fetch(`${API_BASE_URL}${url}`, {
          ...options,
          headers,
        });
        
        processQueue(null, newAccessToken);
      } catch (error) {
        processQueue(error, null);
        throw error;
      } finally {
        isRefreshing = false;
      }
    } else {
      // Wait for ongoing refresh
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then(token => {
        headers['Authorization'] = `Bearer ${token}`;
        return fetch(`${API_BASE_URL}${url}`, { ...options, headers });
      });
    }
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}

// Convenience methods
export const api = {
  get: (url, options) => apiRequest(url, { ...options, method: 'GET' }),
  post: (url, data, options) => apiRequest(url, { ...options, method: 'POST', body: JSON.stringify(data) }),
  put: (url, data, options) => apiRequest(url, { ...options, method: 'PUT', body: JSON.stringify(data) }),
  patch: (url, data, options) => apiRequest(url, { ...options, method: 'PATCH', body: JSON.stringify(data) }),
  delete: (url, options) => apiRequest(url, { ...options, method: 'DELETE' }),
};
```

### Step 4.3: Update Login/Register Functions

```javascript
// services/authService.js
import { api } from '../utils/apiClient.js';
import { tokenStorage } from '../utils/tokenStorage.js';

export const authService = {
  async login(email, password) {
    const response = await api.post('/api/auth/login', { email, password });
    
    // Store tokens
    tokenStorage.setTokens(
      response.accessToken,
      response.refreshToken,
      response.expiresIn || '900'
    );
    
    return response;
  },

  async register(email, password, role) {
    const response = await api.post('/api/auth/register', { email, password, role });
    
    // Store tokens
    tokenStorage.setTokens(
      response.accessToken,
      response.refreshToken,
      response.expiresIn || '900'
    );
    
    return response;
  },

  async logout() {
    const refreshToken = tokenStorage.getRefreshToken();
    
    try {
      await api.post('/api/auth/logout', { refreshToken });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Always clear local tokens
      tokenStorage.clearTokens();
    }
  },

  async logoutAll() {
    try {
      await api.post('/api/auth/logout-all');
    } catch (error) {
      console.error('Logout all error:', error);
    } finally {
      tokenStorage.clearTokens();
    }
  },

  isAuthenticated() {
    return tokenStorage.isAuthenticated();
  }
};
```

### Step 4.4: React Native Axios Interceptor (Alternative)

If using Axios in React Native:

```javascript
// utils/axiosConfig.js
import axios from 'axios';
import { tokenStorage } from './tokenStorage.js';

const api = axios.create({
  baseURL: API_BASE_URL,
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Request interceptor - add token
api.interceptors.request.use(async (config) => {
  const token = await tokenStorage.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - handle 401 and refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and not already retrying
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Queue request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(token => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch(err => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await tokenStorage.getRefreshToken();
        const response = await axios.post(`${API_BASE_URL}/api/auth/refresh`, {
          refreshToken,
        });

        const { accessToken, refreshToken: newRefreshToken, expiresIn } = response.data;
        
        await tokenStorage.setTokens(
          accessToken,
          newRefreshToken || refreshToken,
          expiresIn || '900'
        );

        processQueue(null, accessToken);
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        await tokenStorage.clearTokens();
        // Redirect to login
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
```

---

## Phase 5: Testing

### Step 5.1: Test Backend Endpoints

```bash
# 1. Register/Login
curl -X POST http://localhost:3002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Save the accessToken and refreshToken from response

# 2. Use access token
curl http://localhost:3002/api/scan/results \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# 3. Wait for access token to expire (or set short expiry), then refresh
curl -X POST http://localhost:3002/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"YOUR_REFRESH_TOKEN"}'

# 4. Logout
curl -X POST http://localhost:3002/api/auth/logout \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"YOUR_REFRESH_TOKEN"}'
```

### Step 5.2: Test Token Expiration

1. Set `JWT_ACCESS_EXPIRES_IN=1m` for testing
2. Login and get tokens
3. Wait 1 minute
4. Make API request - should auto-refresh
5. Verify new access token works

### Step 5.3: Test Refresh Token Expiration

1. Set `JWT_REFRESH_EXPIRES_IN=1h` for testing
2. Wait for refresh token to expire
3. Try to refresh - should fail and require re-login

---

## Phase 6: Security Best Practices

### Step 6.1: Token Storage Security

**Web:**
- Consider using httpOnly cookies for refresh tokens (more secure than localStorage)
- Use HTTPS in production
- Implement CSRF protection if using cookies

**Mobile:**
- Use secure storage (Keychain on iOS, Keystore on Android)
- Never log tokens
- Clear tokens on app uninstall

### Step 6.2: Token Rotation

Enable token rotation for better security:
```env
JWT_REFRESH_ROTATION=true
```

This issues a new refresh token on each refresh, invalidating the old one.

### Step 6.3: Rate Limiting

Add rate limiting to `/api/auth/refresh` endpoint to prevent abuse:

```javascript
import rateLimit from 'express-rate-limit';

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5 // Limit each IP to 5 refresh requests per windowMs
});

router.post('/refresh', refreshLimiter, async (req, res) => {
  // ... refresh logic
});
```

### Step 6.4: Cleanup Job

Add a periodic job to clean up expired tokens:

```javascript
// utils/tokenCleanup.js
import { cleanupExpiredTokens } from '../services/refreshTokenService.js';

// Run cleanup every hour
setInterval(async () => {
  try {
    const deleted = await cleanupExpiredTokens();
    console.log(`[Token Cleanup] Deleted ${deleted} expired tokens`);
  } catch (error) {
    console.error('[Token Cleanup] Error:', error);
  }
}, 60 * 60 * 1000); // 1 hour
```

---

## Phase 7: Migration Strategy

### Step 7.1: Backward Compatibility

Keep the old `generateToken` function temporarily for backward compatibility, or update all existing code to use `generateAccessToken`.

### Step 7.2: Gradual Rollout

1. Deploy backend changes first
2. Support both old and new token formats temporarily
3. Update frontend to use refresh tokens
4. Remove old token support after migration

### Step 7.3: User Communication

Inform users about the change:
- "You'll stay logged in longer"
- "You may need to log in once after the update"

---

## Phase 8: Monitoring & Logging

### Step 8.1: Add Logging

Log important events:
- Token refresh attempts
- Failed refresh attempts
- Token revocations
- Cleanup operations

### Step 8.2: Metrics to Track

- Number of active refresh tokens per user
- Token refresh success rate
- Average session duration
- Failed refresh attempts

---

## Troubleshooting

### Issue: "Refresh token not found"
- Check token hashing matches between storage and lookup
- Verify token hasn't expired
- Check database connection

### Issue: "Token refresh loop"
- Ensure refresh endpoint doesn't require authentication
- Check token expiration logic
- Verify queue handling in frontend

### Issue: "Tokens not persisting"
- Check localStorage/AsyncStorage permissions
- Verify token storage functions are async where needed
- Check for storage quota issues

---

## Summary Checklist

**Backend:**
- [ ] Create `refresh_tokens` table
- [ ] Add environment variables
- [ ] Create `refreshTokenService.js`
- [ ] Update `jwtAuth.js` with new token functions
- [ ] Update login/register endpoints
- [ ] Add `/api/auth/refresh` endpoint
- [ ] Add `/api/auth/logout` endpoint
- [ ] Test all endpoints

**Frontend:**
- [ ] Create token storage utility
- [ ] Create API client with auto-refresh
- [ ] Update login/register functions
- [ ] Add logout functionality
- [ ] Test token refresh flow
- [ ] Test token expiration handling

**Security:**
- [ ] Enable HTTPS
- [ ] Add rate limiting
- [ ] Enable token rotation (optional)
- [ ] Set up token cleanup job
- [ ] Review token storage security

**Testing:**
- [ ] Test happy path (login → use token → refresh → use new token)
- [ ] Test expired access token refresh
- [ ] Test expired refresh token
- [ ] Test logout
- [ ] Test concurrent refresh requests
- [ ] Test mobile and web separately

---

This implementation provides a robust, secure refresh token system that will significantly improve user experience by reducing the need for frequent re-logins.

