# Persistent Sidebar Menu Implementation Guide

## Overview

This guide provides step-by-step instructions for replacing the hamburger menu with a persistent left-side sidebar menu **for web versions only**. Mobile and native platforms will continue to use the existing hamburger menu pattern.

## Current Architecture

### Components Involved

1. **`components/MenuButton.tsx`** - Hamburger menu button that opens a Sheet modal
2. **`components/NavigationBar.tsx`** - Top navigation bar containing MenuButton and page title
3. **Screens using NavigationBar:**
   - `app/home.tsx`
   - `app/scan.tsx`
   - `app/admin.tsx`

### Current Flow

- `NavigationBar` renders `MenuButton` in the top-left
- `MenuButton` opens a Sheet modal with navigation options
- All screens include `<NavigationBar />` at the top

## Implementation Strategy

### Approach

1. Create a new `SidebarMenu` component for web
2. Modify `NavigationBar` to conditionally render based on platform
3. Update layout structure to accommodate sidebar on web
4. Keep mobile experience unchanged

## Step-by-Step Implementation

### Step 1: Create SidebarMenu Component

**File:** `components/SidebarMenu.tsx`

Create a new component that renders a persistent left-side menu for web:

```typescript
import { YStack, XStack, Text, Button, Separator } from 'tamagui';
import { useRouter, usePathname } from 'expo-router';
import { logout } from '../lib/api';
import { useAuth } from '../lib/useAuth';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function SidebarMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isSuperAdmin } = useAuth();
  const insets = useSafeAreaInsets();

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  const navigateTo = (path: string) => {
    router.push(path);
  };

  const menuItems = [
    { label: 'Home', path: '/home', show: true },
    { label: 'Scan Results', path: '/scan', show: true },
    { label: 'Admin Panel', path: '/admin', show: isSuperAdmin },
  ].filter(item => item.show);

  return (
    <YStack
      width={250}
      backgroundColor="$backgroundStrong"
      borderRightWidth={1}
      borderRightColor="$borderColor"
      padding="$4"
      paddingTop={insets.top + 12}
      height="100%"
      position="fixed"
      left={0}
      top={0}
      zIndex={1000}
    >
      <YStack space="$4" flex={1}>
        {/* Logo/Title Section */}
        <YStack space="$2" marginBottom="$4">
          <Text fontSize="$8" fontWeight="bold" color="$color">
            Edgeway
          </Text>
        </YStack>

        {/* User Info */}
        {user && (
          <YStack space="$2" paddingVertical="$2" marginBottom="$2">
            <Text fontSize="$4" color="$colorPress">
              {user.email}
            </Text>
            <Text fontSize="$2" color="$colorPress">
              Role: {user.role}
            </Text>
          </YStack>
        )}

        <Separator />

        {/* Navigation Items */}
        <YStack space="$2" flex={1}>
          {menuItems.map((item) => (
            <Button
              key={item.path}
              size="$4"
              theme={pathname === item.path ? 'active' : undefined}
              onPress={() => navigateTo(item.path)}
              justifyContent="flex-start"
              width="100%"
            >
              <Text color="$color">{item.label}</Text>
            </Button>
          ))}
        </YStack>

        <Separator />

        {/* Logout Button */}
        <Button
          size="$4"
          theme="red"
          onPress={handleLogout}
          width="100%"
        >
          <Text color="$color">Logout</Text>
        </Button>
      </YStack>
    </YStack>
  );
}
```

**Key Features:**
- Fixed positioning on the left side
- Full height sidebar
- Same menu items as current MenuButton
- Active route highlighting
- User info display
- Logout functionality

### Step 2: Modify NavigationBar Component

**File:** `components/NavigationBar.tsx`

Update to conditionally render based on platform:

```typescript
import { XStack, Text } from 'tamagui';
import { usePathname } from 'expo-router';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MenuButton } from './MenuButton';

export function NavigationBar() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';

  // Get page title based on pathname
  const getPageTitle = () => {
    switch (pathname) {
      case '/home':
        return 'Home';
      case '/scan':
        return 'Scan Results';
      case '/admin':
        return 'Admin Panel';
      default:
        return 'Edgeway';
    }
  };

  // On web, don't render NavigationBar (sidebar handles navigation)
  if (isWeb) {
    return null;
  }

  // Mobile/native: render existing navigation bar
  return (
    <XStack 
      padding="$3" 
      paddingTop={insets.top + 12}
      backgroundColor="$blue9" 
      borderBottomWidth={1} 
      borderBottomColor="$borderColor" 
      alignItems="center" 
      space="$3"
    >
      <XStack space="$3" alignItems="center" flex={1}>
        <MenuButton />
        <Text fontSize="$6" fontWeight="bold" color="white">
          {getPageTitle()}
        </Text>
      </XStack>
    </XStack>
  );
}
```

