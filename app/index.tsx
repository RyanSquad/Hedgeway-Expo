import { useState } from 'react';
import { YStack, XStack, Text, Button, Input, Card, Spinner } from 'tamagui';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Platform } from 'react-native';
import { post } from '../lib/api';
import { tokenStorage } from '../lib/tokenStorage';

interface LoginResponse {
  accessToken?: string;
  token?: string; // Backward compatibility
  refreshToken?: string;
  expiresIn?: string;
  user?: {
    id: string;
    email: string;
    role?: string;
  };
}

interface RegisterResponse {
  accessToken?: string;
  token?: string; // Backward compatibility
  refreshToken?: string;
  expiresIn?: string;
  user?: {
    id: string;
    email: string;
    role?: string;
  };
  message?: string;
}

export default function HomeScreen() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!email || !password) {
      setError('Please fill in all required fields');
      return;
    }

    if (!isLogin && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      // Some servers may expect passwordConfirmation or confirmPassword for register
      const body = isLogin 
        ? { email, password }
        : { email, password, passwordConfirmation: confirmPassword };

      const response = await post<LoginResponse | RegisterResponse>(endpoint, body);

      if (response.error) {
        setError(response.error);
        setLoading(false);
        return;
      }

      if (!response.data) {
        setError('No data received from server');
        setLoading(false);
        return;
      }

      // Extract tokens from response
      const data = response.data as any;
      // New API format: { success: true, accessToken: "...", refreshToken: "...", expiresIn: "15m", user: {...} }
      // Old API format (backward compatibility): { success: true, token: "...", user: {...} }
      const accessToken = data?.accessToken || data?.token;
      const refreshToken = data?.refreshToken;
      const expiresIn = data?.expiresIn || '900'; // Default 15 minutes if not provided
      
      if (accessToken && typeof accessToken === 'string') {
        // If we have a refresh token, use the new token storage system
        if (refreshToken && typeof refreshToken === 'string') {
          const stored = await tokenStorage.setTokens(accessToken, refreshToken, expiresIn);
          
          if (stored) {
            // Navigate to landing page after tokens are confirmed stored
            router.replace('/home');
          } else {
            setError('Failed to store authentication tokens. Please try again.');
            setLoading(false);
          }
        } else {
          // Backward compatibility: only access token (old API format)
          // Store as access token only (refresh will not work until backend is updated)
          console.warn('No refresh token received. Refresh token functionality will not work.');
          const stored = await tokenStorage.setTokens(accessToken, '', expiresIn);
          
          if (stored) {
            router.replace('/home');
          } else {
            setError('Failed to store authentication token. Please try again.');
            setLoading(false);
          }
        }
      } else {
        setError('No access token received from server. Please try again.');
        setLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  };

  const isWeb = Platform.OS === 'web';
  
  return (
    <YStack 
      flex={1} 
      backgroundColor="$background" 
      alignItems="center" 
      justifyContent={isWeb ? "center" : "flex-start"} 
      padding="$4" 
      paddingTop={isWeb ? "$4" : "$20"}
    >
      <Card elevate padding="$6" width="100%" maxWidth={400} backgroundColor="$backgroundStrong">
        <YStack space="$3">
          <YStack alignItems="center" space="$2" marginBottom="$2">
            <Text fontSize="$10" fontWeight="bold" color="$color">
              Hedgeway
            </Text>
            <Text fontSize="$4" color="$colorPress">
              {isLogin ? 'Sign in to continue' : 'Create your account'}
            </Text>
          </YStack>

          <XStack space="$2" marginBottom="$2" justifyContent="center">
            <Button
              size="$3"
              theme={isLogin ? 'active' : undefined}
              onPress={() => {
                setIsLogin(true);
                setError(null);
              }}
              flex={1}
            >
              Login
            </Button>
            <Button
              size="$3"
              theme={!isLogin ? 'active' : undefined}
              onPress={() => {
                setIsLogin(false);
                setError(null);
              }}
              flex={1}
            >
              Register
            </Button>
          </XStack>

          {error && (
            <Card backgroundColor="$red2" padding="$3" borderRadius="$3">
              <Text color="$red11" fontSize="$3" textAlign="center">
                {error}
              </Text>
            </Card>
          )}

          <YStack space="$2">
            <YStack space="$1">
              <Text fontSize="$3" color="$colorPress">
                Email
              </Text>
              <Input
                placeholder="Enter your email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                size="$4"
                borderColor="$borderColor"
                backgroundColor="$background"
              />
            </YStack>

            <YStack space="$1">
              <Text fontSize="$3" color="$colorPress">
                Password
              </Text>
              <Input
                placeholder="Enter your password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                size="$4"
                borderColor="$borderColor"
                backgroundColor="$background"
              />
            </YStack>

            {!isLogin && (
              <YStack space="$1">
                <Text fontSize="$3" color="$colorPress">
                  Confirm Password
                </Text>
                <Input
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  size="$4"
                  borderColor="$borderColor"
                  backgroundColor="$background"
                />
              </YStack>
            )}

            <Button
              theme="active"
              size="$4"
              onPress={handleSubmit}
              disabled={loading}
              marginTop="$1"
            >
              {loading ? (
                <XStack alignItems="center" space="$2">
                  <Spinner size="small" color="$color" />
                  <Text color="$color">Please wait...</Text>
                </XStack>
              ) : (
                <Text color="$color">{isLogin ? 'Sign In' : 'Sign Up'}</Text>
              )}
            </Button>
          </YStack>
        </YStack>
      </Card>
      <StatusBar style="light" />
    </YStack>
  );
}
