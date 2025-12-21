import Constants from 'expo-constants';
import { tokenStorage } from './tokenStorage';

// Base API URL - configure in app.json or environment variables
export const API_BASE_URL = 
  Constants.expoConfig?.extra?.apiUrl || 
  process.env.EXPO_PUBLIC_API_URL || 
  'https://hedgeway-server-production.up.railway.app';

// Token refresh state management
let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string | null) => void; reject: (error: Error) => void }> = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

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
 * Refresh access token using refresh token
 */
async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await tokenStorage.getRefreshToken();
  
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
      const error = await response.json().catch(() => ({ error: 'Failed to refresh token' }));
      throw new Error(error.error || 'Failed to refresh token');
    }

    const data = await response.json();
    
    // Update stored tokens
    await tokenStorage.setTokens(
      data.accessToken,
      data.refreshToken || refreshToken, // Use new refresh token if rotation enabled
      data.expiresIn || '900' // Default 15 minutes
    );

    return data.accessToken;
  } catch (error) {
    // Refresh failed - clear tokens
    await tokenStorage.clearTokens();
    throw error;
  }
}

/**
 * Get stored access token
 * Returns null if token is expired or not found
 * @deprecated Use tokenStorage.getAccessToken() instead
 */
export async function getAuthToken(): Promise<string | null> {
  return await tokenStorage.getAccessToken();
}

/**
 * Set auth token (for backward compatibility)
 * @deprecated Use tokenStorage.setTokens() instead
 */
export async function setAuthToken(token: string): Promise<boolean> {
  // For backward compatibility, we'll store it as access token only
  // But this should be replaced with setTokens() that includes refresh token
  console.warn('setAuthToken is deprecated. Use tokenStorage.setTokens() with both access and refresh tokens.');
  // This is a fallback - ideally login/register should use setTokens
  return false;
}

/**
 * Logout - invalidate refresh token on server and clear local tokens
 */
export async function logout(): Promise<void> {
  try {
    const refreshToken = await tokenStorage.getRefreshToken();
    
    if (refreshToken) {
      try {
        // Call logout endpoint to invalidate refresh token on server
        await fetch(`${API_BASE_URL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await tokenStorage.getAccessToken() || ''}`,
          },
          body: JSON.stringify({ refreshToken }),
        });
      } catch (error) {
        // Even if logout API call fails, clear local tokens
        console.error('Logout API call failed:', error);
      }
    }
  } catch (error) {
    console.error('Error during logout:', error);
  } finally {
    // Always clear local tokens regardless of API call result
    await tokenStorage.clearTokens();
  }
}

/**
 * Logout from all devices - invalidate all refresh tokens
 */
export async function logoutAll(): Promise<void> {
  try {
    try {
      // Call logout-all endpoint
      await fetch(`${API_BASE_URL}/api/auth/logout-all`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await tokenStorage.getAccessToken() || ''}`,
        },
      });
    } catch (error) {
      console.error('Logout all API call failed:', error);
    }
  } catch (error) {
    console.error('Error during logout all:', error);
  } finally {
    // Always clear local tokens
    await tokenStorage.clearTokens();
  }
}

/**
 * Clear auth token (for backward compatibility)
 * @deprecated Use logout() instead
 */
export async function clearAuthToken(): Promise<void> {
  await tokenStorage.clearTokens();
}

/**
 * Make an authenticated API request with automatic token refresh
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    // Check if token is expired and refresh if needed (but not if we're already refreshing)
    if (await tokenStorage.isTokenExpired() && !isRefreshing) {
      isRefreshing = true;
      try {
        await refreshAccessToken();
      } catch (error) {
        processQueue(error as Error, null);
        // If refresh fails, continue with request - it will fail with 401 and we'll handle it
      } finally {
        isRefreshing = false;
      }
    }

    // If refresh is in progress, queue this request
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ 
          resolve: async (token) => {
            try {
              const result = await apiRequest<T>(endpoint, options);
              resolve(result);
            } catch (err) {
              reject(err as Error);
            }
          }, 
          reject 
        });
      });
    }

    // Get stored access token
    const token = await tokenStorage.getAccessToken();

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

    let response = await fetch(url, {
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

    // If 401, try to refresh token once
    if (response.status === 401 && token && !endpoint.includes('/api/auth/refresh')) {
      if (!isRefreshing) {
        isRefreshing = true;
        
        try {
          const newAccessToken = await refreshAccessToken();
          
          // Retry original request with new token
          headers['Authorization'] = `Bearer ${newAccessToken}`;
          response = await fetch(url, {
            ...options,
            headers,
          });
          
          // Re-parse response after retry
          const retryText = await response.text();
          if (response.headers.get('content-type')?.includes('application/json')) {
            try {
              data = retryText ? JSON.parse(retryText) : {};
            } catch {
              data = { error: retryText || 'Invalid JSON response' };
            }
          } else {
            data = retryText ? { error: retryText } : { error: 'Invalid response format' };
          }
          
          processQueue(null, newAccessToken);
        } catch (error) {
          processQueue(error as Error, null);
          // Refresh failed - return authentication error
          const errorMsg = data.message || data.error || 'Authentication required';
          return {
            error: errorMsg.includes('JWT') || errorMsg.includes('authentication')
              ? 'Authentication required. Please log in to access scan results.'
              : errorMsg,
            data: undefined,
          };
        } finally {
          isRefreshing = false;
        }
      } else {
        // Wait for ongoing refresh
        return new Promise((resolve, reject) => {
          failedQueue.push({ 
            resolve: async (newToken) => {
              if (newToken) {
                headers['Authorization'] = `Bearer ${newToken}`;
                const retryResponse = await fetch(url, { ...options, headers });
                const retryText = await retryResponse.text();
                let retryData;
                if (retryResponse.headers.get('content-type')?.includes('application/json')) {
                  try {
                    retryData = retryText ? JSON.parse(retryText) : {};
                  } catch {
                    retryData = { error: retryText || 'Invalid JSON response' };
                  }
                } else {
                  retryData = retryText ? { error: retryText } : { error: 'Invalid response format' };
                }
                
                if (!retryResponse.ok) {
                  resolve({
                    error: retryData.message || retryData.error || `Server error: ${retryResponse.status}`,
                    data: undefined,
                  });
                } else {
                  resolve({ data: retryData, error: undefined });
                }
              } else {
                resolve({
                  error: 'Authentication required. Please log in.',
                  data: undefined,
                });
              }
            }, 
            reject 
          });
        });
      }
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

