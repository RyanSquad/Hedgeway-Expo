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

// Helper function for consistent date formatting to EST/EDT
function formatDateToEST(date: Date): string {
  // Check if date is valid
  if (isNaN(date.getTime())) {
    return 'Invalid Date';
  }
  
  try {
    // Use Intl.DateTimeFormat to get Eastern Time components
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    
    // Format parts
    const parts = formatter.formatToParts(date);
    const month = parts.find(p => p.type === 'month')?.value || '';
    const day = parts.find(p => p.type === 'day')?.value || '';
    let hours = parts.find(p => p.type === 'hour')?.value || '00';
    const minutes = parts.find(p => p.type === 'minute')?.value || '00';
    
    // Ensure hours are padded (should already be from '2-digit', but just in case)
    hours = hours.padStart(2, '0');
    
    // Determine if EST or EDT
    // Get the timezone offset for Eastern Time
    const easternFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      timeZoneName: 'short',
    });
    const timeZoneParts = easternFormatter.formatToParts(date);
    const timeZoneName = timeZoneParts.find(p => p.type === 'timeZoneName')?.value || 'EST';
    
    const result = `${month} ${day} @ ${hours}:${minutes} ${timeZoneName}`;
    // Final safety check - ensure we never return an ISO string
    // Check for ISO pattern: T followed by digits (like T03:00:00) or Z at the end
    const isoPattern = /T\d{2}:\d{2}/; // Matches T followed by HH:MM pattern
    if (isoPattern.test(result) || result.endsWith('Z')) {
      // Use fallback instead
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                          'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const fallbackMonth = monthNames[date.getUTCMonth()];
      const fallbackDay = date.getUTCDate();
      const fallbackHours = String(date.getUTCHours()).padStart(2, '0');
      const fallbackMinutes = String(date.getUTCMinutes()).padStart(2, '0');
      return `${fallbackMonth} ${fallbackDay} @ ${fallbackHours}:${fallbackMinutes} EST`;
    }
    return result;
  } catch (error) {
    // Fallback if Intl API fails
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[date.getUTCMonth()];
    const day = date.getUTCDate();
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    return `${month} ${day} @ ${hours}:${minutes} EST`;
  }
}

function formatDate(dateString: string): string {
  try {
    if (!dateString || typeof dateString !== 'string') return '';
    // Trim whitespace
    const trimmed = dateString.trim();
    if (!trimmed) return '';
    
    // If it's already a formatted date (contains @ and EST/EDT), return as is
    if (trimmed.includes('@') && (trimmed.includes('EST') || trimmed.includes('EDT'))) {
      return trimmed;
    }
    
    // If it's a raw ISO string, we MUST format it - never return it as-is
    if (trimmed.includes('T') && trimmed.includes('Z')) {
      const date = new Date(trimmed);
      // Check if date is valid before formatting
      if (isNaN(date.getTime())) {
        return ''; // Return empty string instead of raw ISO string
      }
      const formatted = formatDateToEST(date);
      // Double-check we didn't get back a raw ISO string
      // Check for ISO pattern: T followed by digits (like T03:00:00) or Z at the end
      const isoPattern = /T\d{2}:\d{2}/; // Matches T followed by HH:MM pattern
      if (formatted && (isoPattern.test(formatted) || formatted.endsWith('Z'))) {
        return ''; // Return empty string instead of raw ISO string
      }
      return formatted;
    }
    
    // Try to parse as date anyway
    const date = new Date(trimmed);
    if (isNaN(date.getTime())) {
      return ''; // Return empty string instead of raw ISO string
    }
    const formatted = formatDateToEST(date);
    // Double-check we didn't get back a raw ISO string
    if (formatted && (formatted.includes('T') || formatted.includes('Z'))) {
      return ''; // Return empty string instead of raw ISO string
    }
    return formatted;
  } catch (error) {
    return ''; // Return empty string instead of raw ISO string
  }
}

