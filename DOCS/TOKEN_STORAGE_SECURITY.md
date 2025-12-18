# Token Storage Security Guide

## Current Implementation

**Web**: Uses `localStorage` (less secure, accessible to JavaScript)  
**Native (iOS/Android)**: Uses `SecureStore` (more secure, encrypted storage)

## Security Concerns with localStorage

### Risks:
1. **XSS (Cross-Site Scripting)**: Any JavaScript on the page can access localStorage
2. **No automatic expiration**: Tokens persist until explicitly removed
3. **Visible in DevTools**: Users can see tokens in browser DevTools
4. **Shared across tabs**: Same origin can access the token

## Security Improvement Options

### 1. ✅ Token Obfuscation/Encryption (Implemented)

**What it does**: Encrypts/obfuscates tokens before storing in localStorage

**Pros**:
- Prevents casual inspection
- Easy to implement
- Works with current architecture

**Cons**:
- Not cryptographically secure (client-side only)
- Can be reverse-engineered
- Doesn't protect against XSS

**Implementation**: See `lib/token-security.ts`

**Usage**:
```typescript
import { storeTokenSecurely, retrieveTokenSecurely } from '../lib/token-security';

// Store
const obfuscated = storeTokenSecurely(token);
localStorage.setItem('auth_token', obfuscated);

// Retrieve
const obfuscated = localStorage.getItem('auth_token');
const token = retrieveTokenSecurely(obfuscated);
```

### 2. 🔒 HttpOnly Cookies (Most Secure - Requires Server Changes)

**What it does**: Server sets cookies with `HttpOnly` flag, JavaScript cannot access them

**Pros**:
- **Best security**: Protected from XSS attacks
- Automatic expiration support
- Sent automatically with requests
- Can use `Secure` flag (HTTPS only)
- Can use `SameSite` flag (CSRF protection)

**Cons**:
- Requires server-side changes
- More complex implementation
- Need to handle CORS properly

**Server Implementation** (Example):
```javascript
// On login/register success
res.cookie('auth_token', token, {
  httpOnly: true,      // JavaScript cannot access
  secure: true,        // HTTPS only
  sameSite: 'strict',  // CSRF protection
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/'
});
```

**Client Changes**:
- Remove token from Authorization header (cookies sent automatically)
- Handle cookie expiration
- Update logout to clear cookies

### 3. 🕐 Session Storage (Better than localStorage)

**What it does**: Stores tokens in `sessionStorage` instead of `localStorage`

**Pros**:
- Automatically cleared when tab/window closes
- Same origin policy protection
- Better for temporary sessions

**Cons**:
- Still vulnerable to XSS
- Lost on tab close (may not be desired)
- Still visible in DevTools

**Implementation**:
```typescript
// Use sessionStorage instead of localStorage
sessionStorage.setItem('auth_token', token);
const token = sessionStorage.getItem('auth_token');
```

### 4. 💾 Memory-Only Storage (Most Secure Client-Side)

**What it does**: Store tokens only in memory (JavaScript variables), never persist

**Pros**:
- Not accessible via DevTools
- Automatically cleared on page refresh
- No persistence risk

**Cons**:
- Lost on page refresh (user must re-login)
- Not suitable for "remember me" functionality
- Still vulnerable to XSS (but less exposure)

**Implementation**:
```typescript
// Store in memory only
let memoryToken: string | null = null;

export function setAuthToken(token: string) {
  memoryToken = token;
}

export function getAuthToken() {
  return memoryToken;
}
```

### 5. 🔐 Web Crypto API (Strong Encryption)

**What it does**: Use browser's built-in Web Crypto API for encryption

**Pros**:
- Cryptographically secure
- Uses browser's native encryption
- Better than simple obfuscation

**Cons**:
- More complex implementation
- Still vulnerable to XSS (encrypted but accessible)
- Requires key management

**Implementation** (Simplified):
```typescript
async function encryptToken(token: string, key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const keyData = encoder.encode(key);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: new Uint8Array(12) },
    cryptoKey,
    data
  );
  
  return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
}
```

