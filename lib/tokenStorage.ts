/**
 * Token Storage Utility
 * 
 * Handles storage and retrieval of access and refresh tokens
 * Uses SecureStore for native platforms and localStorage for web
 */

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { storeTokenSecurely, retrieveTokenSecurely, isTokenExpired } from './token-security';

const ACCESS_TOKEN_KEY = 'hedgeway_access_token';
const REFRESH_TOKEN_KEY = 'hedgeway_refresh_token';
const TOKEN_EXPIRY_KEY = 'hedgeway_token_expiry';

const isWeb = Platform.OS === 'web';

/**
 * Parse expiration string (e.g., "15m", "1h", "7d") and return milliseconds
 */
function parseExpirationToMs(expiresIn: string): number {
  const match = expiresIn.match(/^(\d+)([dhms])$/);
  
  if (!match) {
    // If it's just a number, assume seconds
    const seconds = parseInt(expiresIn);
    if (!isNaN(seconds)) {
      return seconds * 1000;
    }
    // Default to 15 minutes
    return 15 * 60 * 1000;
  }
  
  const value = parseInt(match[1]);
  const unit = match[2];
  
  switch (unit) {
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'm':
      return value * 60 * 1000;
    case 's':
      return value * 1000;
    default:
      return 15 * 60 * 1000; // Default 15 minutes
  }
}

export const tokenStorage = {
  /**
   * Store access and refresh tokens
   */
  async setTokens(accessToken: string, refreshToken: string, expiresIn: string): Promise<boolean> {
    try {
      const expiresAt = Date.now() + parseExpirationToMs(expiresIn);
      
      if (isWeb) {
        if (typeof window === 'undefined') {
          return false;
        }
        
        // Obfuscate tokens for web storage
        const obfuscatedAccess = storeTokenSecurely(accessToken, true);
        const obfuscatedRefresh = storeTokenSecurely(refreshToken, true);
        
        localStorage.setItem(ACCESS_TOKEN_KEY, obfuscatedAccess);
        localStorage.setItem(REFRESH_TOKEN_KEY, obfuscatedRefresh);
        localStorage.setItem(TOKEN_EXPIRY_KEY, expiresAt.toString());
        
        return true;
      } else {
        // Use SecureStore for native platforms
        let isAvailable = true;
        try {
          if (typeof SecureStore.isAvailableAsync === 'function') {
            isAvailable = await SecureStore.isAvailableAsync();
          }
        } catch {
          isAvailable = true;
        }

        if (!isAvailable) {
          console.warn('SecureStore is not available on this platform.');
          return false;
        }

        await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
        await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
        await SecureStore.setItemAsync(TOKEN_EXPIRY_KEY, expiresAt.toString());
        
        // Small delay to ensure write completes
        await new Promise(resolve => setTimeout(resolve, 50));
        
        return true;
      }
    } catch (error) {
      console.error('Error setting tokens:', error);
      return false;
    }
  },

  /**
   * Get access token
   */
  async getAccessToken(): Promise<string | null> {
    try {
      if (isWeb) {
        if (typeof window === 'undefined') {
          return null;
        }
        const obfuscated = localStorage.getItem(ACCESS_TOKEN_KEY);
        if (!obfuscated) {
          return null;
        }
        return retrieveTokenSecurely(obfuscated, true);
      } else {
        return await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
      }
    } catch (error) {
      console.error('Error getting access token:', error);
      return null;
    }
  },

  /**
   * Get refresh token
   */
  async getRefreshToken(): Promise<string | null> {
    try {
      if (isWeb) {
        if (typeof window === 'undefined') {
          return null;
        }
        const obfuscated = localStorage.getItem(REFRESH_TOKEN_KEY);
        if (!obfuscated) {
          return null;
        }
        return retrieveTokenSecurely(obfuscated, true);
      } else {
        return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
      }
    } catch (error) {
      console.error('Error getting refresh token:', error);
      return null;
    }
  },

  /**
   * Check if access token is expired or about to expire (within 1 minute)
   */
  async isTokenExpired(): Promise<boolean> {
    try {
      if (isWeb) {
        if (typeof window === 'undefined') {
          return true;
        }
        const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
        if (!expiry) {
          return true;
        }
        
        const expiryTime = parseInt(expiry);
        const now = Date.now();
        const buffer = 60 * 1000; // 1 minute buffer
        
        return now >= (expiryTime - buffer);
      } else {
        const expiry = await SecureStore.getItemAsync(TOKEN_EXPIRY_KEY);
        if (!expiry) {
          return true;
        }
        
        const expiryTime = parseInt(expiry);
        const now = Date.now();
        const buffer = 60 * 1000; // 1 minute buffer
        
        return now >= (expiryTime - buffer);
      }
    } catch (error) {
      console.error('Error checking token expiry:', error);
      return true;
    }
  },

  /**
   * Clear all tokens
   */
  async clearTokens(): Promise<void> {
    try {
      if (isWeb) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem(ACCESS_TOKEN_KEY);
          localStorage.removeItem(REFRESH_TOKEN_KEY);
          localStorage.removeItem(TOKEN_EXPIRY_KEY);
        }
      } else {
        await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
        await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
        await SecureStore.deleteItemAsync(TOKEN_EXPIRY_KEY);
      }
    } catch (error) {
      console.error('Error clearing tokens:', error);
    }
  },

  /**
   * Check if user is authenticated (has both tokens)
   */
  async isAuthenticated(): Promise<boolean> {
    const accessToken = await this.getAccessToken();
    const refreshToken = await this.getRefreshToken();
    return !!accessToken && !!refreshToken;
  }
};

