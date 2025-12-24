# Prediction Model Implementation Guide

This guide provides step-by-step instructions for implementing a prediction model that combines NBA player statistics from your database with odds data from BallDontLie to predict prop betting outcomes. The model will help identify value bets and improve decision-making beyond simple arbitrage opportunities.

## Overview

**Current State:**
- Player statistics stored in `player_stats` table (last game, rolling averages for 7/14/30 games, season totals)
- Odds data fetched from BallDontLie API (`/v2/odds/player_props`)
- Arbitrage detection based on implied probabilities from odds
- No prediction modeling or value bet identification
- No historical prediction tracking or model performance metrics

**Target State:**
- Prediction model that combines player performance metrics with odds data
- Probability predictions for over/under outcomes on player props
- Value bet identification (comparing predicted probability vs implied probability from odds)
- Historical prediction tracking with actual outcomes for model validation
- Model performance metrics (accuracy, ROI, calibration)
- API endpoints to get predictions for current games
- Model retraining and improvement capabilities

---

## Phase 1: Understanding Data Sources

### Step 1.1: Player Statistics Available

Your `player_stats` table provides comprehensive data for each player:

**Recent Performance:**
- Last game statistics (points, assists, rebounds, steals, blocks, turnovers, threes, etc.)
- Rolling averages for last 7, 14, and 30 games
- Games played counts for each window

**Season Performance:**
- Season totals and averages
- Games played in season
- Field goal percentages (calculated from attempts/made)

**Player Information:**
- Position, team, physical attributes
- Player ID (links to BallDontLie player data)

**Key Statistics for Prediction:**
```sql
-- Example query to get relevant stats for a player
SELECT 
  player_id,
  player_first_name,
  player_last_name,
  team_abbreviation,
  
  -- Last game (most recent performance)
  last_game_points,
  last_game_assists,
  last_game_rebounds,
  last_game_steals,
  last_game_blocks,
  last_game_fg3_made,
  
  -- Rolling averages (trend indicators)
  avg_7_points, avg_7_assists, avg_7_rebounds,
  avg_14_points, avg_14_assists, avg_14_rebounds,
  avg_30_points, avg_30_assists, avg_30_rebounds,
  
  -- Season averages (baseline performance)
  season_avg_points,
  season_avg_assists,
  season_avg_rebounds,
  season_avg_steals,
  season_avg_blocks,
  
  -- Sample size indicators
  games_played_7,
  games_played_14,
  games_played_30,
  season_games_played,
  
  last_game_date,
  last_updated
FROM player_stats
WHERE player_id = ? AND season = ?;
```

### Step 1.2: Odds Data Structure from BallDontLie

The BallDontLie API provides odds data through `/v2/odds/player_props`:

**Prop Types:**
- `points` - Total points scored
- `assists` - Total assists
- `rebounds` - Total rebounds
- `steals` - Total steals
- `blocks` - Total blocks
- `turnovers` - Total turnovers
- `threes` - Total three-pointers made

**Odds Structure:**
- Line value (e.g., 25.5 points)
- Over/Under odds (American format: -110, +150, etc.)
- Multiple vendors (FanDuel, DraftKings, BetMGM, etc.)
- Game ID and player ID references

**Example API Response:**
```json
{
  "data": [
    {
      "game_id": 12345,
      "player_id": 237,
      "prop_type": "points",
      "line_value": 25.5,
      "market_type": "over_under",
      "vendors": [
        {
          "vendor": "fanduel",
          "over_odds": -110,
          "under_odds": -110
        },
        {
          "vendor": "draftkings",
          "over_odds": -105,
          "under_odds": -115
        }
      ]
    }
  ]
}
```

### Step 1.3: Feature Engineering Opportunities

Combine stats and odds data to create predictive features:

**Performance Features:**
- Recent trend (7-game avg vs 30-game avg) - indicates hot/cold streak
- Consistency (variance in recent games)
- Opponent-adjusted stats (if opponent defensive data available)
- Home vs away splits (if game context available)
- Back-to-back game indicators
- Minutes played trends

**Odds-Based Features:**
- Line value relative to player average (e.g., line 25.5 vs season avg 23.0)
- Market consensus (average line across vendors)
- Line movement (if tracking historical odds)
- Implied probability from best available odds

---

## Phase 2: Database Schema for Predictions

### Step 2.1: Predictions Table

Create a table to store model predictions for each prop:

