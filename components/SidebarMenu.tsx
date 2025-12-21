import { YStack, XStack, Text, Button, Separator } from 'tamagui';
import { useRouter, usePathname } from 'expo-router';
import { logout } from '../lib/api';
import { useAuth } from '../lib/useAuth';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSidebar } from './SidebarContext';

export function SidebarMenu() {
  const { isCollapsed, setIsCollapsed, sidebarWidth } = useSidebar();
  const router = useRouter();
  const pathname = usePathname();
  const { user, isSuperAdmin } = useAuth();
  const insets = useSafeAreaInsets();

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  const navigateTo = (path: string) => {
    router.push(path);
  };

  const menuItems = [
    { label: 'Home', path: '/home', show: true, icon: '🏠' },
    { label: 'Scan Results', path: '/scan', show: true, icon: '🔍' },
    { label: 'Admin Panel', path: '/admin', show: isSuperAdmin, icon: '⚙️' },
  ].filter(item => item.show);

  return (
    <YStack
      width={sidebarWidth}
      backgroundColor="$backgroundStrong"
      borderRightWidth={1}
      borderRightColor="$borderColor"
      padding={isCollapsed ? "$2" : "$4"}
      paddingTop={insets.top + 12}
      height="100%"
      position="fixed"
      left={0}
      top={0}
      zIndex={1000}
      animation="quick"
    >
      <YStack space="$4" flex={1}>
        {/* Logo/Title Section with Hamburger */}
        <XStack 
          space="$2" 
          alignItems="center" 
          marginBottom="$4"
          justifyContent={isCollapsed ? "center" : "flex-start"}
        >
          <Button
            size="$3"
            circular
            onPress={toggleCollapse}
            backgroundColor="transparent"
            pressStyle={{ opacity: 0.7 }}
            padding="$1"
          >
            <Text fontSize="$5" color="$color">☰</Text>
          </Button>
          {!isCollapsed && (
            <Text fontSize="$8" fontWeight="bold" color="$color">
              Hedgeway
            </Text>
          )}
        </XStack>

        {/* User Info */}
        {!isCollapsed && user && (
          <YStack space="$2" paddingVertical="$2" marginBottom="$2">
            <Text fontSize="$4" color="$colorPress">
              {user.email}
            </Text>
            <Text fontSize="$2" color="$colorPress">
              Role: {user.role}
            </Text>
          </YStack>
        )}

        {!isCollapsed && <Separator />}

        {/* Navigation Items */}
        <YStack space="$2" flex={1}>
          {menuItems.map((item) => (
            <Button
              key={item.path}
              size="$4"
              theme={pathname === item.path ? 'active' : undefined}
              onPress={() => navigateTo(item.path)}
              justifyContent={isCollapsed ? "center" : "flex-start"}
              width="100%"
              title={isCollapsed ? item.label : undefined}
            >
              <XStack space="$2" alignItems="center" justifyContent={isCollapsed ? "center" : "flex-start"}>
                <Text fontSize="$5">{item.icon}</Text>
                {!isCollapsed && (
                  <Text color="$color">{item.label}</Text>
                )}
              </XStack>
            </Button>
          ))}
        </YStack>

        {!isCollapsed && <Separator />}

        {/* Logout Button */}
        <Button
          size="$4"
          theme="red"
          onPress={handleLogout}
          width="100%"
          justifyContent={isCollapsed ? "center" : "flex-start"}
          title={isCollapsed ? "Logout" : undefined}
        >
          <XStack space="$2" alignItems="center" justifyContent={isCollapsed ? "center" : "flex-start"}>
            <Text fontSize="$5">🚪</Text>
            {!isCollapsed && (
              <Text color="$color">Logout</Text>
            )}
          </XStack>
        </Button>
      </YStack>
    </YStack>
  );
}

