# Player Stats Table Implementation Guide

This guide provides step-by-step instructions for populating a database table with comprehensive player statistics, including:
1. **All Active Players**: Every player currently active in the NBA
2. **Last Game Stats**: Most recent game performance for each player
3. **Rolling Averages**: Average statistics for last 7, 14, and 30 games
4. **Season Totals**: Overall season statistics for each player

This implementation will help track player performance over time and enable data-driven analysis for prop betting decisions.

## Overview

**Current State:**
- No player statistics are stored in the database
- Player data is fetched on-demand from BallDontLie API
- No historical performance tracking
- No aggregated statistics available

**Target State:**
- Database table containing comprehensive player statistics
- Last game performance for each active player
- Rolling averages for multiple time windows (7, 14, 30 games)
- Season totals and averages for all players
- Automated updates to keep data current
- Efficient querying of player performance data

---

## Phase 1: Database Schema

### Step 1.1: Design the Player Stats Table

Create a table schema that stores player statistics with all required fields:

```sql
-- Player Statistics Table
CREATE TABLE IF NOT EXISTS player_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id INTEGER NOT NULL,                    -- BallDontLie player ID
  season INTEGER NOT NULL,                       -- Season year (e.g., 2024)
  
  -- Player Information (denormalized for quick access)
  player_first_name VARCHAR(100),
  player_last_name VARCHAR(100),
  player_position VARCHAR(10),                   -- e.g., "G", "F", "C", "G-F"
  player_height_feet INTEGER,
  player_height_inches INTEGER,
  player_weight_pounds INTEGER,
  team_id INTEGER,                               -- Current team ID
  team_abbreviation VARCHAR(10),                 -- e.g., "LAL", "BOS"
  
  -- Last Game Statistics
  last_game_id INTEGER,                          -- Game ID of most recent game
  last_game_date DATE,
  last_game_minutes INTEGER,
  last_game_points INTEGER,
  last_game_assists INTEGER,
  last_game_rebounds INTEGER,
  last_game_steals INTEGER,
  last_game_blocks INTEGER,
  last_game_turnovers INTEGER,
  last_game_fg_attempted INTEGER,
  last_game_fg_made INTEGER,
  last_game_fg3_attempted INTEGER,
  last_game_fg3_made INTEGER,
  last_game_ft_attempted INTEGER,
  last_game_ft_made INTEGER,
  
  -- Last 7 Games Averages
  avg_7_minutes DECIMAL(5,2),
  avg_7_points DECIMAL(5,2),
  avg_7_assists DECIMAL(5,2),
  avg_7_rebounds DECIMAL(5,2),
  avg_7_steals DECIMAL(5,2),
  avg_7_blocks DECIMAL(5,2),
  avg_7_turnovers DECIMAL(5,2),
  avg_7_fg_attempted DECIMAL(5,2),
  avg_7_fg_made DECIMAL(5,2),
  avg_7_fg3_attempted DECIMAL(5,2),
  avg_7_fg3_made DECIMAL(5,2),
  avg_7_ft_attempted DECIMAL(5,2),
  avg_7_ft_made DECIMAL(5,2),
  games_played_7 INTEGER DEFAULT 0,              -- Actual number of games in last 7
  
  -- Last 14 Games Averages
  avg_14_minutes DECIMAL(5,2),
  avg_14_points DECIMAL(5,2),
  avg_14_assists DECIMAL(5,2),
  avg_14_rebounds DECIMAL(5,2),
  avg_14_steals DECIMAL(5,2),
  avg_14_blocks DECIMAL(5,2),
  avg_14_turnovers DECIMAL(5,2),
  avg_14_fg_attempted DECIMAL(5,2),
  avg_14_fg_made DECIMAL(5,2),
  avg_14_fg3_attempted DECIMAL(5,2),
  avg_14_fg3_made DECIMAL(5,2),
  avg_14_ft_attempted DECIMAL(5,2),
  avg_14_ft_made DECIMAL(5,2),
  games_played_14 INTEGER DEFAULT 0,             -- Actual number of games in last 14
  
  -- Last 30 Games Averages
  avg_30_minutes DECIMAL(5,2),
  avg_30_points DECIMAL(5,2),
  avg_30_assists DECIMAL(5,2),
  avg_30_rebounds DECIMAL(5,2),
  avg_30_steals DECIMAL(5,2),
  avg_30_blocks DECIMAL(5,2),
  avg_30_turnovers DECIMAL(5,2),
  avg_30_fg_attempted DECIMAL(5,2),
  avg_30_fg_made DECIMAL(5,2),
  avg_30_fg3_attempted DECIMAL(5,2),
  avg_30_fg3_made DECIMAL(5,2),
  avg_30_ft_attempted DECIMAL(5,2),
  avg_30_ft_made DECIMAL(5,2),
  games_played_30 INTEGER DEFAULT 0,             -- Actual number of games in last 30
  
  -- Season Totals
  season_games_played INTEGER DEFAULT 0,
  season_minutes INTEGER DEFAULT 0,
  season_points INTEGER DEFAULT 0,
  season_assists INTEGER DEFAULT 0,
  season_rebounds INTEGER DEFAULT 0,
  season_steals INTEGER DEFAULT 0,
  season_blocks INTEGER DEFAULT 0,
  season_turnovers INTEGER DEFAULT 0,
  season_fg_attempted INTEGER DEFAULT 0,
  season_fg_made INTEGER DEFAULT 0,
  season_fg3_attempted INTEGER DEFAULT 0,
  season_fg3_made INTEGER DEFAULT 0,
  season_ft_attempted INTEGER DEFAULT 0,
  season_ft_made INTEGER DEFAULT 0,
  
  -- Season Averages (calculated fields)
  season_avg_minutes DECIMAL(5,2),
  season_avg_points DECIMAL(5,2),
  season_avg_assists DECIMAL(5,2),
  season_avg_rebounds DECIMAL(5,2),
  season_avg_steals DECIMAL(5,2),
  season_avg_blocks DECIMAL(5,2),
  season_avg_turnovers DECIMAL(5,2),
  
  -- Metadata
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraints
  UNIQUE(player_id, season)                      -- One record per player per season
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_player_stats_player_id ON player_stats(player_id);
CREATE INDEX IF NOT EXISTS idx_player_stats_season ON player_stats(season);
CREATE INDEX IF NOT EXISTS idx_player_stats_team_id ON player_stats(team_id);
CREATE INDEX IF NOT EXISTS idx_player_stats_last_game_date ON player_stats(last_game_date);
CREATE INDEX IF NOT EXISTS idx_player_stats_last_updated ON player_stats(last_updated);
CREATE INDEX IF NOT EXISTS idx_player_stats_season_avg_points ON player_stats(season_avg_points DESC);
CREATE INDEX IF NOT EXISTS idx_player_stats_avg_7_points ON player_stats(avg_7_points DESC);

-- Trigger to update last_updated timestamp
CREATE TRIGGER update_player_stats_updated_at BEFORE UPDATE ON player_stats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Step 1.2: Add Schema to database/schema.sql

Add the player_stats table definition to `database/schema.sql`:

```sql
-- Add after the refresh_tokens table definition

