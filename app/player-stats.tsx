/**
 * Player Stats Page with Pagination
 * 
 * Features:
 * - Displays 50 players per page
 * - Search functionality searches ALL players in the season (backend-side)
 * - Pagination controls for navigating through pages
 * 
 * Backend API Requirements:
 * The backend endpoint GET /api/player-stats should support:
 * - Query params: season (required), page (optional), limit (optional), search (optional)
 * - Response format: { data: PlayerStats[], pagination: PaginationInfo }
 * - When search is provided, return all matching players (not paginated)
 * - When page/limit provided, return paginated results with pagination metadata
 * 
 * See IMPLEMENTATION_GUIDES/PLAYER_STATS_PAGINATION_IMPLEMENTATION.md for full details
 */

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { YStack, XStack, Text, ScrollView, Spinner, Card, Separator, Input, Label, Button } from 'tamagui';
import { StatusBar } from 'expo-status-bar';
import { RefreshControl } from 'react-native';
import { get } from '../lib/api';
import { NavigationBar } from '../components/NavigationBar';

interface PlayerStats {
  id: string;
  player_id: number;
  season: number;
  player_first_name: string;
  player_last_name: string;
  player_position: string | null;
  team_abbreviation: string | null;
  last_game_date: string | null;
  last_game_points: number | null;
  last_game_assists: number | null;
  last_game_rebounds: number | null;
  last_game_steals: number | null;
  last_game_blocks: number | null;
  avg_7_points: number | null;
  avg_7_assists: number | null;
  avg_7_rebounds: number | null;
  avg_7_steals: number | null;
  avg_7_blocks: number | null;
  avg_14_points: number | null;
  avg_14_assists: number | null;
  avg_14_rebounds: number | null;
  avg_14_steals: number | null;
  avg_14_blocks: number | null;
  avg_30_points: number | null;
  avg_30_assists: number | null;
  avg_30_rebounds: number | null;
  avg_30_steals: number | null;
  avg_30_blocks: number | null;
  season_avg_points: number | null;
  season_avg_assists: number | null;
  season_avg_rebounds: number | null;
  season_avg_steals: number | null;
  season_avg_blocks: number | null;
  season_games_played: number;
  games_played_7: number;
  games_played_14: number;
  games_played_30: number;
  last_updated: string;
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalPlayers: number;
  limit: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

interface PlayerStatsResponse {
  data: PlayerStats[];
  pagination: PaginationInfo;
}

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

export default function PlayerStatsPage() {
  const [playerStats, setPlayerStats] = useState<PlayerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [paginationInfo, setPaginationInfo] = useState<PaginationInfo | null>(null);
  const [isSearchMode, setIsSearchMode] = useState(false);
  
  const PLAYERS_PER_PAGE = 50;
  const searchInputRef = useRef<string>('');

  const fetchPlayerStats = useCallback(async (page: number = 1, search: string = '') => {
    try {
      setError(null);
      setLoading(true);
      const currentSeason = getCurrentSeason();
      
      // Build endpoint with pagination or search
      let endpoint = `/api/player-stats?season=${currentSeason}`;
      
      if (search.trim()) {
        // Search mode: fetch all matching players
        endpoint += `&search=${encodeURIComponent(search.trim())}`;
        setIsSearchMode(true);
      } else {
        // Pagination mode: fetch specific page
        endpoint += `&page=${page}&limit=${PLAYERS_PER_PAGE}`;
        setIsSearchMode(false);
      }
      
      console.log(`[PlayerStats] Fetching: ${endpoint}`);
      
      // Use any type to handle both legacy array and new paginated response
      const response = await get<PlayerStatsResponse | PlayerStats[]>(endpoint);
      
      if (response.error) {
        const errorMsg = response.error.toLowerCase();
        if (errorMsg.includes('not found') || errorMsg.includes('404') || errorMsg.includes('route')) {
          setError(
            'API endpoint not found. The backend route GET /api/player-stats needs to be implemented. ' +
            'Please check the backend implementation or contact an administrator.'
          );
        } else {
          setError(response.error);
        }
        setPlayerStats([]);
        setPaginationInfo(null);
      } else if (response.data) {
        // Handle both new paginated response and legacy array response
        let players: PlayerStats[] = [];
        let pagination: PaginationInfo | null = null;
        
        if (Array.isArray(response.data)) {
          // Legacy response format (array directly)
          players = response.data;
        } else if ('data' in response.data && Array.isArray(response.data.data)) {
          // New paginated response format: { data: PlayerStats[], pagination: PaginationInfo }
          players = response.data.data;
          if (response.data.pagination && 'currentPage' in response.data.pagination) {
            pagination = response.data.pagination as PaginationInfo;
          }
        } else {
          players = [];
        }
        
        setPlayerStats(players);
        setPaginationInfo(pagination);
        
        if (players.length === 0) {
          setError(null); // Clear error, just show empty state message
        }
      } else {
        setError('No data received from server');
        setPlayerStats([]);
        setPaginationInfo(null);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch player stats';
      console.error('[PlayerStats] Error fetching stats:', err);
      setError(errorMsg);
      setPlayerStats([]);
      setPaginationInfo(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [PLAYERS_PER_PAGE]);

  // Memoize player count text to prevent recalculation on every render
  const playerCountText = useMemo(() => {
    if (isSearchMode) {
      return `${playerStats.length} player${playerStats.length !== 1 ? 's' : ''} found`;
    } else if (paginationInfo) {
      return `Showing ${((currentPage - 1) * PLAYERS_PER_PAGE) + 1}-${Math.min(currentPage * PLAYERS_PER_PAGE, paginationInfo.totalPlayers)} of ${paginationInfo.totalPlayers} players`;
    } else {
      return `${playerStats.length} players`;
    }
  }, [isSearchMode, playerStats.length, paginationInfo, currentPage, PLAYERS_PER_PAGE]);

  // Handle input change - only update ref, no state update to prevent re-renders
  // State will be synced only when search is triggered or input is cleared
  const handleInputChange = useCallback((text: string) => {
    searchInputRef.current = text;
    // Don't update state - this prevents re-renders and input delay
    // The input will still work because we're using defaultValue with key
  }, []);

  // Handle manual search trigger (button click or Enter key)
  const handleSearch = useCallback(() => {
    const trimmedQuery = searchInputRef.current.trim();
    
    // Sync ref value to state for display consistency
    setSearchQuery(searchInputRef.current);
    
    if (trimmedQuery) {
      // Search mode: fetch all matching players
      setCurrentPage(1); // Reset to first page when searching
      fetchPlayerStats(1, trimmedQuery);
    } else {
      // Clear search: return to pagination mode
      setCurrentPage(1);
      searchInputRef.current = '';
      setSearchQuery('');
      fetchPlayerStats(1, '');
    }
  }, [fetchPlayerStats]);

  // Initial load
  useEffect(() => {
    fetchPlayerStats(currentPage, searchQuery);
  }, []); // Only run on mount

  // Handle page changes (only in pagination mode)
  useEffect(() => {
    if (!isSearchMode) {
      fetchPlayerStats(currentPage, '');
    }
  }, [currentPage, isSearchMode, fetchPlayerStats]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPlayerStats(currentPage, searchQuery);
  }, [fetchPlayerStats, currentPage, searchQuery]);

  const formatStat = (value: number | string | null | undefined): string => {
    if (value === null || value === undefined) return 'N/A';
    
    // Convert to number if it's a string (PostgreSQL DECIMAL returns as string)
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    
    // Check if conversion resulted in a valid number
    if (isNaN(numValue)) return 'N/A';
    
    return numValue.toFixed(1);
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateString;
    }
  };

  // Pagination Controls Component
  const PaginationControls = () => {
    if (!paginationInfo || isSearchMode) {
      return null; // Don't show pagination in search mode
    }
    
    const { currentPage: page, totalPages, hasNextPage, hasPreviousPage, totalPlayers } = paginationInfo;
    
    const handlePageChange = (newPage: number) => {
      if (newPage >= 1 && newPage <= totalPages) {
        setCurrentPage(newPage);
      }
    };
    
    // Calculate page numbers to display
    const getPageNumbers = () => {
      const pages: (number | string)[] = [];
      const maxVisible = 5;
      
      if (totalPages <= maxVisible) {
        // Show all pages if total is small
        for (let i = 1; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        // Show first page
        pages.push(1);
        
        if (page > 3) {
          pages.push('...');
        }
        
        // Show pages around current page
        const start = Math.max(2, page - 1);
        const end = Math.min(totalPages - 1, page + 1);
        
        for (let i = start; i <= end; i++) {
          pages.push(i);
        }
        
        if (page < totalPages - 2) {
          pages.push('...');
        }
        
        // Show last page
        pages.push(totalPages);
      }
      
      return pages;
    };
    
    return (
      <Card elevate padding="$3" backgroundColor="$backgroundStrong" marginTop="$4">
        <XStack space="$3" alignItems="center" justifyContent="center" flexWrap="wrap">
          <Button
            size="$3"
            disabled={!hasPreviousPage}
            onPress={() => handlePageChange(page - 1)}
            opacity={hasPreviousPage ? 1 : 0.5}
          >
            Previous
          </Button>
          
          {getPageNumbers().map((pageNum, index) => {
            if (pageNum === '...') {
              return (
                <Text key={`ellipsis-${index}`} fontSize="$4" color="$colorPress" paddingHorizontal="$2">
                  ...
                </Text>
              );
            }
            
            const isCurrentPage = pageNum === page;
            
            return (
              <Button
                key={pageNum}
                size="$3"
                variant="outlined"
                backgroundColor={isCurrentPage ? '$blue5' : 'transparent'}
                onPress={() => handlePageChange(pageNum as number)}
              >
                <Text color={isCurrentPage ? '$color' : '$colorPress'}>
                  {pageNum}
                </Text>
              </Button>
            );
          })}
          
          <Button
            size="$3"
            disabled={!hasNextPage}
            onPress={() => handlePageChange(page + 1)}
            opacity={hasNextPage ? 1 : 0.5}
          >
            Next
          </Button>
        </XStack>
        
        <Text fontSize="$2" color="$colorPress" textAlign="center" marginTop="$2">
          Page {page} of {totalPages} ({totalPlayers} total players)
        </Text>
      </Card>
    );
  };

  if (loading) {
    return (
      <YStack flex={1} backgroundColor="$background" alignItems="center" justifyContent="center">
        <Spinner size="large" color="$color" />
        <Text marginTop="$4" fontSize="$4" color="$color">
          Loading player stats...
        </Text>
        <StatusBar style="light" />
      </YStack>
    );
  }

  return (
    <YStack flex={1} backgroundColor="$background">
      <NavigationBar />

      <ScrollView
        flex={1}
        padding="$4"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <YStack space="$4">
          {error && (
            <Card backgroundColor="$red2" padding="$3" borderRadius="$3">
              <Text color="$red11" fontSize="$3" textAlign="center">
                {error}
              </Text>
            </Card>
          )}

          {/* Header and Search */}
          <Card elevate padding="$4" backgroundColor="$backgroundStrong">
            <YStack space="$3">
              <Text fontSize="$7" fontWeight="bold" color="$color">
                Player Statistics
              </Text>
              <Text fontSize="$3" color="$colorPress">
                Season {getCurrentSeason()} (Current Season)
              </Text>
              <Separator />
              
              <YStack space="$2">
                <Label fontSize="$4" color="$colorPress">
                  Search Players
                </Label>
                <XStack space="$2" alignItems="center">
                  <Input
                    key={`search-input-${searchQuery === '' ? 'empty' : 'filled'}`}
                    flex={1}
                    defaultValue={searchQuery}
                    onChangeText={handleInputChange}
                    onSubmitEditing={handleSearch}
                    returnKeyType="search"
                    placeholder="Search by name, team, or position..."
                    size="$4"
                    backgroundColor="$background"
                  />
                  <Button
                    size="$4"
                    onPress={handleSearch}
                    backgroundColor="$blue9"
                    color="white"
                    fontWeight="bold"
                  >
                    Search
                  </Button>
                </XStack>
                <Text fontSize="$2" color="$colorPress">
                  {playerCountText}
                </Text>
              </YStack>
            </YStack>
          </Card>

          {/* Stats Table */}
          {playerStats.length === 0 && !error ? (
            <Card elevate padding="$4" backgroundColor="$backgroundStrong">
              <YStack space="$2" alignItems="center">
                <Text fontSize="$4" color="$colorPress" textAlign="center">
                  {searchQuery 
                    ? 'No players found matching your search.' 
                    : `No player stats available for season ${getCurrentSeason()}.`}
                </Text>
                {!searchQuery && (
                  <Text fontSize="$3" color="$yellow11" textAlign="center" marginTop="$2">
                    💡 Use the Admin Panel to populate player stats for this season.
                  </Text>
                )}
              </YStack>
            </Card>
          ) : playerStats.length > 0 ? (
            <Card elevate padding="$4" backgroundColor="$backgroundStrong">
              <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                <YStack space="$2" minWidth={1600}>
                  {/* Table Header */}
                  <XStack
                    paddingVertical="$2"
                    paddingHorizontal="$3"
                    backgroundColor="$blue3"
                    borderRadius="$2"
                    borderBottomWidth={1}
                    borderBottomColor="$borderColor"
                  >
                    <Text width={180} fontSize="$3" fontWeight="bold" color="$color">
                      Player
                    </Text>
                    <Text width={60} fontSize="$3" fontWeight="bold" color="$color">
                      Team
                    </Text>
                    <Text width={60} fontSize="$3" fontWeight="bold" color="$color">
                      Pos
                    </Text>
                    <Text width={100} fontSize="$3" fontWeight="bold" color="$color">
                      Last Game
                    </Text>
                    <Text width={80} fontSize="$3" fontWeight="bold" color="$color" textAlign="right">
                      Last Pts
                    </Text>
                    <Text width={80} fontSize="$3" fontWeight="bold" color="$color" textAlign="right">
                      Last Ast
                    </Text>
                    <Text width={80} fontSize="$3" fontWeight="bold" color="$color" textAlign="right">
                      Last Reb
                    </Text>
                    <Text width={80} fontSize="$3" fontWeight="bold" color="$color" textAlign="right">
                      Last Stl
                    </Text>
                    <Text width={80} fontSize="$3" fontWeight="bold" color="$color" textAlign="right">
                      Last Blk
                    </Text>
                    <Text width={80} fontSize="$3" fontWeight="bold" color="$color" textAlign="right">
                      Avg 7 Pts
                    </Text>
                    <Text width={80} fontSize="$3" fontWeight="bold" color="$color" textAlign="right">
                      Avg 7 Ast
                    </Text>
                    <Text width={80} fontSize="$3" fontWeight="bold" color="$color" textAlign="right">
                      Avg 7 Reb
                    </Text>
                    <Text width={80} fontSize="$3" fontWeight="bold" color="$color" textAlign="right">
                      Avg 7 Stl
                    </Text>
                    <Text width={80} fontSize="$3" fontWeight="bold" color="$color" textAlign="right">
                      Avg 7 Blk
                    </Text>
                    <Text width={80} fontSize="$3" fontWeight="bold" color="$color" textAlign="right">
                      Avg 14 Pts
                    </Text>
                    <Text width={80} fontSize="$3" fontWeight="bold" color="$color" textAlign="right">
                      Avg 14 Ast
                    </Text>
                    <Text width={80} fontSize="$3" fontWeight="bold" color="$color" textAlign="right">
                      Avg 14 Reb
                    </Text>
                    <Text width={80} fontSize="$3" fontWeight="bold" color="$color" textAlign="right">
                      Avg 14 Stl
                    </Text>
                    <Text width={80} fontSize="$3" fontWeight="bold" color="$color" textAlign="right">
                      Avg 14 Blk
                    </Text>
                    <Text width={80} fontSize="$3" fontWeight="bold" color="$color" textAlign="right">
                      Avg 30 Pts
                    </Text>
                    <Text width={80} fontSize="$3" fontWeight="bold" color="$color" textAlign="right">
                      Avg 30 Ast
                    </Text>
                    <Text width={80} fontSize="$3" fontWeight="bold" color="$color" textAlign="right">
                      Avg 30 Reb
                    </Text>
                    <Text width={80} fontSize="$3" fontWeight="bold" color="$color" textAlign="right">
                      Avg 30 Stl
                    </Text>
                    <Text width={80} fontSize="$3" fontWeight="bold" color="$color" textAlign="right">
                      Avg 30 Blk
                    </Text>
                    <Text width={80} fontSize="$3" fontWeight="bold" color="$color" textAlign="right">
                      Season Pts
                    </Text>
                    <Text width={80} fontSize="$3" fontWeight="bold" color="$color" textAlign="right">
                      Season Ast
                    </Text>
                    <Text width={80} fontSize="$3" fontWeight="bold" color="$color" textAlign="right">
                      Season Reb
                    </Text>
                    <Text width={80} fontSize="$3" fontWeight="bold" color="$color" textAlign="right">
                      Season Stl
                    </Text>
                    <Text width={80} fontSize="$3" fontWeight="bold" color="$color" textAlign="right">
                      Season Blk
                    </Text>
                    <Text width={80} fontSize="$3" fontWeight="bold" color="$color" textAlign="right">
                      Games
                    </Text>
                  </XStack>

                  {/* Table Rows */}
                  {playerStats.map((stat, index) => (
                    <XStack
                      key={stat.id}
                      paddingVertical="$3"
                      paddingHorizontal="$3"
                      backgroundColor={index % 2 === 0 ? '$background' : '$backgroundStrong'}
                      borderBottomWidth={1}
                      borderBottomColor="$borderColor"
                      alignItems="center"
                    >
                      <Text width={180} fontSize="$3" color="$color">
                        {stat.player_first_name} {stat.player_last_name}
                      </Text>
                      <Text width={60} fontSize="$3" color="$color">
                        {stat.team_abbreviation || 'N/A'}
                      </Text>
                      <Text width={60} fontSize="$3" color="$color">
                        {stat.player_position || 'N/A'}
                      </Text>
                      <Text width={100} fontSize="$2" color="$colorPress">
                        {formatDate(stat.last_game_date)}
                      </Text>
                      <Text width={80} fontSize="$3" color="$color" textAlign="right">
                        {formatStat(stat.last_game_points)}
                      </Text>
                      <Text width={80} fontSize="$3" color="$color" textAlign="right">
                        {formatStat(stat.last_game_assists)}
                      </Text>
                      <Text width={80} fontSize="$3" color="$color" textAlign="right">
                        {formatStat(stat.last_game_rebounds)}
                      </Text>
                      <Text width={80} fontSize="$3" color="$color" textAlign="right">
                        {formatStat(stat.last_game_steals)}
                      </Text>
                      <Text width={80} fontSize="$3" color="$color" textAlign="right">
                        {formatStat(stat.last_game_blocks)}
                      </Text>
                      <Text width={80} fontSize="$3" color="$color" textAlign="right">
                        {formatStat(stat.avg_7_points)}
                      </Text>
                      <Text width={80} fontSize="$3" color="$color" textAlign="right">
                        {formatStat(stat.avg_7_assists)}
                      </Text>
                      <Text width={80} fontSize="$3" color="$color" textAlign="right">
                        {formatStat(stat.avg_7_rebounds)}
                      </Text>
                      <Text width={80} fontSize="$3" color="$color" textAlign="right">
                        {formatStat(stat.avg_7_steals)}
                      </Text>
                      <Text width={80} fontSize="$3" color="$color" textAlign="right">
                        {formatStat(stat.avg_7_blocks)}
                      </Text>
                      <Text width={80} fontSize="$3" color="$color" textAlign="right">
                        {formatStat(stat.avg_14_points)}
                      </Text>
                      <Text width={80} fontSize="$3" color="$color" textAlign="right">
                        {formatStat(stat.avg_14_assists)}
                      </Text>
                      <Text width={80} fontSize="$3" color="$color" textAlign="right">
                        {formatStat(stat.avg_14_rebounds)}
                      </Text>
                      <Text width={80} fontSize="$3" color="$color" textAlign="right">
                        {formatStat(stat.avg_14_steals)}
                      </Text>
                      <Text width={80} fontSize="$3" color="$color" textAlign="right">
                        {formatStat(stat.avg_14_blocks)}
                      </Text>
                      <Text width={80} fontSize="$3" color="$color" textAlign="right">
                        {formatStat(stat.avg_30_points)}
                      </Text>
                      <Text width={80} fontSize="$3" color="$color" textAlign="right">
                        {formatStat(stat.avg_30_assists)}
                      </Text>
                      <Text width={80} fontSize="$3" color="$color" textAlign="right">
                        {formatStat(stat.avg_30_rebounds)}
                      </Text>
                      <Text width={80} fontSize="$3" color="$color" textAlign="right">
                        {formatStat(stat.avg_30_steals)}
                      </Text>
                      <Text width={80} fontSize="$3" color="$color" textAlign="right">
                        {formatStat(stat.avg_30_blocks)}
                      </Text>
                      <Text width={80} fontSize="$3" color="$color" textAlign="right">
                        {formatStat(stat.season_avg_points)}
                      </Text>
                      <Text width={80} fontSize="$3" color="$color" textAlign="right">
                        {formatStat(stat.season_avg_assists)}
                      </Text>
                      <Text width={80} fontSize="$3" color="$color" textAlign="right">
                        {formatStat(stat.season_avg_rebounds)}
                      </Text>
                      <Text width={80} fontSize="$3" color="$color" textAlign="right">
                        {formatStat(stat.season_avg_steals)}
                      </Text>
                      <Text width={80} fontSize="$3" color="$color" textAlign="right">
                        {formatStat(stat.season_avg_blocks)}
                      </Text>
                      <Text width={80} fontSize="$3" color="$color" textAlign="right">
                        {stat.season_games_played}
                      </Text>
                    </XStack>
                  ))}
                </YStack>
              </ScrollView>
            </Card>
          ) : null}

          {/* Pagination Controls */}
          {!isSearchMode && <PaginationControls />}
        </YStack>
      </ScrollView>

      <StatusBar style="auto" />
    </YStack>
  );
}

