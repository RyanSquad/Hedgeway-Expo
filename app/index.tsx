import { useState, useRef } from 'react';
import { YStack, XStack, Text, Button, Input, Card, Spinner } from 'tamagui';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Platform } from 'react-native';
import { post, API_BASE_URL } from '../lib/api';
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
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const passwordInputRef = useRef<any>(null);
  const confirmPasswordInputRef = useRef<any>(null);

  const handleSubmit = async () => {
    // Prevent multiple simultaneous requests
    if (isSubmitting) {
      return;
    }

    if (!email || !password) {
      setError('Please fill in all required fields');
      return;
    }

    if (!isLogin && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsSubmitting(true);
    setLoading(true);
    setError(null);
    
    // Set loading message for login to account for backend delay
    if (isLogin) {
      setLoadingMessage('Authenticating...');
    } else {
      setLoadingMessage('Creating account...');
    }

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      // Some servers may expect passwordConfirmation or confirmPassword for register
      const body = isLogin 
        ? { email, password }
        : { email, password, passwordConfirmation: confirmPassword };

      // For login, use fetch with timeout to handle backend delay
      if (isLogin) {
        const LOGIN_TIMEOUT = 10000; // 10 seconds total timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), LOGIN_TIMEOUT);
        const startTime = Date.now();

        try {
          // Use shared API_BASE_URL to ensure consistency
          const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);
          const requestDuration = Date.now() - startTime;
          console.log(`[Login] Request completed in ${requestDuration}ms (expected ~2000ms with backend delay)`);

          const contentType = response.headers.get('content-type');
          let data: any;
          
          if (contentType && contentType.includes('application/json')) {
            const text = await response.text();
            try {
              data = text ? JSON.parse(text) : {};
            } catch {
              data = { error: text || 'Invalid JSON response' };
            }
          } else {
            const text = await response.text();
            data = text ? { error: text } : { error: 'Invalid response format' };
          }

          if (!response.ok) {
            setError(data.error || data.message || 'Login failed');
            setLoading(false);
            setLoadingMessage('');
            setIsSubmitting(false);
            return;
          }

          // Process successful login response
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
                setLoadingMessage('');
                setIsSubmitting(false);
              }
            } else {
              // Backward compatibility: only access token (old API format)
              console.warn('No refresh token received. Refresh token functionality will not work.');
              const stored = await tokenStorage.setTokens(accessToken, '', expiresIn);
              
              if (stored) {
                router.replace('/home');
              } else {
                setError('Failed to store authentication token. Please try again.');
                setLoading(false);
                setLoadingMessage('');
                setIsSubmitting(false);
              }
            }
          } else {
            setError('No access token received from server. Please try again.');
            setLoading(false);
            setLoadingMessage('');
            setIsSubmitting(false);
          }
        } catch (err) {
          clearTimeout(timeoutId);
          const errorDuration = Date.now() - startTime;
          console.log(`[Login] Request failed after ${errorDuration}ms`);
          
          if (err instanceof Error && err.name === 'AbortError') {
            setError('Login request timed out. Please try again.');
          } else {
            setError(err instanceof Error ? err.message : 'An error occurred');
          }
          setLoading(false);
          setLoadingMessage('');
          setIsSubmitting(false);
        }
      } else {
        // For register, use the existing post helper
        const response = await post<RegisterResponse>(endpoint, body);

        if (response.error) {
          setError(response.error);
          setLoading(false);
          setLoadingMessage('');
          setIsSubmitting(false);
          return;
        }

        if (!response.data) {
          setError('No data received from server');
          setLoading(false);
          setLoadingMessage('');
          setIsSubmitting(false);
          return;
        }

        // Extract tokens from response
        const data = response.data as any;
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
              setLoadingMessage('');
              setIsSubmitting(false);
            }
          } else {
            // Backward compatibility: only access token (old API format)
            console.warn('No refresh token received. Refresh token functionality will not work.');
            const stored = await tokenStorage.setTokens(accessToken, '', expiresIn);
            
            if (stored) {
              router.replace('/home');
            } else {
              setError('Failed to store authentication token. Please try again.');
              setLoading(false);
              setLoadingMessage('');
              setIsSubmitting(false);
            }
          }
        } else {
          setError('No access token received from server. Please try again.');
          setLoading(false);
          setLoadingMessage('');
          setIsSubmitting(false);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
      setLoadingMessage('');
      setIsSubmitting(false);
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
                returnKeyType="next"
                onSubmitEditing={() => {
                  if (isLogin) {
                    // In login mode, focus password or submit if password is already filled
                    if (password) {
                      handleSubmit();
                    } else {
                      passwordInputRef.current?.focus();
                    }
                  } else {
                    // In register mode, always focus password
                    passwordInputRef.current?.focus();
                  }
                }}
              />
            </YStack>

            <YStack space="$1">
              <Text fontSize="$3" color="$colorPress">
                Password
              </Text>
              <Input
                ref={passwordInputRef}
                placeholder="Enter your password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                size="$4"
                borderColor="$borderColor"
                backgroundColor="$background"
                returnKeyType={isLogin ? "done" : "next"}
                onSubmitEditing={() => {
                  if (isLogin) {
                    // In login mode, submit the form
                    handleSubmit();
                  } else {
                    // In register mode, focus confirm password
                    confirmPasswordInputRef.current?.focus();
                  }
                }}
              />
            </YStack>

            {!isLogin && (
              <YStack space="$1">
                <Text fontSize="$3" color="$colorPress">
                  Confirm Password
                </Text>
                <Input
                  ref={confirmPasswordInputRef}
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  size="$4"
                  borderColor="$borderColor"
                  backgroundColor="$background"
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                />
              </YStack>
            )}

            <Button
              theme="active"
              size="$4"
              onPress={handleSubmit}
              disabled={loading || isSubmitting}
              marginTop="$1"
            >
              {loading ? (
                <XStack alignItems="center" space="$2">
                  <Spinner size="small" color="$color" />
                  <Text color="$color">{loadingMessage || (isLogin ? 'Logging in...' : 'Please wait...')}</Text>
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
