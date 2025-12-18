/**
 * Token Security Utilities
 * 
 * Provides encryption/obfuscation for tokens stored in localStorage
 * Note: This is client-side obfuscation, not true encryption.
 * For maximum security, use HttpOnly cookies (requires server changes).
 */

// Simple obfuscation key (in production, generate this per-user or per-session)
// This is NOT true encryption - it's obfuscation to prevent casual inspection
const OBFUSCATION_KEY = 'hedgeway_token_key_v1';

/**
 * Simple obfuscation function (XOR cipher)
 * Note: This is NOT cryptographically secure, but prevents casual inspection
 * For production, consider using Web Crypto API or a library like crypto-js
 */
function obfuscateToken(token: string): string {
  let obfuscated = '';
  for (let i = 0; i < token.length; i++) {
    const keyChar = OBFUSCATION_KEY[i % OBFUSCATION_KEY.length];
    obfuscated += String.fromCharCode(token.charCodeAt(i) ^ keyChar.charCodeAt(0));
  }
  return btoa(obfuscated); // Base64 encode
}

/**
 * Deobfuscate token
 */
function deobfuscateToken(obfuscated: string): string | null {
  try {
    const decoded = atob(obfuscated);
    let token = '';
    for (let i = 0; i < decoded.length; i++) {
      const keyChar = OBFUSCATION_KEY[i % OBFUSCATION_KEY.length];
      token += String.fromCharCode(decoded.charCodeAt(i) ^ keyChar.charCodeAt(0));
    }
    return token;
  } catch {
    return null;
  }
}

/**
 * Store token with obfuscation (web only)
 */
export function storeTokenSecurely(token: string, useObfuscation: boolean = true): string {
  if (useObfuscation) {
    return obfuscateToken(token);
  }
  return token;
}

/**
 * Retrieve and deobfuscate token (web only)
 */
export function retrieveTokenSecurely(obfuscated: string, useObfuscation: boolean = true): string | null {
  if (useObfuscation) {
    return deobfuscateToken(obfuscated);
  }
  return obfuscated;
}

/**
 * Check if token is expired (if token contains expiration info)
 */
export function isTokenExpired(token: string): boolean {
  try {
    // JWT tokens have 3 parts separated by dots
    const parts = token.split('.');
    if (parts.length === 3) {
      // Decode the payload (second part)
      const payload = JSON.parse(atob(parts[1]));
      if (payload.exp) {
        // exp is in seconds, Date.now() is in milliseconds
        return Date.now() >= payload.exp * 1000;
      }
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Get token expiration time (if available)
 */
export function getTokenExpiration(token: string): Date | null {
  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(atob(parts[1]));
      if (payload.exp) {
        return new Date(payload.exp * 1000);
      }
    }
    return null;
  } catch {
    return null;
  }
}

