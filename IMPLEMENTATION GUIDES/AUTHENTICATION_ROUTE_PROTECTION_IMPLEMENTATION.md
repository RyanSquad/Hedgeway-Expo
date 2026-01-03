# Authentication Route Protection Implementation Guide

## Overview

This guide explains how to implement route protection that automatically redirects unauthenticated users or users with expired tokens to the login screen (`/`).

## Current State

- **Authentication System**: Uses `tokenStorage` for token management and `useAuth()` hook for user state
- **Routing**: Expo Router with Stack navigation defined in `app/_layout.tsx`
- **API Layer**: `api.ts` handles token refresh automatically but doesn't redirect on auth failures
- **Current Issue**: Pages can be accessed without authentication - no route protection exists

## Implementation Strategy

### Approach 1: Layout-Level Protection (Recommended)

Protect routes at the root layout level using a custom authentication wrapper component.

### Approach 2: Per-Page Protection

Add authentication checks to each protected page individually.

**This guide recommends Approach 1** as it's more maintainable and ensures consistent protection across all routes.

---

## Implementation Steps

### Step 1: Create Authentication Guard Component

Create a new component `components/AuthGuard.tsx` that will wrap protected routes:

```typescript
import { useEffect } from 'react';
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
  const isLoginPage = pathname === '/';

  useEffect(() => {
    const checkAuth = async () => {
      // Allow access to login page
      if (isLoginPage) {
        return;
      }

      // Wait for auth hook to finish loading
      if (loading) {
        return;
      }

      // Check if user is authenticated
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
  }, [loading, user, pathname, isLoginPage, router]);

  // Show loading state while checking authentication
  if (!isLoginPage && loading) {
    return (
      <YStack flex={1} alignItems="center" justifyContent="center" backgroundColor="$background">
        <Spinner size="large" />
        <Text marginTop="$4" color="$color">
          Checking authentication...
        </Text>
      </YStack>
    );
  }

  // If on login page, always show content
  if (isLoginPage) {
    return <>{children}</>;
  }

  // If not authenticated, show nothing (redirect will happen)
  if (!user) {
    return null;
  }

  // User is authenticated, show protected content
  return <>{children}</>;
}
```

### Step 2: Update Root Layout

Modify `app/_layout.tsx` to wrap the Stack with the AuthGuard component:

```typescript
import '../tamagui.config'; // Ensure config is loaded first
import { Stack } from 'expo-router';
import { TamaguiProvider } from 'tamagui';
import config from '../tamagui.config';
import { WebLayout } from '../components/WebLayout';
import { AuthGuard } from '../components/AuthGuard';

export default function RootLayout() {
  return (
    <TamaguiProvider config={config} defaultTheme="dark">
      <WebLayout>
        <AuthGuard>
          <Stack>
            <Stack.Screen name="index" options={{ title: 'Login', headerShown: false }} />
            <Stack.Screen name="home" options={{ title: 'Home', headerShown: false }} />
            <Stack.Screen name="scan" options={{ title: 'Scan Results', headerShown: false }} />
            <Stack.Screen name="player-stats" options={{ title: 'Player Stats', headerShown: false }} />
            <Stack.Screen name="predictions" options={{ title: 'Predictions', headerShown: false }} />
            <Stack.Screen name="admin" options={{ title: 'Admin Panel', headerShown: false }} />
          </Stack>
        </AuthGuard>
      </WebLayout>
    </TamaguiProvider>
  );
}
```

### Step 3: Handle API Authentication Errors

Update `lib/api.ts` to redirect to login when token refresh fails. Modify the `refreshAccessToken` function and the 401 error handling:

**In `refreshAccessToken` function** (around line 44-80):
- Already clears tokens on failure - this is good
- No changes needed here

**In `apiRequest` function** (around line 252-338):
- When a 401 error occurs and token refresh fails, we should trigger a redirect
- However, since `api.ts` is a utility library, we should handle redirects at the component level

**Better approach**: Update `useAuth` hook to handle authentication failures and trigger redirects.

### Step 4: Enhance useAuth Hook

Modify `lib/useAuth.ts` to handle authentication failures and redirect:

```typescript
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { get } from './api';
import { tokenStorage } from './tokenStorage';

export interface User {
  userId: string;
  email: string;
  role: string;
  permissions?: string[];
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchUser();
  }, []);

  const fetchUser = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Check if tokens exist before making API call
      const isAuthenticated = await tokenStorage.isAuthenticated();
      if (!isAuthenticated) {
        setUser(null);
        setLoading(false);
        return;
      }

      const response = await get<{ user: User }>('/api/auth/me');
      
      if (response.error) {
        // If 401 or authentication error, clear tokens and redirect
        if (response.error.includes('Authentication') || 
            response.error.includes('JWT') || 
            response.error.includes('401')) {
          await tokenStorage.clearTokens();
          setUser(null);
          // Only redirect if not already on login page
          const currentPath = window?.location?.pathname || '';
          if (currentPath !== '/' && currentPath !== '/index') {
            router.replace('/');
          }
        } else {
          setError(response.error);
          setUser(null);
        }
      } else if (response.data?.user) {
        setUser(response.data.user);
      } else {
        setUser(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch user');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const isSuperAdmin = user?.role === 'super_admin';
  const isAdmin = user?.role === 'admin' || isSuperAdmin;
  const isModerator = user?.role === 'moderator' || isAdmin;

  return {
    user,
    loading,
    error,
    isSuperAdmin,
    isAdmin,
    isModerator,
    refetch: fetchUser,
  };
}
```

**Note**: The router redirect in `useAuth` might cause issues in React Native. A better approach is to handle redirects only in the `AuthGuard` component.

