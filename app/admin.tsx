import { useEffect, useState, useCallback } from 'react';
import { YStack, XStack, Text, ScrollView, Card, Button, Input, Spinner, Separator, Switch, Label } from 'tamagui';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { get, post } from '../lib/api';
import { useAuth } from '../lib/useAuth';
import { NavigationBar } from '../components/NavigationBar';

interface ScanConfig {
  date: string | null;
  books: string[];
  propTypes: string[] | null;
  minEdge: number;
  maxAge?: number;
  autoRefreshSeconds: number;
}

const AVAILABLE_BOOKS = [
  'betmgm',
  'bet365',
  'ballybet',
  'betparx',
  'betrivers',
  'caesars',
  'draftkings',
  'fanduel',
  'rebet',
];

const PROP_TYPES = [
  'points',
  'assists',
  'rebounds',
  'steals',
  'blocks',
  'turnovers',
  'threes',
];

export default function AdminPanel() {
  const router = useRouter();
  const { user, isSuperAdmin, loading: authLoading } = useAuth();
  const [config, setConfig] = useState<ScanConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Local state for form
  const [selectedBooks, setSelectedBooks] = useState<string[]>([]);
  const [selectedPropTypes, setSelectedPropTypes] = useState<string[] | null>(null);
  const [minEdge, setMinEdge] = useState<string>('0.0020');
  const [autoRefreshSeconds, setAutoRefreshSeconds] = useState<string>('60');

  useEffect(() => {
    if (!authLoading) {
      if (!user || !isSuperAdmin) {
        router.replace('/scan');
        return;
      }
      fetchConfig();
    }
  }, [user, isSuperAdmin, authLoading]);

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await get<ScanConfig>('/api/scan/config');

      if (response.error) {
        setError(response.error);
      } else if (response.data) {
        setConfig(response.data);
        setSelectedBooks(response.data.books || []);
        setSelectedPropTypes(response.data.propTypes);
        setMinEdge(response.data.minEdge?.toString() || '0.0020');
        setAutoRefreshSeconds(response.data.autoRefreshSeconds?.toString() || '60');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch config');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const updateData: Partial<ScanConfig> = {
        books: selectedBooks,
        minEdge: parseFloat(minEdge),
        autoRefreshSeconds: parseInt(autoRefreshSeconds, 10),
      };

      if (selectedPropTypes && selectedPropTypes.length > 0) {
        updateData.propTypes = selectedPropTypes;
      } else {
        updateData.propTypes = null;
      }

      const response = await post<{ success: boolean; config: ScanConfig }>('/api/scan/config', updateData);

      if (response.error) {
        setError(response.error);
      } else {
        setSuccess('Configuration saved successfully!');
        setConfig(response.data?.config || null);
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save config');
    } finally {
      setSaving(false);
    }
  };

  const toggleBook = (book: string) => {
    setSelectedBooks((prev) =>
      prev.includes(book) ? prev.filter((b) => b !== book) : [...prev, book]
    );
  };

  const togglePropType = (propType: string) => {
    setSelectedPropTypes((prev) => {
      if (!prev) return [propType];
      if (prev.includes(propType)) {
        const filtered = prev.filter((p) => p !== propType);
        return filtered.length > 0 ? filtered : null;
      }
      return [...prev, propType];
    });
  };

  const handleStartScan = async () => {
    try {
      setError(null);
      const response = await post('/api/scan/start', {});
      if (response.error) {
        setError(response.error);
      } else {
        setSuccess('Auto-refresh started');
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start scan');
    }
  };

  const handleStopScan = async () => {
    try {
      setError(null);
      const response = await post('/api/scan/stop', {});
      if (response.error) {
        setError(response.error);
      } else {
        setSuccess('Auto-refresh stopped');
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop scan');
    }
  };

  if (authLoading || loading) {
    return (
      <YStack flex={1} backgroundColor="$background" alignItems="center" justifyContent="center">
        <Spinner size="large" color="$color" />
        <Text marginTop="$4" fontSize="$4" color="$color">
          Loading...
        </Text>
        <StatusBar style="light" />
      </YStack>
    );
  }

  if (!user || !isSuperAdmin) {
    return (
      <YStack flex={1} backgroundColor="$background" alignItems="center" justifyContent="center" padding="$4">
        <Text fontSize="$6" fontWeight="bold" color="$red10" marginBottom="$4">
          Access Denied
        </Text>
        <Text fontSize="$4" color="$color" textAlign="center">
          You must be a super_admin to access this page.
        </Text>
        <Button marginTop="$4" onPress={() => router.replace('/scan')}>
          Go to Scan Results
        </Button>
        <StatusBar style="light" />
      </YStack>
    );
  }

  return (
    <YStack flex={1} backgroundColor="$background">
      <NavigationBar />

      <ScrollView flex={1} padding="$4">
        <YStack space="$4">
          {error && (
            <Card backgroundColor="$red2" padding="$3" borderRadius="$3">
              <Text color="$red11" fontSize="$3" textAlign="center">
                {error}
              </Text>
            </Card>
          )}

          {success && (
            <Card backgroundColor="$green2" padding="$3" borderRadius="$3">
              <Text color="$green11" fontSize="$3" textAlign="center">
                {success}
              </Text>
            </Card>
          )}

          {/* Scan Control */}
          <Card elevate padding="$4" backgroundColor="$backgroundStrong">
            <YStack space="$3">
              <Text fontSize="$6" fontWeight="bold" color="$color">
                Scan Control
              </Text>
              <Separator />
              <XStack space="$3">
                <Button flex={1} theme="active" onPress={handleStartScan}>
                  Start Auto-Refresh
                </Button>
                <Button flex={1} theme="red" onPress={handleStopScan}>
                  Stop Auto-Refresh
                </Button>
              </XStack>
            </YStack>
          </Card>

          {/* Scan Configuration */}
          <Card elevate padding="$4" backgroundColor="$backgroundStrong">
            <YStack space="$4">
              <Text fontSize="$6" fontWeight="bold" color="$color">
                Scan Configuration
              </Text>
              <Separator />

              {/* Minimum Edge */}
              <YStack space="$2">
                <Label fontSize="$4" color="$colorPress">
                  Minimum Edge (%)
                </Label>
                <Input
                  value={minEdge}
                  onChangeText={setMinEdge}
                  keyboardType="decimal-pad"
                  placeholder="0.0020"
                  size="$4"
                />
                <Text fontSize="$2" color="$colorPress">
                  Current: {(parseFloat(minEdge) * 100).toFixed(2)}%
                </Text>
              </YStack>

              {/* Auto Refresh Seconds */}
              <YStack space="$2">
                <Label fontSize="$4" color="$colorPress">
                  Auto-Refresh Interval (seconds)
                </Label>
                <Input
                  value={autoRefreshSeconds}
                  onChangeText={setAutoRefreshSeconds}
                  keyboardType="number-pad"
                  placeholder="60"
                  size="$4"
                />
              </YStack>

              {/* Sportsbooks */}
              <YStack space="$2">
                <Label fontSize="$4" color="$colorPress">
                  Sportsbooks
                </Label>
                <YStack space="$2" flexWrap="wrap">
                  {AVAILABLE_BOOKS.map((book) => (
                    <XStack key={book} alignItems="center" space="$2">
                      <Switch
                        checked={selectedBooks.includes(book)}
                        onCheckedChange={() => toggleBook(book)}
                        size="$4"
                      />
                      <Text color="$color" onPress={() => toggleBook(book)}>
                        {book}
                      </Text>
                    </XStack>
                  ))}
                </YStack>
              </YStack>

              {/* Prop Types */}
              <YStack space="$2">
                <Label fontSize="$4" color="$colorPress">
                  Prop Types (leave all unchecked for all types)
                </Label>
                <YStack space="$2">
                  {PROP_TYPES.map((propType) => (
                    <XStack key={propType} alignItems="center" space="$2">
                      <Switch
                        checked={selectedPropTypes?.includes(propType) || false}
                        onCheckedChange={() => togglePropType(propType)}
                        size="$4"
                      />
                      <Text color="$color" onPress={() => togglePropType(propType)}>
                        {propType}
                      </Text>
                    </XStack>
                  ))}
                </YStack>
              </YStack>

              <Button
                theme="active"
                size="$4"
                onPress={handleSave}
                disabled={saving}
                marginTop="$2"
              >
                {saving ? (
                  <XStack alignItems="center" space="$2">
                    <Spinner size="small" color="$color" />
                    <Text color="$color">Saving...</Text>
                  </XStack>
                ) : (
                  <Text color="$color">Save Configuration</Text>
                )}
              </Button>
            </YStack>
          </Card>

          {/* Discord Settings */}
          <Card elevate padding="$4" backgroundColor="$backgroundStrong">
            <YStack space="$3">
              <Text fontSize="$6" fontWeight="bold" color="$color">
                Discord Settings
              </Text>
              <Separator />
              <Text fontSize="$3" color="$colorPress">
                Discord configuration is managed server-side via environment variables:
              </Text>
              <YStack space="$1" paddingLeft="$2">
                <Text fontSize="$2" color="$colorPress">• DISCORD_TOKEN</Text>
                <Text fontSize="$2" color="$colorPress">• DISCORD_CHANNEL_ID</Text>
              </YStack>
              <Text fontSize="$3" color="$colorPress" marginTop="$2">
                To send results to Discord, use the POST /api/discord/send-results endpoint.
              </Text>
            </YStack>
          </Card>
        </YStack>
      </ScrollView>

      <StatusBar style="auto" />
    </YStack>
  );
}

