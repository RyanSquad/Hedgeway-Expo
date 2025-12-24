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
      case '/player-stats':
        return 'Player Stats';
      case '/predictions':
        return 'Predictions';
      case '/admin':
        return 'Admin Panel';
      default:
        return 'Hedgeway';
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

