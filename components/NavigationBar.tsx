import { XStack, YStack, Button, Text } from 'tamagui';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { clearAuthToken } from '../lib/api';
import { useAuth } from '../lib/useAuth';
import { MenuButton } from './MenuButton';

export function NavigationBar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const handleLogout = async () => {
    await clearAuthToken();
    router.replace('/');
  };

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
        return 'Hedgeway';
    }
  };

  return (
    <XStack 
      padding="$3" 
      paddingTop={insets.top + 12}
      backgroundColor="$blue9" 
      borderBottomWidth={1} 
      borderBottomColor="$borderColor" 
      alignItems="center" 
      space="$3"
      justifyContent="space-between"
    >
      <XStack space="$3" alignItems="center" flex={1}>
        <MenuButton />
        <Text fontSize="$6" fontWeight="bold" color="white">
          {getPageTitle()}
        </Text>
      </XStack>

      {user && (
        <XStack space="$2" alignItems="center">
          <YStack alignItems="flex-end" marginRight="$2">
            <Text fontSize="$3" color="white">
              {user.email}
            </Text>
            <Text fontSize="$2" color="white" opacity={0.9}>
              {user.role}
            </Text>
          </YStack>
          <Button
            size="$3"
            theme="red"
            onPress={handleLogout}
          >
            <Text color="$color" fontSize="$3">Logout</Text>
          </Button>
        </XStack>
      )}
    </XStack>
  );
}