function formatGameTime(timestamp: number | null): string {
  if (!timestamp) return 'N/A';
  try {
    const date = new Date(timestamp);
    return formatDateToEST(date);
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
      return true;
    } catch (error) {
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
    
    return successful;
  } catch (error) {
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
        const success = await copyToClipboard(csv);
        if (!success) {
          // Try alternative method
          if (typeof window !== 'undefined' && window.navigator && window.navigator.clipboard) {
            try {
              await window.navigator.clipboard.writeText(csv);
            } catch (err) {
              // Silent fail
            }
          }
        }
      } catch (error) {
        // Silent fail
      }
    }
  };

  const cardContent = (
    <Card 
      elevate 
      padding="$3" 
      backgroundColor="$backgroundStrong"
    >
      <YStack space="$2">
        <XStack justifyContent="space-between" alignItems="flex-start">
          <YStack flex={1}>
            <Text fontSize="$5" fontWeight="bold" color="$color">
              {arb.playerName}
            </Text>
            <Text fontSize="$4" color="$colorPress" marginTop="$0.5">
              {arb.gameLabel}
            </Text>
            {(() => {
              // Final safety check in render: split if concatenated
              let displayTime = arb.gameTime;
              
              // CRITICAL: If arb.gameTime is null or looks like an ISO string, don't render anything
              // NEVER use gameTimeRaw as a fallback
              if (!displayTime || displayTime.trim() === '') {
                return null;
              }
              
              // ABSOLUTE BLOCK: Check if it's a raw ISO string - if so, reject it immediately and return null (no span)
              // Check for full ISO date pattern (YYYY-MM-DDTHH:MM:SS), not just 'T' which appears in "EST"
              const isIsoString = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(displayTime) && displayTime.endsWith('Z');
              if (isIsoString) {
                return null; // Return null to prevent the span from appearing at all
              }
              
              // Also check if it matches the gameTimeRaw value exactly - if so, block it
              if (arb.gameTimeRaw && displayTime === arb.gameTimeRaw) {
                return null; // Return null to prevent the span from appearing
              }
              
              // Also check if displayTime contains the gameTimeRaw value (concatenated)
              if (arb.gameTimeRaw && displayTime.includes(arb.gameTimeRaw)) {
                return null; // Return null to prevent the span from appearing
              }
              
              // Check if it looks like an ISO string in any way (starts with YYYY-MM-DD pattern)
              if (/^\d{4}-\d{2}-\d{2}T/.test(displayTime)) {
                return null; // Return null to prevent the span from appearing
              }
              
              // Additional check: if it contains any ISO-like pattern anywhere in the string
              if (/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(displayTime)) {
                return null; // Return null to prevent the span from appearing
              }
              
              // Check if arb has any other properties that might contain ISO strings
              const arbEntries = Object.entries(arb);
              const isoEntries = arbEntries.filter(([key, value]) => 
                typeof value === 'string' && 
                /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value) && 
                value.endsWith('Z')
              );
              if (isoEntries.length > 0) {
                // If displayTime matches any ISO string from arb properties, block it
                for (const [key, value] of isoEntries) {
                  if (displayTime === value || (typeof displayTime === 'string' && displayTime.includes(value))) {
                    return null;
                  }
                }
              }
              
              if (displayTime) {
                // Check for ISO date pattern and split if found
                const isoDatePattern = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?/;
                if (isoDatePattern.test(displayTime)) {
                  const match = displayTime.match(isoDatePattern);
                  if (match && match.index !== undefined && match.index > 0) {
                    displayTime = displayTime.substring(0, match.index).trim();
                  } else {
                    displayTime = null; // ISO at start, don't display
                  }
                }
                
                // Also check for raw ISO pattern - but be careful not to reject formatted dates
                // Only reject if it's a full ISO pattern (YYYY-MM-DDTHH:MM:SS) AND ends with Z
                if (displayTime && /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(displayTime) && displayTime.endsWith('Z')) {
                  displayTime = null; // Don't display raw ISO strings
                }
              }
              
              // Final absolute check: if displayTime contains any ISO pattern, split it
              if (displayTime) {
                const finalIsoCheck = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?/;
                if (finalIsoCheck.test(displayTime)) {
                  const match = displayTime.match(finalIsoCheck);
                  if (match && match.index !== undefined && match.index > 0) {
                    displayTime = displayTime.substring(0, match.index).trim();
                  } else {
                    displayTime = null;
                  }
                }
                
                // Also check if it contains gameTimeRaw
                if (arb.gameTimeRaw && displayTime && displayTime.includes(arb.gameTimeRaw)) {
                  const rawIndex = displayTime.indexOf(arb.gameTimeRaw);
                  if (rawIndex > 0) {
                    displayTime = displayTime.substring(0, rawIndex).trim();
                  } else {
                    displayTime = null;
                  }
                }
              }
              
              // Absolutely ensure we never render gameTimeRaw
              if (arb.gameTimeRaw && displayTime) {
                // Double-check displayTime doesn't accidentally contain gameTimeRaw
                if (displayTime === arb.gameTimeRaw || displayTime.includes(arb.gameTimeRaw)) {
                  return null;
                }
              }
              
              // Final check before rendering - ensure we're not rendering an ISO string
              if (displayTime && /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(displayTime) && displayTime.endsWith('Z')) {
                return null;
              }
              
              // ABSOLUTE FINAL CHECK: Before rendering, verify it's not an ISO string
              // This is the last line of defense - if we get here with an ISO string, something is very wrong
              if (displayTime && (/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(displayTime) && displayTime.endsWith('Z'))) {
                return null; // Prevent rendering at all costs
              }
              
              // Also check if it matches or contains gameTimeRaw
              if (arb.gameTimeRaw && displayTime && (displayTime === arb.gameTimeRaw || displayTime.includes(arb.gameTimeRaw))) {
                return null; // Prevent rendering at all costs
              }
              
              return displayTime ? (
                <Text 
                  key={`gametime-${arb.key}-${displayTime}`} 
                  fontSize="$2" 
                  color="$colorPress" 
                  marginTop="$0.5"
                >
                  {displayTime}
                </Text>
              ) : null;
            })()}
            {arb.gameStatus && (
              <Text fontSize="$2" color="$colorPress">
                {arb.gameStatus}
              </Text>
            )}
          </YStack>
          <YStack alignItems="flex-end">
            <Text fontSize="$5" fontWeight="bold" color="$green10">
              {arb.edge}
            </Text>
            <Text fontSize="$2" color="$colorPress">
              Arb Edge
            </Text>
            <Text fontSize="$4" fontWeight="600" color="$green10" marginTop="$0.5">
              {arb.profit}
            </Text>
          </YStack>
        </XStack>

        <Separator marginVertical="$1.5" />

        <YStack space="$1.5">
          <XStack justifyContent="space-between" alignItems="center">
            <Text fontSize="$3" fontWeight="600" color="$color">
              {arb.propTypeDisplay} {arb.lineValue}
            </Text>
          </XStack>

          <XStack justifyContent="space-between" space="$3">
            <YStack flex={1} padding="$2.5" backgroundColor="$green2" borderRadius="$2">
              <Text fontSize="$2" color="$green11" marginBottom="$0.5">
                OVER
              </Text>
              <Text fontSize="$4" fontWeight="bold" color="$green11">
                {formatOdds(arb.over.odds, useDecimalOdds)}
              </Text>
              <Text fontSize="$3" fontWeight="600" color="$green11" marginTop="$0.5">
                {formatProfit(arb.betAmounts.over)}
              </Text>
              <Text fontSize="$2" color="$green11" marginTop="$0.5">
                {arb.over.vendor}
              </Text>
            </YStack>

            <YStack flex={1} padding="$2.5" backgroundColor="$red2" borderRadius="$2">
              <Text fontSize="$2" color="$red11" marginBottom="$0.5">
                UNDER
              </Text>
              <Text fontSize="$4" fontWeight="bold" color="$red11">
                {formatOdds(arb.under.odds, useDecimalOdds)}
              </Text>
              <Text fontSize="$3" fontWeight="600" color="$red11" marginTop="$0.5">
                {formatProfit(arb.betAmounts.under)}
              </Text>
              <Text fontSize="$2" color="$red11" marginTop="$0.5">
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
  const [hideInProgressGames, setHideInProgressGames] = useState(true);
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
      let gameStatus = results?.gameStatusMap[arb.gameId.toString()];
      
      // CRITICAL: Filter out ISO strings from gameStatus - backend might be returning ISO string instead of status
      if (gameStatus && typeof gameStatus === 'string' && 
          /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(gameStatus) && 
          gameStatus.endsWith('Z')) {
        gameStatus = undefined; // Don't set gameStatus if it's an ISO string
      }
      const betAmounts = calculateBetAmounts(arb.over.odds, arb.under.odds, totalBetAmount);
      const profit = calculateProfit(arb.over.odds, arb.under.odds, betAmounts.over, betAmounts.under, totalBetAmount);
      const formattedProfit = formatProfit(profit);
      const formattedEdge = formatEdge(arb.edge);
      
      let formattedGameTime = gameTime ? formatDate(gameTime) : null;
      
      // If formattedGameTime contains the raw ISO string (concatenated), extract only the formatted part
      if (formattedGameTime) {
        // More flexible ISO pattern that matches with or without milliseconds and Z
        const isoDatePattern = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?/;
        
        // First check: Does the formatted string contain an ISO date pattern?
        if (isoDatePattern.test(formattedGameTime)) {
          // Find where the ISO string starts
          const match = formattedGameTime.match(isoDatePattern);
          if (match && match.index !== undefined) {
            if (match.index > 0) {
              // ISO string is in the middle or end - extract only the part before it
              formattedGameTime = formattedGameTime.substring(0, match.index).trim();
            } else {
              // If ISO string is at the start, the formatting failed - set to null
              formattedGameTime = null;
            }
          }
        }
        
        // Second check: Does it contain the exact raw gameTime value?
        if (gameTime && formattedGameTime && formattedGameTime.includes(gameTime)) {
          const isoIndex = formattedGameTime.indexOf(gameTime);
          if (isoIndex > 0) {
            formattedGameTime = formattedGameTime.substring(0, isoIndex).trim();
          } else if (isoIndex === 0) {
            formattedGameTime = null;
          }
        }
        
        // Final check: Look for any remaining ISO-like patterns and remove them
        const remainingIsoPattern = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
        if (remainingIsoPattern.test(formattedGameTime)) {
          const match = formattedGameTime.match(remainingIsoPattern);
          if (match && match.index !== undefined && match.index > 0) {
            formattedGameTime = formattedGameTime.substring(0, match.index).trim();
          }
        }
      }
      
      // Final safety check: Remove any ISO string that might still be in formattedGameTime
      if (formattedGameTime && gameTime) {
        // Check if formattedGameTime still contains the raw gameTime value
        if (formattedGameTime.includes(gameTime)) {
          const splitIndex = formattedGameTime.indexOf(gameTime);
          if (splitIndex > 0) {
            formattedGameTime = formattedGameTime.substring(0, splitIndex).trim();
          } else {
            formattedGameTime = null;
          }
        }
        
        // Also check for any ISO date pattern
        const finalIsoCheck = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?/;
        if (finalIsoCheck.test(formattedGameTime)) {
          const match = formattedGameTime.match(finalIsoCheck);
          if (match && match.index !== undefined && match.index > 0) {
            formattedGameTime = formattedGameTime.substring(0, match.index).trim();
          } else if (match && match.index === 0) {
            formattedGameTime = null;
          }
        }
      }
      
      // Ensure we never set gameTime to a raw ISO string - filter it out if formatDate failed
      // Also ensure we never accidentally use the raw gameTime value
      // Check for ISO pattern: T followed by digits (like T03:00:00) or Z at the end
      const isoPattern = /T\d{2}:\d{2}/; // Matches T followed by HH:MM pattern
      const safeGameTime = formattedGameTime && 
                          !isoPattern.test(formattedGameTime) && 
                          !formattedGameTime.endsWith('Z') && 
                          formattedGameTime.trim() !== '' &&
                          formattedGameTime !== gameTime && // Never use raw value
                          !formattedGameTime.includes(gameTime) && // Never include raw ISO string
                          !/\d{4}-\d{2}-\d{2}T/.test(formattedGameTime) // Never include ISO date pattern
                          ? formattedGameTime 
                          : null;
      const propTypeDisplay = arb.propType.charAt(0).toUpperCase() + arb.propType.slice(1);
      const arbKey = `${arb.gameId}-${arb.playerId}-${arb.propType}-${arb.lineValue}-${arb.timestamp}`;
      
      // Destructure to exclude any existing gameTime from the original arb
      // Also exclude gameTimeRaw to prevent any accidental display
      const { gameTime: _, gameTimeRaw: __, ...arbWithoutGameTime } = arb;
      
      // CRITICAL: Check if arbWithoutGameTime has any properties containing ISO strings and remove them
      const arbEntries = Object.entries(arbWithoutGameTime);
      const isoEntries = arbEntries.filter(([key, value]) => 
        typeof value === 'string' && 
        /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value) && 
        value.endsWith('Z')
      );
      if (isoEntries.length > 0) {
        // Remove any properties that contain ISO strings
        isoEntries.forEach(([key]) => {
          delete arbWithoutGameTime[key];
        });
      }
      
      // Final verification: ensure safeGameTime doesn't contain the raw ISO string
      let finalGameTime = safeGameTime;
      
            // CRITICAL: If finalGameTime is null or empty, NEVER fall back to raw gameTime
            // This prevents the raw ISO string from being displayed
            if (!finalGameTime || finalGameTime.trim() === '') {
              finalGameTime = null; // Explicitly set to null, never use raw value
            } else {
              // Only process if we have a valid formatted time
              if (gameTime && finalGameTime.includes(gameTime)) {
                const splitIndex = finalGameTime.indexOf(gameTime);
                if (splitIndex > 0) {
                  finalGameTime = finalGameTime.substring(0, splitIndex).trim();
                } else {
                  finalGameTime = null;
                }
              }

              // Also check for ISO pattern one more time
              const isoCheck = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?/;
              if (isoCheck.test(finalGameTime)) {
                const match = finalGameTime.match(isoCheck);
                if (match && match.index !== undefined && match.index > 0) {
                  finalGameTime = finalGameTime.substring(0, match.index).trim();
                } else {
                  finalGameTime = null;
                }
              }

              // Final absolute check: if it looks like an ISO string (has full ISO date pattern AND ends with Z), reject it
              // Don't reject just because it has 'T' (which appears in "EST") or 'Z' in the middle
              if (finalGameTime && /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(finalGameTime) && finalGameTime.endsWith('Z')) {
                finalGameTime = null;
              }
            }
      
      // Create a completely clean object - don't spread anything that might have stale values
      const cleanArb: ProcessedArb = {
        edge: formattedEdge, // Use formatted edge, not raw arb.edge
        gameId: arb.gameId,
        playerId: arb.playerId,
        propType: arb.propType,
        lineValue: arb.lineValue,
        marketType: arb.marketType,
        over: arb.over,
        under: arb.under,
        timestamp: arb.timestamp,
        isLiveOrFinished: arb.isLiveOrFinished,
        gameLabel,
        playerName,
        // Only set if it's properly formatted - check for ISO pattern, not just 'T' or 'Z' (which appear in timezone names)
        // CRITICAL: If finalGameTime is null or is an ISO string, set to null to prevent the span from rendering
        gameTime: (finalGameTime && 
                   !/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(finalGameTime) && 
                   !finalGameTime.endsWith('Z') &&
                   finalGameTime !== gameTime && // Never use raw gameTime value
                   !finalGameTime.includes(gameTime)) // Never include raw ISO string
                  ? finalGameTime 
                  : null, // Only set if it's properly formatted, NEVER raw ISO - null prevents span from rendering
        // Note: gameTimeRaw is stored separately for CSV export only, never displayed
        // IMPORTANT: This should NEVER be accessed in render - only for CSV export
        gameTimeRaw: gameTime || null,
        // Only set gameStatus if it's not an ISO string
        gameStatus: (gameStatus && typeof gameStatus === 'string' && 
                     !/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(gameStatus) && 
                     !gameStatus.endsWith('Z'))
                    ? gameStatus 
                    : undefined,
        betAmounts,
        profit: formattedProfit,
        propTypeDisplay,
        key: arbKey,
      };
      
      // Final sanity check: ensure gameTime doesn't contain ISO pattern
      if (cleanArb.gameTime) {
        // Check for full ISO date pattern (YYYY-MM-DDTHH:MM:SS), not just 'T' which appears in "EST"
        const containsIso = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(cleanArb.gameTime);
        if (containsIso) {
          cleanArb.gameTime = null; // Force to null if it contains ISO
        }
      }
      
      // ABSOLUTE FINAL CHECK: If gameTime looks like an ISO string (full pattern AND ends with Z), set it to null
      // Don't reject just because it has 'T' (which appears in "EST") or 'Z' in the middle
      if (cleanArb.gameTime && /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(cleanArb.gameTime) && cleanArb.gameTime.endsWith('Z')) {
        cleanArb.gameTime = null;
      }
      
      return cleanArb;
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
        </XStack>
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
          <YStack space="$3">
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
          <View
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 12, // $3 spacing = 12px
              width: '100%',
            }}
          >
            {processedArbs.map((processed) => (
              <ArbCard
                key={processed.key}
                arb={processed}
                useDecimalOdds={useDecimalOdds}
                betAmountDisplay={betAmountForCalculation}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <StatusBar style="auto" />
    </YStack>
  );
}

