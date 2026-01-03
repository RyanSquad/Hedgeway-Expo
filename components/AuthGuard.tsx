import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'expo-router';
import { tokenStorage } from '../lib/tokenStorage';
import { useAuth } from '../lib/useAuth';
import { YStack, Spinner, Text } from 'tamagui';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const isLoginPage = pathname === '/' || pathname === '/index';
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      // Wait for auth hook to finish loading
      if (loading) {
        return;
      }

      // If on login page, check if user is already authenticated
      if (isLoginPage) {
        const isAuthenticated = await tokenStorage.isAuthenticated();
        const isTokenExpired = await tokenStorage.isTokenExpired();
        
        // If authenticated and token is valid, redirect to home
        if (isAuthenticated && !isTokenExpired && user) {
          router.replace('/home');
        }
        return;
      }

      // For protected pages, check if user is authenticated
      const isAuthenticated = await tokenStorage.isAuthenticated();
      const isTokenExpired = await tokenStorage.isTokenExpired();

      // If not authenticated or token expired, redirect to login
      if (!isAuthenticated || isTokenExpired || !user) {
        // Clear any invalid tokens
        await tokenStorage.clearTokens();
        router.replace('/');
      }
    };

    checkAuth();

    // Set up periodic token expiration check (every 30 seconds)
    if (!isLoginPage) {
      checkIntervalRef.current = setInterval(checkAuth, 30000);
    }

    // Cleanup interval on unmount or pathname change
    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
    };
  }, [loading, user, pathname, isLoginPage, router]);

  // Show loading state while checking authentication
  if (loading) {
    return (
      <YStack flex={1} alignItems="center" justifyContent="center" backgroundColor="$background">
        <Spinner size="large" />
        <Text marginTop="$4" color="$color">
          Checking authentication...
        </Text>
      </YStack>
    );
  }

  // If on login page, only show content if user is not authenticated
  if (isLoginPage) {
    // If user is authenticated, don't render (redirect will happen)
    if (user) {
      return null;
    }
    // User is not authenticated, show login page
    return <>{children}</>;
  }

  // For protected pages, if not authenticated, show nothing (redirect will happen)
  if (!user) {
    return null;
  }

  // User is authenticated, show protected content
  return <>{children}</>;
}