-- Player Statistics Table (see PLAYER_STATS_TABLE_IMPLEMENTATION.md for full schema)
-- [Include the full CREATE TABLE statement from Step 1.1]
```

---

## Phase 2: Understanding BallDontLie API Endpoints

### Step 2.1: Review Available API Endpoints

The BallDontLie API provides several endpoints you'll need:

1. **Get All Active Players**
   - `GET /v1/players?per_page=100&cursor=...`
   - Returns paginated list of all players
   - Filter by `seasons[]` parameter to get players from current season

2. **Get Player Details**
   - `GET /v1/players/{player_id}`
   - Returns detailed player information including position, height, weight, team

3. **Get Player Stats (Season)**
   - `GET /v1/stats?player_ids[]={player_id}&seasons[]={season}&per_page=100`
   - Returns all game stats for a player in a season
   - Supports pagination with cursor

4. **Get Games**
   - `GET /v1/games?dates[]={date}&per_page=100`
   - Useful for determining which games to include in rolling averages

**Important Notes:**
- BallDontLie API uses pagination with `cursor` parameter
- Array parameters use bracket notation: `player_ids[]`, `seasons[]`, `dates[]`
- Rate limiting: Be respectful with API calls (add delays between requests)
- Current season format: `YYYY` (e.g., `2024` for 2023-2024 season)

### Step 2.2: Determine Current Season

You'll need to determine the current NBA season. The NBA season typically runs from October to April, with the season year representing the calendar year in which the season ends.

```javascript
function getCurrentSeason() {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  const year = now.getFullYear();
  
  // NBA season runs October (10) to April (4)
  // If we're in Oct-Dec, season is next year
  // If we're in Jan-Apr, season is current year
  if (month >= 10) {
    return year + 1; // October-December: next year's season
  } else if (month <= 4) {
    return year; // January-April: current year's season
  } else {
    // May-September: previous season is still current, or use next season
    return year; // Adjust based on your needs
  }
}
```

---

## Phase 3: Service Implementation

### Step 3.1: Create Player Stats Service

Create a new service file `services/playerStatsService.js`:

```javascript
/**
 * Player Stats Service
 * Fetches and aggregates player statistics from BallDontLie API
 */

import { query, getClient } from '../config/database.js';

const API_BASE_URL = "https://api.balldontlie.io";

/**
 * Helper function to make API calls to BallDontLie
 */