**Changes:**
- Import `Platform` from `react-native`
- Check `Platform.OS === 'web'`
- Return `null` on web (sidebar will handle navigation)
- Keep existing behavior for mobile/native

### Step 3: Create Layout Wrapper Component

**File:** `components/WebLayout.tsx`

Create a wrapper component that handles the sidebar layout for web:

```typescript
import { XStack, YStack } from 'tamagui';
import { Platform } from 'react-native';
import { SidebarMenu } from './SidebarMenu';

interface WebLayoutProps {
  children: React.ReactNode;
}

export function WebLayout({ children }: WebLayoutProps) {
  const isWeb = Platform.OS === 'web';

  if (!isWeb) {
    // On mobile/native, just render children
    return <>{children}</>;
  }

  // On web, render sidebar + content
  return (
    <XStack flex={1} backgroundColor="$background">
      <SidebarMenu />
      <YStack flex={1} marginLeft={250}>
        {children}
      </YStack>
    </XStack>
  );
}
```

**Purpose:**
- Conditionally wraps content with sidebar on web
- Provides proper layout structure
- No changes to mobile/native layout

### Step 4: Update Root Layout

**File:** `app/_layout.tsx`

Wrap the Stack with WebLayout:

```typescript
import '../tamagui.config';
import { Stack } from 'expo-router';
import { TamaguiProvider } from 'tamagui';
import config from '../tamagui.config';
import { WebLayout } from '../components/WebLayout';

export default function RootLayout() {
  return (
    <TamaguiProvider config={config} defaultTheme="dark">
      <WebLayout>
        <Stack>
          <Stack.Screen name="index" options={{ title: 'Login', headerShown: false }} />
          <Stack.Screen name="home" options={{ title: 'Home', headerShown: false }} />
          <Stack.Screen name="scan" options={{ title: 'Scan Results', headerShown: false }} />
          <Stack.Screen name="admin" options={{ title: 'Admin Panel', headerShown: false }} />
        </Stack>
      </WebLayout>
    </TamaguiProvider>
  );
}
```

**Note:** This approach wraps all screens. If you want to exclude the login screen (`index.tsx`) from having the sidebar, you'll need additional logic in `WebLayout` to check the current route.

### Step 5: Alternative - Per-Screen Implementation

If you prefer not to modify `_layout.tsx`, you can update each screen individually:

**Example for `app/home.tsx`:**

```typescript
import { YStack, Text } from 'tamagui';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import { NavigationBar } from '../components/NavigationBar';
import { SidebarMenu } from '../components/SidebarMenu';
import { WebLayout } from '../components/WebLayout';

export default function LandingPage() {
  return (
    <WebLayout>
      <YStack flex={1} backgroundColor="$background">
        <NavigationBar />
        
        <YStack flex={1} alignItems="center" justifyContent="center" padding="$4">
          <Text fontSize="$10" fontWeight="bold" color="$color">
            Welcome
          </Text>
        </YStack>
        <StatusBar style="light" />
      </YStack>
    </WebLayout>
  );
}
```

**Repeat for:**
- `app/scan.tsx`
- `app/admin.tsx`

**Note:** The login screen (`app/index.tsx`) should NOT include the sidebar.

### Step 6: Handle Login Screen Exclusion

Update `WebLayout` to exclude sidebar on login screen:

```typescript
import { XStack, YStack } from 'tamagui';
import { Platform } from 'react-native';
import { usePathname } from 'expo-router';
import { SidebarMenu } from './SidebarMenu';

interface WebLayoutProps {
  children: React.ReactNode;
}

export function WebLayout({ children }: WebLayoutProps) {
  const isWeb = Platform.OS === 'web';
  const pathname = usePathname();

  // Don't show sidebar on login screen or if not web
  if (!isWeb || pathname === '/') {
    return <>{children}</>;
  }

  // On web (except login), render sidebar + content
  return (
    <XStack flex={1} backgroundColor="$background">
      <SidebarMenu />
      <YStack flex={1} marginLeft={250}>
        {children}
      </YStack>
    </XStack>
  );
}
```

