import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { storeTokenSecurely, retrieveTokenSecurely, isTokenExpired } from './token-security';

// Base API URL - configure in app.json or environment variables
const API_BASE_URL = 
  Constants.expoConfig?.extra?.apiUrl || 
  process.env.EXPO_PUBLIC_API_URL || 
  'https://hedgeway-server-production.up.railway.app';

// Token storage key
const AUTH_TOKEN_KEY = 'auth_token';

// Check if we're on web
const isWeb = Platform.OS === 'web';

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface ApiError {
  message: string;
  status?: number;
  errors?: Record<string, string[]>;
}

/**
 * Get stored auth token
 * Returns null if token is expired or not found
 */
export async function getAuthToken(): Promise<string | null> {
  try {
    if (isWeb) {
      // Use localStorage for web with obfuscation
      if (typeof window === 'undefined') {
        return null;
      }
      const obfuscated = localStorage.getItem(AUTH_TOKEN_KEY);
      if (!obfuscated) {
        return null;
      }
      const token = retrieveTokenSecurely(obfuscated, true);
      
      // Check if token is expired
      if (token && isTokenExpired(token)) {
        console.warn('Token has expired, clearing from storage');
        await clearAuthToken();
        return null;
      }
      
      return token;
    } else {
      // Use SecureStore for native platforms
      const token = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
      
      // Check if token is expired
      if (token && isTokenExpired(token)) {
        console.warn('Token has expired, clearing from storage');
        await clearAuthToken();
        return null;
      }
      
      return token;
    }
  } catch (error) {
    console.error('Error getting auth token:', error);
    return null;
  }
}

/**
 * Set auth token
 * Returns true if successful, false otherwise
 */
export async function setAuthToken(token: string): Promise<boolean> {
  try {
    // Check if token is already expired before storing
    if (isTokenExpired(token)) {
      console.warn('Attempted to store an expired token');
      return false;
    }

    if (isWeb) {
      // Use localStorage for web with obfuscation
      if (typeof window === 'undefined') {
        console.error('localStorage is not available');
        return false;
      }
      
      // Obfuscate token before storing
      const obfuscated = storeTokenSecurely(token, true);
      localStorage.setItem(AUTH_TOKEN_KEY, obfuscated);
      
      // Verify it was stored correctly
      const storedObfuscated = localStorage.getItem(AUTH_TOKEN_KEY);
      if (!storedObfuscated) {
        return false;
      }
      
      const deobfuscated = retrieveTokenSecurely(storedObfuscated, true);
      return deobfuscated === token;
    } else {
      // Use SecureStore for native platforms
      // Check if SecureStore is available
      let isAvailable = true;
      try {
        if (typeof SecureStore.isAvailableAsync === 'function') {
          isAvailable = await SecureStore.isAvailableAsync();
        }
      } catch {
        // Method might not exist, assume available
        isAvailable = true;
      }

      if (!isAvailable) {
        console.warn('SecureStore is not available on this platform.');
        return false;
      }

      await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
      
      // Small delay to ensure write completes (some platforms need this)
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Verify it was stored
      const stored = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
      return stored === token;
    }
  } catch (error) {
    console.error('Error setting auth token:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
    }
    return false;
  }
}

/**
 * Clear auth token
 */
export async function clearAuthToken(): Promise<void> {
  try {
    if (isWeb) {
      // Use localStorage for web
      if (typeof window !== 'undefined') {
        localStorage.removeItem(AUTH_TOKEN_KEY);
      }
    } else {
      // Use SecureStore for native platforms
      await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
    }
  } catch (error) {
    console.error('Error clearing auth token:', error);
  }
}

/**
 * Make an authenticated API request
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    // Get stored auth token
    const token = await getAuthToken();

    const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    // Build headers - ensure Authorization is included if token exists
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Add Authorization header if token exists (override any existing Authorization header)
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    } else {
      // Log if token is missing for protected endpoints (for debugging)
      if (endpoint.includes('/api/scan') || endpoint.includes('/api/bdl') || endpoint.includes('/api/discord')) {
        console.warn(`[API] No auth token found for protected endpoint: ${endpoint}`);
      }
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    let data;
    const contentType = response.headers.get('content-type');
    
    try {
      const text = await response.text();
      if (contentType && contentType.includes('application/json')) {
        try {
          data = text ? JSON.parse(text) : {};
        } catch {
          data = { error: text || 'Invalid JSON response' };
        }
      } else {
        data = text ? { error: text } : { error: 'Invalid response format' };
      }
    } catch (parseError) {
      return {
        error: 'Failed to read response from server',
        data: undefined,
      };
    }

    if (!response.ok) {
      // Handle authentication errors with helpful messages
      if (response.status === 401) {
        const errorMsg = data.message || data.error || 'Authentication required';
        return {
          error: errorMsg.includes('JWT') || errorMsg.includes('authentication')
            ? 'Authentication required. Please log in to access scan results.'
            : errorMsg,
          data: undefined,
        };
      }
      
      // Handle validation errors (400) - may have detailed error messages
      if (response.status === 400) {
        let errorMsg = data.message || data.error;
        
        // Check if there are validation errors in a different format
        if (data.errors && typeof data.errors === 'object') {
          const errorDetails = Object.entries(data.errors)
            .map(([field, messages]) => {
              const msgArray = Array.isArray(messages) ? messages : [messages];
              return `${field}: ${msgArray.join(', ')}`;
            })
            .join('; ');
          errorMsg = errorDetails || errorMsg;
        }
        
        return {
          error: errorMsg || `Invalid request: ${response.statusText}`,
          data: undefined,
        };
      }
      
      return {
        error: data.message || data.error || `Server error: ${response.status} ${response.statusText}`,
        data: undefined,
      };
    }

    return { data, error: undefined };
  } catch (error) {
    // Provide more helpful error messages
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return {
        error: `Network error: Unable to reach server at ${API_BASE_URL}. Please check your internet connection and API URL configuration.`,
        data: undefined,
      };
    }
    
    return {
      error: error instanceof Error ? error.message : 'Network error occurred',
      data: undefined,
    };
  }
}

/**
 * GET request helper
 */
export async function get<T>(endpoint: string): Promise<ApiResponse<T>> {
  return apiRequest<T>(endpoint, { method: 'GET' });
}

/**
 * POST request helper
 */
export async function post<T>(
  endpoint: string,
  body?: any
): Promise<ApiResponse<T>> {
  return apiRequest<T>(endpoint, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * PUT request helper
 */
export async function put<T>(
  endpoint: string,
  body?: any
): Promise<ApiResponse<T>> {
  return apiRequest<T>(endpoint, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

/**
 * PATCH request helper
 */
export async function patch<T>(
  endpoint: string,
  body?: any
): Promise<ApiResponse<T>> {
  return apiRequest<T>(endpoint, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

/**
 * DELETE request helper
 */
export async function del<T>(endpoint: string): Promise<ApiResponse<T>> {
  return apiRequest<T>(endpoint, { method: 'DELETE' });
}