async function apiGet(apiKey, path, params = {}) {
  const url = new URL(`${API_BASE_URL}${path}`);
  
  // Handle array parameters (e.g., player_ids[]=1&player_ids[]=2)
  Object.entries(params || {}).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach(item => url.searchParams.append(key, item));
    } else if (value !== undefined && value !== null) {
      url.searchParams.set(key, value);
    }
  });

  const res = await fetch(url.toString(), {
    headers: { Authorization: apiKey }
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${txt || res.statusText}`);
  }

  return res.json();
}

/**
 * Fetch all active players for a season (with pagination)
 */
async function fetchAllActivePlayers(apiKey, season, perPage = 100) {
  const allPlayers = [];
  let cursor = null;

  do {
    const params = { "seasons[]": [season], per_page: perPage };
    if (cursor) params.cursor = cursor;

    try {
      const payload = await apiGet(apiKey, "/v1/players", params);
      const players = payload.data || [];
      allPlayers.push(...players);

      const meta = payload.meta || {};
      cursor = meta.next_cursor || null;
      
      // Add delay to respect rate limits
      if (cursor) {
        await new Promise(r => setTimeout(r, 150));
      }
    } catch (error) {
      console.error(`[PlayerStats] Error fetching players (cursor: ${cursor}):`, error);
      break; // Stop on error
    }
  } while (cursor);

  return allPlayers;
}

/**
 * Fetch all game stats for a player in a season
 */
async function fetchPlayerSeasonStats(apiKey, playerId, season, perPage = 100) {
  const allStats = [];
  let cursor = null;

  do {
    const params = {
      "player_ids[]": [playerId],
      "seasons[]": [season],
      per_page: perPage
    };
    if (cursor) params.cursor = cursor;

    try {
      const payload = await apiGet(apiKey, "/v1/stats", params);
      const stats = payload.data || [];
      allStats.push(...stats);

      const meta = payload.meta || {};
      cursor = meta.next_cursor || null;
      
      // Add delay to respect rate limits
      if (cursor) {
        await new Promise(r => setTimeout(r, 150));
      }
    } catch (error) {
      console.error(`[PlayerStats] Error fetching stats for player ${playerId}:`, error);
      break;
    }
  } while (cursor);

  return allStats;
}

/**
 * Calculate rolling averages for last N games
 */
function calculateRollingAverages(stats, n) {
  // Sort stats by game date (most recent first)
  const sortedStats = [...stats].sort((a, b) => {
    const dateA = new Date(a.game.date);
    const dateB = new Date(b.game.date);
    return dateB - dateA;
  });

  // Get last N games
  const lastNGames = sortedStats.slice(0, n);

  if (lastNGames.length === 0) {
    return {
      games_played: 0,
      averages: null
    };
  }

  // Sum all stats
  const totals = lastNGames.reduce((acc, stat) => {
    return {
      minutes: acc.minutes + (stat.min || 0),
      points: acc.points + (stat.pts || 0),
      assists: acc.assists + (stat.ast || 0),
      rebounds: acc.rebounds + (stat.reb || 0),
      steals: acc.steals + (stat.stl || 0),
      blocks: acc.blocks + (stat.blk || 0),
      turnovers: acc.turnovers + (stat.turnover || 0),
      fg_attempted: acc.fg_attempted + (stat.fga || 0),
      fg_made: acc.fg_made + (stat.fgm || 0),
      fg3_attempted: acc.fg3_attempted + (stat.fg3a || 0),
      fg3_made: acc.fg3_made + (stat.fg3m || 0),
      ft_attempted: acc.ft_attempted + (stat.fta || 0),
      ft_made: acc.ft_made + (stat.ftm || 0),
    };
  }, {
    minutes: 0, points: 0, assists: 0, rebounds: 0,
    steals: 0, blocks: 0, turnovers: 0,
    fg_attempted: 0, fg_made: 0,
    fg3_attempted: 0, fg3_made: 0,
    ft_attempted: 0, ft_made: 0
  });

  const gamesCount = lastNGames.length;

  // Calculate averages
  return {
    games_played: gamesCount,
    averages: {
      minutes: totals.minutes / gamesCount,
      points: totals.points / gamesCount,
      assists: totals.assists / gamesCount,
      rebounds: totals.rebounds / gamesCount,
      steals: totals.steals / gamesCount,
      blocks: totals.blocks / gamesCount,
      turnovers: totals.turnovers / gamesCount,
      fg_attempted: totals.fg_attempted / gamesCount,
      fg_made: totals.fg_made / gamesCount,
      fg3_attempted: totals.fg3_attempted / gamesCount,
      fg3_made: totals.fg3_made / gamesCount,
      ft_attempted: totals.ft_attempted / gamesCount,
      ft_made: totals.ft_made / gamesCount,
    }
  };
}

/**
 * Calculate season totals and averages
 */
function calculateSeasonStats(stats) {
  if (stats.length === 0) {
    return {
      games_played: 0,
      totals: null,
      averages: null
    };
  }

  const totals = stats.reduce((acc, stat) => {
    return {
      minutes: acc.minutes + (stat.min || 0),
      points: acc.points + (stat.pts || 0),
      assists: acc.assists + (stat.ast || 0),
      rebounds: acc.rebounds + (stat.reb || 0),
      steals: acc.steals + (stat.stl || 0),
      blocks: acc.blocks + (stat.blk || 0),
      turnovers: acc.turnovers + (stat.turnover || 0),
      fg_attempted: acc.fg_attempted + (stat.fga || 0),
      fg_made: acc.fg_made + (stat.fgm || 0),
      fg3_attempted: acc.fg3_attempted + (stat.fg3a || 0),
      fg3_made: acc.fg3_made + (stat.fg3m || 0),
      ft_attempted: acc.ft_attempted + (stat.fta || 0),
      ft_made: acc.ft_made + (stat.ftm || 0),
    };
  }, {
    minutes: 0, points: 0, assists: 0, rebounds: 0,
    steals: 0, blocks: 0, turnovers: 0,
    fg_attempted: 0, fg_made: 0,
    fg3_attempted: 0, fg3_made: 0,
    ft_attempted: 0, ft_made: 0
  });

  const gamesCount = stats.length;

  return {
    games_played: gamesCount,
    totals: totals,
    averages: {
      minutes: totals.minutes / gamesCount,
      points: totals.points / gamesCount,
      assists: totals.assists / gamesCount,
      rebounds: totals.rebounds / gamesCount,
      steals: totals.steals / gamesCount,
      blocks: totals.blocks / gamesCount,
      turnovers: totals.turnovers / gamesCount,
    }
  };
}

/**
 * Get the most recent game stats for a player
 */
function getLastGameStats(stats) {
  if (stats.length === 0) return null;

  // Sort by game date (most recent first)
  const sortedStats = [...stats].sort((a, b) => {
    const dateA = new Date(a.game.date);
    const dateB = new Date(b.game.date);
    return dateB - dateA;
  });

  const lastGame = sortedStats[0];
  const gameInfo = lastGame.game || {};

  return {
    game_id: gameInfo.id,
    game_date: gameInfo.date,
    minutes: lastGame.min || 0,
    points: lastGame.pts || 0,
    assists: lastGame.ast || 0,
    rebounds: lastGame.reb || 0,
    steals: lastGame.stl || 0,
    blocks: lastGame.blk || 0,
    turnovers: lastGame.turnover || 0,
    fg_attempted: lastGame.fga || 0,
    fg_made: lastGame.fgm || 0,
    fg3_attempted: lastGame.fg3a || 0,
    fg3_made: lastGame.fg3m || 0,
    ft_attempted: lastGame.fta || 0,
    ft_made: lastGame.ftm || 0,
  };
}

/**
 * Process and aggregate stats for a single player
 */
async function processPlayerStats(apiKey, player, season) {
  try {
    // Fetch all game stats for the season
    const seasonStats = await fetchPlayerSeasonStats(apiKey, player.id, season);
    
    if (seasonStats.length === 0) {
      console.log(`[PlayerStats] No stats found for player ${player.id} (${player.first_name} ${player.last_name})`);
      return null;
    }

    // Get last game stats
    const lastGame = getLastGameStats(seasonStats);

    // Calculate rolling averages
    const avg7 = calculateRollingAverages(seasonStats, 7);
    const avg14 = calculateRollingAverages(seasonStats, 14);
    const avg30 = calculateRollingAverages(seasonStats, 30);

    // Calculate season totals and averages
    const seasonData = calculateSeasonStats(seasonStats);

    // Get current team from most recent game
    const mostRecentStat = seasonStats.sort((a, b) => {
      const dateA = new Date(a.game.date);
      const dateB = new Date(b.game.date);
      return dateB - dateA;
    })[0];

    const team = mostRecentStat.team || {};
    const teamAbbrev = mostRecentStat.team?.abbreviation || player.team?.abbreviation || null;
    const teamId = mostRecentStat.team?.id || player.team?.id || null;

    return {
      player_id: player.id,
      season: season,
      player_first_name: player.first_name,
      player_last_name: player.last_name,
      player_position: player.position,
      player_height_feet: player.height_feet,
      player_height_inches: player.height_inches,
      player_weight_pounds: player.weight_pounds,
      team_id: teamId,
      team_abbreviation: teamAbbrev,
      last_game: lastGame,
      avg_7: avg7,
      avg_14: avg14,
      avg_30: avg30,
      season_data: seasonData
    };
  } catch (error) {
    console.error(`[PlayerStats] Error processing player ${player.id}:`, error);
    return null;
  }
}

/**
 * Upsert player stats into database
 */
async function upsertPlayerStats(processedStats) {
  if (!processedStats) return;

  const {
    player_id,
    season,
    player_first_name,
    player_last_name,
    player_position,
    player_height_feet,
    player_height_inches,
    player_weight_pounds,
    team_id,
    team_abbreviation,
    last_game,
    avg_7,
    avg_14,
    avg_30,
    season_data
  } = processedStats;

  // Build SQL for upsert (INSERT ... ON CONFLICT UPDATE)
  const upsertQuery = `
    INSERT INTO player_stats (
      player_id, season,
      player_first_name, player_last_name, player_position,
      player_height_feet, player_height_inches, player_weight_pounds,
      team_id, team_abbreviation,
      last_game_id, last_game_date,
      last_game_minutes, last_game_points, last_game_assists, last_game_rebounds,
      last_game_steals, last_game_blocks, last_game_turnovers,
      last_game_fg_attempted, last_game_fg_made,
      last_game_fg3_attempted, last_game_fg3_made,
      last_game_ft_attempted, last_game_ft_made,
      avg_7_minutes, avg_7_points, avg_7_assists, avg_7_rebounds,
      avg_7_steals, avg_7_blocks, avg_7_turnovers,
      avg_7_fg_attempted, avg_7_fg_made,
      avg_7_fg3_attempted, avg_7_fg3_made,
      avg_7_ft_attempted, avg_7_ft_made,
      games_played_7,
      avg_14_minutes, avg_14_points, avg_14_assists, avg_14_rebounds,
      avg_14_steals, avg_14_blocks, avg_14_turnovers,
      avg_14_fg_attempted, avg_14_fg_made,
      avg_14_fg3_attempted, avg_14_fg3_made,
      avg_14_ft_attempted, avg_14_ft_made,
      games_played_14,
      avg_30_minutes, avg_30_points, avg_30_assists, avg_30_rebounds,
      avg_30_steals, avg_30_blocks, avg_30_turnovers,
      avg_30_fg_attempted, avg_30_fg_made,
      avg_30_fg3_attempted, avg_30_fg3_made,
      avg_30_ft_attempted, avg_30_ft_made,
      games_played_30,
      season_games_played, season_minutes, season_points,
      season_assists, season_rebounds, season_steals, season_blocks, season_turnovers,
      season_fg_attempted, season_fg_made,
      season_fg3_attempted, season_fg3_made,
      season_ft_attempted, season_ft_made,
      season_avg_minutes, season_avg_points, season_avg_assists, season_avg_rebounds,
      season_avg_steals, season_avg_blocks, season_avg_turnovers
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
      $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25,
      $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38,
      $39, $40, $41, $42, $43, $44, $45, $46, $47, $48, $49, $50, $51,
      $52, $53, $54, $55, $56, $57, $58, $59, $60, $61, $62, $63, $64,
      $65, $66, $67, $68, $69, $70, $71, $72, $73, $74, $75, $76,
      $77, $78, $79, $80, $81, $82, $83
    )
    ON CONFLICT (player_id, season) DO UPDATE SET
      player_first_name = EXCLUDED.player_first_name,
      player_last_name = EXCLUDED.player_last_name,
      player_position = EXCLUDED.player_position,
      player_height_feet = EXCLUDED.player_height_feet,
      player_height_inches = EXCLUDED.player_height_inches,
      player_weight_pounds = EXCLUDED.player_weight_pounds,
      team_id = EXCLUDED.team_id,
      team_abbreviation = EXCLUDED.team_abbreviation,
      last_game_id = EXCLUDED.last_game_id,
      last_game_date = EXCLUDED.last_game_date,
      last_game_minutes = EXCLUDED.last_game_minutes,
      last_game_points = EXCLUDED.last_game_points,
      last_game_assists = EXCLUDED.last_game_assists,
      last_game_rebounds = EXCLUDED.last_game_rebounds,
      last_game_steals = EXCLUDED.last_game_steals,
      last_game_blocks = EXCLUDED.last_game_blocks,
      last_game_turnovers = EXCLUDED.last_game_turnovers,
      last_game_fg_attempted = EXCLUDED.last_game_fg_attempted,
      last_game_fg_made = EXCLUDED.last_game_fg_made,
      last_game_fg3_attempted = EXCLUDED.last_game_fg3_attempted,
      last_game_fg3_made = EXCLUDED.last_game_fg3_made,
      last_game_ft_attempted = EXCLUDED.last_game_ft_attempted,
      last_game_ft_made = EXCLUDED.last_game_ft_made,
      avg_7_minutes = EXCLUDED.avg_7_minutes,
      avg_7_points = EXCLUDED.avg_7_points,
      avg_7_assists = EXCLUDED.avg_7_assists,
      avg_7_rebounds = EXCLUDED.avg_7_rebounds,
      avg_7_steals = EXCLUDED.avg_7_steals,
      avg_7_blocks = EXCLUDED.avg_7_blocks,
      avg_7_turnovers = EXCLUDED.avg_7_turnovers,
      avg_7_fg_attempted = EXCLUDED.avg_7_fg_attempted,
      avg_7_fg_made = EXCLUDED.avg_7_fg_made,
      avg_7_fg3_attempted = EXCLUDED.avg_7_fg3_attempted,
      avg_7_fg3_made = EXCLUDED.avg_7_fg3_made,
      avg_7_ft_attempted = EXCLUDED.avg_7_ft_attempted,
      avg_7_ft_made = EXCLUDED.avg_7_ft_made,
      games_played_7 = EXCLUDED.games_played_7,
      avg_14_minutes = EXCLUDED.avg_14_minutes,
      avg_14_points = EXCLUDED.avg_14_points,
      avg_14_assists = EXCLUDED.avg_14_assists,
      avg_14_rebounds = EXCLUDED.avg_14_rebounds,
      avg_14_steals = EXCLUDED.avg_14_steals,
      avg_14_blocks = EXCLUDED.avg_14_blocks,
      avg_14_turnovers = EXCLUDED.avg_14_turnovers,
      avg_14_fg_attempted = EXCLUDED.avg_14_fg_attempted,
      avg_14_fg_made = EXCLUDED.avg_14_fg_made,
      avg_14_fg3_attempted = EXCLUDED.avg_14_fg3_attempted,
      avg_14_fg3_made = EXCLUDED.avg_14_fg3_made,
      avg_14_ft_attempted = EXCLUDED.avg_14_ft_attempted,
      avg_14_ft_made = EXCLUDED.avg_14_ft_made,
      games_played_14 = EXCLUDED.games_played_14,
      avg_30_minutes = EXCLUDED.avg_30_minutes,
      avg_30_points = EXCLUDED.avg_30_points,
      avg_30_assists = EXCLUDED.avg_30_assists,
      avg_30_rebounds = EXCLUDED.avg_30_rebounds,
      avg_30_steals = EXCLUDED.avg_30_steals,
      avg_30_blocks = EXCLUDED.avg_30_blocks,
      avg_30_turnovers = EXCLUDED.avg_30_turnovers,
      avg_30_fg_attempted = EXCLUDED.avg_30_fg_attempted,
      avg_30_fg_made = EXCLUDED.avg_30_fg_made,
      avg_30_fg3_attempted = EXCLUDED.avg_30_fg3_attempted,
      avg_30_fg3_made = EXCLUDED.avg_30_fg3_made,
      avg_30_ft_attempted = EXCLUDED.avg_30_ft_attempted,
      avg_30_ft_made = EXCLUDED.avg_30_ft_made,
      games_played_30 = EXCLUDED.games_played_30,
      season_games_played = EXCLUDED.season_games_played,
      season_minutes = EXCLUDED.season_minutes,
      season_points = EXCLUDED.season_points,
      season_assists = EXCLUDED.season_assists,
      season_rebounds = EXCLUDED.season_rebounds,
      season_steals = EXCLUDED.season_steals,
      season_blocks = EXCLUDED.season_blocks,
      season_turnovers = EXCLUDED.season_turnovers,
      season_fg_attempted = EXCLUDED.season_fg_attempted,
      season_fg_made = EXCLUDED.season_fg_made,
      season_fg3_attempted = EXCLUDED.season_fg3_attempted,
      season_fg3_made = EXCLUDED.season_fg3_made,
      season_ft_attempted = EXCLUDED.season_ft_attempted,
      season_ft_made = EXCLUDED.season_ft_made,
      season_avg_minutes = EXCLUDED.season_avg_minutes,
      season_avg_points = EXCLUDED.season_avg_points,
      season_avg_assists = EXCLUDED.season_avg_assists,
      season_avg_rebounds = EXCLUDED.season_avg_rebounds,
      season_avg_steals = EXCLUDED.season_avg_steals,
      season_avg_blocks = EXCLUDED.season_avg_blocks,
      season_avg_turnovers = EXCLUDED.season_avg_turnovers,
      last_updated = CURRENT_TIMESTAMP
  `;

  const values = [
    player_id, season,
    player_first_name, player_last_name, player_position,
    player_height_feet, player_height_inches, player_weight_pounds,
    team_id, team_abbreviation,
    last_game?.game_id || null, last_game?.game_date || null,
    last_game?.minutes || 0, last_game?.points || 0,
    last_game?.assists || 0, last_game?.rebounds || 0,
    last_game?.steals || 0, last_game?.blocks || 0, last_game?.turnovers || 0,
    last_game?.fg_attempted || 0, last_game?.fg_made || 0,
    last_game?.fg3_attempted || 0, last_game?.fg3_made || 0,
    last_game?.ft_attempted || 0, last_game?.ft_made || 0,
    avg_7.averages?.minutes || null, avg_7.averages?.points || null,
    avg_7.averages?.assists || null, avg_7.averages?.rebounds || null,
    avg_7.averages?.steals || null, avg_7.averages?.blocks || null,
    avg_7.averages?.turnovers || null,
    avg_7.averages?.fg_attempted || null, avg_7.averages?.fg_made || null,
    avg_7.averages?.fg3_attempted || null, avg_7.averages?.fg3_made || null,
    avg_7.averages?.ft_attempted || null, avg_7.averages?.ft_made || null,
    avg_7.games_played || 0,
    avg_14.averages?.minutes || null, avg_14.averages?.points || null,
    avg_14.averages?.assists || null, avg_14.averages?.rebounds || null,
    avg_14.averages?.steals || null, avg_14.averages?.blocks || null,
    avg_14.averages?.turnovers || null,
    avg_14.averages?.fg_attempted || null, avg_14.averages?.fg_made || null,
    avg_14.averages?.fg3_attempted || null, avg_14.averages?.fg3_made || null,
    avg_14.averages?.ft_attempted || null, avg_14.averages?.ft_made || null,
    avg_14.games_played || 0,
    avg_30.averages?.minutes || null, avg_30.averages?.points || null,
    avg_30.averages?.assists || null, avg_30.averages?.rebounds || null,
    avg_30.averages?.steals || null, avg_30.averages?.blocks || null,
    avg_30.averages?.turnovers || null,
    avg_30.averages?.fg_attempted || null, avg_30.averages?.fg_made || null,
    avg_30.averages?.fg3_attempted || null, avg_30.averages?.fg3_made || null,
    avg_30.averages?.ft_attempted || null, avg_30.averages?.ft_made || null,
    avg_30.games_played || 0,
    season_data.games_played || 0, season_data.totals?.minutes || 0,
    season_data.totals?.points || 0, season_data.totals?.assists || 0,
    season_data.totals?.rebounds || 0, season_data.totals?.steals || 0,
    season_data.totals?.blocks || 0, season_data.totals?.turnovers || 0,
    season_data.totals?.fg_attempted || 0, season_data.totals?.fg_made || 0,
    season_data.totals?.fg3_attempted || 0, season_data.totals?.fg3_made || 0,
    season_data.totals?.ft_attempted || 0, season_data.totals?.ft_made || 0,
    season_data.averages?.minutes || null, season_data.averages?.points || null,
    season_data.averages?.assists || null, season_data.averages?.rebounds || null,
    season_data.averages?.steals || null, season_data.averages?.blocks || null,
    season_data.averages?.turnovers || null
  ];

  await query(upsertQuery, values);
}

/**
 * Main function to populate player stats table
 */
export async function populatePlayerStats(apiKey, season = null) {
  // Determine season if not provided
  if (!season) {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    season = month >= 10 ? year + 1 : year;
  }

  console.log(`[PlayerStats] Starting population for season ${season}`);

  try {
    // Fetch all active players
    console.log('[PlayerStats] Fetching all active players...');
    const players = await fetchAllActivePlayers(apiKey, season);
    console.log(`[PlayerStats] Found ${players.length} active players`);

    // Process each player
    let processed = 0;
    let errors = 0;

    for (const player of players) {
      try {
        console.log(`[PlayerStats] Processing player ${player.id}: ${player.first_name} ${player.last_name} (${processed + 1}/${players.length})`);
        
        const processedStats = await processPlayerStats(apiKey, player, season);
        
        if (processedStats) {
          await upsertPlayerStats(processedStats);
          processed++;
        } else {
          errors++;
        }

        // Add delay between players to respect rate limits
        await new Promise(r => setTimeout(r, 200));
      } catch (error) {
        console.error(`[PlayerStats] Error processing player ${player.id}:`, error);
        errors++;
      }
    }

    console.log(`[PlayerStats] Population complete. Processed: ${processed}, Errors: ${errors}`);
    return { processed, errors, total: players.length };
  } catch (error) {
    console.error('[PlayerStats] Error during population:', error);
    throw error;
  }
}

/**
 * Update stats for a single player
 */
export async function updatePlayerStats(apiKey, playerId, season = null) {
  if (!season) {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    season = month >= 10 ? year + 1 : year;
  }

  try {
    // Fetch player details
    const playerResponse = await apiGet(apiKey, `/v1/players/${playerId}`, {});
    const player = playerResponse.data || playerResponse;

    const processedStats = await processPlayerStats(apiKey, player, season);
    
    if (processedStats) {
      await upsertPlayerStats(processedStats);
      return { success: true, player_id: playerId };
    } else {
      return { success: false, player_id: playerId, error: 'No stats found' };
    }
  } catch (error) {
    console.error(`[PlayerStats] Error updating player ${playerId}:`, error);
    throw error;
  }
}
```

### Step 3.2: Add Helper Function for Current Season

Add the `getCurrentSeason` helper function to `services/playerStatsService.js` or create a utility function:

```javascript
/**
 * Determine the current NBA season year
 * Season year represents the calendar year in which the season ends
 */
export function getCurrentSeason() {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  const year = now.getFullYear();
  
  // NBA season runs October (10) to April (4)
  if (month >= 10) {
    return year + 1; // October-December: next year's season
  } else if (month <= 4) {
    return year; // January-April: current year's season
  } else {
    // May-September: use next season (upcoming)
    return year + 1;
  }
}
```

---

## Phase 4: Create Routes (Optional)

### Step 4.1: Create Player Stats Routes

If you want to expose endpoints for populating/updating stats, create `routes/playerStatsRoutes.js`:

```javascript
import { authenticateToken } from "../middleware/jwtAuth.js";
import { requirePermission } from "../middleware/permissions.js";
import { PERMISSIONS } from "../config/permissions.js";
import { populatePlayerStats, updatePlayerStats } from "../services/playerStatsService.js";

export function registerPlayerStatsRoutes(app, { apiKey }) {
  // Populate all player stats - requires appropriate permission
  app.post("/api/player-stats/populate", 
    authenticateToken, 
    requirePermission(PERMISSIONS.SCAN_RUN), // Or create new permission
    async (req, res) => {
      try {
        const { season } = req.body;
        const result = await populatePlayerStats(apiKey, season);
        res.json({ success: true, ...result });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    }
  );

  // Update stats for a specific player
  app.post("/api/player-stats/update/:playerId",
    authenticateToken,
    requirePermission(PERMISSIONS.SCAN_RUN),
    async (req, res) => {
      try {
        const { playerId } = req.params;
        const { season } = req.body;
        const result = await updatePlayerStats(apiKey, parseInt(playerId), season);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    }
  );
}
```

Then register the routes in `server.js`:

```javascript
import { registerPlayerStatsRoutes } from "./routes/playerStatsRoutes.js";

// ... other route registrations ...

registerPlayerStatsRoutes(app, { apiKey });
```

---

## Phase 5: Implementation Steps

### Step 5.1: Create Database Table

1. **Add the table schema to `database/schema.sql`**:
   - Copy the CREATE TABLE statement from Step 1.1
   - Add it to the schema file after the refresh_tokens table

2. **Run the schema migration**:
   ```bash
   # Connect to your database and run the schema
   psql $DATABASE_URL -f database/schema.sql
   
   # Or if using a migration tool, create a migration file
   ```

3. **Verify the table was created**:
   ```sql
   \d player_stats  -- In psql
   SELECT COUNT(*) FROM player_stats;
   ```

### Step 5.2: Implement the Service

1. **Create `services/playerStatsService.js`**:
   - Copy the service code from Step 3.1
   - Adjust API endpoint paths if needed based on actual BallDontLie API
   - Test API field names match actual response structure

2. **Test API connectivity**:
   ```javascript
   // Test script to verify API responses
   import { fetchAllActivePlayers, fetchPlayerSeasonStats } from './services/playerStatsService.js';
   
   const apiKey = process.env.BALLDONTLIE_API_KEY;
   const season = 2024;
   
   // Test fetching players
   const players = await fetchAllActivePlayers(apiKey, season);
   console.log(`Found ${players.length} players`);
   
   // Test fetching stats for first player
   if (players.length > 0) {
     const stats = await fetchPlayerSeasonStats(apiKey, players[0].id, season);
     console.log(`Found ${stats.length} games for ${players[0].first_name} ${players[0].last_name}`);
   }
   ```

### Step 5.3: Test with a Single Player

Before processing all players, test with one player:

```javascript
import { updatePlayerStats } from './services/playerStatsService.js';

const apiKey = process.env.BALLDONTLIE_API_KEY;
const testPlayerId = 237; // LeBron James, for example

const result = await updatePlayerStats(apiKey, testPlayerId);
console.log(result);

// Verify in database
// SELECT * FROM player_stats WHERE player_id = 237;
```

### Step 5.4: Populate All Player Stats

Once tested, populate stats for all players:

```javascript
import { populatePlayerStats } from './services/playerStatsService.js';

const apiKey = process.env.BALLDONTLIE_API_KEY;

// This will take a while (15-30+ minutes depending on number of players)
const result = await populatePlayerStats(apiKey);
console.log(result);
```

**Note:** This operation can take a significant amount of time:
- ~200ms delay per player (rate limiting)
- 500+ active players in a season
- Each player requires multiple API calls (player details + stats)
- Estimated time: 15-45 minutes for full population

---

## Phase 6: Automation and Scheduling

### Step 6.1: Create Scheduled Update Job

Create a scheduled job to update player stats regularly (e.g., daily after games complete):

```javascript
// In server.js or a separate scheduler file
import { populatePlayerStats } from "./services/playerStatsService.js";
import { getCurrentSeason } from "./services/playerStatsService.js";

/**
 * Scheduled job to update player stats
 * Run daily at 3 AM (after most games have finished)
 */
function schedulePlayerStatsUpdate(apiKey) {
  const updateStats = async () => {
    try {
      console.log('[Scheduler] Starting scheduled player stats update...');
      const season = getCurrentSeason();
      const result = await populatePlayerStats(apiKey, season);
      console.log('[Scheduler] Player stats update complete:', result);
    } catch (error) {
      console.error('[Scheduler] Error updating player stats:', error);
    }
  };

  // Calculate milliseconds until next 3 AM
  const now = new Date();
  const next3AM = new Date(now);
  next3AM.setHours(3, 0, 0, 0);
  if (next3AM <= now) {
    next3AM.setDate(next3AM.getDate() + 1);
  }
  const msUntil3AM = next3AM.getTime() - now.getTime();

  // Schedule first run
  setTimeout(() => {
    updateStats();
    // Then run every 24 hours
    setInterval(updateStats, 24 * 60 * 60 * 1000);
  }, msUntil3AM);

  console.log(`[Scheduler] Player stats updates scheduled to run daily at 3 AM`);
}

// In server.js, after server starts:
// schedulePlayerStatsUpdate(process.env.BALLDONTLIE_API_KEY);
```

### Step 6.2: Incremental Updates

For faster updates, implement incremental updates that only process players who have played games since the last update:

```javascript
/**
 * Update only players who have new games since last update
 */
export async function updateRecentPlayerStats(apiKey, season = null, hoursSinceLastUpdate = 24) {
  if (!season) {
    season = getCurrentSeason();
  }

  // Get players whose last_game_date is older than X hours, or null
  const cutoffTime = new Date();
  cutoffTime.setHours(cutoffTime.getHours() - hoursSinceLastUpdate);

  const query = `
    SELECT player_id FROM player_stats
    WHERE season = $1
    AND (last_game_date IS NULL OR last_game_date < $2)
    ORDER BY last_updated ASC
  `;

  const result = await query(query, [season, cutoffTime.toISOString().split('T')[0]]);
  const playerIds = result.rows.map(row => row.player_id);

  console.log(`[PlayerStats] Found ${playerIds.length} players to update`);

  let updated = 0;
  for (const playerId of playerIds) {
    try {
      await updatePlayerStats(apiKey, playerId, season);
      updated++;
      await new Promise(r => setTimeout(r, 200));
    } catch (error) {
      console.error(`[PlayerStats] Error updating player ${playerId}:`, error);
    }
  }

  return { updated, total: playerIds.length };
}
```

---

## Phase 7: Querying Player Stats

### Step 7.1: Example Queries

Once the table is populated, you can query player stats efficiently:

```sql
-- Get top 10 players by season average points
SELECT 
  player_first_name || ' ' || player_last_name AS name,
  team_abbreviation,
  season_avg_points,
  season_games_played,
  last_game_points
FROM player_stats
WHERE season = 2024
ORDER BY season_avg_points DESC
LIMIT 10;

-- Get players with hot streaks (last 7 games average > season average)
SELECT 
  player_first_name || ' ' || player_last_name AS name,
  team_abbreviation,
  avg_7_points AS last_7_avg,
  season_avg_points AS season_avg,
  (avg_7_points - season_avg_points) AS difference
FROM player_stats
WHERE season = 2024
  AND avg_7_points IS NOT NULL
  AND season_avg_points IS NOT NULL
ORDER BY (avg_7_points - season_avg_points) DESC
LIMIT 20;

-- Get player's rolling averages for trend analysis
SELECT 
  player_first_name || ' ' || player_last_name AS name,
  avg_7_points AS last_7,
  avg_14_points AS last_14,
  avg_30_points AS last_30,
  season_avg_points AS season_avg
FROM player_stats
WHERE player_id = 237  -- LeBron James
  AND season = 2024;

-- Find players who played yesterday
SELECT 
  player_first_name || ' ' || player_last_name AS name,
  team_abbreviation,
  last_game_points,
  last_game_assists,
  last_game_rebounds
FROM player_stats
WHERE last_game_date = CURRENT_DATE - INTERVAL '1 day'
  AND season = 2024
ORDER BY last_game_points DESC;
```

### Step 7.2: Create Query Helper Functions

Create helper functions for common queries:

```javascript
import { query } from '../config/database.js';

/**
 * Get player stats by player ID
 */
export async function getPlayerStats(playerId, season = null) {
  if (!season) {
    season = getCurrentSeason();
  }

  const result = await query(
    'SELECT * FROM player_stats WHERE player_id = $1 AND season = $2',
    [playerId, season]
  );

  return result.rows[0] || null;
}

/**
 * Get top players by stat
 */
export async function getTopPlayersByStat(stat, limit = 10, season = null) {
  if (!season) {
    season = getCurrentSeason();
  }

  // Validate stat column name to prevent SQL injection
  const validStats = [
    'season_avg_points', 'season_avg_assists', 'season_avg_rebounds',
    'avg_7_points', 'avg_14_points', 'avg_30_points'
  ];
  
  if (!validStats.includes(stat)) {
    throw new Error(`Invalid stat: ${stat}`);
  }

  const result = await query(
    `SELECT 
      player_id,
      player_first_name || ' ' || player_last_name AS name,
      team_abbreviation,
      ${stat}
    FROM player_stats
    WHERE season = $1 AND ${stat} IS NOT NULL
    ORDER BY ${stat} DESC
    LIMIT $2`,
    [season, limit]
  );

  return result.rows;
}
```

---

## Phase 8: Testing

### Step 8.1: Unit Testing

Test individual functions:

```javascript
// Test calculateRollingAverages
const mockStats = [
  { game: { date: '2024-01-15' }, pts: 25, ast: 8, reb: 7 },
  { game: { date: '2024-01-13' }, pts: 30, ast: 10, reb: 10 },
  // ... more games
];

const avg7 = calculateRollingAverages(mockStats, 7);
console.assert(avg7.games_played === 7 || avg7.games_played === mockStats.length);
console.assert(avg7.averages.points > 0);
```

### Step 8.2: Integration Testing

Test the full workflow:

```javascript
// Test end-to-end for a single player
async function testPlayerStatsFlow() {
  const apiKey = process.env.BALLDONTLIE_API_KEY;
  const testPlayerId = 237; // LeBron James
  
  // Update stats
  await updatePlayerStats(apiKey, testPlayerId);
  
  // Query from database
  const stats = await getPlayerStats(testPlayerId);
  
  // Verify data
  console.assert(stats !== null, 'Stats should be in database');
  console.assert(stats.season_avg_points > 0, 'Should have season average');
  console.assert(stats.avg_7_points !== null, 'Should have 7-game average');
  console.assert(stats.last_game_points >= 0, 'Should have last game points');
  
  console.log('✅ Test passed');
}
```

### Step 8.3: Data Validation

Verify data integrity:

```sql
-- Check for players with missing data
SELECT 
  player_id,
  player_first_name || ' ' || player_last_name AS name,
  season_games_played,
  last_game_date,
  last_updated
FROM player_stats
WHERE season = 2024
  AND (season_games_played = 0 OR last_game_date IS NULL)
ORDER BY last_updated DESC;

-- Check for data inconsistencies
SELECT 
  player_id,
  games_played_7,
  games_played_14,
  games_played_30,
  season_games_played
FROM player_stats
WHERE season = 2024
  AND (games_played_7 > games_played_14 
    OR games_played_14 > games_played_30 
    OR games_played_30 > season_games_played);
```

---

## Phase 9: Performance Optimization

### Step 9.1: Batch Processing

For large updates, process players in batches:

```javascript
/**
 * Process players in batches to avoid memory issues
 */
export async function populatePlayerStatsBatched(apiKey, season = null, batchSize = 50) {
  if (!season) {
    season = getCurrentSeason();
  }

  const players = await fetchAllActivePlayers(apiKey, season);
  const batches = [];
  
  for (let i = 0; i < players.length; i += batchSize) {
    batches.push(players.slice(i, i + batchSize));
  }

  let totalProcessed = 0;
  let totalErrors = 0;

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    console.log(`[PlayerStats] Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} players)`);

    const results = await Promise.allSettled(
      batch.map(player => processPlayerStats(apiKey, player, season))
    );

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'fulfilled' && result.value) {
        await upsertPlayerStats(result.value);
        totalProcessed++;
      } else {
        totalErrors++;
      }
    }

    // Delay between batches
    if (batchIndex < batches.length - 1) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  return { processed: totalProcessed, errors: totalErrors, total: players.length };
}
```