## Styling Considerations

### Sidebar Width
- Default: `250px` (adjustable via `width` prop)
- Consider making it responsive for smaller web screens

### Responsive Behavior
For very small web windows, you might want to:
- Collapse sidebar to icon-only mode
- Or switch back to hamburger menu below a breakpoint

**Example responsive logic:**

```typescript
import { useWindowDimensions } from 'react-native';

export function SidebarMenu() {
  const { width } = useWindowDimensions();
  const isCollapsed = width < 768; // Tablet breakpoint
  
  // Render collapsed or full sidebar based on width
  // ...
}
```

### Z-Index
- Sidebar: `zIndex={1000}` (ensure it's above content)
- NavigationBar (mobile): Keep existing z-index

### Safe Area Handling
- Use `useSafeAreaInsets()` for proper spacing on devices with notches
- Apply `paddingTop={insets.top + 12}` to sidebar

## Testing Checklist

### Web Testing
- [ ] Sidebar appears on left side of screen
- [ ] Navigation items work correctly
- [ ] Active route is highlighted
- [ ] User info displays correctly
- [ ] Logout works
- [ ] Sidebar doesn't appear on login screen
- [ ] Content area has proper left margin
- [ ] Sidebar is fixed and doesn't scroll with content

### Mobile/Native Testing
- [ ] Hamburger menu still appears
- [ ] Sheet modal opens correctly
- [ ] Navigation works as before
- [ ] No sidebar appears
- [ ] NavigationBar displays correctly

### Cross-Platform Testing
- [ ] Web shows sidebar
- [ ] Mobile shows hamburger menu
- [ ] No visual glitches on either platform
- [ ] Navigation works on both platforms

## Potential Issues & Solutions

### Issue 1: Content Overlap
**Problem:** Content might overlap with sidebar on web.

**Solution:** Ensure `WebLayout` applies proper `marginLeft` equal to sidebar width.

### Issue 2: Login Screen Shows Sidebar
**Problem:** Sidebar appears on login screen.

**Solution:** Add pathname check in `WebLayout` to exclude `/` route.

### Issue 3: Sidebar Scrolls with Content
**Problem:** Sidebar scrolls instead of staying fixed.

**Solution:** Use `position="fixed"` in Tamagui (or equivalent CSS) and ensure proper positioning.

### Issue 4: Mobile Shows Sidebar
**Problem:** Sidebar appears on mobile devices.

**Solution:** Always check `Platform.OS === 'web'` before rendering sidebar.

### Issue 5: Z-Index Conflicts
**Problem:** Other elements appear above sidebar.

**Solution:** Increase sidebar z-index or adjust other component z-index values.

## Advanced Features (Optional)

### Collapsible Sidebar
Add ability to collapse/expand sidebar:

```typescript
const [isCollapsed, setIsCollapsed] = useState(false);

// Collapsed: show icons only
// Expanded: show full labels
```

### Sidebar Animation
Add smooth transitions when toggling:

```typescript
// Use Tamagui animations or react-native-reanimated
```

### Responsive Breakpoints
Switch to hamburger menu on small web windows:

```typescript
const shouldUseSidebar = isWeb && width >= 768;
```

## Migration Notes

### Backward Compatibility
- All changes are additive
- Mobile/native experience unchanged
- No breaking changes to existing components

### Rollout Strategy
1. Implement and test on web
2. Verify mobile/native still works
3. Deploy to staging
4. Test across devices
5. Deploy to production

## File Summary

### New Files
- `components/SidebarMenu.tsx` - Persistent sidebar component
- `components/WebLayout.tsx` - Layout wrapper for web

### Modified Files
- `components/NavigationBar.tsx` - Conditional rendering based on platform
- `app/_layout.tsx` - Optional: wrap with WebLayout
- `app/home.tsx` - Optional: wrap with WebLayout (if not using _layout approach)
- `app/scan.tsx` - Optional: wrap with WebLayout (if not using _layout approach)
- `app/admin.tsx` - Optional: wrap with WebLayout (if not using _layout approach)

### Unchanged Files
- `components/MenuButton.tsx` - Still used for mobile/native
- `app/index.tsx` - Login screen (no sidebar needed)

## Conclusion

This implementation provides a clean separation between web and mobile experiences:
- **Web:** Persistent left-side sidebar menu
- **Mobile/Native:** Existing hamburger menu with Sheet modal

The solution is platform-aware and maintains backward compatibility while improving the web user experience.