```sql
-- Predictions Table
CREATE TABLE IF NOT EXISTS predictions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Game and Player Context
  game_id INTEGER NOT NULL,                       -- BallDontLie game ID
  player_id INTEGER NOT NULL,                     -- BallDontLie player ID
  prop_type VARCHAR(20) NOT NULL,                 -- e.g., "points", "assists", "rebounds"
  season INTEGER NOT NULL,                        -- Season year (e.g., 2024)
  prediction_date DATE NOT NULL,                  -- Date prediction was made
  
  -- Odds Data (snapshot at prediction time)
  line_value DECIMAL(6,2) NOT NULL,              -- The prop line (e.g., 25.5)
  best_over_odds INTEGER,                         -- Best available over odds (American format)
  best_under_odds INTEGER,                        -- Best available under odds (American format)
  over_vendor VARCHAR(50),                        -- Vendor offering best over odds
  under_vendor VARCHAR(50),                       -- Vendor offering best under odds
  implied_prob_over DECIMAL(5,4),                -- Implied probability from best over odds
  implied_prob_under DECIMAL(5,4),               -- Implied probability from best under odds
  
  -- Model Predictions
  predicted_prob_over DECIMAL(5,4) NOT NULL,     -- Model's predicted probability of over (0.0-1.0)
  predicted_prob_under DECIMAL(5,4) NOT NULL,    -- Model's predicted probability of under (0.0-1.0)
  predicted_value_over DECIMAL(6,4),             -- Value = predicted_prob - implied_prob (positive = value bet)
  predicted_value_under DECIMAL(6,4),            -- Value for under side
  
  -- Confidence Metrics
  confidence_score DECIMAL(5,4),                 -- Model confidence (0.0-1.0)
  model_version VARCHAR(50),                      -- Model version/identifier
  
  -- Player Stats Used (snapshot for reproducibility)
  player_avg_7 DECIMAL(5,2),                     -- 7-game average for this prop type
  player_avg_14 DECIMAL(5,2),                    -- 14-game average
  player_avg_30 DECIMAL(5,2),                    -- 30-game average
  player_season_avg DECIMAL(5,2),                -- Season average
  player_last_game INTEGER,                      -- Last game value for this prop
  
  -- Actual Outcome (filled after game)
  actual_result VARCHAR(10),                     -- "over", "under", or NULL if not yet determined
  actual_value DECIMAL(6,2),                     -- Actual stat value (e.g., 27 points)
  outcome_recorded_at TIMESTAMP WITH TIME ZONE,  -- When outcome was recorded
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraints
  UNIQUE(game_id, player_id, prop_type, prediction_date)  -- One prediction per prop per day
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_predictions_game_id ON predictions(game_id);
CREATE INDEX IF NOT EXISTS idx_predictions_player_id ON predictions(player_id);
CREATE INDEX IF NOT EXISTS idx_predictions_prop_type ON predictions(prop_type);
CREATE INDEX IF NOT EXISTS idx_predictions_prediction_date ON predictions(prediction_date);
CREATE INDEX IF NOT EXISTS idx_predictions_season ON predictions(season);
CREATE INDEX IF NOT EXISTS idx_predictions_outcome ON predictions(actual_result) WHERE actual_result IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_predictions_value_over ON predictions(predicted_value_over DESC) WHERE predicted_value_over > 0;
CREATE INDEX IF NOT EXISTS idx_predictions_value_under ON predictions(predicted_value_under DESC) WHERE predicted_value_under > 0;
CREATE INDEX IF NOT EXISTS idx_predictions_model_version ON predictions(model_version);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_predictions_updated_at BEFORE UPDATE ON predictions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Step 2.2: Model Performance Tracking Table

Create a table to track overall model performance:

```sql
-- Model Performance Metrics Table
CREATE TABLE IF NOT EXISTS model_performance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Model Identification
  model_version VARCHAR(50) NOT NULL,
  prop_type VARCHAR(20) NOT NULL,
  evaluation_period_start DATE NOT NULL,
  evaluation_period_end DATE NOT NULL,
  
  -- Prediction Metrics
  total_predictions INTEGER DEFAULT 0,
  predictions_with_outcome INTEGER DEFAULT 0,     -- Predictions where outcome is known
  
  -- Accuracy Metrics
  correct_predictions INTEGER DEFAULT 0,          -- Count of correct predictions
  accuracy DECIMAL(5,4),                          -- correct_predictions / predictions_with_outcome
  
  -- Value Bet Metrics
  value_bets_identified INTEGER DEFAULT 0,        -- Count of predictions with value > threshold
  value_bets_correct INTEGER DEFAULT 0,           -- Correct value bets
  value_bet_accuracy DECIMAL(5,4),                -- value_bets_correct / value_bets_identified
  
  -- ROI Metrics (if tracking bets)
  total_wagered DECIMAL(10,2) DEFAULT 0,
  total_profit DECIMAL(10,2) DEFAULT 0,
  roi DECIMAL(6,4),                               -- (total_profit / total_wagered) * 100
  
  -- Calibration Metrics
  avg_predicted_prob DECIMAL(5,4),               -- Average predicted probability
  actual_hit_rate DECIMAL(5,4),                  -- Actual percentage that hit
  
  -- Metadata
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraints
  UNIQUE(model_version, prop_type, evaluation_period_start, evaluation_period_end)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_model_performance_model_version ON model_performance(model_version);
CREATE INDEX IF NOT EXISTS idx_model_performance_prop_type ON model_performance(prop_type);
CREATE INDEX IF NOT EXISTS idx_model_performance_period ON model_performance(evaluation_period_start, evaluation_period_end);
```

### Step 2.3: Add Schema to database/schema.sql

Add both table definitions to `database/schema.sql`:

```sql
-- Add after the player_stats table definition

-- Predictions Table (see PREDICTION_MODEL_IMPLEMENTATION.md for full schema)
-- [Include the full CREATE TABLE statement from Step 2.1]

-- Model Performance Metrics Table (see PREDICTION_MODEL_IMPLEMENTATION.md for full schema)
-- [Include the full CREATE TABLE statement from Step 2.2]
```

---

## Phase 3: Prediction Model Approaches

### Step 3.1: Model Selection Considerations

Choose a model approach based on your needs:

**1. Simple Statistical Model (Recommended Starting Point)**
- **Approach**: Compare player averages to line value, account for variance
- **Pros**: Easy to implement, interpretable, no training required
- **Cons**: Less sophisticated, may miss non-linear patterns
- **Best For**: MVP implementation, baseline comparisons

**2. Linear Regression Model**
- **Approach**: Predict stat value using weighted combination of features
- **Pros**: Fast, interpretable, handles multiple features
- **Cons**: Assumes linear relationships
- **Best For**: Quick implementation with multiple features

**3. Machine Learning Models (Advanced)**
- **Approach**: Random Forest, XGBoost, or Neural Networks
- **Pros**: Can capture complex patterns, higher potential accuracy
- **Cons**: Requires training data, more complex, harder to interpret
- **Best For**: Production system with historical data

### Step 3.2: Recommended Starting Model: Weighted Average with Variance Adjustment

A good starting approach combines multiple averages with consideration for variance:

**Formula:**
```
predicted_value = (w1 * avg_7 + w2 * avg_14 + w3 * avg_30 + w4 * season_avg) / (w1 + w2 + w3 + w4)

where weights can be:
- w1 (7-game): 0.4  (most recent, highest weight)
- w2 (14-game): 0.3 (recent trend)
- w3 (30-game): 0.2 (medium-term trend)
- w4 (season): 0.1  (baseline, lowest weight)
```

**Variance Adjustment:**
```
standard_deviation = sqrt(variance_of_recent_games)
confidence_interval = 1.96 * standard_deviation  // 95% confidence
```

**Probability Calculation:**
```
If predicted_value > line_value:
  prob_over = 0.5 + min(0.4, (predicted_value - line_value) / (2 * std_dev))
else:
  prob_over = 0.5 - min(0.4, (line_value - predicted_value) / (2 * std_dev))

prob_under = 1 - prob_over
```

**Value Calculation:**
```
implied_prob_over = odds_to_probability(best_over_odds)
value_over = predicted_prob_over - implied_prob_over

If value_over > threshold (e.g., 0.05 = 5%), it's a value bet
```

### Step 3.3: Feature Selection

Features to extract from player_stats for prediction:

**For Points Prediction:**
- `avg_7_points`, `avg_14_points`, `avg_30_points`, `season_avg_points`
- `last_game_points`
- `games_played_7`, `games_played_14`, `games_played_30` (sample size)
- `avg_7_minutes`, `season_avg_minutes` (playing time indicator)

**For Assists Prediction:**
- `avg_7_assists`, `avg_14_assists`, `avg_30_assists`, `season_avg_assists`
- `last_game_assists`

**For Rebounds Prediction:**
- `avg_7_rebounds`, `avg_14_rebounds`, `avg_30_rebounds`, `season_avg_rebounds`
- `last_game_rebounds`

**For Steals/Blocks/Threes:**
- Corresponding averages and last game values
- Note: These stats have higher variance, may need different model tuning

**Additional Features (if available):**
- Opponent defensive ratings
- Home/away indicator
- Days rest (if tracking game dates)
- Back-to-back game indicator

---

## Phase 4: Implementation

### Step 4.1: Create Prediction Service

Create `services/predictionService.js`:

```javascript
/**
 * Prediction Service
 * Generates predictions for player props by combining stats and odds data
 */

