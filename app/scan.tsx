import { useEffect, useState, useCallback } from 'react';
import { YStack, XStack, Text, ScrollView, Spinner, Card, Separator } from 'tamagui';
import { StatusBar } from 'expo-status-bar';
import { get } from '../lib/api';
import { RefreshControl } from 'react-native';
import { MenuButton } from '../components/MenuButton';

interface ArbOpportunity {
  edge: number;
  gameId: number;
  playerId: number;
  propType: string;
  lineValue: number;
  marketType: string;
  over: {
    odds: number;
    vendor: string;
  };
  under: {
    odds: number;
    vendor: string;
  };
  timestamp: number;
}

interface ScanResults {
  arbs: ArbOpportunity[];
  gameMap: Record<string, string>;
  playerNameMap: Record<string, string>;
  gameTimeMap: Record<string, string>;
  gameStatusMap: Record<string, string>;
  date: string | null;
  timestamp: number | null;
  nextRefreshSeconds: number;
}

function formatOdds(odds: number): string {
  if (odds > 0) {
    return `+${odds}`;
  }
  return odds.toString();
}

function formatEdge(edge: number): string {
  return `${(edge * 100).toFixed(2)}%`;
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return dateString;
  }
}

function formatGameTime(timestamp: number | null): string {
  if (!timestamp) return 'N/A';
  try {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return 'N/A';
  }
}

export default function ScanScreen() {
  const [results, setResults] = useState<ScanResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchScanResults = useCallback(async (isRefreshing = false) => {
    try {
      if (isRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const response = await get<ScanResults>('/api/scan/results');
      
      if (response.error) {
        setError(response.error);
        setResults(null);
      } else if (response.data) {
        setResults(response.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch scan results');
      setResults(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchScanResults();

    // Set up auto-refresh every 60 seconds
    const interval = setInterval(() => {
      fetchScanResults(true);
    }, 60000); // 60 seconds

    return () => {
      clearInterval(interval);
    };
  }, [fetchScanResults]);

  const handleRefresh = useCallback(() => {
    fetchScanResults(true);
  }, [fetchScanResults]);

  if (loading && !results) {
    return (
      <YStack flex={1} backgroundColor="$background" alignItems="center" justifyContent="center">
        <Spinner size="large" color="$color" />
        <Text marginTop="$4" fontSize="$4" color="$color">
          Loading scan results...
        </Text>
        <StatusBar style="auto" />
      </YStack>
    );
  }

  if (error && !results) {
    return (
      <YStack flex={1} backgroundColor="$background" alignItems="center" justifyContent="center" padding="$4">
        <Text fontSize="$6" fontWeight="bold" color="$red10" marginBottom="$4">
          Error
        </Text>
        <Text fontSize="$4" color="$color" textAlign="center" marginBottom="$4">
          {error}
        </Text>
        <StatusBar style="auto" />
      </YStack>
    );
  }

  const arbs = results?.arbs || [];
  const hasResults = arbs.length > 0;

  return (
    <YStack flex={1} backgroundColor="$background">
      <XStack padding="$4" backgroundColor="$background" borderBottomWidth={1} borderBottomColor="$borderColor" alignItems="center" space="$3">
        <MenuButton />
        <YStack flex={1}>
          <XStack justifyContent="space-between" alignItems="center" marginBottom="$2">
            <Text fontSize="$8" fontWeight="bold" color="$color">
              Scan Results
            </Text>
            {results?.timestamp && (
              <Text fontSize="$2" color="$colorPress">
                {formatGameTime(results.timestamp)}
              </Text>
            )}
          </XStack>
        {results?.date && (
          <Text fontSize="$3" color="$colorPress">
            Date: {results.date}
          </Text>
        )}
          <Text fontSize="$2" color="$colorPress" marginTop="$2">
            Auto-refreshing every 60 seconds
          </Text>
        </YStack>
      </XStack>

      <ScrollView
        flex={1}
        padding="$4"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {!hasResults ? (
          <YStack alignItems="center" justifyContent="center" padding="$8">
            <Text fontSize="$5" color="$colorPress" textAlign="center">
              No arbitrage opportunities found
            </Text>
            <Text fontSize="$3" color="$colorPress" textAlign="center" marginTop="$2">
              {results?.timestamp
                ? 'Try refreshing or check back later'
                : 'Run a scan to see results'}
            </Text>
          </YStack>
        ) : (
          <YStack space="$4">
            {arbs.map((arb, index) => {
              const gameLabel = results.gameMap[arb.gameId.toString()] || `Game ${arb.gameId}`;
              const playerName = results.playerNameMap[arb.playerId.toString()] || `Player ${arb.playerId}`;
              const gameTime = results.gameTimeMap[arb.gameId.toString()];
              const gameStatus = results.gameStatusMap[arb.gameId.toString()];

              return (
                <Card key={index} elevate padding="$4" backgroundColor="$backgroundStrong">
                  <YStack space="$3">
                    <XStack justifyContent="space-between" alignItems="flex-start">
                      <YStack flex={1}>
                        <Text fontSize="$6" fontWeight="bold" color="$color">
                          {playerName}
                        </Text>
                        <Text fontSize="$4" color="$colorPress" marginTop="$1">
                          {gameLabel}
                        </Text>
                        {gameTime && (
                          <Text fontSize="$2" color="$colorPress" marginTop="$1">
                            {formatDate(gameTime)}
                          </Text>
                        )}
                        {gameStatus && (
                          <Text fontSize="$2" color="$colorPress">
                            {gameStatus}
                          </Text>
                        )}
                      </YStack>
                      <YStack alignItems="flex-end">
                        <Text fontSize="$6" fontWeight="bold" color="$green10">
                          {formatEdge(arb.edge)}
                        </Text>
                        <Text fontSize="$2" color="$colorPress">
                          Edge
                        </Text>
                      </YStack>
                    </XStack>

                    <Separator marginVertical="$2" />

                    <YStack space="$2">
                      <XStack justifyContent="space-between" alignItems="center">
                        <Text fontSize="$4" fontWeight="600" color="$color">
                          {arb.propType.charAt(0).toUpperCase() + arb.propType.slice(1)} {arb.lineValue}
                        </Text>
                      </XStack>

                      <XStack justifyContent="space-between" space="$4">
                        <YStack flex={1} padding="$3" backgroundColor="$green2" borderRadius="$2">
                          <Text fontSize="$2" color="$green11" marginBottom="$1">
                            OVER
                          </Text>
                          <Text fontSize="$5" fontWeight="bold" color="$green11">
                            {formatOdds(arb.over.odds)}
                          </Text>
                          <Text fontSize="$2" color="$green11" marginTop="$1">
                            {arb.over.vendor}
                          </Text>
                        </YStack>

                        <YStack flex={1} padding="$3" backgroundColor="$red2" borderRadius="$2">
                          <Text fontSize="$2" color="$red11" marginBottom="$1">
                            UNDER
                          </Text>
                          <Text fontSize="$5" fontWeight="bold" color="$red11">
                            {formatOdds(arb.under.odds)}
                          </Text>
                          <Text fontSize="$2" color="$red11" marginTop="$1">
                            {arb.under.vendor}
                          </Text>
                        </YStack>
                      </XStack>
                    </YStack>
                  </YStack>
                </Card>
              );
            })}
          </YStack>
        )}
      </ScrollView>

      <StatusBar style="auto" />
    </YStack>
  );
}

