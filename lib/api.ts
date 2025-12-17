import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

// Base API URL - configure in app.json or environment variables
const API_BASE_URL = 
  Constants.expoConfig?.extra?.apiUrl || 
  process.env.EXPO_PUBLIC_API_URL || 
  'https://hedgeway-server-production.up.railway.app';

// Token storage key
const AUTH_TOKEN_KEY = 'auth_token';

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
 */
export async function getAuthToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
  } catch (error) {
    console.error('Error getting auth token:', error);
    return null;
  }
}

/**
 * Set auth token
 */
export async function setAuthToken(token: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
  } catch (error) {
    console.error('Error setting auth token:', error);
  }
}

/**
 * Clear auth token
 */
export async function clearAuthToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
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

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
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