const db = require('../database/db'); // Your database connection
const { getPlayerStats } = require('./playerStatsService'); // Assuming this exists

// Convert American odds to implied probability
function americanOddsToProbability(americanOdds) {
  if (americanOdds > 0) {
    return 100 / (americanOdds + 100);
  } else {
    return Math.abs(americanOdds) / (Math.abs(americanOdds) + 100);
  }
}

// Calculate weighted average with variance consideration
function calculateWeightedPrediction(playerStats, propType) {
  // Map prop type to stat fields
  const propFieldMap = {
    'points': {
      avg7: 'avg_7_points',
      avg14: 'avg_14_points',
      avg30: 'avg_30_points',
      season: 'season_avg_points',
      lastGame: 'last_game_points'
    },
    'assists': {
      avg7: 'avg_7_assists',
      avg14: 'avg_14_assists',
      avg30: 'avg_30_assists',
      season: 'season_avg_assists',
      lastGame: 'last_game_assists'
    },
    'rebounds': {
      avg7: 'avg_7_rebounds',
      avg14: 'avg_14_rebounds',
      avg30: 'avg_30_rebounds',
      season: 'season_avg_rebounds',
      lastGame: 'last_game_rebounds'
    },
    'steals': {
      avg7: 'avg_7_steals',
      avg14: 'avg_14_steals',
      avg30: 'avg_30_steals',
      season: 'season_avg_steals',
      lastGame: 'last_game_steals'
    },
    'blocks': {
      avg7: 'avg_7_blocks',
      avg14: 'avg_14_blocks',
      avg30: 'avg_30_blocks',
      season: 'season_avg_blocks',
      lastGame: 'last_game_blocks'
    },
    'threes': {
      avg7: 'avg_7_fg3_made',
      avg14: 'avg_14_fg3_made',
      avg30: 'avg_30_fg3_made',
      season: 'season_avg_fg3_made',
      lastGame: 'last_game_fg3_made'
    }
  };

  const fields = propFieldMap[propType];
  if (!fields || !playerStats) {
    return null;
  }

  const avg7 = playerStats[fields.avg7];
  const avg14 = playerStats[fields.avg14];
  const avg30 = playerStats[fields.avg30];
  const seasonAvg = playerStats[fields.season];

  // Weighted average (adjust weights based on testing)
  const weights = { w7: 0.4, w14: 0.3, w30: 0.2, wSeason: 0.1 };
  let weightedSum = 0;
  let totalWeight = 0;

  if (avg7 !== null && avg7 !== undefined) {
    weightedSum += avg7 * weights.w7;
    totalWeight += weights.w7;
  }
  if (avg14 !== null && avg14 !== undefined) {
    weightedSum += avg14 * weights.w14;
    totalWeight += weights.w14;
  }
  if (avg30 !== null && avg30 !== undefined) {
    weightedSum += avg30 * weights.w30;
    totalWeight += weights.w30;
  }
  if (seasonAvg !== null && seasonAvg !== undefined) {
    weightedSum += seasonAvg * weights.wSeason;
    totalWeight += weights.wSeason;
  }

  if (totalWeight === 0) {
    return null; // No data available
  }

  return weightedSum / totalWeight;
}

// Calculate probability of over/under based on predicted value and line
function calculateProbability(predictedValue, lineValue, varianceEstimate = 5.0) {
  // Simple approach: use normal distribution assumption
  // More sophisticated models could use actual variance from recent games
  
  const difference = predictedValue - lineValue;
  const stdDev = varianceEstimate; // Could be calculated from actual game data
  
  // Convert difference to probability using normal CDF approximation
  // Z-score = difference / stdDev
  const zScore = difference / stdDev;
  
  // Approximate CDF: prob_over = 0.5 + 0.5 * erf(zScore / sqrt(2))
  // Simplified approximation for zScore in reasonable range
  let probOver;
  if (Math.abs(zScore) < 3) {
    // Use simplified normal CDF approximation
    probOver = 0.5 + 0.4 * Math.tanh(zScore / 1.5);
  } else if (zScore > 3) {
    probOver = 0.95; // Cap at 95%
  } else {
    probOver = 0.05; // Cap at 5%
  }

  // Ensure probabilities are in valid range
  probOver = Math.max(0.05, Math.min(0.95, probOver));
  const probUnder = 1 - probOver;

  return { probOver, probUnder };
}

// Generate prediction for a single prop
async function generatePrediction(gameId, playerId, propType, lineValue, oddsData, season) {
  try {
    // Get player stats
    const playerStats = await getPlayerStats(playerId, season);
    if (!playerStats) {
      throw new Error(`No stats found for player ${playerId} in season ${season}`);
    }

    // Calculate predicted value
    const predictedValue = calculateWeightedPrediction(playerStats, propType);
    if (predictedValue === null) {
      throw new Error(`Insufficient stats data for ${propType} prediction`);
    }

    // Calculate probabilities
    const { probOver, probUnder } = calculateProbability(predictedValue, lineValue);

    // Extract best odds from oddsData
    let bestOverOdds = null;
    let bestUnderOdds = null;
    let overVendor = null;
    let underVendor = null;

    if (oddsData && oddsData.vendors && oddsData.vendors.length > 0) {
      // Find best over and under odds across vendors
      for (const vendor of oddsData.vendors) {
        if (vendor.over_odds !== null && vendor.over_odds !== undefined) {
          if (bestOverOdds === null || vendor.over_odds > bestOverOdds) {
            bestOverOdds = vendor.over_odds;
            overVendor = vendor.vendor;
          }
        }
        if (vendor.under_odds !== null && vendor.under_odds !== undefined) {
          if (bestUnderOdds === null || vendor.under_odds > bestUnderOdds) {
            bestUnderOdds = vendor.under_odds;
            underVendor = vendor.vendor;
          }
        }
      }
    }

    // Calculate implied probabilities
    const impliedProbOver = bestOverOdds ? americanOddsToProbability(bestOverOdds) : null;
    const impliedProbUnder = bestUnderOdds ? americanOddsToProbability(bestUnderOdds) : null;

    // Calculate value (predicted prob - implied prob)
    const valueOver = impliedProbOver !== null ? probOver - impliedProbOver : null;
    const valueUnder = impliedProbUnder !== null ? probUnder - impliedProbUnder : null;

    // Calculate confidence (based on sample size and consistency)
    const gamesPlayed = Math.max(
      playerStats.games_played_7 || 0,
      playerStats.games_played_14 || 0,
      playerStats.games_played_30 || 0
    );
    const confidenceScore = Math.min(1.0, gamesPlayed / 20); // More games = higher confidence

    // Get stat values for this prop type
    const propFieldMap = {
      'points': { avg7: 'avg_7_points', avg14: 'avg_14_points', avg30: 'avg_30_points', season: 'season_avg_points', lastGame: 'last_game_points' },
      'assists': { avg7: 'avg_7_assists', avg14: 'avg_14_assists', avg30: 'avg_30_assists', season: 'season_avg_assists', lastGame: 'last_game_assists' },
      'rebounds': { avg7: 'avg_7_rebounds', avg14: 'avg_14_rebounds', avg30: 'avg_30_rebounds', season: 'season_avg_rebounds', lastGame: 'last_game_rebounds' },
      'steals': { avg7: 'avg_7_steals', avg14: 'avg_14_steals', avg30: 'avg_30_steals', season: 'season_avg_steals', lastGame: 'last_game_steals' },
      'blocks': { avg7: 'avg_7_blocks', avg14: 'avg_14_blocks', avg30: 'avg_30_blocks', season: 'season_avg_blocks', lastGame: 'last_game_blocks' },
      'threes': { avg7: 'avg_7_fg3_made', avg14: 'avg_14_fg3_made', avg30: 'avg_30_fg3_made', season: 'season_avg_fg3_made', lastGame: 'last_game_fg3_made' }
    };
    const fields = propFieldMap[propType] || {};

    return {
      gameId,
      playerId,
      propType,
      season,
      predictionDate: new Date().toISOString().split('T')[0],
      lineValue,
      bestOverOdds,
      bestUnderOdds,
      overVendor,
      underVendor,
      impliedProbOver,
      impliedProbUnder,
      predictedProbOver: probOver,
      predictedProbUnder: probUnder,
      predictedValue,
      predictedValueOver: valueOver,
      predictedValueUnder: valueUnder,
      confidenceScore,
      modelVersion: 'v1.0-weighted-avg',
      playerAvg7: playerStats[fields.avg7],
      playerAvg14: playerStats[fields.avg14],
      playerAvg30: playerStats[fields.avg30],
      playerSeasonAvg: playerStats[fields.season],
      playerLastGame: playerStats[fields.lastGame]
    };
  } catch (error) {
    console.error(`Error generating prediction for player ${playerId}, prop ${propType}:`, error);
    throw error;
  }
}

