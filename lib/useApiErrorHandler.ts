import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { tokenStorage } from './tokenStorage';

/**
 * Hook to handle API authentication errors by redirecting to login
 * Use this in components that make API calls to automatically handle auth failures
 * 
 * @param error - Error string from API response or useAuth hook
 */
export function useApiErrorHandler(error: string | null | undefined) {
  const router = useRouter();

  useEffect(() => {
    if (error && (
      error.includes('Authentication') || 
      error.includes('JWT') || 
      error.includes('401') ||
      error.includes('Please log in') ||
      error.includes('Token expired') ||
      error.includes('Token')
    )) {
      // Clear tokens and redirect to login
      tokenStorage.clearTokens().then(() => {
        router.replace('/');
      });
    }
  }, [error, router]);
}

