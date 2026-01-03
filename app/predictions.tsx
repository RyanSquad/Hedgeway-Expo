/**
 * Predictions Page
 * 
 * Displays model predictions for player props with value bet identification
 * 
 * Features:
 * - View predictions for today's games
 * - Filter by prop type and value threshold
 * - Display value bets prominently
 * - Show prediction confidence and probabilities
 */

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { YStack, XStack, Text, ScrollView, Spinner, Card, Separator, Label, Button } from 'tamagui';
import { StatusBar } from 'expo-status-bar';
import { RefreshControl, Platform, Pressable } from 'react-native';
import { get } from '../lib/api';
import { NavigationBar } from '../components/NavigationBar';

interface Prediction {
  id: string;
  game_id: number;
  player_id: number;
  prop_type: string;
  line_value: number;
  best_over_odds: number | null;
  best_under_odds: number | null;
  over_vendor: string | null;
  under_vendor: string | null;
  implied_prob_over: number | null;
  implied_prob_under: number | null;
  predicted_prob_over: number;
  predicted_prob_under: number;
  predicted_value_over: number | null;
  predicted_value_under: number | null;
  confidence_score: number;
  player_first_name: string;
  player_last_name: string;
  team_abbreviation: string | null;
  player_avg_7: number | null;
  player_avg_14: number | null;
  player_avg_30: number | null;
  player_season_avg: number | null;
  actual_result: string | null;
  actual_value: number | null;
  // Game context fields (from API)
  game_label?: string;
  game_time?: string;
  game_status?: string;
  opponent_team?: string;
}


interface PredictionsResponse {
  predictions?: Prediction[];
  valueBets?: Prediction[];
}

interface Game {
  id: number;
  date: string;
  datetime?: string; // Optional: full ISO datetime if available
  status: string;
  time: string;
  home_team: {
    id: number;
    abbreviation: string;
    full_name: string;
    city: string;
    name: string;
  };
  visitor_team: {
    id: number;
    abbreviation: string;
    full_name: string;
    city: string;
    name: string;
  };
  home_team_score: number | null;
  visitor_team_score: number | null;
}

interface GamesResponse {
  data: Game[];
  meta: {
    total_pages: number;
    current_page: number;
    next_page: number | null;
    per_page: number;
    total_count: number;
  };
}

function formatOdds(odds: number | null): string {
  if (odds === null) return 'N/A';
  if (odds > 0) return `+${odds}`;
  return odds.toString();
}

function formatProbability(prob: number | null): string {
  if (prob === null) return 'N/A';
  return `${(prob * 100).toFixed(1)}%`;
}