### Step 9.2: Caching Strategy

Consider caching frequently accessed player stats:

```javascript
// Use existing cacheService or implement simple caching
const playerStatsCache = new Map();

export async function getPlayerStatsCached(playerId, season = null) {
  if (!season) {
    season = getCurrentSeason();
  }

  const cacheKey = `${playerId}-${season}`;
  
  // Check cache (5 minute TTL)
  if (playerStatsCache.has(cacheKey)) {
    const cached = playerStatsCache.get(cacheKey);
    if (Date.now() - cached.timestamp < 5 * 60 * 1000) {
      return cached.data;
    }
  }

  // Fetch from database
  const stats = await getPlayerStats(playerId, season);
  
  // Cache result
  if (stats) {
    playerStatsCache.set(cacheKey, {
      data: stats,
      timestamp: Date.now()
    });
  }

  return stats;
}
```

---

## Summary

### Files Created/Modified

1. **Database Schema:**
   - `database/schema.sql` - Add `player_stats` table definition

2. **Services:**
   - `services/playerStatsService.js` - Main service for fetching and processing player stats

3. **Routes (Optional):**
   - `routes/playerStatsRoutes.js` - API endpoints for populating/updating stats
   - `server.js` - Register player stats routes

### Key Features Implemented

✅ Database table with comprehensive player statistics  
✅ Last game stats tracking  
✅ Rolling averages for 7, 14, and 30 games  
✅ Season totals and averages  
✅ Automated population from BallDontLie API  
✅ Efficient database queries with indexes  
✅ Rate limiting and error handling  
✅ Scheduled updates support  

