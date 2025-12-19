import { useEffect, useState, useCallback } from 'react';
import { YStack, XStack, Text, ScrollView, Spinner, Card, Separator, Switch, Label, Input } from 'tamagui';
import { StatusBar } from 'expo-status-bar';
import { get } from '../lib/api';
import { RefreshControl } from 'react-native';
import { NavigationBar } from '../components/NavigationBar';

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

function americanToDecimal(americanOdds: number): number {
  if (americanOdds > 0) {
    return (americanOdds / 100) + 1;
  } else {
    return (100 / Math.abs(americanOdds)) + 1;
  }
}

function formatOdds(odds: number, useDecimal: boolean = false): string {
  if (useDecimal) {
    const decimal = americanToDecimal(odds);
    return decimal.toFixed(2);
  }
  if (odds > 0) {
    return `+${odds}`;
  }
  return odds.toString();
}

function formatEdge(edge: number): string {
  return `${(edge * 100).toFixed(2)}%`;
}

function calculateProfit(
  overOdds: number,
  underOdds: number,
  betOver: number,
  betUnder: number,
  totalBetAmount: number
): number {
  // Calculate profit using the actual bet amounts and odds
  // Profit = (Over odds × Over stake) - total bet amount
  // This should equal (Under odds × Under stake) - total bet amount for arbitrage
  
  const decimalOddsOver = americanToDecimal(overOdds);
  const decimalOddsUnder = americanToDecimal(underOdds);
  
  // Profit if OVER wins
  const profitIfOverWins = (betOver * decimalOddsOver) - totalBetAmount;
  
  // Profit if UNDER wins (should be the same for arbitrage)
  const profitIfUnderWins = (betUnder * decimalOddsUnder) - totalBetAmount;
  
  // Return the average to account for any minor rounding differences
  // In true arbitrage, these should be equal
  return (profitIfOverWins + profitIfUnderWins) / 2;
}

function formatProfit(profit: number): string {
  return `$${profit.toFixed(2)}`;
}

function getImpliedProbability(americanOdds: number): number {
  if (americanOdds > 0) {
    return 100 / (americanOdds + 100);
  } else {
    return Math.abs(americanOdds) / (Math.abs(americanOdds) + 100);
  }
}

