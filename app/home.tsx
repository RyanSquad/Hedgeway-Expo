import { YStack, Text } from 'tamagui';
import { StatusBar } from 'expo-status-bar';
import { NavigationBar } from '../components/NavigationBar';

export default function LandingPage() {
  return (
    <YStack flex={1} backgroundColor="$background">
      <NavigationBar />
      
      <YStack flex={1} alignItems="center" justifyContent="center" padding="$4">
        <Text fontSize="$10" fontWeight="bold" color="$color">
          Welcome
        </Text>
      </YStack>
      <StatusBar style="light" />
    </YStack>
  );
}

