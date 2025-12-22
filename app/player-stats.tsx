import { useEffect, useState, useCallback, useMemo } from 'react';
import { YStack, XStack, Text, ScrollView, Spinner, Card, Separator, Input, Label } from 'tamagui';
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
  avg_7_points: number | null;
  avg_7_assists: number | null;
  avg_7_rebounds: number | null;
  avg_14_points: number | null;
  avg_14_assists: number | null;
  avg_14_rebounds: number | null;
  avg_30_points: number | null;
  avg_30_assists: number | null;
  avg_30_rebounds: number | null;
  season_avg_points: number | null;
  season_avg_assists: number | null;
  season_avg_rebounds: number | null;
  season_games_played: number;
  games_played_7: number;
  games_played_14: number;
  games_played_30: number;
  last_updated: string;
}

export default function PlayerStatsPage() {
  const [playerStats, setPlayerStats] = useState<PlayerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchPlayerStats = useCallback(async () => {
    try {
      setError(null);
      const response = await get<PlayerStats[]>('/api/player-stats');

      if (response.error) {
        setError(response.error);
        setPlayerStats([]);
      } else if (response.data) {
        setPlayerStats(response.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch player stats');
      setPlayerStats([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPlayerStats();
  }, [fetchPlayerStats]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPlayerStats();
  }, [fetchPlayerStats]);

  // Filter players by search query
  const filteredStats = useMemo(() => {
    if (!searchQuery.trim()) {
      return playerStats;
    }

    const query = searchQuery.toLowerCase().trim();
    return playerStats.filter((stat) => {
      const fullName = `${stat.player_first_name} ${stat.player_last_name}`.toLowerCase();
      const firstName = stat.player_first_name?.toLowerCase() || '';
      const lastName = stat.player_last_name?.toLowerCase() || '';
      const team = stat.team_abbreviation?.toLowerCase() || '';
      const position = stat.player_position?.toLowerCase() || '';

      return (
        fullName.includes(query) ||
        firstName.includes(query) ||
        lastName.includes(query) ||
        team.includes(query) ||
        position.includes(query)
      );
    });
  }, [playerStats, searchQuery]);

  const formatStat = (value: number | null): string => {
    if (value === null || value === undefined) return 'N/A';
    return value.toFixed(1);
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
              <Separator />
              
              <YStack space="$2">
                <Label fontSize="$4" color="$colorPress">
                  Search Players
                </Label>
                <Input
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search by name, team, or position..."
                  size="$4"
                  backgroundColor="$background"
                />
                <Text fontSize="$2" color="$colorPress">
                  {filteredStats.length} of {playerStats.length} players
                </Text>
              </YStack>
            </YStack>
          </Card>

          {/* Stats Table */}
          {filteredStats.length === 0 ? (
            <Card elevate padding="$4" backgroundColor="$backgroundStrong">
              <Text fontSize="$4" color="$colorPress" textAlign="center">
                {searchQuery ? 'No players found matching your search.' : 'No player stats available.'}
              </Text>
            </Card>
          ) : (
            <Card elevate padding="$4" backgroundColor="$backgroundStrong">
              <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                <YStack space="$2" minWidth={1200}>
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
                      Avg 7 Pts
                    </Text>
                    <Text width={80} fontSize="$3" fontWeight="bold" color="$color" textAlign="right">
                      Avg 7 Ast
                    </Text>
                    <Text width={80} fontSize="$3" fontWeight="bold" color="$color" textAlign="right">
                      Avg 7 Reb
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
                      Avg 30 Pts
                    </Text>
                    <Text width={80} fontSize="$3" fontWeight="bold" color="$color" textAlign="right">
                      Avg 30 Ast
                    </Text>
                    <Text width={80} fontSize="$3" fontWeight="bold" color="$color" textAlign="right">
                      Avg 30 Reb
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
                      Games
                    </Text>
                  </XStack>

                  {/* Table Rows */}
                  {filteredStats.map((stat, index) => (
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
                        {formatStat(stat.avg_7_points)}
                      </Text>
                      <Text width={80} fontSize="$3" color="$color" textAlign="right">
                        {formatStat(stat.avg_7_assists)}
                      </Text>
                      <Text width={80} fontSize="$3" color="$color" textAlign="right">
                        {formatStat(stat.avg_7_rebounds)}
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
                        {formatStat(stat.avg_30_points)}
                      </Text>
                      <Text width={80} fontSize="$3" color="$color" textAlign="right">
                        {formatStat(stat.avg_30_assists)}
                      </Text>
                      <Text width={80} fontSize="$3" color="$color" textAlign="right">
                        {formatStat(stat.avg_30_rebounds)}
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
                        {stat.season_games_played}
                      </Text>
                    </XStack>
                  ))}
                </YStack>
              </ScrollView>
            </Card>
          )}
        </YStack>
      </ScrollView>

      <StatusBar style="auto" />
    </YStack>
  );
}