function formatValue(value: number | null): string {
  if (value === null) return 'N/A';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${(value * 100).toFixed(1)}%`;
}

function formatDecimalOdds(americanOdds: number | null): string {
  if (americanOdds === null) return 'N/A';
  if (americanOdds > 0) {
    // Positive odds: decimal = (odds / 100) + 1
    return ((americanOdds / 100) + 1).toFixed(2);
  } else {
    // Negative odds: decimal = (100 / abs(odds)) + 1
    return ((100 / Math.abs(americanOdds)) + 1).toFixed(2);
  }
}

function formatNumber(value: number | string | null): string {
  if (value === null || value === undefined) return 'N/A';
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(num)) return 'N/A';
  return num.toFixed(1);
}

/**
 * Safely parse a date string, returning null if invalid
 * Prevents RangeError on mobile devices
 */
function safeParseDate(dateString: string | null | undefined): Date | null {
  if (!dateString || typeof dateString !== 'string') {
    return null;
  }
  
  try {
    const trimmed = dateString.trim();
    if (!trimmed) return null;
    
    // Try parsing the date
    const date = new Date(trimmed);
    
    // Check if date is valid (not NaN and within reasonable bounds)
    if (isNaN(date.getTime())) {
      return null;
    }
    
    // Check if date is within reasonable bounds (year 1900-2100)
    const year = date.getFullYear();
    if (year < 1900 || year > 2100) {
      return null;
    }
    
    return date;
  } catch (error) {
    // Catch any RangeError or other date parsing errors
    console.warn('[safeParseDate] Failed to parse date:', dateString, error);
    return null;
  }
}

/**
 * Safely format date parts using Intl API with error handling
 * Prevents RangeError on mobile devices
 */
function safeFormatDateParts(date: Date | null, options: Intl.DateTimeFormatOptions): string {
  if (!date || isNaN(date.getTime())) {
    return 'TBD';
  }
  
  try {
    const formatter = new Intl.DateTimeFormat('en-US', options);
    return formatter.format(date);
  } catch (error) {
    console.warn('[safeFormatDateParts] Failed to format date:', error);
    // Fallback to UTC date formatting
    try {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                          'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = monthNames[date.getUTCMonth()];
      const day = date.getUTCDate();
      const year = date.getUTCFullYear();
      return `${month} ${day}, ${year}`;
    } catch {
      return 'TBD';
    }
  }
}

/**
 * Safely get timezone name from date with error handling
 */
function safeGetTimezoneName(date: Date | null): string {
  if (!date || isNaN(date.getTime())) {
    return 'EST';
  }
  
  try {
    const timeZoneFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      timeZoneName: 'short'
    });
    const parts = timeZoneFormatter.formatToParts(date);
    const timeZoneName = parts.find(part => part.type === 'timeZoneName')?.value;
    return timeZoneName || 'EST';
  } catch (error) {
    console.warn('[safeGetTimezoneName] Failed to get timezone:', error);
    return 'EST';
  }
}

/**
 * Get today and tomorrow dates in America/New_York timezone safely
 * Works reliably on mobile devices
 */
function getTodayAndTomorrowDates(): { today: Date; tomorrow: Date } {
  try {
    const now = new Date();
    
    // Get current time in Eastern Time by calculating offset
    // This is more reliable than using toLocaleString on mobile
    const easternOffset = -5 * 60; // EST is UTC-5 (EDT is UTC-4, but we'll handle that)
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const easternTime = new Date(utc + (easternOffset * 60000));
    
    // Create today date (set to midnight Eastern Time)
    const today = new Date(easternTime);
    today.setHours(0, 0, 0, 0);
    
    // Create tomorrow date
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    return { today, tomorrow };
  } catch (error) {
    console.warn('[getTodayAndTomorrowDates] Error calculating dates, using UTC fallback:', error);
    // Fallback to UTC dates
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    return { today, tomorrow };
  }
}

type SortOption = 'value-desc' | 'value-asc' | 'confidence-desc' | 'confidence-asc' | 'prop-type' | 'player-name' | 'odds-desc' | 'odds-asc';

// Prop type display order
const PROP_TYPE_ORDER = ['points', 'assists', 'rebounds', 'steals', 'blocks', 'threes'];

// Available books for filtering (should match admin.tsx)
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

// Display names for books (human-readable)
const BOOK_DISPLAY_NAMES: Record<string, string> = {
  'betmgm': 'BetMGM',
  'bet365': 'Bet365',
  'ballybet': 'Bally Bet',
  'betparx': 'BetParx',
  'betrivers': 'BetRivers',
  'caesars': 'Caesars',
  'draftkings': 'DraftKings',
  'fanduel': 'FanDuel',
  'rebet': 'Rebet',
};

/**
 * Get display name for prop type
 */
function getPropTypeDisplayName(propType: string): string {
  const displayNames: Record<string, string> = {
    'points': 'Points',
    'assists': 'Assists',
    'rebounds': 'Rebounds',
    'steals': 'Steals',
    'blocks': 'Blocks',
    'threes': 'Three-Pointers',
  };
  
  return displayNames[propType] || 
         (propType.charAt(0).toUpperCase() + propType.slice(1));
}

/**
 * Group predictions by prop type
 */
function groupPredictionsByPropType(predictions: Prediction[]): Record<string, Prediction[]> {
  const grouped: Record<string, Prediction[]> = {};
  
  predictions.forEach((pred) => {
    const propType = pred.prop_type;
    if (!grouped[propType]) {
      grouped[propType] = [];
    }
    grouped[propType].push(pred);
  });
  
  return grouped;
}

/**
 * Get prop types in display order
 * Always maintains consistent header order regardless of sort option.
 * The sortOption only affects the order of predictions within each group,
 * not the order of the groups themselves.
 */
function getPropTypesInOrder(
  groupedPredictions: Record<string, Prediction[]>,
  propTypeFilter: string,
  sortOption?: SortOption
): string[] {
  // Get all prop types that have predictions
  const allPropTypes = Object.keys(groupedPredictions).filter(propType => 
    groupedPredictions[propType] && groupedPredictions[propType].length > 0
  );

  // Apply prop type filter if needed
  const filteredPropTypes = propTypeFilter !== 'all'
    ? allPropTypes.filter(propType => propType === propTypeFilter)
    : allPropTypes;

  // Always use PROP_TYPE_ORDER to maintain consistent header order
  // The sortOption only affects the order of predictions within each group,
  // not the order of the groups themselves
  return PROP_TYPE_ORDER.filter(propType => filteredPropTypes.includes(propType));
}

/**
 * Get opponent team abbreviation for a prediction
 * Uses game data to determine opponent if not provided by API
 */
function getOpponentTeam(prediction: Prediction, gamesList: Game[]): string | undefined {
  // If opponent_team is already provided, use it
  if (prediction.opponent_team) {
    return prediction.opponent_team;
  }
  
  // Find the game for this prediction
  const game = gamesList.find(g => g.id === prediction.game_id);
  if (!game || !prediction.team_abbreviation) {
    return undefined;
  }
  
  // Determine opponent based on player's team
  if (prediction.team_abbreviation === game.home_team.abbreviation) {
    return game.visitor_team.abbreviation;
  } else if (prediction.team_abbreviation === game.visitor_team.abbreviation) {
    return game.home_team.abbreviation;
  }
  
  return undefined;
}

/**
 * Determine if a prediction is a value bet
 * A value bet has either predicted_value_over or predicted_value_under >= minValue
 * AND the corresponding confidence_score >= minConfidence
 */
function isValueBet(
  prediction: Prediction,
  minValue: number,
  minConfidence: number
): boolean {
  const valueOver = prediction.predicted_value_over ?? 0;
  const valueUnder = prediction.predicted_value_under ?? 0;
  const confidence = prediction.confidence_score ?? 0;
  
  // Check if over side is a value bet
  const overIsValueBet = valueOver >= minValue && confidence >= minConfidence;
  
  // Check if under side is a value bet
  const underIsValueBet = valueUnder >= minValue && confidence >= minConfidence;
  
  // A prediction is a value bet if either side meets the criteria
  return overIsValueBet || underIsValueBet;
}

/**
 * Determine if a game status string represents a finished game.
 * Finished games are those that have completed and are no longer in progress.
 * 
 * @param status - The game status string (e.g., "Final", "complete", "finished")
 * @returns true if the game is finished, false otherwise
 */
function isFinishedGameStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  
  const normalized = status.trim().toLowerCase();
  if (!normalized) return false;

  // Keywords that indicate a game is finished
  const finishedKeywords = [
    'final',
    'finished',
    'complete',
    'completed',
    'full time',
    'full-time',
    'ft',
    'ended',
    'over',
  ];

  return finishedKeywords.some((keyword) =>
    normalized.includes(keyword)
  );
}

/**
 * Determine if a prediction is for a finished game.
 * Checks both the prediction's game_status field and the games list.
 * Also checks if the game date is in the past (yesterday or earlier).
 * 
 * @param prediction - The prediction object
 * @param gamesList - Array of Game objects from state
 * @returns true if the prediction's game is finished, false otherwise
 */
function isPredictionForFinishedGame(
  prediction: Prediction,
  gamesList: Game[]
): boolean {
  // First, check if prediction has game_status field
  if (prediction.game_status) {
    if (isFinishedGameStatus(prediction.game_status)) {
      return true;
    }
  }
  
  // Also check the games list for the associated game
  const associatedGame = gamesList.find(g => g.id === prediction.game_id);
  if (associatedGame) {
    if (isFinishedGameStatus(associatedGame.status)) {
      return true;
    }
    
    // Check if the game date is in the past (before today)
    const gameDate = safeParseDate(associatedGame.date);
    if (gameDate) {
      const { today } = getTodayAndTomorrowDates();
      const todayStart = new Date(today);
      todayStart.setHours(0, 0, 0, 0);
      
      // If game date is before today, it's likely finished
      if (gameDate.getTime() < todayStart.getTime()) {
        return true;
      }
    }
  }
  
  // Check if prediction has game_time that indicates it's from the past
  if (prediction.game_time) {
    const gameTimeDate = safeParseDate(prediction.game_time);
    if (gameTimeDate) {
      const { today } = getTodayAndTomorrowDates();
      const todayStart = new Date(today);
      todayStart.setHours(0, 0, 0, 0);
      
      // If game time is before today, it's likely finished
      if (gameTimeDate.getTime() < todayStart.getTime()) {
        return true;
      }
    }
  }
  
  // If the prediction has actual_result, it's definitely finished
  if (prediction.actual_result) {
    return true;
  }
  
  // Don't filter just because game is not in the list - that's too aggressive.
  // Only filter if we have definitive evidence the game is finished/old:
  // - game_status indicates finished
  // - game date is before today
  // - game_time is before today
  // - actual_result exists
  
  // If we can't determine status, be conservative and keep the prediction
  return false;
}

/**
 * Determine if a game status string represents an in-progress/live game.
 * In-progress games are those that have started but not yet finished.
 * 
 * @param status - The game status string (e.g., "1st Qtr", "Halftime", "Live")
 * @returns true if the game is in progress, false otherwise
 */
function isInProgressGameStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  
  const normalized = status.trim().toLowerCase();
  if (!normalized) return false;

  // Keywords that indicate a game is in progress (live)
  const inProgressKeywords = [
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
    'inprogress',
    'playing',
    'active',
  ];

  // Check if status contains any in-progress keywords
  const isInProgress = inProgressKeywords.some((keyword) =>
    normalized.includes(keyword)
  );

  // Make sure it's not finished (finished games should be handled separately)
  const isFinished = isFinishedGameStatus(status);
  
  return isInProgress && !isFinished;
}

/**
 * Determine if a prediction is for an in-progress game.
 * Checks both the prediction's game_status field and the games list.
 * 
 * @param prediction - The prediction object
 * @param gamesList - Array of Game objects from state
 * @returns true if the prediction's game is in progress, false otherwise
 */
function isPredictionForInProgressGame(
  prediction: Prediction,
  gamesList: Game[]
): boolean {
  // First, check if prediction has game_status field
  if (prediction.game_status) {
    if (isInProgressGameStatus(prediction.game_status)) {
      return true;
    }
  }
  
  // Also check the games list for the associated game
  const associatedGame = gamesList.find(g => g.id === prediction.game_id);
  if (associatedGame) {
    if (isInProgressGameStatus(associatedGame.status)) {
      return true;
    }
  }
  
  // If we can't find the game and prediction doesn't have status, 
  // assume it's not in progress (conservative approach)
  return false;
}

export default function PredictionsPage() {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [propTypeFilter, setPropTypeFilter] = useState<string>('all');
  const [minValue, setMinValue] = useState<string>('0');
  const [minConfidence, setMinConfidence] = useState<string>('0');
  const [showValueBetsOnly, setShowValueBetsOnly] = useState(false);
  const [hideInProgressGames, setHideInProgressGames] = useState(true); // Default: true (hidden)
  const [sortOption, setSortOption] = useState<SortOption>('value-desc');
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [selectedBooks, setSelectedBooks] = useState<string[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);
  const [gamesLoading, setGamesLoading] = useState(false);
  const [gamesError, setGamesError] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const hasInitializedCollapsed = useRef(false);
  const dropdownRefs = {
    propType: useRef<any>(null),
    minValue: useRef<any>(null),
    sortBy: useRef<any>(null),
  };

  const fetchUpcomingGames = useCallback(async () => {
    try {
      setGamesError(null);
      setGamesLoading(true);
      
      // Get today, tomorrow, and yesterday dates safely
      const { today, tomorrow } = getTodayAndTomorrowDates();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      const todayStr = today.toISOString().split('T')[0];
      const tomorrowStr = tomorrow.toISOString().split('T')[0];
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      // Fetch games for yesterday, today, and tomorrow
      // We fetch yesterday to check status of finished games for filtering predictions
      const [yesterdayResponse, todayResponse, tomorrowResponse] = await Promise.all([
        get<GamesResponse>(`/api/bdl/v1/games?dates[]=${yesterdayStr}&per_page=100`),
        get<GamesResponse>(`/api/bdl/v1/games?dates[]=${todayStr}&per_page=100`),
        get<GamesResponse>(`/api/bdl/v1/games?dates[]=${tomorrowStr}&per_page=100`)
      ]);
      
      // Check for errors (yesterday is optional, so we don't throw on error)
      if (todayResponse.error) {
        throw new Error(todayResponse.error);
      }
      if (tomorrowResponse.error) {
        throw new Error(tomorrowResponse.error);
      }
      
      // Combine all games (yesterday, today, tomorrow) for status checking
      const allGames: Game[] = [
        ...(yesterdayResponse.data?.data || []),
        ...(todayResponse.data?.data || []),
        ...(tomorrowResponse.data?.data || [])
      ];
      
      // Filter for upcoming games (Scheduled status or status that indicates not started)
      // Only include today and tomorrow games in the upcoming games list
      const todayAndTomorrowGames = [
        ...(todayResponse.data?.data || []),
        ...(tomorrowResponse.data?.data || [])
      ];
      
      const upcomingGames = todayAndTomorrowGames.filter(game => {
        const status = game.status?.toLowerCase() || '';
        return status === 'scheduled' || 
               status === '' || 
               (!status.includes('qtr') && 
                status !== 'final' && 
                status !== 'halftime');
      });
      
      // Sort by date and time - with safe date parsing
      upcomingGames.sort((a, b) => {
        const dateA = safeParseDate(a.date);
        const dateB = safeParseDate(b.date);
        
        if (!dateA && !dateB) return 0;
        if (!dateA) return 1; // Invalid dates go to end
        if (!dateB) return -1;
        
        const timeA = dateA.getTime();
        const timeB = dateB.getTime();
        
        if (timeA !== timeB) return timeA - timeB;
        // If same date, sort by time if available
        return 0;
      });
      
      // Store all games (including yesterday) for status checking in predictions filtering
      // We need yesterday's games to check if predictions are for finished games
      setGames(allGames);
    } catch (err: any) {
      console.error('Error fetching games:', err);
      setGamesError(err.message || 'Failed to fetch upcoming games');
      setGames([]);
    } finally {
      setGamesLoading(false);
    }
  }, []);

  const fetchPredictions = useCallback(async (gameId?: number) => {
    try {
      setError(null);
      setLoading(true);

      // Use selectedGameId if provided, otherwise use gameId parameter
      const targetGameId = selectedGameId || gameId;

      // Build query parameters
      const params = new URLSearchParams();
      
      // Value bet filters
      if (showValueBetsOnly || !targetGameId) {
        params.append('minValue', minValue);
        params.append('minConfidence', minConfidence || '0');
      }
      
      // Prop type filter
      if (propTypeFilter !== 'all') {
        params.append('propType', propTypeFilter);
      }
      
      // Backend filtering parameters
      // excludeFinished defaults to true on backend, but we'll be explicit
      params.append('excludeFinished', 'true');
      
      // excludeInProgress based on frontend toggle
      if (hideInProgressGames) {
        params.append('excludeInProgress', 'true');
      }

      // Build endpoint
      const endpoint = showValueBetsOnly || !targetGameId
        ? `/api/predictions/value-bets?${params.toString()}`
        : `/api/predictions/game/${targetGameId}?${params.toString()}`;

      console.log(`[Predictions] Fetching from endpoint: ${endpoint}`);
      const response = await get<PredictionsResponse>(endpoint);
      
      if (response.error) {
        console.error('[Predictions] API error:', response.error);
        setError(response.error);
        setPredictions([]);
      } else if (response.data) {
        console.log('[Predictions] API response data keys:', Object.keys(response.data));
        
        let predictionsToSet: Prediction[] = [];
        
        if ('predictions' in response.data) {
          predictionsToSet = response.data.predictions || [];
          console.log(`[Predictions] Found ${predictionsToSet.length} predictions`);
        } else if ('valueBets' in response.data) {
          predictionsToSet = response.data.valueBets || [];
          console.log(`[Predictions] Found ${predictionsToSet.length} value bets (filtered by date=CURRENT_DATE, minValue=${minValue}, minConfidence=${minConfidence || '0'})`);
          if (predictionsToSet.length === 0 && parseFloat(minValue) === 0 && parseFloat(minConfidence || '0') === 0) {
            console.warn('[Predictions] No value bets found despite no filters. This may indicate:');
            console.warn('  - Predictions exist but not for CURRENT_DATE');
            console.warn('  - Predictions have null predicted_value_over/under');
            console.warn('  - Backend query filtering issue');
          }
        } else {
          console.warn('[Predictions] Response data exists but no predictions or valueBets found:', Object.keys(response.data));
        }
        
        // Backend handles all filtering for finished and in-progress games via query parameters
        // No client-side filtering needed - backend returns only the predictions we want
        console.log(`[Predictions] Received ${predictionsToSet.length} predictions from backend (already filtered)`);
        
        // If a game is selected, filter predictions to only include players from that game's teams
        if (targetGameId && predictionsToSet.length > 0) {
          const selectedGame = games.find(g => g.id === targetGameId);
          if (selectedGame) {
            const homeTeam = selectedGame.home_team.abbreviation;
            const visitorTeam = selectedGame.visitor_team.abbreviation;
            
            // Filter predictions to only include players from either team
            predictionsToSet = predictionsToSet.filter(
              (pred: Prediction) => 
                pred.team_abbreviation === homeTeam || 
                pred.team_abbreviation === visitorTeam
            );
          }
        }
        
        // Enrich predictions with opponent_team if not already provided
        predictionsToSet = predictionsToSet.map((pred: Prediction) => {
          const opponentTeam = getOpponentTeam(pred, games);
          if (opponentTeam && !pred.opponent_team) {
            return { ...pred, opponent_team: opponentTeam };
          }
          return pred;
        });
        
        // Filter for value bets only if showValueBetsOnly is enabled
        if (showValueBetsOnly) {
          const minValueNum = parseFloat(minValue);
          const minConfidenceNum = parseFloat(minConfidence || '0');
          
          predictionsToSet = predictionsToSet.filter((pred: Prediction) => 
            isValueBet(pred, minValueNum, minConfidenceNum)
          );
          
          console.log(`[Predictions] Filtered to ${predictionsToSet.length} value bets (minValue=${minValueNum}, minConfidence=${minConfidenceNum})`);
        }
        
        setPredictions(predictionsToSet);
      } else {
        console.warn('[Predictions] No data or error in response:', response);
        setPredictions([]);
      }
    } catch (err: any) {
      console.error('Error fetching predictions:', err);
      setError(err.message || 'Failed to fetch predictions');
      setPredictions([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [propTypeFilter, minValue, minConfidence, showValueBetsOnly, selectedGameId, games, hideInProgressGames]);

  useEffect(() => {
    fetchUpcomingGames();
  }, [fetchUpcomingGames]);

  useEffect(() => {
    fetchPredictions();
  }, [fetchPredictions]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchUpcomingGames();
    fetchPredictions();
  }, [fetchUpcomingGames, fetchPredictions]);

  // Toggle book selection
  const toggleBook = useCallback((book: string) => {
    setSelectedBooks((prev) => {
      if (prev.includes(book)) {
        return prev.filter((b) => b !== book);
      } else {
        return [...prev, book];
      }
    });
  }, []);

  // Filter predictions by selected books
  const bookFilteredPredictions = useMemo(() => {
    // If no books selected, return all predictions
    if (selectedBooks.length === 0) {
      return predictions;
    }

    // Normalize selected books to lowercase for comparison
    const normalizedSelectedBooks = selectedBooks.map(book => book.toLowerCase());

    // Filter predictions where BOTH over_vendor AND under_vendor match selected books
    const filtered = predictions.filter(pred => {
      // Both vendor fields must exist
      if (!pred.over_vendor || !pred.under_vendor) {
        return false; // Exclude predictions with missing vendor info
      }

      const overVendorNormalized = pred.over_vendor?.toLowerCase().trim();
      const underVendorNormalized = pred.under_vendor?.toLowerCase().trim();

      const overMatch = overVendorNormalized 
        ? normalizedSelectedBooks.includes(overVendorNormalized)
        : false;
      const underMatch = underVendorNormalized
        ? normalizedSelectedBooks.includes(underVendorNormalized)
        : false;
      
      // BOTH over AND under must match selected books
      return overMatch && underMatch;
    });

    return filtered;
  }, [predictions, selectedBooks]);

  // Sort predictions based on selected option
  const sortedPredictions = useMemo(() => {
    const sorted = [...bookFilteredPredictions];

    switch (sortOption) {
      case 'value-desc':
        return sorted.sort((a, b) => {
          const aValue = Math.max(a.predicted_value_over || 0, a.predicted_value_under || 0);
          const bValue = Math.max(b.predicted_value_over || 0, b.predicted_value_under || 0);
          return bValue - aValue;
        });

      case 'value-asc':
        return sorted.sort((a, b) => {
          const aValue = Math.max(a.predicted_value_over || 0, a.predicted_value_under || 0);
          const bValue = Math.max(b.predicted_value_over || 0, b.predicted_value_under || 0);
          return aValue - bValue;
        });

      case 'confidence-desc':
        // Get the displayed confidence (predicted_prob_over or predicted_prob_under based on value side)
        const getDisplayConfidence = (p: Prediction) => {
          const valueSide = (p.predicted_value_over || 0) > (p.predicted_value_under || 0) ? 'over' : 'under';
          const prob = valueSide === 'over' ? p.predicted_prob_over : p.predicted_prob_under;
          return Number(prob) || 0;
        };
        return sorted.sort((a, b) => {
          const aConf = getDisplayConfidence(a);
          const bConf = getDisplayConfidence(b);
          return bConf - aConf;
        });

      case 'confidence-asc':
        // Get the displayed confidence (predicted_prob_over or predicted_prob_under based on value side)
        const getDisplayConfidenceAsc = (p: Prediction) => {
          const valueSide = (p.predicted_value_over || 0) > (p.predicted_value_under || 0) ? 'over' : 'under';
          const prob = valueSide === 'over' ? p.predicted_prob_over : p.predicted_prob_under;
          return Number(prob) || 0;
        };
        return sorted.sort((a, b) => {
          const aConf = getDisplayConfidenceAsc(a);
          const bConf = getDisplayConfidenceAsc(b);
          return aConf - bConf;
        });

      case 'prop-type':
        return sorted.sort((a, b) => {
          if (a.prop_type !== b.prop_type) {
            return a.prop_type.localeCompare(b.prop_type);
          }
          // Secondary sort by value
          const aValue = Math.max(a.predicted_value_over || 0, a.predicted_value_under || 0);
          const bValue = Math.max(b.predicted_value_over || 0, b.predicted_value_under || 0);
          return bValue - aValue;
        });

      case 'player-name':
        return sorted.sort((a, b) => {
          const aName = `${a.player_first_name} ${a.player_last_name}`;
          const bName = `${b.player_first_name} ${b.player_last_name}`;
          return aName.localeCompare(bName);
        });

      case 'odds-desc':
        return sorted.sort((a, b) => {
          // Get best odds for each prediction (highest value is best)
          const aBestOdds = Math.max(
            a.best_over_odds ?? Number.NEGATIVE_INFINITY,
            a.best_under_odds ?? Number.NEGATIVE_INFINITY
          );
          const bBestOdds = Math.max(
            b.best_over_odds ?? Number.NEGATIVE_INFINITY,
            b.best_under_odds ?? Number.NEGATIVE_INFINITY
          );
          
          // If both have null odds, maintain order
          if (aBestOdds === Number.NEGATIVE_INFINITY && bBestOdds === Number.NEGATIVE_INFINITY) {
            return 0;
          }
          
          // Predictions with null odds go to the end
          if (aBestOdds === Number.NEGATIVE_INFINITY) return 1;
          if (bBestOdds === Number.NEGATIVE_INFINITY) return -1;
          
          // Sort descending (best odds first)
          return bBestOdds - aBestOdds;
        });

      case 'odds-asc':
        return sorted.sort((a, b) => {
          // Get best odds for each prediction (highest value is best)
          const aBestOdds = Math.max(
            a.best_over_odds ?? Number.NEGATIVE_INFINITY,
            a.best_under_odds ?? Number.NEGATIVE_INFINITY
          );
          const bBestOdds = Math.max(
            b.best_over_odds ?? Number.NEGATIVE_INFINITY,
            b.best_under_odds ?? Number.NEGATIVE_INFINITY
          );
          
          // If both have null odds, maintain order
          if (aBestOdds === Number.NEGATIVE_INFINITY && bBestOdds === Number.NEGATIVE_INFINITY) {
            return 0;
          }
          
          // Predictions with null odds go to the end
          if (aBestOdds === Number.NEGATIVE_INFINITY) return 1;
          if (bBestOdds === Number.NEGATIVE_INFINITY) return -1;
          
          // Sort ascending (worst odds first)
          return aBestOdds - bBestOdds;
        });

      default:
        return sorted;
    }
  }, [bookFilteredPredictions, sortOption]);

  // Group sorted predictions by prop type
  const groupedPredictions = useMemo(() => {
    return groupPredictionsByPropType(sortedPredictions);
  }, [sortedPredictions]);

  // Get prop types in display order
  const propTypesInOrder = useMemo(() => {
    return getPropTypesInOrder(groupedPredictions, propTypeFilter, sortOption);
  }, [groupedPredictions, propTypeFilter, sortOption]);

  // Toggle section collapsed state
  const toggleSection = useCallback((propType: string) => {
    setCollapsedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(propType)) {
        newSet.delete(propType); // Expand (remove from collapsed set)
      } else {
        newSet.add(propType); // Collapse (add to collapsed set)
      }
      return newSet;
    });
  }, []);

  // Collapse all sections
  const collapseAll = useCallback(() => {
    setCollapsedSections(new Set(propTypesInOrder));
  }, [propTypesInOrder]);

  // Expand all sections
  const expandAll = useCallback(() => {
    setCollapsedSections(new Set());
  }, []);

  // Check if all sections are collapsed
  const allCollapsed = propTypesInOrder.length > 0 && 
                       propTypesInOrder.every(propType => collapsedSections.has(propType));

  // Collapse all sections by default when predictions first load
  useEffect(() => {
    if (!hasInitializedCollapsed.current && propTypesInOrder.length > 0) {
      setCollapsedSections(new Set(propTypesInOrder));
      hasInitializedCollapsed.current = true;
    }
  }, [propTypesInOrder]);

  // Format game time for display
  const formatGameTime = useCallback((timeString?: string): string | null => {
    if (!timeString) return null;
    
    // Clean ISO strings from timeString if present
    let cleaned = timeString
      .replace(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[.0-9]*Z?\s*/g, '')
      .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/g, '')
      .replace(/\s+\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z?/g, '')
      .trim();
    
    // If cleaned string is empty or only contains ISO patterns, return null
    if (!cleaned || cleaned.length === 0 || /^\d{4}-\d{2}-\d{2}T/.test(cleaned)) {
      return null;
    }
    
    // If cleaned string already looks formatted (contains month name), return it as-is
    if (/^[A-Za-z]{3}\s+\d{1,2}/.test(cleaned)) {
      return cleaned;
    }
    
    // Use safe date parsing
    const date = safeParseDate(cleaned);
    if (!date) return null;
    
    try {
      const formatted = safeFormatDateParts(date, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'America/New_York',
      });
      
      const timeZoneName = safeGetTimezoneName(date);
      return `${formatted} ${timeZoneName}`;
    } catch {
      return null;
    }
  }, []);

  // Format game label (e.g., "LAL at BOS")
  const formatGameLabel = useCallback((game: Game): string => {
    return `${game.visitor_team.abbreviation} at ${game.home_team.abbreviation}`;
  }, []);

  // Format game time for display - using same approach as scan.tsx
  const formatGameTimeDisplay = useCallback((game: Game): string => {
    try {
      // Use datetime field if available, otherwise use date field
      // Both should contain ISO timestamp (e.g., "2025-12-25T22:00:00Z")
      const isoString = game.datetime || game.date;
      
      if (!isoString) {
        // Fallback to game.time if available, but clean it
        if (game.time) {
          // Check if game.time is already formatted (contains month name)
          if (/^[A-Za-z]{3}\s+\d{1,2}/.test(game.time)) {
            // Already formatted, but check for ISO strings
            const cleaned = game.time.replace(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[.0-9]*Z?\s*/g, '').trim();
            if (cleaned && !/\d{4}-\d{2}-\d{2}T/.test(cleaned)) {
              return cleaned;
            }
          }
        }
        return 'TBD';
      }
      
      // Use safe date parsing
      const date = safeParseDate(isoString);
      if (!date) {
        return 'TBD';
      }
      
      // Format using safe formatting functions
      const formatted = safeFormatDateParts(date, {
        timeZone: 'America/New_York',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
      
      // Get timezone abbreviation (EST or EDT) safely
      const timeZoneName = safeGetTimezoneName(date);
      
      let result = `${formatted} ${timeZoneName}`;
      
      // Apply same ISO cleanup logic as scan.tsx (lines 923-985)
      // Check if formatted result contains the raw ISO string (concatenated)
      if (result && isoString) {
        // More flexible ISO pattern that matches with or without milliseconds and Z
        const isoDatePattern = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?/;
        
        // First check: Does the formatted string contain an ISO date pattern?
        if (isoDatePattern.test(result)) {
          const match = result.match(isoDatePattern);
          if (match && match.index !== undefined) {
            if (match.index > 0) {
              // ISO string is in the middle or end - extract only the part before it
              result = result.substring(0, match.index).trim();
            } else {
              // If ISO string is at the start, the formatting failed - return TBD
              return 'TBD';
            }
          }
        }
        
        // Second check: Does it contain the exact raw isoString value?
        if (result && result.includes(isoString)) {
          const isoIndex = result.indexOf(isoString);
          if (isoIndex > 0) {
            result = result.substring(0, isoIndex).trim();
          } else if (isoIndex === 0) {
            return 'TBD';
          }
        }
        
        // Final check: Look for any remaining ISO-like patterns and remove them
        const remainingIsoPattern = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
        if (remainingIsoPattern.test(result)) {
          const match = result.match(remainingIsoPattern);
          if (match && match.index !== undefined && match.index > 0) {
            result = result.substring(0, match.index).trim();
          }
        }
      }
      
      // Final safety check: Remove any ISO string that might still be in result
      if (result && isoString) {
        // Check if result still contains the raw isoString value
        if (result.includes(isoString)) {
          const splitIndex = result.indexOf(isoString);
          if (splitIndex > 0) {
            result = result.substring(0, splitIndex).trim();
          } else {
            return 'TBD';
          }
        }
        
        // Also check for any ISO date pattern
        const finalIsoCheck = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?/;
        if (finalIsoCheck.test(result)) {
          const match = result.match(finalIsoCheck);
          if (match && match.index !== undefined && match.index > 0) {
            result = result.substring(0, match.index).trim();
          } else if (match && match.index === 0) {
            return 'TBD';
          }
        }
      }
      
      // Ensure we never return an ISO string - final validation
      if (result && (/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(result) && result.endsWith('Z'))) {
        return 'TBD';
      }
      
      return result || 'TBD';
    } catch (err) {
      console.warn('[formatGameTimeDisplay] Error formatting game time:', err);
      return 'TBD';
    }
  }, []);

  // Close dropdowns when clicking outside (web only)
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const handleClickOutside = (event: any) => {
        if (openDropdown && !event.target.closest('[data-dropdown]')) {
          setOpenDropdown(null);
        }
      };
      if (openDropdown) {
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
          document.removeEventListener('mousedown', handleClickOutside);
        };
      }
    }
  }, [openDropdown]);

  const propTypeOptions = [
    { value: 'all', label: 'All Props' },
    { value: 'points', label: 'Points' },
    { value: 'assists', label: 'Assists' },
    { value: 'rebounds', label: 'Rebounds' },
    { value: 'steals', label: 'Steals' },
    { value: 'blocks', label: 'Blocks' },
    { value: 'threes', label: 'Three-Pointers' },
  ];

  const minValueOptions = [
    { value: '0', label: '0% (All)' },
    { value: '0.03', label: '3%' },
    { value: '0.05', label: '5%' },
    { value: '0.07', label: '7%' },
    { value: '0.10', label: '10%' },
  ];

  const sortOptions = [
    { value: 'value-desc', label: 'Value (High to Low)' },
    { value: 'value-asc', label: 'Value (Low to High)' },
    { value: 'confidence-desc', label: 'Confidence (High to Low)' },
    { value: 'confidence-asc', label: 'Confidence (Low to High)' },
    { value: 'prop-type', label: 'Prop Type' },
    { value: 'player-name', label: 'Player Name' },
    { value: 'odds-desc', label: 'Market Odds (Best to Worst)' },
    { value: 'odds-asc', label: 'Market Odds (Worst to Best)' },
  ];

  return (
    <>
      <StatusBar style="light" />
      <NavigationBar />
      <ScrollView
        flex={1}
        backgroundColor="$background"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <YStack padding="$4" space="$4">
          <Text fontSize="$8" fontWeight="bold" color="$color">
            Predictions
          </Text>

          {/* Game Selector */}
          <Card padding="$3" backgroundColor="$backgroundStrong">
            <YStack space="$3">
              <XStack justifyContent="space-between" alignItems="center">
                <Text fontSize="$5" fontWeight="600" color="$color">
                  Select Game
                </Text>
                <Button
                  onPress={() => {
                    setSelectedGameId(null);
                    fetchPredictions();
                  }}
                  backgroundColor={selectedGameId === null ? "$blue9" : "$gray5"}
                  color="white"
                  size="$3"
                >
                  All Games
                </Button>
              </XStack>
              
              {gamesLoading && (
                <YStack alignItems="center" padding="$2">
                  <Spinner size="small" color="$blue9" />
                  <Text marginTop="$2" fontSize="$3" color="$color10">
                    Loading games...
                  </Text>
                </YStack>
              )}
              
              {gamesError && (
                <Card padding="$2" backgroundColor="$red5">
                  <Text color="white" fontSize="$3">{gamesError}</Text>
                </Card>
              )}
              
              {!gamesLoading && games.length === 0 && !gamesError && (
                <Text fontSize="$3" color="$color10" textAlign="center">
                  No upcoming games found.
                </Text>
              )}
              
              {!gamesLoading && games.length > 0 && (() => {
                // Filter to show only upcoming games (today and tomorrow) in the selector
                // Yesterday's games are in the games list for status checking, but shouldn't be selectable
                const { today, tomorrow } = getTodayAndTomorrowDates();
                const todayStr = today.toISOString().split('T')[0];
                const tomorrowStr = tomorrow.toISOString().split('T')[0];
                
                const upcomingGamesForSelector = games.filter(game => {
                  const gameDate = safeParseDate(game.date);
                  if (!gameDate) return false;
                  const gameDateStr = gameDate.toISOString().split('T')[0];
                  return gameDateStr === todayStr || gameDateStr === tomorrowStr;
                });
                
                if (upcomingGamesForSelector.length === 0) {
                  return (
                    <Text fontSize="$3" color="$color10" textAlign="center">
                      No upcoming games found.
                    </Text>
                  );
                }
                
                return (
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingVertical: 8 }}
                  >
                    <XStack space="$2" flexWrap="wrap">
                      {upcomingGamesForSelector.map((game) => {
                      const isSelected = selectedGameId === game.id;
                      const gameLabel = formatGameLabel(game);
                      let gameTime = formatGameTimeDisplay(game);
                      
                      // Get raw ISO string for comparison (same as scan.tsx approach)
                      const rawIsoString = game.datetime || game.date;
                      
                      // Final safety check: if gameTime contains the raw ISO string, extract only the part before it
                      // This matches the scan.tsx approach (lines 943-951)
                      if (gameTime && rawIsoString && gameTime.includes(rawIsoString)) {
                        const isoIndex = gameTime.indexOf(rawIsoString);
                        if (isoIndex > 0) {
                          gameTime = gameTime.substring(0, isoIndex).trim();
                        } else if (isoIndex === 0) {
                          gameTime = 'TBD'; // If ISO string is at start, formatting failed
                        }
                      }
                      
                      // Additional safety: remove any ISO patterns that might still be present
                      if (gameTime && /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(gameTime)) {
                        const match = gameTime.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?/);
                        if (match && match.index !== undefined) {
                          if (match.index > 0) {
                            gameTime = gameTime.substring(0, match.index).trim();
                          } else {
                            gameTime = 'TBD';
                          }
                        }
                      }
                      
                      // Final validation: if gameTime looks like an ISO string, set to TBD
                      if (gameTime && /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(gameTime) && gameTime.endsWith('Z')) {
                        gameTime = 'TBD';
                      }
                      
                      return (
                        <Pressable
                          key={game.id}
                          onPress={() => {
                            setSelectedGameId(game.id);
                          }}
                        >
                          <Card
                            padding="$3"
                            backgroundColor={isSelected ? "$blue9" : "$background"}
                            borderWidth={isSelected ? 2 : 1}
                            borderColor={isSelected ? "$blue11" : "$borderColor"}
                            minWidth={200}
                          >
                            <YStack space="$1">
                              <Text 
                                fontSize="$4" 
                                fontWeight={isSelected ? "bold" : "600"}
                                color={isSelected ? "white" : "$color"}
                              >
                                {gameLabel}
                              </Text>
                              <Text 
                                fontSize="$2" 
                                color={isSelected ? "white" : "$color10"}
                              >
                                {(() => {
                                  // ABSOLUTE BLOCK: If gameTime is exactly the raw ISO string, return TBD
                                  if (gameTime && (gameTime === rawIsoString || gameTime === game.datetime || gameTime === game.date)) {
                                    return 'TBD';
                                  }
                                  
                                  // Check if gameTime looks like an ISO string (full pattern AND ends with Z)
                                  if (gameTime && /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(gameTime) && gameTime.endsWith('Z')) {
                                    return 'TBD';
                                  }
                                  
                                  // Final safety: if gameTime contains ISO, extract only formatted part
                                  if (gameTime && rawIsoString && gameTime.includes(rawIsoString)) {
                                    const isoIndex = gameTime.indexOf(rawIsoString);
                                    if (isoIndex > 0) {
                                      const cleaned = gameTime.substring(0, isoIndex).trim();
                                      return cleaned;
                                    } else if (isoIndex === 0) {
                                      return 'TBD';
                                    }
                                  }
                                  
                                  // Also check for ISO pattern
                                  if (gameTime && /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(gameTime)) {
                                    const match = gameTime.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?/);
                                    if (match && match.index !== undefined) {
                                      if (match.index > 0) {
                                        const cleaned = gameTime.substring(0, match.index).trim();
                                        return cleaned;
                                      } else {
                                        return 'TBD';
                                      }
                                    }
                                  }
                                  
                                  return gameTime || 'TBD';
                                })()}
                              </Text>
                              <Text 
                                fontSize="$2" 
                                color={isSelected ? "white" : "$color10"}
                                textTransform="capitalize"
                              >
                                {(() => {
                                  // Check if game.status is an ISO string (like scan.tsx does for gameStatus)
                                  if (game.status && typeof game.status === 'string' && 
                                      /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(game.status) && 
                                      game.status.endsWith('Z')) {
                                    return 'Scheduled'; // Don't render ISO string as status
                                  }
                                  return game.status || 'Scheduled';
                                })()}
                              </Text>
                            </YStack>
                          </Card>
                        </Pressable>
                      );
                      })}
                    </XStack>
                  </ScrollView>
                );
              })()}
              
              {selectedGameId && games.find(g => g.id === selectedGameId) && (
                <Card padding="$2" backgroundColor="$blue2">
                  <Text fontSize="$3" color="$color">
                    Showing predictions for: {formatGameLabel(games.find(g => g.id === selectedGameId)!)}
                  </Text>
                </Card>
              )}
            </YStack>
          </Card>

          {/* Filters and Sorting */}
          {openDropdown && (
            <Pressable
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 50,
              }}
              onPress={() => setOpenDropdown(null)}
            />
          )}
          <Card padding="$3" backgroundColor="$backgroundStrong" marginTop="$2">
            <YStack space="$3">
              <XStack space="$3" alignItems="center" flexWrap="wrap">
                <YStack flex={1} minWidth={150} position="relative" zIndex={openDropdown === 'propType' ? 100 : 1}>
                  <Label htmlFor="prop-type">Prop Type</Label>
                  <Button
                    data-dropdown
                    width="100%"
                    justifyContent="space-between"
                    backgroundColor="$background"
                    borderWidth={1}
                    borderColor="$borderColor"
                    onPress={() => setOpenDropdown(openDropdown === 'propType' ? null : 'propType')}
                  >
                    <Text color="$color">
                      {propTypeOptions.find(opt => opt.value === propTypeFilter)?.label || 'All Props'}
                    </Text>
                    <Text color="$color">▼</Text>
                  </Button>
                  {openDropdown === 'propType' && (
                    <Card
                      data-dropdown
                      position="absolute"
                      top="100%"
                      left={0}
                      right={0}
                      marginTop="$1"
                      padding="$2"
                      backgroundColor="$backgroundStrong"
                      borderWidth={1}
                      borderColor="$borderColor"
                      zIndex={100}
                      elevation={4}
                    >
                      <YStack space="$1">
                        {propTypeOptions.map((option) => (
                          <Pressable
                            key={option.value}
                            onPress={() => {
                              setPropTypeFilter(option.value);
                              setOpenDropdown(null);
                            }}
                          >
                            <YStack
                              padding="$2"
                              backgroundColor={propTypeFilter === option.value ? "$blue3" : "transparent"}
                              borderRadius="$2"
                              hoverStyle={{ backgroundColor: "$blue2" }}
                            >
                              <Text color="$color">{option.label}</Text>
                            </YStack>
                          </Pressable>
                        ))}
                      </YStack>
                    </Card>
                  )}
                </YStack>

                <YStack flex={1} minWidth={150} position="relative" zIndex={openDropdown === 'minValue' ? 100 : 1}>
                  <Label htmlFor="min-value">Min Value (%)</Label>
                  <Button
                    data-dropdown
                    width="100%"
                    justifyContent="space-between"
                    backgroundColor="$background"
                    borderWidth={1}
                    borderColor="$borderColor"
                    onPress={() => setOpenDropdown(openDropdown === 'minValue' ? null : 'minValue')}
                  >
                    <Text color="$color">
                      {minValueOptions.find(opt => opt.value === minValue)?.label || '0%'}
                    </Text>
                    <Text color="$color">▼</Text>
                  </Button>
                  {openDropdown === 'minValue' && (
                    <Card
                      data-dropdown
                      position="absolute"
                      top="100%"
                      left={0}
                      right={0}
                      marginTop="$1"
                      padding="$2"
                      backgroundColor="$backgroundStrong"
                      borderWidth={1}
                      borderColor="$borderColor"
                      zIndex={100}
                      elevation={4}
                    >
                      <YStack space="$1">
                        {minValueOptions.map((option) => (
                          <Pressable
                            key={option.value}
                            onPress={() => {
                              setMinValue(option.value);
                              setOpenDropdown(null);
                            }}
                          >
                            <YStack
                              padding="$2"
                              backgroundColor={minValue === option.value ? "$blue3" : "transparent"}
                              borderRadius="$2"
                              hoverStyle={{ backgroundColor: "$blue2" }}
                            >
                              <Text color="$color">{option.label}</Text>
                            </YStack>
                          </Pressable>
                        ))}
                      </YStack>
                    </Card>
                  )}
                </YStack>

                <YStack flex={1} minWidth={150} position="relative" zIndex={openDropdown === 'sortBy' ? 100 : 1}>
                  <Label htmlFor="sort-by">Sort By</Label>
                  <Button
                    data-dropdown
                    width="100%"
                    justifyContent="space-between"
                    backgroundColor="$background"
                    borderWidth={1}
                    borderColor="$borderColor"
                    onPress={() => setOpenDropdown(openDropdown === 'sortBy' ? null : 'sortBy')}
                  >
                    <Text color="$color">
                      {sortOptions.find(opt => opt.value === sortOption)?.label || 'Value (High to Low)'}
                    </Text>
                    <Text color="$color">▼</Text>
                  </Button>
                  {openDropdown === 'sortBy' && (
                    <Card
                      data-dropdown
                      position="absolute"
                      top="100%"
                      left={0}
                      right={0}
                      marginTop="$1"
                      padding="$2"
                      backgroundColor="$backgroundStrong"
                      borderWidth={1}
                      borderColor="$borderColor"
                      zIndex={100}
                      elevation={4}
                    >
                      <YStack space="$1">
                        {sortOptions.map((option) => (
                          <Pressable
                            key={option.value}
                            onPress={() => {
                              setSortOption(option.value as SortOption);
                              setOpenDropdown(null);
                            }}
                          >
                            <YStack
                              padding="$2"
                              backgroundColor={sortOption === option.value ? "$blue3" : "transparent"}
                              borderRadius="$2"
                              hoverStyle={{ backgroundColor: "$blue2" }}
                            >
                              <Text color="$color">{option.label}</Text>
                            </YStack>
                          </Pressable>
                        ))}
                      </YStack>
                    </Card>
                  )}
                </YStack>

                <YStack flex={1} minWidth={150} position="relative" zIndex={openDropdown === 'books' ? 100 : 1}>
                  <Label htmlFor="books">Sportsbooks</Label>
                  <Button
                    data-dropdown
                    width="100%"
                    justifyContent="space-between"
                    backgroundColor="$background"
                    borderWidth={1}
                    borderColor="$borderColor"
                    onPress={() => setOpenDropdown(openDropdown === 'books' ? null : 'books')}
                  >
                    <Text color="$color">
                      {selectedBooks.length === 0 
                        ? 'All Books' 
                        : selectedBooks.length === 1
                          ? BOOK_DISPLAY_NAMES[selectedBooks[0]] || selectedBooks[0]
                          : `${selectedBooks.length} Selected`}
                    </Text>
                    <Text color="$color">▼</Text>
                  </Button>
                  {openDropdown === 'books' && (
                    <Card
                      data-dropdown
                      position="absolute"
                      top="100%"
                      left={0}
                      right={0}
                      marginTop="$1"
                      padding="$2"
                      backgroundColor="$backgroundStrong"
                      borderWidth={1}
                      borderColor="$borderColor"
                      zIndex={100}
                      elevation={4}
                      maxHeight={300}
                    >
                      <ScrollView>
                        <YStack space="$1">
                          {/* "All Books" / "Clear All" option */}
                          <Pressable
                            onPress={() => {
                              setSelectedBooks([]);
                              setOpenDropdown(null);
                            }}
                          >
                            <YStack
                              padding="$2"
                              backgroundColor={selectedBooks.length === 0 ? "$blue3" : "transparent"}
                              borderRadius="$2"
                              hoverStyle={{ backgroundColor: "$blue2" }}
                            >
                              <Text color="$color">All Books</Text>
                            </YStack>
                          </Pressable>
                          <Separator />
                          
                          {/* Individual book options */}
                          {AVAILABLE_BOOKS.map((book) => (
                            <Pressable
                              key={book}
                              onPress={() => toggleBook(book)}
                            >
                              <YStack
                                padding="$2"
                                backgroundColor={selectedBooks.includes(book) ? "$blue3" : "transparent"}
                                borderRadius="$2"
                                hoverStyle={{ backgroundColor: "$blue2" }}
                              >
                                <XStack alignItems="center" space="$2">
                                  <Text color="$color">
                                    {selectedBooks.includes(book) ? '✓' : ' '}
                                  </Text>
                                  <Text color="$color">{BOOK_DISPLAY_NAMES[book] || book}</Text>
                                </XStack>
                              </YStack>
                            </Pressable>
                          ))}
                        </YStack>
                      </ScrollView>
                    </Card>
                  )}
                </YStack>

                <Button
                  onPress={() => setShowValueBetsOnly(!showValueBetsOnly)}
                  backgroundColor={showValueBetsOnly ? "$blue9" : "$gray5"}
                  color="white"
                >
                  {showValueBetsOnly ? 'Show All' : 'Value Bets Only'}
                </Button>

                <Button
                  onPress={() => setHideInProgressGames(!hideInProgressGames)}
                  backgroundColor={hideInProgressGames ? "$blue9" : "$gray5"}
                  color="white"
                >
                  {hideInProgressGames ? 'Show In-Progress' : 'Hide In-Progress'}
                </Button>
              </XStack>
            </YStack>
          </Card>

          {/* Error Message */}
          {error && (
            <Card padding="$3" backgroundColor="$red5">
              <Text color="white">{error}</Text>
            </Card>
          )}

          {/* Loading State */}
          {loading && !refreshing && (
            <YStack alignItems="center" padding="$8">
              <Spinner size="large" color="$blue9" />
              <Text marginTop="$3" color="$color">
                Loading predictions...
              </Text>
            </YStack>
          )}

          {/* Predictions List */}
          {!loading && sortedPredictions.length === 0 && (
            <Card padding="$4" backgroundColor="$backgroundStrong">
              <Text color="$color" textAlign="center">
                No predictions found. Try adjusting your filters or generate predictions for today's games.
              </Text>
            </Card>
          )}

          {!loading && sortedPredictions.length > 0 && (
            <YStack space="$4">
              <XStack justifyContent="space-between" alignItems="center" flexWrap="wrap" space="$2">
                <Text fontSize="$6" fontWeight="600" color="$color">
                  {sortedPredictions.length} Prediction{sortedPredictions.length !== 1 ? 's' : ''}
                </Text>
                <Button
                  size="$3"
                  onPress={allCollapsed ? expandAll : collapseAll}
                  backgroundColor={allCollapsed ? "$blue9" : "$gray5"}
                  color="white"
                >
                  {allCollapsed ? 'Expand All' : 'Collapse All'}
                </Button>
              </XStack>

              {propTypesInOrder.map((propType) => {
                const predictionsForType = groupedPredictions[propType];
                const displayName = getPropTypeDisplayName(propType);
                const isCollapsed = collapsedSections.has(propType);
                
                return (
                  <YStack key={propType} space="$3">
                    {/* Prop Type Heading - Clickable */}
                    <Pressable onPress={() => toggleSection(propType)}>
                      <Card 
                        padding="$3" 
                        backgroundColor="$backgroundStrong" 
                        borderWidth={1} 
                        borderColor="$borderColor"
                      >
                        <XStack justifyContent="space-between" alignItems="center">
                          <XStack alignItems="center" space="$2" flex={1}>
                            <Text fontSize="$4" color="$color10">
                              {isCollapsed ? '▶' : '▼'}
                            </Text>
                            <Text fontSize="$6" fontWeight="bold" color="$color">
                              {displayName}
                            </Text>
                          </XStack>
                          <Card padding="$2" backgroundColor="$blue2" borderRadius="$2">
                            <Text fontSize="$4" fontWeight="600" color="$color">
                              {predictionsForType.length}
                            </Text>
                          </Card>
                        </XStack>
                      </Card>
                    </Pressable>

                    {/* Predictions for this prop type - Conditionally rendered */}
                    {!isCollapsed && (
                      Platform.OS === 'web' ? (
                        // Web: 3-column grid layout
                        <XStack 
                          flexWrap="wrap" 
                          space="$2"
                          gap="$2"
                          alignItems="stretch"
                        >
                          {predictionsForType.map((pred) => {
                            const bestValue = Math.max(
                              pred.predicted_value_over || 0,
                              pred.predicted_value_under || 0
                            );
                            const isValueBet = bestValue >= parseFloat(minValue);
                            const valueSide = (pred.predicted_value_over || 0) > (pred.predicted_value_under || 0) ? 'over' : 'under';
                            const playerName = `${pred.player_first_name} ${pred.player_last_name}`;

                            return (
                              <YStack 
                                key={pred.id}
                                flex={1}
                                minWidth="30%"
                                space="$3"
                              >
                                <Card
                                  padding="$4"
                                  backgroundColor={isValueBet ? "$green2" : "$backgroundStrong"}
                                  borderWidth={isValueBet ? 2 : 1}
                                  borderColor={isValueBet ? "$green9" : "$borderColor"}
                                  height="100%"
                                >
                                  <YStack space="$3">
                                    {/* Header with Game Context */}
                                    <XStack justifyContent="space-between" alignItems="flex-start" flexWrap="wrap">
                                      <YStack flex={1} minWidth={200}>
                                        <Text fontSize="$6" fontWeight="bold" color="$color">
                                          {playerName}
                                          {pred.team_abbreviation && ` (${pred.team_abbreviation})`}
                                          {pred.opponent_team && ` v. ${pred.opponent_team}`}
                                        </Text>
                                        <Text fontSize="$5" color="$color" textTransform="capitalize">
                                          {pred.prop_type} {pred.line_value}
                                        </Text>
                                        
                                        {/* Game Context */}
                                        {(pred.game_label || pred.game_time || pred.opponent_team) && (
                                          <YStack marginTop="$2" space="$1">
                                            {pred.game_label && (
                                              <Text fontSize="$3" color="$color10">
                                                {pred.game_label}
                                                {pred.opponent_team && ` vs ${pred.opponent_team}`}
                                              </Text>
                                            )}
                                            {pred.game_time && formatGameTime(pred.game_time) && (
                                              <Text fontSize="$3" color="$color10">
                                                {formatGameTime(pred.game_time)}
                                              </Text>
                                            )}
                                            {pred.game_status && (
                                              <Text fontSize="$3" color="$color10" fontStyle="italic">
                                                {pred.game_status}
                                              </Text>
                                            )}
                                          </YStack>
                                        )}
                                      </YStack>
                                      {isValueBet && (
                                        <Card padding="$2" backgroundColor="$green9">
                                          <Text fontSize="$5" fontWeight="bold" color="white">
                                            VALUE BET
                                          </Text>
                                        </Card>
                                      )}
                                    </XStack>

                                    <Separator />

                                    {/* Prediction Details */}
                                    <XStack space="$2" flexWrap="wrap">
                                      <YStack minWidth={150} space="$2">
                                        <Text fontSize="$4" color="$color11" fontWeight="600">
                                          Prediction
                                        </Text>
                                        <Text color="$color">
                                          {valueSide === 'over' ? 'OVER' : 'UNDER'} {valueSide === 'over' ? formatProbability(pred.implied_prob_over) : formatProbability(pred.implied_prob_under)}
                                        </Text>
                                        <Text fontSize="$3" color="$color10">
                                          Confidence: {formatProbability(valueSide === 'over' ? pred.predicted_prob_over : pred.predicted_prob_under)}
                                        </Text>
                                      </YStack>

                                      <YStack minWidth={150} space="$2">
                                        <Text fontSize="$4" color="$color11" fontWeight="600">
                                          Market Odds
                                        </Text>
                                        {valueSide === 'over' ? (
                                          <>
                                            <Text color="$color">
                                              {formatOdds(pred.best_over_odds)} ({formatDecimalOdds(pred.best_over_odds)})
                                            </Text>
                                            {pred.over_vendor && (
                                              <Text fontSize="$3" color="$color10" marginTop="$1">
                                                {pred.over_vendor}
                                              </Text>
                                            )}
                                          </>
                                        ) : (
                                          <>
                                            <Text color="$color">
                                              {formatOdds(pred.best_under_odds)} ({formatDecimalOdds(pred.best_under_odds)})
                                            </Text>
                                            {pred.under_vendor && (
                                              <Text fontSize="$3" color="$color10" marginTop="$1">
                                                {pred.under_vendor}
                                              </Text>
                                            )}
                                          </>
                                        )}
                                      </YStack>

                                      <YStack minWidth={150} space="$2">
                                        <Text fontSize="$4" color="$color11" fontWeight="600">
                                          Value
                                        </Text>
                                        <Text 
                                          fontSize="$5" 
                                          fontWeight="bold"
                                          color={bestValue >= 0 ? "$green9" : "$red9"}
                                        >
                                          {formatValue(bestValue)}
                                        </Text>
                                        <Text fontSize="$3" color="$color10">
                                          {valueSide === 'over' 
                                            ? formatValue(pred.predicted_value_over)
                                            : formatValue(pred.predicted_value_under)
                                          } edge
                                        </Text>
                                      </YStack>
                                    </XStack>

                                    {/* Player Stats Context */}
                                    {(pred.player_avg_7 !== null || pred.player_avg_14 !== null || pred.player_avg_30 !== null || pred.player_season_avg !== null) && (
                                      <>
                                        <Separator />
                                        <XStack space="$4" flexWrap="wrap">
                                          {pred.player_avg_7 !== null && (
                                            <Text fontSize="$3" color="$color10">
                                              7-game avg: {formatNumber(pred.player_avg_7)}
                                            </Text>
                                          )}
                                          {pred.player_avg_14 !== null && (
                                            <Text fontSize="$3" color="$color10">
                                              14-game avg: {formatNumber(pred.player_avg_14)}
                                            </Text>
                                          )}
                                          {pred.player_avg_30 !== null && (
                                            <Text fontSize="$3" color="$color10">
                                              30-game avg: {formatNumber(pred.player_avg_30)}
                                            </Text>
                                          )}
                                          {pred.player_season_avg !== null && (
                                            <Text fontSize="$3" color="$color10">
                                              Season avg: {formatNumber(pred.player_season_avg)}
                                            </Text>
                                          )}
                                        </XStack>
                                      </>
                                    )}

                                    {/* Actual Outcome (if available) */}
                                    {pred.actual_result && (
                                      <>
                                        <Separator />
                                        <XStack space="$3" alignItems="center">
                                          <Text fontSize="$4" color="$color11" fontWeight="600">
                                            Result:
                                          </Text>
                                          <Text 
                                            fontSize="$5" 
                                            fontWeight="bold"
                                            color={pred.actual_result === valueSide ? "$green9" : "$red9"}
                                            textTransform="uppercase"
                                          >
                                            {pred.actual_result} {pred.actual_value !== null && `(${pred.actual_value})`}
                                          </Text>
                                          {pred.actual_result === valueSide && (
                                            <Text fontSize="$4" color="$green9">
                                              ✓ Correct
                                            </Text>
                                          )}
                                        </XStack>
                                      </>
                                    )}
                                  </YStack>
                                </Card>
                              </YStack>
                            );
                          })}
                        </XStack>
                      ) : (
                        // Mobile: Single column (unchanged)
                        <YStack space="$3">
                          {predictionsForType.map((pred) => {
                            const bestValue = Math.max(
                              pred.predicted_value_over || 0,
                              pred.predicted_value_under || 0
                            );
                            const isValueBet = bestValue >= parseFloat(minValue);
                            const valueSide = (pred.predicted_value_over || 0) > (pred.predicted_value_under || 0) ? 'over' : 'under';
                            const playerName = `${pred.player_first_name} ${pred.player_last_name}`;

                            return (
                              <Card
                                key={pred.id}
                                padding="$4"
                                backgroundColor={isValueBet ? "$green2" : "$backgroundStrong"}
                                borderWidth={isValueBet ? 2 : 1}
                                borderColor={isValueBet ? "$green9" : "$borderColor"}
                              >
                                <YStack space="$3">
                                  {/* Header with Game Context */}
                                  <XStack justifyContent="space-between" alignItems="flex-start" flexWrap="wrap">
                                    <YStack flex={1} minWidth={200}>
                                      <Text fontSize="$6" fontWeight="bold" color="$color">
                                        {playerName}
                                        {pred.team_abbreviation && ` (${pred.team_abbreviation})`}
                                        {pred.opponent_team && ` v. ${pred.opponent_team}`}
                                      </Text>
                                      <Text fontSize="$5" color="$color" textTransform="capitalize">
                                        {pred.prop_type} {pred.line_value}
                                      </Text>
                                      
                                      {/* Game Context */}
                                      {(pred.game_label || pred.game_time || pred.opponent_team) && (
                                        <YStack marginTop="$2" space="$1">
                                          {pred.game_label && (
                                            <Text fontSize="$3" color="$color10">
                                              {pred.game_label}
                                              {pred.opponent_team && ` vs ${pred.opponent_team}`}
                                            </Text>
                                          )}
                                          {pred.game_time && formatGameTime(pred.game_time) && (
                                            <Text fontSize="$3" color="$color10">
                                              {formatGameTime(pred.game_time)}
                                            </Text>
                                          )}
                                          {pred.game_status && (
                                            <Text fontSize="$3" color="$color10" fontStyle="italic">
                                              {pred.game_status}
                                            </Text>
                                          )}
                                        </YStack>
                                      )}
                                    </YStack>
                                    {isValueBet && (
                                      <Card padding="$2" backgroundColor="$green9">
                                        <Text fontSize="$5" fontWeight="bold" color="white">
                                          VALUE BET
                                        </Text>
                                      </Card>
                                    )}
                                  </XStack>

                                  <Separator />

                                  {/* Prediction Details */}
                                  <XStack>
                                    <YStack flex={1} space="$2">
                                      <Text fontSize="$4" color="$color11" fontWeight="600">
                                        Prediction
                                      </Text>
                                      <Text fontSize="$3" color="$color">
                                        {valueSide === 'over' ? 'OVER' : 'UNDER'} {valueSide === 'over' ? formatProbability(pred.implied_prob_over) : formatProbability(pred.implied_prob_under)}
                                      </Text>
                                      <Text fontSize="$2" color="$color10">
                                        Confidence: {formatProbability(valueSide === 'over' ? pred.predicted_prob_over : pred.predicted_prob_under)}
                                      </Text>
                                    </YStack>

                                    <YStack flex={1} space="$2">
                                      <Text fontSize="$4" color="$color11" fontWeight="600">
                                        Market Odds
                                      </Text>
                                      {valueSide === 'over' ? (
                                        <>
                                          <Text fontSize="$3" color="$color">
                                            {formatOdds(pred.best_over_odds)} ({formatDecimalOdds(pred.best_over_odds)})
                                          </Text>
                                          {pred.over_vendor && (
                                            <Text fontSize="$2" color="$color10" marginTop="$2">
                                              {pred.over_vendor}
                                            </Text>
                                          )}
                                        </>
                                      ) : (
                                        <>
                                          <Text fontSize="$3" color="$color">
                                            {formatOdds(pred.best_under_odds)} ({formatDecimalOdds(pred.best_under_odds)})
                                          </Text>
                                          {pred.under_vendor && (
                                            <Text fontSize="$2" color="$color10" marginTop="$2">
                                              {pred.under_vendor}
                                            </Text>
                                          )}
                                        </>
                                      )}
                                    </YStack>

                                    <YStack flex={1} space="$2">
                                      <Text fontSize="$4" color="$color11" fontWeight="600">
                                        Value
                                      </Text>
                                      <Text 
                                        fontSize="$4" 
                                        fontWeight="bold"
                                        color={bestValue >= 0 ? "$green9" : "$red9"}
                                      >
                                        {formatValue(bestValue)}
                                      </Text>
                                      <Text fontSize="$2" color="$color10">
                                        {valueSide === 'over' 
                                          ? formatValue(pred.predicted_value_over)
                                          : formatValue(pred.predicted_value_under)
                                        } edge
                                      </Text>
                                    </YStack>
                                  </XStack>

                                  {/* Player Stats Context */}
                                  {(pred.player_avg_7 !== null || pred.player_avg_14 !== null || pred.player_avg_30 !== null || pred.player_season_avg !== null) && (
                                    <>
                                      <Separator />
                                      <XStack space="$4" flexWrap="wrap">
                                        {pred.player_avg_7 !== null && (
                                          <Text fontSize="$3" color="$color10">
                                            7-game avg: {formatNumber(pred.player_avg_7)}
                                          </Text>
                                        )}
                                        {pred.player_avg_14 !== null && (
                                          <Text fontSize="$3" color="$color10">
                                            14-game avg: {formatNumber(pred.player_avg_14)}
                                          </Text>
                                        )}
                                        {pred.player_avg_30 !== null && (
                                          <Text fontSize="$3" color="$color10">
                                            30-game avg: {formatNumber(pred.player_avg_30)}
                                          </Text>
                                        )}
                                        {pred.player_season_avg !== null && (
                                          <Text fontSize="$3" color="$color10">
                                            Season avg: {formatNumber(pred.player_season_avg)}
                                          </Text>
                                        )}
                                      </XStack>
                                    </>
                                  )}

                                  {/* Actual Outcome (if available) */}
                                  {pred.actual_result && (
                                    <>
                                      <Separator />
                                      <XStack space="$3" alignItems="center">
                                        <Text fontSize="$4" color="$color11" fontWeight="600">
                                          Result:
                                        </Text>
                                        <Text 
                                          fontSize="$5" 
                                          fontWeight="bold"
                                          color={pred.actual_result === valueSide ? "$green9" : "$red9"}
                                          textTransform="uppercase"
                                        >
                                          {pred.actual_result} {pred.actual_value !== null && `(${pred.actual_value})`}
                                        </Text>
                                        {pred.actual_result === valueSide && (
                                          <Text fontSize="$4" color="$green9">
                                            ✓ Correct
                                          </Text>
                                        )}
                                      </XStack>
                                    </>
                                  )}
                                </YStack>
                              </Card>
                            );
                          })}
                        </YStack>
                      )
                    )}
                  </YStack>
                );
              })}
            </YStack>
          )}
        </YStack>
      </ScrollView>
    </>
  );
}

