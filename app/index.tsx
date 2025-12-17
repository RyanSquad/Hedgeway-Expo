import { YStack, Text, Button } from 'tamagui';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';

export default function HomeScreen() {
  const router = useRouter();

  return (
    <YStack flex={1} backgroundColor="$background" alignItems="center" justifyContent="center" padding="$4" space="$4">
      <Text fontSize="$8" fontWeight="bold" color="$color">
        Welcome to Hedgeway
      </Text>
      <Text fontSize="$4" color="$colorPress">
        Your Expo app is ready with Tamagui!
      </Text>
      <Button theme="active" size="$4" onPress={() => router.push('/scan')}>
        Get Started
      </Button>
      <StatusBar style="auto" />
    </YStack>
  );
}

