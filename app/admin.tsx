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

  // Player Stats state
  const [testPlayerId, setTestPlayerId] = useState<string>('237'); // Default: LeBron James
  const [testSeason, setTestSeason] = useState<string>('');
  const [populateSeason, setPopulateSeason] = useState<string>('');
  const [testingPlayer, setTestingPlayer] = useState(false);
  const [populatingStats, setPopulatingStats] = useState(false);
  const [playerStatsResult, setPlayerStatsResult] = useState<string | null>(null);
  const [populateResult, setPopulateResult] = useState<{
    processed?: number;
    errors?: number;
    total?: number;
  } | null>(null);

  // Prediction generation state
  const [generatingPredictions, setGeneratingPredictions] = useState(false);
  const [predictionResult, setPredictionResult] = useState<string | null>(null);

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

  /**
   * Get current NBA season year
   * Season year represents the calendar year in which the season begins
   * e.g., 2023-2024 season = 2023, 2024-2025 season = 2024
   */
  const getCurrentSeason = (): number => {
    const now = new Date();
    const month = now.getMonth() + 1; // 1-12
    const year = now.getFullYear();
    
    // NBA season runs October (10) to April (4)
    // Season year is the year it BEGINS
    if (month >= 10) {
      return year; // October-December: current season started this year
    } else if (month <= 4) {
      return year - 1; // January-April: current season started last year
    } else {
      // May-September: off-season, use last season (the one that just ended)
      return year - 1;
    }
  };

  /**
   * Test player stats update for a single player
   */
  const handleTestPlayerStats = async () => {
    if (!testPlayerId || isNaN(parseInt(testPlayerId))) {
      setError('Please enter a valid player ID');
      return;
    }

    try {
      setTestingPlayer(true);
      setError(null);
      setPlayerStatsResult(null);
      setSuccess(null);

      const season = testSeason ? parseInt(testSeason) : getCurrentSeason();
      const playerId = parseInt(testPlayerId);

      console.log(`[Admin] Testing player stats for player ${playerId}, season ${season}`);

      const response = await post<{ success: boolean; player_id: number; error?: string; message?: string }>(
        `/api/player-stats/update/${playerId}`,
        { season }
      );

      console.log('[Admin] Response:', response);

      if (response.error) {
        // API-level error (network, auth, etc.)
        const errorMsg = response.error;
        setError(errorMsg);
        setPlayerStatsResult(`API Error: ${errorMsg}`);
      } else if (response.data) {
        if (response.data.success) {
          setSuccess(`Player stats updated successfully for player ID ${playerId}`);
          setPlayerStatsResult(`Successfully updated stats for player ${playerId} (season ${season})`);
          setTimeout(() => setSuccess(null), 5000);
        } else {
          // Backend returned success: false
          const errorMsg = response.data.error || response.data.message || 'Failed to update player stats';
          
          // Provide more helpful error messages
          let userFriendlyError = errorMsg;
          if (errorMsg.includes('No stats found') || errorMsg.includes('No stats')) {
            userFriendlyError = `No stats found for player ${playerId} in season ${season}. This could mean:
- The player hasn't played any games this season
- The season year is incorrect (current: ${getCurrentSeason()})
- The player ID may be invalid
- The BallDontLie API may not have data for this player/season`;
          }
          
          setError(userFriendlyError);
          setPlayerStatsResult(`Error: ${errorMsg}`);
        }
      } else {
        // No data and no error - unexpected response
        setError('Unexpected response from server');
        setPlayerStatsResult('Error: Unexpected response format');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to test player stats';
      console.error('[Admin] Error testing player stats:', err);
      setError(errorMsg);
      setPlayerStatsResult(`Error: ${errorMsg}`);
    } finally {
      setTestingPlayer(false);
    }
  };

  /**
   * Populate player stats for all active players
   */
  const handlePopulatePlayerStats = async () => {
    try {
      setPopulatingStats(true);
      setError(null);
      setPopulateResult(null);
      setSuccess(null);

      const season = populateSeason ? parseInt(populateSeason) : getCurrentSeason();

      const response = await post<{
        success: boolean;
        processed?: number;
        errors?: number;
        total?: number;
        error?: string;
      }>('/api/player-stats/populate', { season });

      if (response.error) {
        setError(response.error);
        setPopulateResult(null);
      } else if (response.data) {
        if (response.data.success) {
          setPopulateResult({
            processed: response.data.processed || 0,
            errors: response.data.errors || 0,
            total: response.data.total || 0,
          });
          setSuccess(
            `Player stats populated: ${response.data.processed || 0} processed, ${response.data.errors || 0} errors`
          );
          setTimeout(() => setSuccess(null), 10000);
        } else {
          setError(response.data.error || 'Failed to populate player stats');
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to populate player stats';
      setError(errorMsg);
      setPopulateResult(null);
    } finally {
      setPopulatingStats(false);
    }
  };

  /**
   * Generate predictions for today's games
   */
  const handleGeneratePredictions = async () => {
    try {
      setGeneratingPredictions(true);
      setError(null);
      setPredictionResult(null);
      setSuccess(null);

      const response = await post<{
        success?: boolean;
        message?: string;
        predictionsGenerated?: number;
        error?: string;
      }>('/api/predictions/generate/today', {});

      if (response.error) {
        const errorMsg = response.error;
        setError(errorMsg);
        setPredictionResult(`Error: ${errorMsg}`);
      } else if (response.data) {
        if (response.data.success !== false) {
          const message = response.data.message || 'Predictions generated successfully';
          const count = response.data.predictionsGenerated 
            ? ` (${response.data.predictionsGenerated} predictions)` 
            : '';
          setSuccess(`${message}${count}`);
          setPredictionResult(`${message}${count}`);
          setTimeout(() => setSuccess(null), 10000);
        } else {
          const errorMsg = response.data.error || response.data.message || 'Failed to generate predictions';
          setError(errorMsg);
          setPredictionResult(`Error: ${errorMsg}`);
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to generate predictions';
      console.error('[Admin] Error generating predictions:', err);
      setError(errorMsg);
      setPredictionResult(`Error: ${errorMsg}`);
    } finally {
      setGeneratingPredictions(false);
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

          {/* Player Stats Management */}
          <Card elevate padding="$4" backgroundColor="$backgroundStrong">
            <YStack space="$4">
              <Text fontSize="$6" fontWeight="bold" color="$color">
                Player Stats Management
              </Text>
              <Separator />
              
              <Text fontSize="$3" color="$colorPress">
                Current Season: {getCurrentSeason()}
              </Text>

              {/* Test Single Player */}
              <YStack space="$3">
                <Text fontSize="$5" fontWeight="600" color="$color">
                  Test Single Player
                </Text>
                <Text fontSize="$2" color="$colorPress">
                  Fetch and update stats for a single player from BallDontLie API. This will INSERT new data 
                  into the database if the player doesn't exist, or UPDATE existing data if the player is already in the database.
                </Text>
                
                <YStack space="$2">
                  <Label fontSize="$4" color="$colorPress">
                    Player ID
                  </Label>
                  <Input
                    value={testPlayerId}
                    onChangeText={setTestPlayerId}
                    keyboardType="number-pad"
                    placeholder="237"
                    size="$4"
                  />
                  <Text fontSize="$2" color="$colorPress">
                    Example: 237 (LeBron James), 115 (Stephen Curry), 145 (Kevin Durant)
                  </Text>
                </YStack>

                <YStack space="$2">
                  <Label fontSize="$4" color="$colorPress">
                    Season (optional - defaults to current season)
                  </Label>
                  <Input
                    value={testSeason}
                    onChangeText={setTestSeason}
                    keyboardType="number-pad"
                    placeholder={`${getCurrentSeason()}`}
                    size="$4"
                  />
                  <Text fontSize="$2" color="$colorPress">
                    Current season: {getCurrentSeason()} (NBA season year = calendar year season begins)
                  </Text>
                </YStack>

                <Card backgroundColor="$blue2" padding="$2" borderRadius="$2">
                  <Text fontSize="$2" color="$blue11" fontWeight="600">
                    📥 This function will:
                  </Text>
                  <YStack space="$1" paddingLeft="$2" marginTop="$1">
                    <Text fontSize="$2" color="$blue11">
                      • Fetch player data from BallDontLie API
                    </Text>
                    <Text fontSize="$2" color="$blue11">
                      • Calculate rolling averages (7, 14, 30 games)
                    </Text>
                    <Text fontSize="$2" color="$blue11">
                      • INSERT new record if player doesn't exist
                    </Text>
                    <Text fontSize="$2" color="$blue11">
                      • UPDATE existing record if player already exists
                    </Text>
                  </YStack>
                </Card>

                <Card backgroundColor="$yellow2" padding="$2" borderRadius="$2">
                  <Text fontSize="$2" color="$yellow11">
                    ⚠️ If you get "No stats found", the player may not have played games this season, 
                    or the season/year may need adjustment. Try a different player ID or season.
                  </Text>
                </Card>

                <Button
                  theme="active"
                  size="$4"
                  onPress={handleTestPlayerStats}
                  disabled={testingPlayer || !testPlayerId}
                >
                  {testingPlayer ? (
                    <XStack alignItems="center" space="$2">
                      <Spinner size="small" color="$color" />
                      <Text color="$color">Testing...</Text>
                    </XStack>
                  ) : (
                    <Text color="$color">Test Player Stats</Text>
                  )}
                </Button>

                {playerStatsResult && (
                  <Card backgroundColor="$blue2" padding="$3" borderRadius="$3">
                    <Text color="$blue11" fontSize="$3">
                      {playerStatsResult}
                    </Text>
                  </Card>
                )}
              </YStack>

              <Separator />

              {/* Populate All Players */}
              <YStack space="$3">
                <Text fontSize="$5" fontWeight="600" color="$color">
                  Populate All Player Stats
                </Text>
                <Text fontSize="$2" color="$colorPress">
                  This will fetch and populate stats for all active players. This operation may take 15-45 minutes.
                </Text>
                <Text fontSize="$2" color="$red10" fontWeight="600">
                  ⚠️ Warning: This is a long-running operation. Do not close the app.
                </Text>

                <YStack space="$2">
                  <Label fontSize="$4" color="$colorPress">
                    Season (optional - defaults to current season)
                  </Label>
                  <Input
                    value={populateSeason}
                    onChangeText={setPopulateSeason}
                    keyboardType="number-pad"
                    placeholder={`${getCurrentSeason()}`}
                    size="$4"
                  />
                </YStack>

                <Button
                  theme="blue"
                  size="$4"
                  onPress={handlePopulatePlayerStats}
                  disabled={populatingStats}
                >
                  {populatingStats ? (
                    <XStack alignItems="center" space="$2">
                      <Spinner size="small" color="$color" />
                      <Text color="$color">Populating Stats...</Text>
                    </XStack>
                  ) : (
                    <Text color="$color">Populate All Player Stats</Text>
                  )}
                </Button>

                {populateResult && (
                  <Card backgroundColor="$blue2" padding="$3" borderRadius="$3">
                    <YStack space="$2">
                      <Text color="$blue11" fontSize="$4" fontWeight="600">
                        Population Results
                      </Text>
                      <Text color="$blue11" fontSize="$3">
                        Total Players: {populateResult.total || 0}
                      </Text>
                      <Text color="$green11" fontSize="$3">
                        Successfully Processed: {populateResult.processed || 0}
                      </Text>
                      {populateResult.errors && populateResult.errors > 0 && (
                        <Text color="$red11" fontSize="$3">
                          Errors: {populateResult.errors}
                        </Text>
                      )}
                    </YStack>
                  </Card>
                )}
              </YStack>
            </YStack>
          </Card>

          {/* Prediction Management */}
          <Card elevate padding="$4" backgroundColor="$backgroundStrong">
            <YStack space="$4">
              <Text fontSize="$6" fontWeight="bold" color="$color">
                Prediction Management
              </Text>
              <Separator />
              
              <YStack space="$3">
                <Text fontSize="$5" fontWeight="600" color="$color">
                  Generate Predictions for Today
                </Text>
                <Text fontSize="$2" color="$colorPress">
                  Generate model predictions for all player props in today's games. This will:
                </Text>
                
                <Card backgroundColor="$blue2" padding="$2" borderRadius="$2">
                  <Text fontSize="$2" color="$blue11" fontWeight="600">
                    📊 This function will:
                  </Text>
                  <YStack space="$1" paddingLeft="$2" marginTop="$1">
                    <Text fontSize="$2" color="$blue11">
                      • Fetch today's games and player prop odds
                    </Text>
                    <Text fontSize="$2" color="$blue11">
                      • Calculate predicted probabilities using player stats
                    </Text>
                    <Text fontSize="$2" color="$blue11">
                      • Identify value bets (predicted prob vs market implied prob)
                    </Text>
                    <Text fontSize="$2" color="$blue11">
                      • Save predictions to database
                    </Text>
                  </YStack>
                </Card>

                <Card backgroundColor="$yellow2" padding="$2" borderRadius="$2">
                  <Text fontSize="$2" color="$yellow11">
                    ⚠️ Note: This requires the prediction backend service to be implemented. 
                    If you see errors, check that the backend prediction endpoints are available.
                  </Text>
                </Card>

                <Button
                  theme="active"
                  size="$4"
                  onPress={handleGeneratePredictions}
                  disabled={generatingPredictions}
                >
                  {generatingPredictions ? (
                    <XStack alignItems="center" space="$2">
                      <Spinner size="small" color="$color" />
                      <Text color="$color">Generating Predictions...</Text>
                    </XStack>
                  ) : (
                    <Text color="$color">Generate Predictions</Text>
                  )}
                </Button>

                {predictionResult && (
                  <Card backgroundColor="$blue2" padding="$3" borderRadius="$3">
                    <Text color="$blue11" fontSize="$3">
                      {predictionResult}
                    </Text>
                  </Card>
                )}
              </YStack>
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