### Step 5: Handle Token Expiration During Navigation

The `AuthGuard` component should also listen for token expiration events. Update it to periodically check token status:

```typescript
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
  const isLoginPage = pathname === '/';
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      // Allow access to login page
      if (isLoginPage) {
        return;
      }

      // Wait for auth hook to finish loading
      if (loading) {
        return;
      }

      // Check if user is authenticated
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
  if (!isLoginPage && loading) {
    return (
      <YStack flex={1} alignItems="center" justifyContent="center" backgroundColor="$background">
        <Spinner size="large" />
        <Text marginTop="$4" color="$color">
          Checking authentication...
        </Text>
      </YStack>
    );
  }

  // If on login page, always show content
  if (isLoginPage) {
    return <>{children}</>;
  }

  // If not authenticated, show nothing (redirect will happen)
  if (!user) {
    return null;
  }

  // User is authenticated, show protected content
  return <>{children}</>;
}
```

### Step 6: Handle API 401 Errors at Component Level

For pages that make API calls, handle 401 errors by redirecting to login. Create a helper hook `lib/useApiErrorHandler.ts`:

```typescript
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { tokenStorage } from './tokenStorage';

export function useApiErrorHandler(error: string | null | undefined) {
  const router = useRouter();

  useEffect(() => {
    if (error && (
      error.includes('Authentication') || 
      error.includes('JWT') || 
      error.includes('401') ||
      error.includes('Please log in')
    )) {
      // Clear tokens and redirect to login
      tokenStorage.clearTokens().then(() => {
        router.replace('/');
      });
    }
  }, [error, router]);
}
```

Then use it in pages that make API calls:

```typescript
import { useApiErrorHandler } from '../lib/useApiErrorHandler';

export default function SomePage() {
  const { error } = useAuth(); // or from API call
  useApiErrorHandler(error);
  
  // ... rest of component
}
```

---

## Alternative: Simpler Implementation

If you want a simpler approach without periodic checks, use this minimal `AuthGuard`:

```typescript
import { useEffect } from 'react';
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
  const isLoginPage = pathname === '/';

  useEffect(() => {
    const checkAuth = async () => {
      if (isLoginPage || loading) {
        return;
      }

      const isAuthenticated = await tokenStorage.isAuthenticated();
      const isTokenExpired = await tokenStorage.isTokenExpired();

      if (!isAuthenticated || isTokenExpired || !user) {
        await tokenStorage.clearTokens();
        router.replace('/');
      }
    };

    checkAuth();
  }, [loading, user, pathname, isLoginPage, router]);

  if (!isLoginPage && loading) {
    return (
      <YStack flex={1} alignItems="center" justifyContent="center" backgroundColor="$background">
        <Spinner size="large" />
      </YStack>
    );
  }

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
```

---

## Testing Checklist

After implementation, test the following scenarios:

1. **Unauthenticated Access**
   - Navigate to `/home` without logging in
   - Should redirect to `/` (login page)

2. **Token Expiration**
   - Log in and navigate to a protected page
   - Wait for token to expire (or manually expire it)
   - Navigate to another page or refresh
   - Should redirect to login page

3. **API Call with Expired Token**
   - Make an API call with an expired token
   - Should attempt refresh, and if that fails, redirect to login

4. **Login Flow**
   - After successful login, should navigate to `/home` (already implemented)
   - Should not redirect back to login

5. **Logout Flow**
   - Click logout (already implemented in SidebarMenu)
   - Should redirect to login page

6. **Direct URL Access**
   - Type a protected route URL directly in browser
   - Should redirect to login if not authenticated

---

## Edge Cases to Consider

1. **Race Conditions**: Multiple rapid navigations might trigger multiple auth checks. The `loading` state in `useAuth` helps prevent this.

2. **Token Refresh During Navigation**: The API layer already handles token refresh automatically. The `AuthGuard` should not interfere with this.

3. **Network Errors**: Distinguish between network errors and authentication errors. Only redirect on auth failures.

4. **React Native vs Web**: `window.location` doesn't exist in React Native. Use `usePathname()` from expo-router instead.

5. **Login Page Access**: Users should always be able to access the login page, even if they have expired tokens.

---

## Files to Modify

1. **Create**: `components/AuthGuard.tsx` - New component for route protection
2. **Modify**: `app/_layout.tsx` - Wrap Stack with AuthGuard
3. **Optional**: `lib/useAuth.ts` - Enhance error handling (be careful with router usage)
4. **Optional**: Create `lib/useApiErrorHandler.ts` - Helper hook for API error handling

---

## Notes

- The `tokenStorage.isTokenExpired()` method already includes a 1-minute buffer, so tokens are considered expired 1 minute before actual expiration
- The API layer (`api.ts`) already handles automatic token refresh, so the route protection should work in conjunction with this
- The login page (`app/index.tsx`) already handles successful login and navigation to `/home`
- The logout function in `lib/api.ts` already clears tokens and can be called from components

---

## Implementation Priority

1. **High Priority**: Create `AuthGuard` component and integrate into `_layout.tsx`
2. **Medium Priority**: Add periodic token expiration checks
3. **Low Priority**: Add `useApiErrorHandler` hook for component-level error handling

---

## Summary

This implementation will:
- ✅ Redirect unauthenticated users to login when accessing protected pages
- ✅ Redirect users with expired tokens to login
- ✅ Show loading state during authentication checks
- ✅ Allow access to login page without authentication
- ✅ Work with existing token refresh mechanism
- ✅ Clear invalid tokens before redirecting

The solution is non-intrusive and works with the existing authentication infrastructure.

