import '../tamagui.config'; // Ensure config is loaded first
import { Stack } from 'expo-router';
import { TamaguiProvider } from 'tamagui';
import config from '../tamagui.config';

export default function RootLayout() {
  return (
    <TamaguiProvider config={config} defaultTheme="light">
      <Stack>
        <Stack.Screen name="index" options={{ title: 'Login', headerShown: false }} />
        <Stack.Screen name="home" options={{ title: 'Home', headerShown: false }} />
        <Stack.Screen name="scan" options={{ title: 'Scan Results', headerShown: false }} />
        <Stack.Screen name="admin" options={{ title: 'Admin Panel', headerShown: false }} />
      </Stack>
    </TamaguiProvider>
  );
}