function calculateBetAmounts(
  overOdds: number,
  underOdds: number,
  totalBetAmount: number
): { over: number; under: number } {
  // For arbitrage betting, we need to ensure equal profit regardless of which side wins
  // Profit if OVER wins = (betOver × decimalOddsOver) - totalBet
  // Profit if UNDER wins = (betUnder × decimalOddsUnder) - totalBet
  // For arbitrage, these must be equal, so:
  // betOver × decimalOddsOver = betUnder × decimalOddsUnder
  // And: betOver + betUnder = totalBet
  // Solving: betOver = (totalBet × decimalOddsUnder) / (decimalOddsOver + decimalOddsUnder)
  
  const decimalOddsOver = americanToDecimal(overOdds);
  const decimalOddsUnder = americanToDecimal(underOdds);
  
  const betOver = (totalBetAmount * decimalOddsUnder) / (decimalOddsOver + decimalOddsUnder);
  const betUnder = (totalBetAmount * decimalOddsOver) / (decimalOddsOver + decimalOddsUnder);
  
  return {
    over: betOver,
    under: betUnder,
  };
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

const REFRESH_INTERVAL_KEY = 'hedgeway_scan_refresh_interval';
const DEFAULT_REFRESH_INTERVAL = 60; // seconds

export default function ScanScreen() {
  const [results, setResults] = useState<ScanResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [useDecimalOdds, setUseDecimalOdds] = useState(false);
  const [hideInProgressGames, setHideInProgressGames] = useState(false);
  const [betAmount, setBetAmount] = useState<string>('100');
  const [refreshInterval, setRefreshInterval] = useState<string>(() => {
    // Load from localStorage on mount
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(REFRESH_INTERVAL_KEY);
      return saved || DEFAULT_REFRESH_INTERVAL.toString();
    }
    return DEFAULT_REFRESH_INTERVAL.toString();
  });

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

    // Set up auto-refresh with user-defined interval
    const intervalSeconds = parseInt(refreshInterval, 10) || DEFAULT_REFRESH_INTERVAL;
    const intervalMs = Math.max(1000, intervalSeconds * 1000); // Minimum 1 second

    const interval = setInterval(() => {
      fetchScanResults(true);
    }, intervalMs);

    return () => {
      clearInterval(interval);
    };
  }, [fetchScanResults, refreshInterval]);

  const handleRefreshIntervalChange = useCallback((value: string) => {
    // Only allow numbers
    const numericValue = value.replace(/[^0-9]/g, '');
    if (numericValue === '' || parseInt(numericValue, 10) > 0) {
      setRefreshInterval(numericValue);
      // Save to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem(REFRESH_INTERVAL_KEY, numericValue || DEFAULT_REFRESH_INTERVAL.toString());
      }
    }
  }, []);

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
        <StatusBar style="light" />
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
        <StatusBar style="light" />
      </YStack>
    );
  }

  const arbs = results?.arbs || [];
  
  // Filter out in-progress or finished games if toggle is enabled
  const filteredArbs = hideInProgressGames
    ? arbs.filter((arb) => {
        const gameStatus = results?.gameStatusMap[arb.gameId.toString()];
        // If gameStatus exists and is not empty, the game is in progress or finished
        return !gameStatus || gameStatus.trim() === '';
      })
    : arbs;
  
  const hasResults = filteredArbs.length > 0;

  return (
    <YStack flex={1} backgroundColor="$background">
      <NavigationBar />
      
      <YStack padding="$4" backgroundColor="$background" borderBottomWidth={1} borderBottomColor="$borderColor">
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
        <XStack justifyContent="space-between" alignItems="center" marginTop="$2">
          <XStack alignItems="center" space="$3">
            <XStack alignItems="center" space="$2">
              <Label htmlFor="bet-amount" fontSize="$2" color="$colorPress">
                Bet Amount: $
              </Label>
              <Input
                id="bet-amount"
                value={betAmount}
                onChangeText={(text) => {
                  // Only allow numbers and decimal point
                  const numericValue = text.replace(/[^0-9.]/g, '');
                  // Prevent multiple decimal points
                  const parts = numericValue.split('.');
                  const formatted = parts.length > 2 
                    ? parts[0] + '.' + parts.slice(1).join('')
                    : numericValue;
                  setBetAmount(formatted);
                }}
                keyboardType="numeric"
                size="$3"
                width={80}
                borderColor="$borderColor"
                backgroundColor="$background"
                fontSize="$3"
                paddingHorizontal="$2"
              />
            </XStack>
            <XStack alignItems="center" space="$2">
              <Label htmlFor="refresh-interval" fontSize="$2" color="$colorPress">
                Refresh: 
              </Label>
              <Input
                id="refresh-interval"
                value={refreshInterval}
                onChangeText={handleRefreshIntervalChange}
                keyboardType="numeric"
                size="$3"
                width={60}
                borderColor="$borderColor"
                backgroundColor="$background"
                fontSize="$3"
                paddingHorizontal="$2"
              />
              <Text fontSize="$2" color="$colorPress">
                sec
              </Text>
            </XStack>
          </XStack>
          <XStack alignItems="center" space="$3">
            <XStack alignItems="center" space="$2">
              <Label htmlFor="odds-toggle" fontSize="$2" color="$colorPress">
                {useDecimalOdds ? 'Decimal' : 'American'}
              </Label>
              <Switch
                id="odds-toggle"
                checked={useDecimalOdds}
                onCheckedChange={setUseDecimalOdds}
                size="$3"
              >
                <Switch.Thumb animation="quick" />
              </Switch>
            </XStack>
            <XStack alignItems="center" space="$2">
              <Label htmlFor="filter-toggle" fontSize="$2" color="$colorPress">
                Hide Live/Finished
              </Label>
              <Switch
                id="filter-toggle"
                checked={hideInProgressGames}
                onCheckedChange={setHideInProgressGames}
                size="$3"
              >
                <Switch.Thumb animation="quick" />
              </Switch>
            </XStack>
          </XStack>
        </XStack>
        <Text fontSize="$2" color="$colorPress" marginTop="$2">
          Auto-refreshing every {parseInt(refreshInterval, 10) || DEFAULT_REFRESH_INTERVAL} seconds
        </Text>
      </YStack>

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
            {filteredArbs.map((arb, index) => {
              const gameLabel = results.gameMap[arb.gameId.toString()] || `Game ${arb.gameId}`;
              const playerName = results.playerNameMap[arb.playerId.toString()] || `Player ${arb.playerId}`;
              const gameTime = results.gameTimeMap[arb.gameId.toString()];
              const gameStatus = results.gameStatusMap[arb.gameId.toString()];
              const totalBetAmount = parseFloat(betAmount) || 100;
              const betAmounts = calculateBetAmounts(arb.over.odds, arb.under.odds, totalBetAmount);

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
                          Arb Edge
                        </Text>
                        <Text fontSize="$4" fontWeight="600" color="$green10" marginTop="$1">
                          {formatProfit(calculateProfit(arb.over.odds, arb.under.odds, betAmounts.over, betAmounts.under, totalBetAmount))}
                        </Text>
                        <Text fontSize="$2" color="$colorPress">
                          Profit (${parseFloat(betAmount) || 100} bet)
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
                            {formatOdds(arb.over.odds, useDecimalOdds)}
                          </Text>
                          <Text fontSize="$3" fontWeight="600" color="$green11" marginTop="$1">
                            {formatProfit(betAmounts.over)}
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
                            {formatOdds(arb.under.odds, useDecimalOdds)}
                          </Text>
                          <Text fontSize="$3" fontWeight="600" color="$red11" marginTop="$1">
                            {formatProfit(betAmounts.under)}
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