// Save prediction to database
async function savePrediction(prediction) {
  const query = `
    INSERT INTO predictions (
      game_id, player_id, prop_type, season, prediction_date,
      line_value, best_over_odds, best_under_odds, over_vendor, under_vendor,
      implied_prob_over, implied_prob_under,
      predicted_prob_over, predicted_prob_under,
      predicted_value_over, predicted_value_under,
      confidence_score, model_version,
      player_avg_7, player_avg_14, player_avg_30, player_season_avg, player_last_game
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9, $10,
      $11, $12,
      $13, $14,
      $15, $16,
      $17, $18,
      $19, $20, $21, $22, $23
    )
    ON CONFLICT (game_id, player_id, prop_type, prediction_date)
    DO UPDATE SET
      best_over_odds = EXCLUDED.best_over_odds,
      best_under_odds = EXCLUDED.best_under_odds,
      over_vendor = EXCLUDED.over_vendor,
      under_vendor = EXCLUDED.under_vendor,
      implied_prob_over = EXCLUDED.implied_prob_over,
      implied_prob_under = EXCLUDED.implied_prob_under,
      predicted_prob_over = EXCLUDED.predicted_prob_over,
      predicted_prob_under = EXCLUDED.predicted_prob_under,
      predicted_value_over = EXCLUDED.predicted_value_over,
      predicted_value_under = EXCLUDED.predicted_value_under,
      confidence_score = EXCLUDED.confidence_score,
      player_avg_7 = EXCLUDED.player_avg_7,
      player_avg_14 = EXCLUDED.player_avg_14,
      player_avg_30 = EXCLUDED.player_avg_30,
      player_season_avg = EXCLUDED.player_season_avg,
      player_last_game = EXCLUDED.player_last_game,
      updated_at = CURRENT_TIMESTAMP
    RETURNING id;
  `;

  const values = [
    prediction.gameId,
    prediction.playerId,
    prediction.propType,
    prediction.season,
    prediction.predictionDate,
    prediction.lineValue,
    prediction.bestOverOdds,
    prediction.bestUnderOdds,
    prediction.overVendor,
    prediction.underVendor,
    prediction.impliedProbOver,
    prediction.impliedProbUnder,
    prediction.predictedProbOver,
    prediction.predictedProbUnder,
    prediction.predictedValueOver,
    prediction.predictedValueUnder,
    prediction.confidenceScore,
    prediction.modelVersion,
    prediction.playerAvg7,
    prediction.playerAvg14,
    prediction.playerAvg30,
    prediction.playerSeasonAvg,
    prediction.playerLastGame
  ];

  const result = await db.query(query, values);
  return result.rows[0].id;
}

// Generate predictions for all props in a game
async function generateGamePredictions(gameId, oddsDataArray, season) {
  const predictions = [];

  for (const oddsData of oddsDataArray) {
    try {
      const prediction = await generatePrediction(
        gameId,
        oddsData.player_id,
        oddsData.prop_type,
        oddsData.line_value,
        oddsData,
        season
      );
      predictions.push(prediction);
    } catch (error) {
      console.error(`Failed to generate prediction for game ${gameId}, player ${oddsData.player_id}, prop ${oddsData.prop_type}:`, error);
      // Continue with other predictions
    }
  }

  return predictions;
}

