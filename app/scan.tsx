import { useEffect, useState, useCallback, useMemo, useRef, memo, useId } from 'react';
import { YStack, XStack, Text, ScrollView, Spinner, Card, Separator, Switch, Label, Input, Button } from 'tamagui';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import { get, clearCache } from '../lib/api';
import { RefreshControl, Pressable, View, useWindowDimensions } from 'react-native';
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
  isLiveOrFinished?: boolean; // Optional: backend-provided flag (preferred)
}

interface ScanResults {
  arbs: ArbOpportunity[];
  gameMap: Record<string, string>;
  playerNameMap: Record<string, string>;
  gameTimeMap: Record<string, string>;
  gameStatusMap: Record<string, string>;
  gamePhaseMap?: Record<string, 'pre' | 'live' | 'final' | 'unknown'>; // Optional: backend-provided phase
  isLiveOrFinishedMap?: Record<string, boolean>; // Optional: backend-provided flag (preferred)
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

const DEFAULT_REFRESH_INTERVAL = 60; // seconds

// Memoized component for list items to prevent unnecessary re-renders
interface ProcessedArb extends ArbOpportunity {
  gameLabel: string;
  playerName: string;
  gameTime: string | null;
  gameTimeRaw: string | null; // Raw timestamp for CSV formatting
  gameStatus?: string;
  betAmounts: { over: number; under: number };
  profit: string;
  edge: string;
  propTypeDisplay: string;
  key: string;
}

/**
 * Determine if a game status string represents a live or finished game.
 * 
 * @deprecated This is a fallback function for backwards compatibility.
 * Prefer using backend-provided `isLiveOrFinished` flag on arb or `isLiveOrFinishedMap` from results.
 */
function isLiveOrFinishedStatus(status: string | undefined | null): boolean {
  if (!status) return false;
  
  const normalized = status.trim().toLowerCase();
  if (!normalized) return false;

  // Keywords that typically indicate a game is in progress
  const liveKeywords = [
    'qtr',
    'quarter',
    '1st',
    '2nd',
    '3rd',
    '4th',
    'ot',
    'overtime',
    'half',
    'halftime',
    'live',
    'in progress',
    'in-progress',
  ];

  // Keywords that typically indicate a game is finished
  const finishedKeywords = [
    'final',
    'end',
    'finished',
    'complete',
    'full time',
    'full-time',
    'ft',
  ];

  return [...liveKeywords, ...finishedKeywords].some((keyword) =>
    normalized.includes(keyword)
  );
}

// Format game time as MM/DD with time and timezone
function formatGameTimeForCSV(gameTime: string | null): string {
  if (!gameTime || gameTime === 'N/A') return 'N/A';
  try {
    // Try parsing as date (handles both timestamp strings and formatted dates)
    const date = new Date(gameTime);
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return gameTime;
    }
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    // Get timezone abbreviation (e.g., EST, PST, EDT)
    const timeZone = date.toLocaleString('en-US', { timeZoneName: 'short' }).split(' ').pop() || '';
    
    return `${month}/${day} ${hours}:${minutes} ${timeZone}`;
  } catch {
    return gameTime;
  }
}

// Convert arb to CSV format (without header)
function arbToCSV(arb: ProcessedArb, useDecimalOdds: boolean): string {
  const overOdds = formatOdds(arb.over.odds, useDecimalOdds);
  const underOdds = formatOdds(arb.under.odds, useDecimalOdds);
  const profitValue = arb.profit; // Keep $ sign
  const edgeValue = arb.edge; // Keep % sign
  const overStake = arb.betAmounts.over.toFixed(2);
  const underStake = arb.betAmounts.under.toFixed(2);
  
  // Format Over and Under with book and stake: "odds (book) ($stake)"
  const overFormatted = `${overOdds} (${arb.over.vendor}) ($${overStake})`;
  const underFormatted = `${underOdds} (${arb.under.vendor}) ($${underStake})`;
  
  // Format game time as MM/DD with time (use raw timestamp if available, otherwise try formatted)
  const gameTimeFormatted = formatGameTimeForCSV(arb.gameTimeRaw || arb.gameTime);
  
  // Escape CSV values (handle commas and quotes)
  const escapeCSV = (value: string | number): string => {
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  
  // Order: Edge, Game, Game Start Time, Player, Prop, Line, Over, Under, Profit
  return [
    escapeCSV(edgeValue),
    escapeCSV(arb.gameLabel),
    escapeCSV(gameTimeFormatted),
    escapeCSV(arb.playerName),
    escapeCSV(arb.propTypeDisplay),
    escapeCSV(arb.lineValue),
    escapeCSV(overFormatted),
    escapeCSV(underFormatted),
    escapeCSV(profitValue),
  ].join(',');
}

// Copy text to clipboard (web only)
async function copyToClipboard(text: string): Promise<boolean> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return false;
  }
  
  // Try modern Clipboard API first
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      console.log('Copied to clipboard via Clipboard API');
      return true;
    } catch (error) {
      console.warn('Clipboard API failed, trying fallback:', error);
      // Fall through to fallback method
    }
  }
  
  // Fallback method using execCommand (works in more contexts)
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    
    if (successful) {
      console.log('Copied to clipboard via execCommand');
      return true;
    } else {
      console.error('execCommand copy failed');
      return false;
    }
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}

