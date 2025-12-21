import { YStack } from 'tamagui';
import { Platform } from 'react-native';
import { usePathname } from 'expo-router';
import { SidebarMenu } from './SidebarMenu';
import { SidebarProvider, useSidebar } from './SidebarContext';

interface WebLayoutContentProps {
  children: React.ReactNode;
}

function WebLayoutContent({ children }: WebLayoutContentProps) {
  const isWeb = Platform.OS === 'web';
  const pathname = usePathname();
  const { sidebarWidth } = useSidebar();

  // Don't show sidebar on login screen or if not web
  if (!isWeb || pathname === '/') {
    return <>{children}</>;
  }

  // On web (except login), render sidebar + content
  // Sidebar is fixed, so we just need to add margin to content
  return (
    <YStack flex={1} backgroundColor="$background">
      <SidebarMenu />
      <YStack flex={1} marginLeft={sidebarWidth} backgroundColor="$background" animation="quick">
        {children}
      </YStack>
    </YStack>
  );
}

interface WebLayoutProps {
  children: React.ReactNode;
}

export function WebLayout({ children }: WebLayoutProps) {
  const isWeb = Platform.OS === 'web';
  const pathname = usePathname();

  // Don't wrap with provider on login screen or if not web
  if (!isWeb || pathname === '/') {
    return <>{children}</>;
  }

  // Wrap with SidebarProvider for web (except login)
  return (
    <SidebarProvider>
      <WebLayoutContent>{children}</WebLayoutContent>
    </SidebarProvider>
  );
}

