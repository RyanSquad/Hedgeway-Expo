import { useState } from 'react';
import { YStack, XStack, Text, Button, Input, Card, Spinner } from 'tamagui';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { post, setAuthToken, getAuthToken } from '../lib/api';

interface LoginResponse {
  token: string;
  user?: {
    id: string;
    email: string;
    role?: string;
  };
}

interface RegisterResponse {
  token?: string;
  user?: {
    id: string;
    email: string;
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

      // Extract token from response - according to API docs, token is directly in response.data
      const data = response.data as any;
      // API returns: { success: true, token: "...", user: {...} }
      const token = data?.token;
      
      if (token && typeof token === 'string') {
        // Store token securely before navigation
        const stored = await setAuthToken(token);
        
        if (stored) {
          // Navigate to scan screen after token is confirmed stored
          router.replace('/scan');
        } else {
          setError('Failed to store authentication token. Please try again.');
          setLoading(false);
        }
      } else {
        setError('No token received from server. Please try again.');
        setLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  };

  return (
    <YStack flex={1} backgroundColor="$background" alignItems="center" justifyContent="center" padding="$4">
      <Card elevate padding="$6" width="100%" maxWidth={400} backgroundColor="$backgroundStrong">
        <YStack space="$4">
          <YStack alignItems="center" space="$2" marginBottom="$4">
            <Text fontSize="$10" fontWeight="bold" color="$color">
              Hedgeway
            </Text>
            <Text fontSize="$4" color="$colorPress">
              {isLogin ? 'Sign in to continue' : 'Create your account'}
            </Text>
          </YStack>

          <XStack space="$2" marginBottom="$4" justifyContent="center">
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

          <YStack space="$3">
            <YStack space="$2">
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

            <YStack space="$2">
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
              <YStack space="$2">
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
              marginTop="$2"
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
      <StatusBar style="auto" />
    </YStack>
  );
}