### Next Steps

1. **Initial Population:**
   - Run `populatePlayerStats()` to populate initial data
   - This may take 15-45 minutes depending on number of players

2. **Set Up Automation:**
   - Implement scheduled daily updates
   - Consider incremental updates for efficiency

3. **Integration:**
   - Use player stats in prop betting analysis
   - Create API endpoints to query stats
   - Build dashboards/UI to display trends

4. **Monitoring:**
   - Track update success/failure rates
   - Monitor API rate limit usage
   - Set up alerts for data inconsistencies

---

## Troubleshooting

### Issue: API rate limiting errors

**Solution:** 
- Increase delays between API calls (currently 150-200ms)
- Implement exponential backoff on errors
- Process in smaller batches with longer delays between batches

### Issue: Missing stats for some players

**Solution:**
- Some players may not have played in the current season
- Check if player is active using `GET /v1/players/{id}`
- Verify season parameter matches current NBA season

### Issue: Rolling averages show fewer games than expected

**Solution:**
- This is expected if a player hasn't played N games yet
- The `games_played_7/14/30` fields track actual games played
- Averages are calculated only from games that exist

### Issue: Database connection errors

**Solution:**
- Verify `DATABASE_URL` environment variable is set
- Check database connection pool settings
- Ensure database schema has been applied

### Issue: Stats not updating

**Solution:**
- Check last_updated timestamp in database
- Verify scheduled job is running
- Check API key is valid and has proper permissions
- Review error logs for failed updates

---

## References

- [BallDontLie API Documentation](https://www.balldontlie.io/#introduction)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Node.js pg Library](https://node-postgres.com/)
- [NBA Season Structure](https://www.nba.com/news/nba-season-dates)

---

## Notes

- **API Field Mapping:** The field names in this guide (e.g., `pts`, `ast`, `reb`) are based on typical BallDontLie API responses. Verify actual field names by inspecting API responses.

- **Season Format:** BallDontLie API uses the year in which the season ends (e.g., `2024` for 2023-2024 season). Adjust season calculation logic based on your needs.

- **Performance:** Full population can take 15-45+ minutes. Consider running during off-peak hours or implementing incremental updates.

- **Data Freshness:** Update frequency depends on your needs:
  - **Daily:** Good for most use cases
  - **After each game day:** More up-to-date but more API calls
  - **Real-time:** Requires webhooks or frequent polling (not recommended due to rate limits)