const ArbCard = memo(({ 
  arb, 
  useDecimalOdds, 
  betAmountDisplay 
}: { 
  arb: ProcessedArb; 
  useDecimalOdds: boolean; 
  betAmountDisplay: string;
}) => {
  const handleClick = async () => {
    if (Platform.OS === 'web') {
      try {
        const csv = arbToCSV(arb, useDecimalOdds);
        console.log('Attempting to copy CSV:', csv.substring(0, 100) + '...');
        const success = await copyToClipboard(csv);
        if (success) {
          console.log('Successfully copied to clipboard');
        } else {
          console.error('Failed to copy to clipboard');
          // Try alternative method
          if (typeof window !== 'undefined' && window.navigator && window.navigator.clipboard) {
            console.log('Retrying with direct clipboard API...');
            try {
              await window.navigator.clipboard.writeText(csv);
              console.log('Successfully copied via direct API');
            } catch (err) {
              console.error('Direct API also failed:', err);
            }
          }
        }
      } catch (error) {
        console.error('Error in handleClick:', error);
      }
    }
  };

  const cardContent = (
    <Card 
      elevate 
      padding="$4" 
      backgroundColor="$backgroundStrong"
    >
      <YStack space="$3">
        <XStack justifyContent="space-between" alignItems="flex-start">
          <YStack flex={1}>
            <Text fontSize="$6" fontWeight="bold" color="$color">
              {arb.playerName}
            </Text>
            <Text fontSize="$4" color="$colorPress" marginTop="$1">
              {arb.gameLabel}
            </Text>
            {arb.gameTime && (
              <Text fontSize="$2" color="$colorPress" marginTop="$1">
                {arb.gameTime}
              </Text>
            )}
            {arb.gameStatus && (
              <Text fontSize="$2" color="$colorPress">
                {arb.gameStatus}
              </Text>
            )}
          </YStack>
          <YStack alignItems="flex-end">
            <Text fontSize="$6" fontWeight="bold" color="$green10">
              {arb.edge}
            </Text>
            <Text fontSize="$2" color="$colorPress">
              Arb Edge
            </Text>
            <Text fontSize="$4" fontWeight="600" color="$green10" marginTop="$1">
              {arb.profit}
            </Text>
            <Text fontSize="$2" color="$colorPress">
              Profit (${betAmountDisplay} bet)
            </Text>
          </YStack>
        </XStack>

        <Separator marginVertical="$2" />

        <YStack space="$2">
          <XStack justifyContent="space-between" alignItems="center">
            <Text fontSize="$4" fontWeight="600" color="$color">
              {arb.propTypeDisplay} {arb.lineValue}
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
                {formatProfit(arb.betAmounts.over)}
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
                {formatProfit(arb.betAmounts.under)}
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

  if (Platform.OS === 'web') {
    // Use Pressable which works on web, but also add onClick as fallback
    return (
      <Pressable 
        onPress={handleClick}
        style={{ cursor: 'pointer' }}
      >
        {cardContent}
      </Pressable>
    );
  }

  return cardContent;
});

ArbCard.displayName = 'ArbCard';

export default function ScanScreen() {
  const { width } = useWindowDimensions();
  const isMobile = width < 700; // Use single column on screens narrower than 700px
  
  // Generate unique IDs for form inputs to prevent duplicate ID warnings
  const betAmountId = useId();
  const refreshIntervalId = useId();
  const oddsToggleId = useId();
  const filterToggleId = useId();
  
  const [results, setResults] = useState<ScanResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [useDecimalOdds, setUseDecimalOdds] = useState(false);
  const [hideInProgressGames, setHideInProgressGames] = useState(false);
  const [lastResponseTime, setLastResponseTime] = useState<number | null>(null);
  const [isFromCache, setIsFromCache] = useState(false);
  
  // Debouncing state for manual refresh
  const lastRefreshTimeRef = useRef<number>(0);
  const MIN_RELOAD_INTERVAL = 2000; // 2 seconds minimum between reloads (accounts for backend delay ~1.5s)
  
  // Track response times for adaptive polling
  const responseTimeHistoryRef = useRef<number[]>([]);
  const MAX_RESPONSE_TIME_HISTORY = 5;
  
  // Input values (for display only, don't trigger calculations)
  const [betAmountInput, setBetAmountInput] = useState<string>('100');
  
  // Actual values used for calculations (only updated when Save is pressed)
  const [betAmountForCalculation, setBetAmountForCalculation] = useState<string>('100');
  
  // Polling interval ref for smart polling based on nextRefreshSeconds
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const fetchScanResults = useCallback(async (isManualRefresh = false, skipCache = false) => {
    try {
      if (isManualRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      setIsFromCache(false);

      const startTime = Date.now();
      
      // Use client-side caching for automatic refreshes (not manual)
      // Cache TTL should match backend cache (default 5 seconds)
      const response = await get<ScanResults>('/api/scan/results', {
        useCache: !skipCache && !isManualRefresh, // Don't use cache for manual refreshes
        cacheTTL: 5, // 5 seconds to match backend cache
      });
      
      const duration = Date.now() - startTime;
      setLastResponseTime(duration);
      
      // Track response times for adaptive polling
      if (response.data && !response.error) {
        responseTimeHistoryRef.current.push(duration);
        if (responseTimeHistoryRef.current.length > MAX_RESPONSE_TIME_HISTORY) {
          responseTimeHistoryRef.current.shift();
        }
      }
      
      // Check if response was from cache (very fast response, likely cached)
      if (duration < 200 && response.data && !response.error) {
        setIsFromCache(true);
      }
      
      if (response.error) {
        setError(response.error);
        setResults(null);
      } else if (response.data) {
        setResults(response.data);
        
        // Log timing for debugging
        if (duration > 1000) {
          console.log(`[Scan] Results loaded in ${duration}ms (includes backend delay)`);
        } else if (duration < 200) {
          console.log(`[Scan] Results loaded from cache in ${duration}ms`);
        }
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
    // Clear any existing polling timeout
    if (pollingIntervalRef.current) {
      clearTimeout(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    // Initial fetch
    fetchScanResults();

    // Set up adaptive polling based on default interval and response times
    const calculateAdaptiveInterval = (): number => {
      const baseIntervalSeconds = DEFAULT_REFRESH_INTERVAL;
      
      // If we have response time history, adjust interval based on average response time
      if (responseTimeHistoryRef.current.length > 0) {
        const avgResponseTime = responseTimeHistoryRef.current.reduce((a, b) => a + b, 0) / responseTimeHistoryRef.current.length;
        
        // If responses are fast (cached), we can poll more frequently
        // If responses are slow (progressive delays active), poll less frequently
        if (avgResponseTime < 500) {
          // Fast responses - use base interval (could be more aggressive)
          return Math.max(3, baseIntervalSeconds);
        } else if (avgResponseTime > 2000) {
          // Slow responses - add buffer to prevent overload
          return Math.max(5, baseIntervalSeconds + Math.ceil(avgResponseTime / 1000));
        }
      }
      
      // Default: minimum 3 seconds to account for backend delay (1.5s) + processing time
      return Math.max(3, baseIntervalSeconds);
    };

    const scheduleNextPoll = () => {
      const effectiveIntervalSeconds = calculateAdaptiveInterval();
      const intervalMs = effectiveIntervalSeconds * 1000;

      pollingIntervalRef.current = setTimeout(() => {
        fetchScanResults(false, false); // Auto-refresh, use cache
        scheduleNextPoll();
      }, intervalMs);
    };

    // Start adaptive polling after initial fetch
    scheduleNextPoll();

    return () => {
      if (pollingIntervalRef.current) {
        clearTimeout(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [fetchScanResults]);

  const handleRefresh = useCallback(() => {
    const now = Date.now();
    const timeSinceLastRefresh = now - lastRefreshTimeRef.current;
    
    // Prevent rapid refresh requests (debouncing)
    // Backend has progressive delays, so minimum 2 seconds between refreshes to prevent overload
    if (timeSinceLastRefresh < MIN_RELOAD_INTERVAL) {
      const remaining = Math.ceil((MIN_RELOAD_INTERVAL - timeSinceLastRefresh) / 1000);
      console.log(`[Scan] Please wait ${remaining} second(s) before refreshing again`);
      // Prevent rapid refresh requests
      return;
    }
    
    lastRefreshTimeRef.current = now;
    
    // Clear cache for manual refresh to get fresh data
    clearCache('/api/scan/results');
    
    fetchScanResults(true, true); // Manual refresh, skip cache
  }, [fetchScanResults]);

  const handleBetAmountInputChange = useCallback((text: string) => {
    // Only allow numbers and decimal point
    const numericValue = text.replace(/[^0-9.]/g, '');
    // Prevent multiple decimal points
    const parts = numericValue.split('.');
    const formatted = parts.length > 2 
      ? parts[0] + '.' + parts.slice(1).join('')
      : numericValue;
    setBetAmountInput(formatted);

    // On mobile, immediately apply the new bet amount so the page rerenders
    if (Platform.OS !== 'web') {
      const betValue = formatted || '100';
      setBetAmountForCalculation(betValue);
    }
  }, []);

  const handleSaveSettings = useCallback(async () => {
    // Save bet amount
    const betValue = betAmountInput || '100';
    setBetAmountForCalculation(betValue);
  }, [betAmountInput]);

  const handleSettingsInputKeyPress = useCallback(
    (event: any) => {
      const key = event?.nativeEvent?.key ?? event?.key;

      if (key === 'Enter') {
        if (typeof event.preventDefault === 'function') {
          event.preventDefault();
        }
        handleSaveSettings();
      }
    },
    [handleSaveSettings]
  );

  // Memoize calculations before conditional returns (Rules of Hooks)
  const arbs = results?.arbs || [];
  
  // Filter out in-progress or finished games if toggle is enabled
  // Uses backend-provided flags when available, falls back to heuristic parsing for backwards compatibility
  const filteredArbs = useMemo(() => {
    if (hideInProgressGames) {
      return arbs.filter((arb) => {
        const gameId = arb.gameId.toString();
        
        // Priority 1: Use per-arb flag if available (Option B from backend improvements)
        if (typeof arb.isLiveOrFinished === 'boolean') {
          return !arb.isLiveOrFinished;
        }
        
        // Priority 2: Use isLiveOrFinishedMap if available (Option A from backend improvements)
        if (results?.isLiveOrFinishedMap && typeof results.isLiveOrFinishedMap[gameId] === 'boolean') {
          return !results.isLiveOrFinishedMap[gameId];
        }
        
        // Priority 3: Fallback to heuristic parsing for backwards compatibility
        const gameStatus = results?.gameStatusMap[gameId];
        return !isLiveOrFinishedStatus(gameStatus);
      });
    }
    return arbs;
  }, [arbs, hideInProgressGames, results?.isLiveOrFinishedMap, results?.gameStatusMap]);
  
  // Memoize parsed bet amount to avoid parsing on every render
  // Use debounced value for calculations to prevent expensive recalculations on every keystroke
  const totalBetAmount = useMemo(() => {
    return parseFloat(betAmountForCalculation) || 100;
  }, [betAmountForCalculation]);
  
  // Pre-calculate and memoize all list item data to prevent expensive recalculations
  const processedArbs = useMemo(() => {
    return filteredArbs.map((arb) => {
      const gameLabel = results?.gameMap[arb.gameId.toString()] || `Game ${arb.gameId}`;
      const playerName = results?.playerNameMap[arb.playerId.toString()] || `Player ${arb.playerId}`;
      const gameTime = results?.gameTimeMap[arb.gameId.toString()];
      const gameStatus = results?.gameStatusMap[arb.gameId.toString()];
      const betAmounts = calculateBetAmounts(arb.over.odds, arb.under.odds, totalBetAmount);
      const profit = calculateProfit(arb.over.odds, arb.under.odds, betAmounts.over, betAmounts.under, totalBetAmount);
      const formattedProfit = formatProfit(profit);
      const formattedEdge = formatEdge(arb.edge);
      const formattedGameTime = gameTime ? formatDate(gameTime) : null;
      const propTypeDisplay = arb.propType.charAt(0).toUpperCase() + arb.propType.slice(1);
      const arbKey = `${arb.gameId}-${arb.playerId}-${arb.propType}-${arb.lineValue}-${arb.timestamp}`;
      
      return {
        ...arb,
        gameLabel,
        playerName,
        gameTime: formattedGameTime,
        gameTimeRaw: gameTime || null, // Store raw timestamp for CSV
        gameStatus,
        betAmounts,
        profit: formattedProfit,
        edge: formattedEdge,
        propTypeDisplay,
        key: arbKey,
      };
    });
  }, [filteredArbs, results?.gameMap, results?.playerNameMap, results?.gameTimeMap, results?.gameStatusMap, totalBetAmount]);
  
  const hasResults = processedArbs.length > 0;

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
          <XStack alignItems="center" space={isMobile ? "$2" : "$3"}>
            <XStack alignItems="center" space="$2">
              <Label htmlFor={betAmountId} fontSize="$2" color="$colorPress">
                Bet Amount: $
              </Label>
              <Input
                id={betAmountId}
                value={betAmountInput}
                onChangeText={handleBetAmountInputChange}
                keyboardType="numeric"
                onKeyPress={handleSettingsInputKeyPress}
                size={isMobile ? "$2" : "$3"}
                width={isMobile ? 70 : 80}
                borderColor="$borderColor"
                backgroundColor="$background"
                fontSize={isMobile ? "$2" : "$3"}
                paddingHorizontal="$2"
                marginRight={isMobile ? "$2" : 0}
              />
            </XStack>
            {Platform.OS === 'web' && (
              <Button
                size="$3"
                theme="active"
                onPress={handleSaveSettings}
                paddingHorizontal="$3"
              >
                <Text fontSize="$3">Save</Text>
              </Button>
            )}
          </XStack>
          <XStack alignItems="center" space={isMobile ? "$2" : "$3"}>
            <XStack alignItems="center" space="$2">
              <Label htmlFor={oddsToggleId} fontSize="$2" color="$colorPress">
                {useDecimalOdds ? 'Decimal' : 'American'}
              </Label>
              <Switch
                id={oddsToggleId}
                checked={useDecimalOdds}
                onCheckedChange={setUseDecimalOdds}
                size="$3"
              >
                <Switch.Thumb animation="quick" />
              </Switch>
            </XStack>
            <XStack alignItems="center" space="$2">
              <Label htmlFor={filterToggleId} fontSize="$2" color="$colorPress">
                Hide Live/Finished
              </Label>
              <Switch
                id={filterToggleId}
                checked={hideInProgressGames}
                onCheckedChange={setHideInProgressGames}
                size="$3"
              >
                <Switch.Thumb animation="quick" />
              </Switch>
            </XStack>
          </XStack>
        </XStack>
        <XStack alignItems="center" space="$2" marginTop="$2" flexWrap="wrap">
          <Text fontSize="$2" color="$colorPress">
            Auto-refreshing every {Math.max(3, DEFAULT_REFRESH_INTERVAL)} seconds
          </Text>
          {refreshing && (
            <Text fontSize="$2" color="$blue10">
              (refreshing...)
            </Text>
          )}
          {isFromCache && lastResponseTime !== null && lastResponseTime < 200 && (
            <Text fontSize="$2" color="$green10">
              (cached, {lastResponseTime}ms)
            </Text>
          )}
          {lastResponseTime !== null && lastResponseTime > 2000 && (
            <Text fontSize="$2" color="$orange10">
              (slow response: {Math.round(lastResponseTime / 100) / 10}s)
            </Text>
          )}
        </XStack>
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
        ) : isMobile ? (
          <YStack space="$4">
            {processedArbs.map((processed) => (
              <ArbCard
                key={processed.key}
                arb={processed}
                useDecimalOdds={useDecimalOdds}
                betAmountDisplay={betAmountForCalculation}
              />
            ))}
          </YStack>
        ) : (
          <XStack flexWrap="wrap" space="$4">
            {processedArbs.map((processed) => (
              <YStack key={processed.key} flex={1} minWidth="48%" maxWidth="48%" marginBottom={Platform.OS === 'web' ? "$4" : undefined}>
                <ArbCard
                  arb={processed}
                  useDecimalOdds={useDecimalOdds}
                  betAmountDisplay={betAmountForCalculation}
                />
              </YStack>
            ))}
          </XStack>
        )}
      </ScrollView>

      <StatusBar style="auto" />
    </YStack>
  );
}

