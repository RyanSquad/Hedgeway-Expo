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
  player_season_avg: number | null;
  actual_result: string | null;
  actual_value: number | null;
  // Game context fields (from API)
  game_label?: string;
  game_time?: string;
  game_status?: string;
  opponent_team?: string;
}

interface ModelPerformance {
  id: string;
  model_version: string;
  prop_type: string;
  evaluation_period_start: string;
  evaluation_period_end: string;
  total_predictions: number;
  predictions_with_outcome: number;
  correct_predictions: number;
  accuracy: number | null;
  value_bets_identified: number;
  value_bets_correct: number;
  value_bet_accuracy: number | null;
  avg_predicted_prob: number | null;
  actual_hit_rate: number | null;
  calculated_at: string;
}

interface PredictionsResponse {
  predictions?: Prediction[];
  valueBets?: Prediction[];
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

type SortOption = 'value-desc' | 'value-asc' | 'confidence-desc' | 'confidence-asc' | 'prop-type' | 'player-name';

export default function PredictionsPage() {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<ModelPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [performanceLoading, setPerformanceLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [propTypeFilter, setPropTypeFilter] = useState<string>('all');
  const [minValue, setMinValue] = useState<string>('0.05');
  const [showValueBetsOnly, setShowValueBetsOnly] = useState(false);
  const [sortOption, setSortOption] = useState<SortOption>('value-desc');
  const [showPerformanceMetrics, setShowPerformanceMetrics] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dropdownRefs = {
    propType: useRef<any>(null),
    minValue: useRef<any>(null),
    sortBy: useRef<any>(null),
  };

  const fetchPredictions = useCallback(async (gameId?: number) => {
    try {
      setError(null);
      setLoading(true);

      // Fetch value bets (all games for today)
      const endpoint = showValueBetsOnly 
        ? `/api/predictions/value-bets?minValue=${minValue}&minConfidence=0.5${propTypeFilter !== 'all' ? `&propType=${propTypeFilter}` : ''}`
        : gameId 
          ? `/api/predictions/game/${gameId}${propTypeFilter !== 'all' ? `?propType=${propTypeFilter}` : ''}`
          : `/api/predictions/value-bets?minValue=0${propTypeFilter !== 'all' ? `&propType=${propTypeFilter}` : ''}`;

      const response = await get<PredictionsResponse>(endpoint);
      
      if ('predictions' in response) {
        setPredictions(response.predictions || []);
      } else if ('valueBets' in response) {
        setPredictions(response.valueBets || []);
      } else {
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
  }, [propTypeFilter, minValue, showValueBetsOnly]);

  useEffect(() => {
    fetchPredictions();
  }, [fetchPredictions]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPredictions();
  }, [fetchPredictions]);

  // Fetch performance metrics
  const fetchPerformanceMetrics = useCallback(async () => {
    try {
      setPerformanceLoading(true);
      const response = await get<{ performance: ModelPerformance[] }>('/api/predictions/performance?limit=10');
      setPerformanceMetrics(response.performance || []);
    } catch (err: any) {
      console.error('Error fetching performance metrics:', err);
      // Don't show error for performance metrics, just log it
    } finally {
      setPerformanceLoading(false);
    }
  }, []);

  useEffect(() => {
    if (showPerformanceMetrics) {
      fetchPerformanceMetrics();
    }
  }, [showPerformanceMetrics, fetchPerformanceMetrics]);

  // Sort predictions based on selected option
  const sortedPredictions = useMemo(() => {
    const sorted = [...predictions];

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
        return sorted.sort((a, b) => b.confidence_score - a.confidence_score);

      case 'confidence-asc':
        return sorted.sort((a, b) => a.confidence_score - b.confidence_score);

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

      default:
        return sorted;
    }
  }, [predictions, sortOption]);

  // Format game time for display
  const formatGameTime = useCallback((timeString?: string): string | null => {
    if (!timeString) return null;
    try {
      const date = new Date(timeString);
      if (isNaN(date.getTime())) return null;
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'America/New_York',
      }) + ' EST';
    } catch {
      return null;
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
        return () => document.removeEventListener('mousedown', handleClickOutside);
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
    { value: '0', label: '0%' },
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

          {/* Performance Metrics Toggle */}
          <Card padding="$3" backgroundColor="$backgroundStrong">
            <XStack justifyContent="space-between" alignItems="center">
              <Text fontSize="$5" fontWeight="600" color="$color">
                Model Performance
              </Text>
              <Button
                onPress={() => setShowPerformanceMetrics(!showPerformanceMetrics)}
                backgroundColor={showPerformanceMetrics ? "$blue9" : "$gray5"}
                color="white"
                size="$3"
              >
                {showPerformanceMetrics ? 'Hide Metrics' : 'Show Metrics'}
              </Button>
            </XStack>
          </Card>

          {/* Performance Metrics Display */}
          {showPerformanceMetrics && (
            <Card padding="$4" backgroundColor="$backgroundStrong">
              {performanceLoading ? (
                <YStack alignItems="center" padding="$4">
                  <Spinner size="small" color="$blue9" />
                </YStack>
              ) : performanceMetrics.length === 0 ? (
                <Text color="$color10" textAlign="center">
                  No performance metrics available yet. Metrics are calculated after predictions have outcomes.
                </Text>
              ) : (
                <YStack space="$3">
                  {performanceMetrics.map((metric) => (
                    <Card key={metric.id} padding="$3" backgroundColor="$background">
                      <YStack space="$2">
                        <XStack justifyContent="space-between" alignItems="center">
                          <Text fontSize="$5" fontWeight="bold" color="$color">
                            {metric.prop_type.charAt(0).toUpperCase() + metric.prop_type.slice(1)} - {metric.model_version}
                          </Text>
                          <Text fontSize="$3" color="$color10">
                            {new Date(metric.evaluation_period_start).toLocaleDateString()} - {new Date(metric.evaluation_period_end).toLocaleDateString()}
                          </Text>
                        </XStack>
                        <Separator />
                        <XStack space="$4" flexWrap="wrap">
                          <YStack minWidth={120}>
                            <Text fontSize="$3" color="$color10">Accuracy</Text>
                            <Text fontSize="$5" fontWeight="600" color="$color">
                              {metric.accuracy !== null ? `${(metric.accuracy * 100).toFixed(1)}%` : 'N/A'}
                            </Text>
                            <Text fontSize="$2" color="$color10">
                              {metric.correct_predictions} / {metric.predictions_with_outcome}
                            </Text>
                          </YStack>
                          <YStack minWidth={120}>
                            <Text fontSize="$3" color="$color10">Value Bet Accuracy</Text>
                            <Text fontSize="$5" fontWeight="600" color="$color">
                              {metric.value_bet_accuracy !== null ? `${(metric.value_bet_accuracy * 100).toFixed(1)}%` : 'N/A'}
                            </Text>
                            <Text fontSize="$2" color="$color10">
                              {metric.value_bets_correct} / {metric.value_bets_identified}
                            </Text>
                          </YStack>
                          <YStack minWidth={120}>
                            <Text fontSize="$3" color="$color10">Total Predictions</Text>
                            <Text fontSize="$5" fontWeight="600" color="$color">
                              {metric.total_predictions}
                            </Text>
                          </YStack>
                          {metric.avg_predicted_prob !== null && metric.actual_hit_rate !== null && (
                            <YStack minWidth={150}>
                              <Text fontSize="$3" color="$color10">Calibration</Text>
                              <Text fontSize="$5" fontWeight="600" color="$color">
                                Pred: {(metric.avg_predicted_prob * 100).toFixed(1)}%
                              </Text>
                              <Text fontSize="$3" color="$color10">
                                Actual: {(metric.actual_hit_rate * 100).toFixed(1)}%
                              </Text>
                            </YStack>
                          )}
                        </XStack>
                      </YStack>
                    </Card>
                  ))}
                </YStack>
              )}
            </Card>
          )}

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
          <Card padding="$3" backgroundColor="$backgroundStrong">
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

                <Button
                  onPress={() => setShowValueBetsOnly(!showValueBetsOnly)}
                  backgroundColor={showValueBetsOnly ? "$blue9" : "$gray5"}
                  color="white"
                >
                  {showValueBetsOnly ? 'Show All' : 'Value Bets Only'}
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
            <YStack space="$3">
              <Text fontSize="$6" fontWeight="600" color="$color">
                {sortedPredictions.length} Prediction{sortedPredictions.length !== 1 ? 's' : ''}
              </Text>

              {sortedPredictions.map((pred) => {
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
                      <XStack space="$4" flexWrap="wrap">
                        <YStack minWidth={150} space="$2">
                          <Text fontSize="$4" color="$color11" fontWeight="600">
                            Prediction
                          </Text>
                          <Text color="$color">
                            {valueSide === 'over' ? 'OVER' : 'UNDER'}: {formatProbability(valueSide === 'over' ? pred.predicted_prob_over : pred.predicted_prob_under)}
                          </Text>
                          <Text fontSize="$3" color="$color10">
                            Confidence: {formatProbability(pred.confidence_score)}
                          </Text>
                        </YStack>

                        <YStack minWidth={150} space="$2">
                          <Text fontSize="$4" color="$color11" fontWeight="600">
                            Market Odds
                          </Text>
                          {valueSide === 'over' ? (
                            <>
                              <Text color="$color">
                                OVER: {formatOdds(pred.best_over_odds)} ({formatProbability(pred.implied_prob_over)})
                              </Text>
                              {pred.over_vendor && (
                                <Text fontSize="$3" color="$color10">
                                  {pred.over_vendor}
                                </Text>
                              )}
                            </>
                          ) : (
                            <>
                              <Text color="$color">
                                UNDER: {formatOdds(pred.best_under_odds)} ({formatProbability(pred.implied_prob_under)})
                              </Text>
                              {pred.under_vendor && (
                                <Text fontSize="$3" color="$color10">
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
                      {(pred.player_avg_7 !== null || pred.player_season_avg !== null) && (
                        <>
                          <Separator />
                          <XStack space="$4" flexWrap="wrap">
                            {pred.player_avg_7 !== null && (
                              <Text fontSize="$3" color="$color10">
                                7-game avg: {pred.player_avg_7.toFixed(1)}
                              </Text>
                            )}
                            {pred.player_season_avg !== null && (
                              <Text fontSize="$3" color="$color10">
                                Season avg: {pred.player_season_avg.toFixed(1)}
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
          )}
        </YStack>
      </ScrollView>
    </>
  );
}

