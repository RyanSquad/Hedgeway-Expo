import { useState } from 'react';
import { XStack, YStack, Button, Sheet, Text, Separator } from 'tamagui';
import { useRouter, usePathname } from 'expo-router';
import { logout } from '../lib/api';
import { useAuth } from '../lib/useAuth';

export function MenuButton() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { user, isSuperAdmin } = useAuth();

  const handleLogout = async () => {
    await logout();
    setOpen(false);
    router.replace('/');
  };

  const navigateTo = (path: string) => {
    setOpen(false);
    router.push(path);
  };

  const menuItems = [
    { label: 'Home', path: '/home', show: true },
    { label: 'Scan Results', path: '/scan', show: true },
    { label: 'Player Stats', path: '/player-stats', show: true },
    { label: 'Admin Panel', path: '/admin', show: isSuperAdmin },
  ].filter(item => item.show);

  return (
    <>
      <Button
        size="$3"
        circular
        onPress={() => setOpen(true)}
        backgroundColor="transparent"
        pressStyle={{ opacity: 0.7 }}
        padding="$1"
      >
        <Text fontSize="$6" color="white">☰</Text>
      </Button>

      <Sheet
        modal
        open={open}
        onOpenChange={setOpen}
        snapPoints={[70]}
        dismissOnSnapToBottom
        zIndex={100_000}
        animation="medium"
      >
        <Sheet.Overlay />
        <Sheet.Handle />
        <Sheet.Frame padding="$4" backgroundColor="$background">
          <YStack space="$4">
            <XStack justifyContent="space-between" alignItems="center">
              <Text fontSize="$7" fontWeight="bold" color="$color">
                Menu
              </Text>
              <Button
                size="$3"
                circular
                onPress={() => setOpen(false)}
                backgroundColor="transparent"
              >
                ✕
              </Button>
            </XStack>

            {user && (
              <YStack space="$2" paddingVertical="$2">
                <Text fontSize="$4" color="$colorPress">
                  {user.email}
                </Text>
                <Text fontSize="$2" color="$colorPress">
                  Role: {user.role}
                </Text>
              </YStack>
            )}

            <Separator />

            <YStack space="$3">
              {menuItems.map((item) => (
                <Button
                  key={item.path}
                  size="$4"
                  theme={pathname === item.path ? 'active' : undefined}
                  onPress={() => navigateTo(item.path)}
                  justifyContent="flex-start"
                >
                  <Text color="$color">{item.label}</Text>
                </Button>
              ))}
            </YStack>

            <Separator />

            <Button
              size="$4"
              theme="red"
              onPress={handleLogout}
            >
              <Text color="$color">Logout</Text>
            </Button>
          </YStack>
        </Sheet.Frame>
      </Sheet>
    </>
  );
}