module.exports = {
  generatePrediction,
  generateGamePredictions,
  savePrediction,
  calculateWeightedPrediction,
  calculateProbability
};
```

### Step 4.2: Create Prediction Routes

Create `routes/predictionRoutes.js`:

**Note:** To include game context (game label, time, status, opponent) in predictions, you'll need to integrate with your scan service's game data. The scan service already fetches games with labels, times, and statuses. You can either:

1. **Join with scan results:** Fetch game context from your scan service when returning predictions
2. **Store game context in predictions table:** Add optional fields to store game label, time, status when predictions are created
3. **Separate game context endpoint:** Create a helper endpoint that fetches game context separately and merge on frontend

The current implementation includes TODOs for game context enhancement. For now, predictions will work without game context, and you can enhance the API later.

```javascript
/**
 * Prediction API Routes
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/jwtAuth');
const { requirePermission } = require('../middleware/permissions');
const { PERMISSIONS } = require('../config/permissions');
const predictionService = require('../services/predictionService');
const db = require('../database/db');

// Get predictions for a specific game
router.get('/game/:gameId', authenticateToken, requirePermission(PERMISSIONS.SCAN_READ), async (req, res) => {
  try {
    const { gameId } = req.params;
    const { propType, minValue } = req.query; // Optional filters

    // Note: You'll need to fetch game context separately or join with a games table
    // This assumes you have game context available from your scan service
    // For now, we'll fetch predictions and you can enhance with game context later

    let query = `
      SELECT 
        p.*,
        ps.player_first_name,
        ps.player_last_name,
        ps.team_abbreviation
      FROM predictions p
      JOIN player_stats ps ON p.player_id = ps.player_id AND p.season = ps.season
      WHERE p.game_id = $1
        AND p.prediction_date = CURRENT_DATE
    `;
    const params = [gameId];

    if (propType) {
      query += ` AND p.prop_type = $${params.length + 1}`;
      params.push(propType);
    }

    if (minValue) {
      query += ` AND (p.predicted_value_over >= $${params.length + 1} OR p.predicted_value_under >= $${params.length + 1})`;
      params.push(parseFloat(minValue));
    }

    query += ` ORDER BY GREATEST(COALESCE(p.predicted_value_over, 0), COALESCE(p.predicted_value_under, 0)) DESC`;

    const result = await db.query(query, params);
    
    // TODO: Enhance with game context (game label, time, status) from your games/scan data
    // You can fetch this from your scan service or a games table
    // For example:
    // const gameContext = await getGameContext(gameId);
    // const predictionsWithContext = result.rows.map(pred => ({
    //   ...pred,
    //   game_label: gameContext?.label,
    //   game_time: gameContext?.time,
    //   game_status: gameContext?.status
    // }));
    
    res.json({ predictions: result.rows });
  } catch (error) {
    console.error('Error fetching predictions:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get value bets (predictions with positive value)
router.get('/value-bets', authenticateToken, requirePermission(PERMISSIONS.SCAN_READ), async (req, res) => {
  try {
    const { propType, minValue = 0.05, minConfidence = 0.5 } = req.query;

    let query = `
      SELECT 
        p.*,
        ps.player_first_name,
        ps.player_last_name,
        ps.team_abbreviation
      FROM predictions p
      JOIN player_stats ps ON p.player_id = ps.player_id AND p.season = ps.season
      WHERE p.prediction_date = CURRENT_DATE
        AND (
          (p.predicted_value_over >= $1 AND p.confidence_score >= $2)
          OR (p.predicted_value_under >= $1 AND p.confidence_score >= $2)
        )
    `;
    const params = [parseFloat(minValue), parseFloat(minConfidence)];

    if (propType) {
      query += ` AND p.prop_type = $${params.length + 1}`;
      params.push(propType);
    }

    query += ` ORDER BY GREATEST(COALESCE(p.predicted_value_over, 0), COALESCE(p.predicted_value_under, 0)) DESC`;

    const result = await db.query(query, params);
    
    // TODO: Enhance with game context (game label, time, status, opponent) from your games/scan data
    // You can fetch this from your scan service similar to how scan results include gameMap, gameTimeMap, etc.
    // For example, if you have access to scan results:
    // const gameIds = [...new Set(result.rows.map(r => r.game_id))];
    // const gameContexts = await getGamesContext(gameIds); // Fetch from scan service or games table
    // const valueBetsWithContext = result.rows.map(pred => ({
    //   ...pred,
    //   game_label: gameContexts[pred.game_id]?.label,
    //   game_time: gameContexts[pred.game_id]?.time,
    //   game_status: gameContexts[pred.game_id]?.status,
    //   opponent_team: gameContexts[pred.game_id]?.opponent
    // }));
    
    res.json({ valueBets: result.rows });
  } catch (error) {
    console.error('Error fetching value bets:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate predictions for today's games (triggers prediction generation)
router.post('/generate/today', authenticateToken, requirePermission(PERMISSIONS.SCAN_RUN), async (req, res) => {
  try {
    // This would integrate with your scan service to get today's games and odds
    // For now, placeholder structure
    res.status(501).json({ error: 'Not yet implemented - integrate with scan service' });
  } catch (error) {
    console.error('Error generating predictions:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get model performance metrics
router.get('/performance', authenticateToken, requirePermission(PERMISSIONS.SCAN_READ), async (req, res) => {
  try {
    const { modelVersion, propType, startDate, endDate, limit = 10 } = req.query;

    let query = `
      SELECT *
      FROM model_performance
      WHERE 1=1
    `;
    const params = [];

    if (modelVersion) {
      query += ` AND model_version = $${params.length + 1}`;
      params.push(modelVersion);
    }

    if (propType) {
      query += ` AND prop_type = $${params.length + 1}`;
      params.push(propType);
    }

    if (startDate) {
      query += ` AND evaluation_period_start >= $${params.length + 1}`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND evaluation_period_end <= $${params.length + 1}`;
      params.push(endDate);
    }

    query += ` ORDER BY calculated_at DESC LIMIT $${params.length + 1}`;
    params.push(parseInt(limit));

    const result = await db.query(query, params);
    res.json({ performance: result.rows });
  } catch (error) {
    console.error('Error fetching model performance:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

### Step 4.2.1: Enhance API with Game Context (Optional)

To include game context (game label, time, status, opponent) in prediction responses, enhance the prediction routes. Here's an example helper function you can add:

```javascript
// Helper function to fetch game context
// This assumes you have access to your scan service's game data
async function getGameContext(gameIds, scanService) {
  // Option 1: Get from scan results (if available)
  const scanResults = scanService.getLatestResults();
  if (scanResults) {
    const contexts = {};
    gameIds.forEach(gameId => {
      const gameIdStr = gameId.toString();
      contexts[gameId] = {
        game_label: scanResults.gameMap[gameIdStr] || null,
        game_time: scanResults.gameTimeMap[gameIdStr] || null,
        game_status: scanResults.gameStatusMap[gameIdStr] || null,
        // Extract opponent from game label if needed
        opponent_team: extractOpponent(scanResults.gameMap[gameIdStr])
      };
    });
    return contexts;
  }

  // Option 2: Fetch from BallDontLie API
  // GET /v1/games?ids[]={gameId}
  // Parse game data to create context

  return {};
}

// Helper to extract opponent team from game label (e.g., "LAL at BOS" -> "BOS")
function extractOpponent(gameLabel) {
  if (!gameLabel) return null;
  const parts = gameLabel.split(' at ');
  return parts.length > 1 ? parts[1] : null;
}
```

Then update the prediction routes to use this helper:

```javascript
// In routes/predictionRoutes.js
const scanService = require('../services/scanService'); // Adjust path as needed

// Update value-bets route example:
router.get('/value-bets', authenticateToken, requirePermission(PERMISSIONS.SCAN_READ), async (req, res) => {
  try {
    // ... existing query code ...
    const result = await db.query(query, params);
    
    // Enhance with game context
    const gameIds = [...new Set(result.rows.map(r => r.game_id))];
    const gameContexts = await getGameContext(gameIds, scanService);
    
    const valueBetsWithContext = result.rows.map(pred => ({
      ...pred,
      game_label: gameContexts[pred.game_id]?.game_label || null,
      game_time: gameContexts[pred.game_id]?.game_time || null,
      game_status: gameContexts[pred.game_id]?.game_status || null,
      opponent_team: gameContexts[pred.game_id]?.opponent_team || null
    }));
    
    res.json({ valueBets: valueBetsWithContext });
  } catch (error) {
    console.error('Error fetching value bets:', error);
    res.status(500).json({ error: error.message });
  }
});
```

### Step 4.3: Integrate with Scan Service

Modify your scan service to generate predictions after fetching odds:

```javascript
// In your scan service (e.g., services/scanService.js)
const predictionService = require('./predictionService');

// After fetching odds for a game, generate predictions
async function processGameOdds(gameId, oddsData, season) {
  // ... existing arbitrage detection code ...

  // Generate predictions for this game
  try {
    const predictions = await predictionService.generateGamePredictions(
      gameId,
      oddsData,
      season
    );

    // Save predictions to database
    for (const prediction of predictions) {
      await predictionService.savePrediction(prediction);
    }
  } catch (error) {
    console.error(`Error generating predictions for game ${gameId}:`, error);
    // Don't fail the scan if prediction generation fails
  }

  // ... return arbitrage results ...
}
```

---

## Phase 5: Outcome Tracking and Validation

### Step 5.1: Update Predictions with Actual Outcomes

Create a service to update predictions after games complete:

```javascript
// In services/predictionService.js

// Update prediction with actual outcome
async function updatePredictionOutcome(gameId, playerId, propType, actualValue, predictionDate) {
  const query = `
    UPDATE predictions
    SET 
      actual_value = $1,
      actual_result = CASE 
        WHEN $1 > line_value THEN 'over'
        WHEN $1 < line_value THEN 'under'
        ELSE 'push'
      END,
      outcome_recorded_at = CURRENT_TIMESTAMP
    WHERE game_id = $2
      AND player_id = $3
      AND prop_type = $4
      AND prediction_date = $5
    RETURNING *;
  `;

  const result = await db.query(query, [actualValue, gameId, playerId, propType, predictionDate]);
  return result.rows[0];
}

// Fetch actual game stats from BallDontLie and update predictions
async function updateGameOutcomes(gameId, season) {
  try {
    // Fetch game stats from BallDontLie API
    // GET /v1/stats?game_ids[]={gameId}&per_page=100
    const gameStats = await fetchGameStatsFromAPI(gameId);

    // Get all predictions for this game
    const predictionsQuery = `
      SELECT * FROM predictions
      WHERE game_id = $1 AND season = $2 AND actual_result IS NULL
    `;
    const predictions = await db.query(predictionsQuery, [gameId, season]);

    // Update each prediction with actual outcome
    for (const prediction of predictions.rows) {
      const playerStats = gameStats.find(s => s.player.id === prediction.player_id);
      if (!playerStats) continue;

      const actualValue = getStatValue(playerStats, prediction.prop_type);
      if (actualValue !== null && actualValue !== undefined) {
        await updatePredictionOutcome(
          gameId,
          prediction.player_id,
          prediction.prop_type,
          actualValue,
          prediction.prediction_date
        );
      }
    }
  } catch (error) {
    console.error(`Error updating outcomes for game ${gameId}:`, error);
    throw error;
  }
}

function getStatValue(playerStats, propType) {
  const statMap = {
    'points': playerStats.pts,
    'assists': playerStats.ast,
    'rebounds': playerStats.reb,
    'steals': playerStats.stl,
    'blocks': playerStats.blk,
    'turnovers': playerStats.turnover,
    'threes': playerStats.fg3m
  };
  return statMap[propType];
}

module.exports = {
  // ... existing exports ...
  updatePredictionOutcome,
  updateGameOutcomes
};
```

### Step 5.2: Calculate Model Performance Metrics

Create a service to calculate and store performance metrics:

```javascript
// In services/predictionService.js

async function calculateModelPerformance(modelVersion, propType, startDate, endDate) {
  const query = `
    SELECT 
      COUNT(*) as total_predictions,
      COUNT(actual_result) as predictions_with_outcome,
      COUNT(CASE WHEN actual_result = 'over' AND predicted_prob_over > 0.5 THEN 1 END) +
      COUNT(CASE WHEN actual_result = 'under' AND predicted_prob_under > 0.5 THEN 1 END) as correct_predictions,
      COUNT(CASE WHEN predicted_value_over >= 0.05 OR predicted_value_under >= 0.05 THEN 1 END) as value_bets_identified,
      COUNT(CASE 
        WHEN (predicted_value_over >= 0.05 AND actual_result = 'over') 
          OR (predicted_value_under >= 0.05 AND actual_result = 'under') 
        THEN 1 
      END) as value_bets_correct,
      AVG(predicted_prob_over) as avg_predicted_prob,
      AVG(CASE WHEN actual_result = 'over' THEN 1.0 ELSE 0.0 END) as actual_hit_rate
    FROM predictions
    WHERE model_version = $1
      AND prop_type = $2
      AND prediction_date >= $3
      AND prediction_date <= $4
  `;

  const result = await db.query(query, [modelVersion, propType, startDate, endDate]);
  const stats = result.rows[0];

  const accuracy = stats.predictions_with_outcome > 0 
    ? stats.correct_predictions / stats.predictions_with_outcome 
    : null;

  const valueBetAccuracy = stats.value_bets_identified > 0
    ? stats.value_bets_correct / stats.value_bets_identified
    : null;

  // Insert into model_performance table
  const insertQuery = `
    INSERT INTO model_performance (
      model_version, prop_type, evaluation_period_start, evaluation_period_end,
      total_predictions, predictions_with_outcome, correct_predictions, accuracy,
      value_bets_identified, value_bets_correct, value_bet_accuracy,
      avg_predicted_prob, actual_hit_rate
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    ON CONFLICT (model_version, prop_type, evaluation_period_start, evaluation_period_end)
    DO UPDATE SET
      total_predictions = EXCLUDED.total_predictions,
      predictions_with_outcome = EXCLUDED.predictions_with_outcome,
      correct_predictions = EXCLUDED.correct_predictions,
      accuracy = EXCLUDED.accuracy,
      value_bets_identified = EXCLUDED.value_bets_identified,
      value_bets_correct = EXCLUDED.value_bets_correct,
      value_bet_accuracy = EXCLUDED.value_bet_accuracy,
      avg_predicted_prob = EXCLUDED.avg_predicted_prob,
      actual_hit_rate = EXCLUDED.actual_hit_rate,
      calculated_at = CURRENT_TIMESTAMP
    RETURNING *;
  `;

  const insertResult = await db.query(insertQuery, [
    modelVersion, propType, startDate, endDate,
    parseInt(stats.total_predictions),
    parseInt(stats.predictions_with_outcome),
    parseInt(stats.correct_predictions),
    accuracy,
    parseInt(stats.value_bets_identified),
    parseInt(stats.value_bets_correct),
    valueBetAccuracy,
    parseFloat(stats.avg_predicted_prob),
    parseFloat(stats.actual_hit_rate)
  ]);

  return insertResult.rows[0];
}

module.exports = {
  // ... existing exports ...
  calculateModelPerformance
};
```

---

## Phase 6: API Integration

### Step 6.1: Register Routes in Server

Add prediction routes to your server:

```javascript
// In server.js or routes/index.js
const predictionRoutes = require('./routes/predictionRoutes');

// Register routes
app.use('/api/predictions', predictionRoutes);
```

### Step 6.2: API Endpoint Summary

**GET /api/predictions/game/:gameId**
- Get all predictions for a specific game
- Query params: `propType` (optional), `minValue` (optional)

**GET /api/predictions/value-bets**
- Get predictions with positive value (value bets)
- Query params: `propType` (optional), `minValue` (default 0.05), `minConfidence` (default 0.5)

**POST /api/predictions/generate/today**
- Trigger prediction generation for today's games
- Requires `scan:run` permission

**GET /api/predictions/performance**
- Get model performance metrics
- Query params: `modelVersion`, `propType`, `startDate`, `endDate`

---

## Phase 7: Testing and Validation

### Step 7.1: Unit Testing

Test individual prediction functions:

```javascript
// tests/predictionService.test.js
const predictionService = require('../services/predictionService');

describe('Prediction Service', () => {
  test('calculateWeightedPrediction returns correct weighted average', () => {
    const mockStats = {
      avg_7_points: 25.0,
      avg_14_points: 23.0,
      avg_30_points: 22.0,
      season_avg_points: 21.5
    };
    
    const result = predictionService.calculateWeightedPrediction(mockStats, 'points');
    // Expected: (25*0.4 + 23*0.3 + 22*0.2 + 21.5*0.1) / 1.0 = 23.65
    expect(result).toBeCloseTo(23.65, 2);
  });

  test('calculateProbability returns valid probabilities', () => {
    const { probOver, probUnder } = predictionService.calculateProbability(27.0, 25.5);
    expect(probOver).toBeGreaterThan(0);
    expect(probOver).toBeLessThan(1);
    expect(probUnder).toBeGreaterThan(0);
    expect(probUnder).toBeLessThan(1);
    expect(probOver + probUnder).toBeCloseTo(1.0, 5);
  });
});
```

### Step 7.2: Backtesting

Create a backtesting script to evaluate model on historical data:

```javascript
// scripts/backtestPredictions.js

/**
 * Backtest prediction model on historical data
 * This script would:
 * 1. Fetch historical odds data
 * 2. Generate predictions for historical games
 * 3. Fetch actual game outcomes
 * 4. Calculate performance metrics
 */

