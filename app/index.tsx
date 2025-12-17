import { YStack, Text, Button } from 'tamagui';
import { StatusBar } from 'expo-status-bar';

export default function HomeScreen() {
  return (
    <YStack flex={1} backgroundColor="$background" alignItems="center" justifyContent="center" padding="$4" space="$4">
      <Text fontSize="$8" fontWeight="bold" color="$color">
        Welcome to Hedgeway
      </Text>
      <Text fontSize="$4" color="$colorPress">
        Your Expo app is ready with Tamagui!
      </Text>
      <Button theme="active" size="$4">
        Get Started
      </Button>
      <StatusBar style="auto" />
    </YStack>
  );
}