### 6. ⏰ Token Expiration & Refresh

**What it does**: Implement automatic token refresh before expiration

**Pros**:
- Limits exposure window
- Better security posture
- Industry best practice

**Cons**:
- Requires server support for refresh tokens
- More complex state management

**Implementation**:
```typescript
// Check token expiration before use
import { isTokenExpired, getTokenExpiration } from '../lib/token-security';

const token = await getAuthToken();
if (token && isTokenExpired(token)) {
  // Refresh token or redirect to login
  await refreshToken();
}
```

## Recommended Security Stack

### For Development:
1. ✅ Token obfuscation (current implementation)
2. ✅ SecureStore for native platforms
3. ✅ Token expiration checking

### For Production:
1. 🔒 **HttpOnly Cookies** (best option - requires server changes)
2. ✅ Token encryption/obfuscation (if cookies not possible)
3. ✅ Token expiration & refresh
4. ✅ HTTPS only (enforce secure connections)
5. ✅ Content Security Policy (CSP) headers
6. ✅ XSS protection (input sanitization)

## Additional Security Measures

### 1. Content Security Policy (CSP)
Prevent XSS attacks at the browser level:

```html
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; script-src 'self' 'unsafe-inline';">
```

### 2. HTTPS Only
Ensure all API calls use HTTPS:
```typescript
if (API_BASE_URL.startsWith('http://') && !__DEV__) {
  throw new Error('Production must use HTTPS');
}
```

### 3. Token Rotation
Regularly rotate tokens:
- Short-lived access tokens (15-30 minutes)
- Long-lived refresh tokens (7-30 days)
- Automatic refresh before expiration

### 4. Logout & Token Cleanup
Always clear tokens on logout:
```typescript
export async function logout() {
  await clearAuthToken();
  // Also clear any other user data
  // Redirect to login
}
```

### 5. Same-Origin Policy
Ensure API and frontend are on same origin (or proper CORS):
- Reduces XSS attack surface
- Prevents token leakage to third parties

## Implementation Priority

### High Priority (Do Now):
1. ✅ Use SecureStore for native (already done)
2. ✅ Add token obfuscation for web (see `lib/token-security.ts`)
3. ✅ Implement token expiration checking
4. ✅ Clear tokens on logout

### Medium Priority (Next):
1. 🔒 Implement HttpOnly cookies (requires server changes)
2. ⏰ Add token refresh mechanism
3. 🔐 Use Web Crypto API for stronger encryption

### Low Priority (Future):
1. 💾 Consider memory-only storage for sensitive operations
2. 🕐 Use sessionStorage for temporary sessions
3. 🔄 Implement token rotation

## Quick Implementation Guide

### Step 1: Add Token Obfuscation (Web Only)

Update `lib/api.ts`:
```typescript
import { storeTokenSecurely, retrieveTokenSecurely } from './token-security';

// In setAuthToken for web:
if (isWeb) {
  const obfuscated = storeTokenSecurely(token, true);
  localStorage.setItem(AUTH_TOKEN_KEY, obfuscated);
  // ... verify
}

// In getAuthToken for web:
if (isWeb) {
  const obfuscated = localStorage.getItem(AUTH_TOKEN_KEY);
  return obfuscated ? retrieveTokenSecurely(obfuscated, true) : null;
}
```

### Step 2: Add Token Expiration Check

Before making API calls:
```typescript
import { isTokenExpired } from './token-security';

const token = await getAuthToken();
if (token && isTokenExpired(token)) {
  await clearAuthToken();
  router.replace('/');
  return;
}
```

### Step 3: Enforce HTTPS in Production

```typescript
if (!__DEV__ && !API_BASE_URL.startsWith('https://')) {
  console.error('Production API must use HTTPS');
}
```

## Summary

**Current State**: ✅ Good for development
- SecureStore on native (secure)
- localStorage on web (less secure but functional)

**Recommended Next Steps**:
1. Add token obfuscation for web
2. Implement token expiration checking
3. Plan migration to HttpOnly cookies for production

**Best Practice**: HttpOnly cookies are the most secure option for web applications, but require server-side changes.