async function backtestModel(startDate, endDate, propType = 'points') {
  // Implementation would:
  // - Fetch games in date range
  // - For each game, get odds and generate predictions
  // - Wait for games to complete, then fetch outcomes
  // - Calculate accuracy, ROI, etc.
  // - Generate report
}
```

### Step 7.3: Model Calibration

Monitor calibration (predicted probability vs actual hit rate):

- Well-calibrated model: If model predicts 60% probability, actual hit rate should be ~60%
- Poorly calibrated: Systematic over/under estimation
- Adjust probability calculation if calibration is off

---

## Phase 8: Model Improvement

### Step 8.1: Feature Engineering

Consider adding features:

**Opponent Factors:**
- Opponent defensive rating
- Opponent pace (affects total stats)
- Head-to-head history

**Context Factors:**
- Home vs away
- Days rest
- Back-to-back games
- Injury reports

**Market Factors:**
- Line movement (odds changing over time)
- Market consensus (average line across vendors)
- Public betting percentages (if available)

### Step 8.2: Model Tuning

Adjust model parameters based on performance:

**Weight Adjustments:**
- Test different weight combinations for 7/14/30/season averages
- Use backtesting to find optimal weights

**Variance Estimation:**
- Calculate actual variance from recent games
- Use different variance estimates for different prop types

**Confidence Scoring:**
- Refine confidence calculation based on sample size
- Consider consistency metrics (low variance = higher confidence)

### Step 8.3: Advanced Models

Consider upgrading to machine learning models:

**Random Forest:**
- Can handle non-linear relationships
- Provides feature importance
- Handles missing data well

**XGBoost:**
- High performance on tabular data
- Handles feature interactions
- Requires more data for training

**Neural Networks:**
- Can model complex patterns
- Requires significant training data
- Less interpretable

---

## Troubleshooting

### Issue: Predictions not generating

**Solution:**
- Verify player_stats table has data for the player
- Check that prop_type matches available stat fields
- Verify database connection is working
- Check error logs for specific failures

### Issue: Low prediction accuracy

**Solution:**
- Increase sample size (use more games in averages)
- Adjust weight distribution
- Consider adding more features (opponent, context)
- Test different probability calculation methods
- Review variance estimates

### Issue: Poor value bet identification

**Solution:**
- Adjust value threshold (currently 0.05 = 5%)
- Improve probability calibration
- Consider market inefficiencies vs model errors
- Track which value bets actually win

### Issue: Missing outcomes

**Solution:**
- Verify game completion detection
- Check BallDontLie API for game stats availability
- Implement retry logic for outcome updates
- Handle cases where stats aren't immediately available

---

## Phase 9: Frontend Implementation

### Step 9.1: Create Predictions Page

Create `app/predictions.tsx`:

```typescript
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

import { useEffect, useState, useCallback, useMemo } from 'react';
import { YStack, XStack, Text, ScrollView, Spinner, Card, Separator, Select, Label, Button } from 'tamagui';
import { StatusBar } from 'expo-status-bar';
import { RefreshControl, Platform } from 'react-native';
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
  predictions: Prediction[];
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
        setPredictions(response.predictions);
      } else if ('valueBets' in response) {
        setPredictions(response.valueBets);
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
          <Card padding="$3" backgroundColor="$backgroundStrong">
            <YStack space="$3">
              <XStack space="$3" alignItems="center" flexWrap="wrap">
                <YStack flex={1} minWidth={150}>
                  <Label htmlFor="prop-type">Prop Type</Label>
                  <Select
                    id="prop-type"
                    value={propTypeFilter}
                    onValueChange={setPropTypeFilter}
                  >
                    <Select.Trigger width="100%">
                      <Select.Value placeholder="All Props" />
                    </Select.Trigger>
                    <Select.Content>
                      <Select.Item index={0} value="all">All Props</Select.Item>
                      <Select.Item index={1} value="points">Points</Select.Item>
                      <Select.Item index={2} value="assists">Assists</Select.Item>
                      <Select.Item index={3} value="rebounds">Rebounds</Select.Item>
                      <Select.Item index={4} value="steals">Steals</Select.Item>
                      <Select.Item index={5} value="blocks">Blocks</Select.Item>
                      <Select.Item index={6} value="threes">Three-Pointers</Select.Item>
                    </Select.Content>
                  </Select>
                </YStack>

                <YStack flex={1} minWidth={150}>
                  <Label htmlFor="min-value">Min Value (%)</Label>
                  <Select
                    id="min-value"
                    value={minValue}
                    onValueChange={setMinValue}
                  >
                    <Select.Trigger width="100%">
                      <Select.Value />
                    </Select.Trigger>
                    <Select.Content>
                      <Select.Item index={0} value="0">0%</Select.Item>
                      <Select.Item index={1} value="0.03">3%</Select.Item>
                      <Select.Item index={2} value="0.05">5%</Select.Item>
                      <Select.Item index={3} value="0.07">7%</Select.Item>
                      <Select.Item index={4} value="0.10">10%</Select.Item>
                    </Select.Content>
                  </Select>
                </YStack>

                <YStack flex={1} minWidth={150}>
                  <Label htmlFor="sort-by">Sort By</Label>
                  <Select
                    id="sort-by"
                    value={sortOption}
                    onValueChange={(value) => setSortOption(value as SortOption)}
                  >
                    <Select.Trigger width="100%">
                      <Select.Value />
                    </Select.Trigger>
                    <Select.Content>
                      <Select.Item index={0} value="value-desc">Value (High to Low)</Select.Item>
                      <Select.Item index={1} value="value-asc">Value (Low to High)</Select.Item>
                      <Select.Item index={2} value="confidence-desc">Confidence (High to Low)</Select.Item>
                      <Select.Item index={3} value="confidence-asc">Confidence (Low to High)</Select.Item>
                      <Select.Item index={4} value="prop-type">Prop Type</Select.Item>
                      <Select.Item index={5} value="player-name">Player Name</Select.Item>
                    </Select.Content>
                  </Select>
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
```

### Step 9.2: Add Route to Layout

Update `app/_layout.tsx` to add the predictions route:

```typescript
import '../tamagui.config';
import { Stack } from 'expo-router';
import { TamaguiProvider } from 'tamagui';
import config from '../tamagui.config';
import { WebLayout } from '../components/WebLayout';

export default function RootLayout() {
  return (
    <TamaguiProvider config={config} defaultTheme="dark">
      <WebLayout>
        <Stack>
          <Stack.Screen name="index" options={{ title: 'Login', headerShown: false }} />
          <Stack.Screen name="home" options={{ title: 'Home', headerShown: false }} />
          <Stack.Screen name="scan" options={{ title: 'Scan Results', headerShown: false }} />
          <Stack.Screen name="player-stats" options={{ title: 'Player Stats', headerShown: false }} />
          <Stack.Screen name="predictions" options={{ title: 'Predictions', headerShown: false }} />
          <Stack.Screen name="admin" options={{ title: 'Admin Panel', headerShown: false }} />
        </Stack>
      </WebLayout>
    </TamaguiProvider>
  );
}
```

### Step 9.3: Add Menu Item to Sidebar

Update `components/SidebarMenu.tsx` to add predictions menu item:

```typescript
// In the menuItems array, add:
const menuItems = [
  { label: 'Home', path: '/home', show: true, icon: '🏠' },
  { label: 'Scan Results', path: '/scan', show: true, icon: '🔍' },
  { label: 'Player Stats', path: '/player-stats', show: true, icon: '📊' },
  { label: 'Predictions', path: '/predictions', show: true, icon: '🎯' }, // Add this line
  { label: 'Admin Panel', path: '/admin', show: isSuperAdmin, icon: '⚙️' },
].filter(item => item.show);
```

### Step 9.4: Update NavigationBar Title

Update `components/NavigationBar.tsx` to include predictions page title:

```typescript
// In the getPageTitle function, add:
const getPageTitle = () => {
  switch (pathname) {
    case '/home':
      return 'Home';
    case '/scan':
      return 'Scan Results';
    case '/player-stats':
      return 'Player Stats';
    case '/predictions':
      return 'Predictions'; // Add this case
    case '/admin':
      return 'Admin Panel';
    default:
      return 'Hedgeway';
  }
};
```

---

## Summary

### Files Created/Modified

1. **Database Schema:**
   - `database/schema.sql` - Add `predictions` and `model_performance` tables

2. **Services:**
   - `services/predictionService.js` - Prediction generation and management

3. **Routes:**
   - `routes/predictionRoutes.js` - API endpoints for predictions

4. **Integration:**
   - `services/scanService.js` - Integrate prediction generation into scan flow

5. **Frontend (NEW):**
   - `app/predictions.tsx` - New predictions page
   - `app/_layout.tsx` - Add predictions route
   - `components/SidebarMenu.tsx` - Add predictions menu item
   - `components/NavigationBar.tsx` - Add predictions page title

### Key Features Implemented

✅ Database tables for predictions and performance tracking  
✅ Prediction model combining player stats with odds data  
✅ Value bet identification  
✅ Outcome tracking and validation  
✅ Model performance metrics  
✅ API endpoints for accessing predictions  
✅ Integration with existing scan service  
✅ **Frontend page for viewing predictions**  
✅ **Value bet filtering and highlighting**  
✅ **Prop type and value threshold filters**  
✅ **Sorting options (by value, confidence, prop type, player name)**  
✅ **Game context display (game label, time, status, opponent)**  
✅ **Performance metrics visualization (accuracy, value bet accuracy, calibration)**  

### Next Steps

1. **Initial Testing:**
   - Test prediction generation on current games
   - Verify database inserts work correctly
   - Check API endpoints return expected data
   - Test frontend page displays predictions correctly

2. **Data Collection:**
   - Run predictions daily for upcoming games
   - Track outcomes as games complete
   - Build historical dataset for model improvement

3. **Model Refinement:**
   - Analyze performance metrics
   - Adjust weights and parameters
   - Add additional features
   - Consider more sophisticated models

4. **UI Enhancements:**
   - ✅ Sorting options (by value, confidence, prop type, player name) - Implemented
   - ✅ Performance metrics display - Implemented
   - ✅ Game context display - Implemented (requires API enhancement for full game context)
   - Create detailed prediction view with more stats
   - Add charts/graphs for performance metrics trends
   - Add export functionality for predictions

5. **Automation:**
   - Schedule daily prediction generation
   - Automate outcome updates after games
   - Generate performance reports weekly/monthly

---

## References

- [BallDontLie API Documentation](https://www.balldontlie.io/#introduction)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Sports Betting Prediction Models](https://www.kaggle.com/c/nfl-big-data-bowl-2021) - Example of sports prediction modeling
- [Calibration in Machine Learning](https://scikit-learn.org/stable/modules/calibration.html) - Understanding model calibration

---

## Notes

- **Model Versioning:** Use semantic versioning for models (e.g., v1.0.0). This allows tracking which model version made which predictions.

- **Value Threshold:** The 5% value threshold is a starting point. Adjust based on:
  - Betting unit sizes
  - Risk tolerance
  - Historical performance

- **Probability Calculation:** The current implementation uses a simplified normal distribution approximation. More sophisticated approaches could:
  - Use actual variance from recent games
  - Apply prop-type-specific variance estimates
  - Use empirical distributions from historical data

- **Performance Metrics:** Track metrics separately by prop type, as different stats have different variance and predictability.

- **Data Freshness:** Ensure player stats are up-to-date before generating predictions. Consider running predictions after daily stats updates.

