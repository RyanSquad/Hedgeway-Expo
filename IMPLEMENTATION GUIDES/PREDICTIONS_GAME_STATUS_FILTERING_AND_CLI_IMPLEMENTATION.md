# Predictions Game Status Filtering and CLI Implementation Guide

## Overview

This guide provides step-by-step instructions for:

1. **Ensuring finished games are completely filtered out** from the predictions view
2. **Adding a toggle button to filter in-progress games** (default: hidden)
3. **Creating a CLI (Command Line Interface)** for the predictions view

---

## Part 1: Prevent Finished Games from Showing

### Current Status

The predictions page already has some filtering for finished games implemented:
- `isFinishedGameStatus()` function (lines 397-419) checks if a status string indicates a finished game
- `isPredictionForFinishedGame()` function (lines 429-451) checks if a prediction is for a finished game
- Filtering is applied in `fetchPredictions()` (lines 588-593)

### Enhancement: Ensure Robust Filtering

While the basic filtering exists, we should ensure it's comprehensive and handles all edge cases.

#### Step 1.1: Verify Helper Functions Are Complete

The `isFinishedGameStatus()` function should handle all possible finished game statuses. Verify it includes:

```typescript
// Current implementation (lines 397-419) already includes:
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
```

**Action**: If your backend uses additional status strings for finished games, add them to this array.

#### Step 1.2: Ensure Filtering Happens at All Entry Points

The filtering should occur:
1. ✅ **After fetching from API** (already implemented at lines 588-593)
2. ✅ **Before displaying predictions** (already implemented)
3. ⚠️ **When refreshing predictions** (verify `onRefresh` calls `fetchPredictions`)

**Location**: Verify `onRefresh` function (lines 655-659) properly calls `fetchPredictions()`.

#### Step 1.3: Add Backend Filtering (Optional Enhancement)

For better performance, consider filtering finished games on the backend:

**Backend Endpoint Enhancement**:
- Modify `/api/predictions/value-bets` to exclude finished games
- Modify `/api/predictions/game/:gameId` to exclude finished games if the game is finished
- Add query parameter: `?excludeFinished=true` (default: true)

**Note**: This is optional. Client-side filtering works but backend filtering reduces data transfer.

---

## Part 2: Add Toggle to Filter In-Progress Games

### Goal

Add a toggle button that:
- **When ON (default)**: Hides predictions for games that are currently in progress
- **When OFF**: Shows all predictions (including in-progress games, but still excluding finished games)

### Implementation Steps

#### Step 2.1: Create Helper Function to Detect In-Progress Games

Add a new helper function after `isFinishedGameStatus()` (around line 420):

```typescript
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
```

**Location**: Add this function after `isFinishedGameStatus()` (around line 420) and before `isPredictionForFinishedGame()`.

#### Step 2.2: Create Helper Function to Check if Prediction is for In-Progress Game

Add another helper function after `isInProgressGameStatus()`:

```typescript
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
```

**Location**: Add this function immediately after `isInProgressGameStatus()`.

#### Step 2.3: Add State for Hide In-Progress Toggle

Add a new state variable in the `PredictionsPage` component (around line 461, after `showValueBetsOnly`):

```typescript
const [hideInProgressGames, setHideInProgressGames] = useState(true); // Default: true (hidden)
```

**Location**: Add this line after line 461 in the component state declarations.

#### Step 2.4: Update `fetchPredictions` to Filter In-Progress Games

In the `fetchPredictions` function, add filtering for in-progress games **after** filtering finished games:

```typescript
// Filter out predictions for finished games
const initialCount = predictionsToSet.length;
predictionsToSet = predictionsToSet.filter((pred: Prediction) => 
  !isPredictionForFinishedGame(pred, games)
);
console.log(`[Predictions] Filtered out finished games: ${initialCount} -> ${predictionsToSet.length} predictions`);

// NEW: Filter out predictions for in-progress games if toggle is enabled
if (hideInProgressGames) {
  const beforeInProgressFilter = predictionsToSet.length;
  predictionsToSet = predictionsToSet.filter((pred: Prediction) => 
    !isPredictionForInProgressGame(pred, games)
  );
  console.log(`[Predictions] Filtered out in-progress games: ${beforeInProgressFilter} -> ${predictionsToSet.length} predictions`);
}
```

**Location**: Add this code block after line 593 (after the finished games filter) and before the game selection filter (line 595).

#### Step 2.5: Update `fetchPredictions` Dependency Array

Add `hideInProgressGames` to the dependency array of `fetchPredictions`:

```typescript
}, [propTypeFilter, minValue, minConfidence, showValueBetsOnly, selectedGameId, games, hideInProgressGames]);
```

**Location**: Update line 645 to include `hideInProgressGames` in the dependency array.

#### Step 2.6: Add Toggle Button to UI

Add the toggle button in the filters section, next to the "Value Bets Only" button:

```typescript
<Button
  onPress={() => setHideInProgressGames(!hideInProgressGames)}
  backgroundColor={hideInProgressGames ? "$blue9" : "$gray5"}
  color="white"
>
  {hideInProgressGames ? 'Show In-Progress' : 'Hide In-Progress'}
</Button>
```

**Location**: Add this button in the filters section (around line 1550), after the "Value Bets Only" button and before the closing `</XStack>` tag.

**Full Context** (around line 1544-1551):

```typescript
<Button
  onPress={() => setShowValueBetsOnly(!showValueBetsOnly)}
  backgroundColor={showValueBetsOnly ? "$blue9" : "$gray5"}
  color="white"
>
  {showValueBetsOnly ? 'Show All' : 'Value Bets Only'}
</Button>

{/* NEW: Hide In-Progress Games Toggle */}
<Button
  onPress={() => setHideInProgressGames(!hideInProgressGames)}
  backgroundColor={hideInProgressGames ? "$blue9" : "$gray5"}
  color="white"
>
  {hideInProgressGames ? 'Show In-Progress' : 'Hide In-Progress'}
</Button>
```

---

## Part 3: Create CLI for Predictions View

### Goal

Create a command-line interface (CLI) script that allows users to:
- View predictions from the terminal
- Filter predictions by various criteria
- Export predictions to CSV/JSON
- Generate predictions via command line

### Implementation Steps

#### Step 3.1: Create CLI Script File

Create a new file: `scripts/predictions-cli.js`

```javascript
#!/usr/bin/env node

/**
 * Predictions CLI
 * 
 * Command-line interface for viewing and managing predictions
 * 
 * Usage:
 *   node scripts/predictions-cli.js list [options]
 *   node scripts/predictions-cli.js value-bets [options]
 *   node scripts/predictions-cli.js game <gameId> [options]
 *   node scripts/predictions-cli.js generate [options]
 *   node scripts/predictions-cli.js export [options]
 */

const { program } = require('commander');
const fs = require('fs').promises;
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// API base URL (adjust based on your setup)
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const API_TOKEN = process.env.API_TOKEN || process.env.ACCESS_TOKEN;

/**
 * Make API request
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(API_TOKEN && { Authorization: `Bearer ${API_TOKEN}` }),
    ...(options.headers || {}),
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error: ${response.status} - ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Request failed:', error.message);
    throw error;
  }
}

/**
 * Format prediction for display
 */
function formatPrediction(pred, options = {}) {
  const {
    player_first_name,
    player_last_name,
    team_abbreviation,
    prop_type,
    line_value,
    best_over_odds,
    best_under_odds,
    predicted_value_over,
    predicted_value_under,
    predicted_prob_over,
    predicted_prob_under,
    confidence_score,
    over_vendor,
    under_vendor,
  } = pred;

  const playerName = `${player_first_name} ${player_last_name}`;
  const bestValue = Math.max(
    predicted_value_over || 0,
    predicted_value_under || 0
  );
  const valueSide = (predicted_value_over || 0) > (predicted_value_under || 0) ? 'OVER' : 'UNDER';
  const bestOdds = valueSide === 'OVER' ? best_over_odds : best_under_odds;
  const vendor = valueSide === 'OVER' ? over_vendor : under_vendor;
  const predictedProb = valueSide === 'OVER' ? predicted_prob_over : predicted_prob_under;

  const lines = [
    `\n${'='.repeat(60)}`,
    `Player: ${playerName} (${team_abbreviation || 'N/A'})`,
    `Prop: ${prop_type.toUpperCase()} ${line_value}`,
    `Value Bet: ${valueSide} | Value: ${(bestValue * 100).toFixed(1)}%`,
    `Predicted Probability: ${(predictedProb * 100).toFixed(1)}%`,
    `Market Odds: ${formatOdds(bestOdds)} (${vendor || 'N/A'})`,
    `Confidence Score: ${(confidence_score * 100).toFixed(1)}%`,
  ];

  if (options.verbose) {
    lines.push(
      `Over Odds: ${formatOdds(best_over_odds)} (${over_vendor || 'N/A'})`,
      `Under Odds: ${formatOdds(best_under_odds)} (${under_vendor || 'N/A'})`,
      `Over Value: ${predicted_value_over ? (predicted_value_over * 100).toFixed(1) + '%' : 'N/A'}`,
      `Under Value: ${predicted_value_under ? (predicted_value_under * 100).toFixed(1) + '%' : 'N/A'}`
    );
  }

  return lines.join('\n');
}

/**
 * Format odds for display
 */
function formatOdds(odds) {
  if (odds === null || odds === undefined) return 'N/A';
  if (odds > 0) return `+${odds}`;
  return odds.toString();
}

/**
 * List all predictions
 */
async function listPredictions(options) {
  try {
    const params = new URLSearchParams();
    if (options.propType && options.propType !== 'all') {
      params.append('propType', options.propType);
    }
    if (options.minValue) {
      params.append('minValue', options.minValue);
    }
    if (options.minConfidence) {
      params.append('minConfidence', options.minConfidence);
    }

    const endpoint = `/api/predictions/value-bets${params.toString() ? '?' + params.toString() : ''}`;
    console.log(`Fetching predictions from: ${endpoint}`);

    const response = await apiRequest(endpoint);
    const predictions = response.valueBets || response.predictions || [];

    if (predictions.length === 0) {
      console.log('No predictions found.');
      return [];
    }

    console.log(`\nFound ${predictions.length} prediction(s):\n`);

    predictions.forEach((pred, index) => {
      console.log(`${index + 1}. ${formatPrediction(pred, options)}`);
    });

    return predictions;
  } catch (error) {
    console.error('Error listing predictions:', error.message);
    throw error;
  }
}

/**
 * Get predictions for a specific game
 */
async function getGamePredictions(gameId, options) {
  try {
    const params = new URLSearchParams();
    if (options.propType && options.propType !== 'all') {
      params.append('propType', options.propType);
    }

    const endpoint = `/api/predictions/game/${gameId}${params.toString() ? '?' + params.toString() : ''}`;
    console.log(`Fetching predictions for game ${gameId} from: ${endpoint}`);

    const response = await apiRequest(endpoint);
    const predictions = response.predictions || [];

    if (predictions.length === 0) {
      console.log(`No predictions found for game ${gameId}.`);
      return [];
    }

    console.log(`\nFound ${predictions.length} prediction(s) for game ${gameId}:\n`);

    predictions.forEach((pred, index) => {
      console.log(`${index + 1}. ${formatPrediction(pred, options)}`);
    });

    return predictions;
  } catch (error) {
    console.error(`Error fetching predictions for game ${gameId}:`, error.message);
    throw error;
  }
}

/**
 * Get value bets only
 */
async function getValueBets(options) {
  try {
    const params = new URLSearchParams();
    params.append('minValue', options.minValue || '0.05');
    params.append('minConfidence', options.minConfidence || '0.5');
    if (options.propType && options.propType !== 'all') {
      params.append('propType', options.propType);
    }

    const endpoint = `/api/predictions/value-bets?${params.toString()}`;
    console.log(`Fetching value bets from: ${endpoint}`);

    const response = await apiRequest(endpoint);
    const valueBets = response.valueBets || [];

    if (valueBets.length === 0) {
      console.log('No value bets found.');
      return [];
    }

    console.log(`\nFound ${valueBets.length} value bet(s):\n`);

    // Sort by value (descending)
    valueBets.sort((a, b) => {
      const aValue = Math.max(a.predicted_value_over || 0, a.predicted_value_under || 0);
      const bValue = Math.max(b.predicted_value_over || 0, b.predicted_value_under || 0);
      return bValue - aValue;
    });

    valueBets.forEach((pred, index) => {
      console.log(`${index + 1}. ${formatPrediction(pred, options)}`);
    });

    return valueBets;
  } catch (error) {
    console.error('Error fetching value bets:', error.message);
    throw error;
  }
}

/**
 * Generate predictions for today
 */
async function generatePredictions(options) {
  try {
    console.log('Generating predictions for today...');
    const response = await apiRequest('/api/predictions/generate/today', {
      method: 'POST',
    });

    console.log('Predictions generated successfully!');
    console.log(`Generated ${response.count || 0} prediction(s).`);

    if (options.listAfter) {
      console.log('\n--- Generated Predictions ---');
      await listPredictions({ ...options, minValue: '0' });
    }

    return response;
  } catch (error) {
    console.error('Error generating predictions:', error.message);
    throw error;
  }
}

/**
 * Export predictions to file
 */
async function exportPredictions(options) {
  try {
    let predictions = [];

    if (options.gameId) {
      predictions = await getGamePredictions(options.gameId, { ...options, silent: true });
    } else if (options.valueBetsOnly) {
      predictions = await getValueBets({ ...options, silent: true });
    } else {
      predictions = await listPredictions({ ...options, silent: true });
    }

    if (predictions.length === 0) {
      console.log('No predictions to export.');
      return;
    }

    const format = options.format || 'json';
    const filename = options.output || `predictions-${Date.now()}.${format}`;

    let content;
    if (format === 'json') {
      content = JSON.stringify(predictions, null, 2);
    } else if (format === 'csv') {
      // Convert to CSV
      const headers = [
        'Player Name',
        'Team',
        'Prop Type',
        'Line Value',
        'Value Side',
        'Value %',
        'Predicted Prob %',
        'Market Odds',
        'Vendor',
        'Confidence %',
      ];
      const rows = predictions.map(pred => {
        const playerName = `${pred.player_first_name} ${pred.player_last_name}`;
        const bestValue = Math.max(
          pred.predicted_value_over || 0,
          pred.predicted_value_under || 0
        );
        const valueSide = (pred.predicted_value_over || 0) > (pred.predicted_value_under || 0) ? 'OVER' : 'UNDER';
        const bestOdds = valueSide === 'OVER' ? pred.best_over_odds : pred.best_under_odds;
        const vendor = valueSide === 'OVER' ? pred.over_vendor : pred.under_vendor;
        const predictedProb = valueSide === 'OVER' ? pred.predicted_prob_over : pred.predicted_prob_under;

        return [
          playerName,
          pred.team_abbreviation || '',
          pred.prop_type,
          pred.line_value,
          valueSide,
          (bestValue * 100).toFixed(1),
          (predictedProb * 100).toFixed(1),
          formatOdds(bestOdds),
          vendor || '',
          (pred.confidence_score * 100).toFixed(1),
        ];
      });

      content = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
      ].join('\n');
    } else {
      throw new Error(`Unsupported format: ${format}. Use 'json' or 'csv'.`);
    }

    await fs.writeFile(filename, content, 'utf8');
    console.log(`Exported ${predictions.length} prediction(s) to ${filename}`);
  } catch (error) {
    console.error('Error exporting predictions:', error.message);
    throw error;
  }
}

// CLI Setup
program
  .name('predictions-cli')
  .description('CLI tool for managing predictions')
  .version('1.0.0');

// List command
program
  .command('list')
  .description('List all predictions')
  .option('-p, --prop-type <type>', 'Filter by prop type (points, assists, etc.)', 'all')
  .option('-v, --min-value <value>', 'Minimum value threshold (default: 0)', '0')
  .option('-c, --min-confidence <confidence>', 'Minimum confidence threshold (default: 0)', '0')
  .option('--verbose', 'Show detailed information')
  .action(listPredictions);

// Value bets command
program
  .command('value-bets')
  .description('List value bets only')
  .option('-p, --prop-type <type>', 'Filter by prop type', 'all')
  .option('-v, --min-value <value>', 'Minimum value threshold (default: 0.05)', '0.05')
  .option('-c, --min-confidence <confidence>', 'Minimum confidence threshold (default: 0.5)', '0.5')
  .option('--verbose', 'Show detailed information')
  .action(getValueBets);

// Game command
program
  .command('game <gameId>')
  .description('Get predictions for a specific game')
  .option('-p, --prop-type <type>', 'Filter by prop type', 'all')
  .option('--verbose', 'Show detailed information')
  .action((gameId, options) => getGamePredictions(parseInt(gameId), options));

// Generate command
program
  .command('generate')
  .description('Generate predictions for today')
  .option('--list-after', 'List predictions after generating')
  .action(generatePredictions);

// Export command
program
  .command('export')
  .description('Export predictions to file')
  .option('-g, --game-id <id>', 'Export predictions for specific game')
  .option('--value-bets-only', 'Export only value bets')
  .option('-p, --prop-type <type>', 'Filter by prop type', 'all')
  .option('-v, --min-value <value>', 'Minimum value threshold', '0')
  .option('-c, --min-confidence <confidence>', 'Minimum confidence threshold', '0')
  .option('-f, --format <format>', 'Export format (json or csv)', 'json')
  .option('-o, --output <file>', 'Output filename')
  .action(exportPredictions);

// Parse arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
```

#### Step 3.2: Install Required Dependencies

Add the following dependencies to `package.json`:

```json
{
  "dependencies": {
    "commander": "^11.0.0",
    "dotenv": "^16.3.1"
  }
}
```

Or install via npm:

```bash
npm install commander dotenv
```

**Note**: If using Node.js 18+, `fetch` is built-in. For older Node versions, you may need to install `node-fetch`.

#### Step 3.3: Make Script Executable

Make the script executable:

```bash
chmod +x scripts/predictions-cli.js
```

#### Step 3.4: Add npm Script (Optional)

Add a script to `package.json` for easier access:

```json
{
  "scripts": {
    "predictions": "node scripts/predictions-cli.js"
  }
}
```

Then you can run: `npm run predictions list`

#### Step 3.5: Usage Examples

After implementation, users can run:

```bash
# List all predictions
node scripts/predictions-cli.js list

# List value bets only
node scripts/predictions-cli.js value-bets

# List value bets with filters
node scripts/predictions-cli.js value-bets --prop-type points --min-value 0.07

# Get predictions for a specific game
node scripts/predictions-cli.js game 12345

# Generate predictions for today
node scripts/predictions-cli.js generate

# Export predictions to CSV
node scripts/predictions-cli.js export --value-bets-only --format csv --output value-bets.csv

# Export with filters
node scripts/predictions-cli.js export --prop-type points --min-value 0.05 --format json
```

---

## Testing Checklist

### Part 1: Finished Games Filtering

- [ ] Verify finished games are never displayed in predictions
- [ ] Test with various finished game statuses: "Final", "finished", "complete", etc.
- [ ] Verify filtering works when selecting a specific game
- [ ] Verify filtering works with "Value Bets Only" toggle enabled
- [ ] Check console logs show correct filtering counts

### Part 2: In-Progress Games Toggle

- [ ] Toggle button appears in the filters section
- [ ] Default state: in-progress games are hidden
- [ ] When toggle is ON: in-progress games are hidden
- [ ] When toggle is OFF: in-progress games are shown
- [ ] Finished games remain hidden regardless of toggle state
- [ ] Toggle works with other filters (prop type, value bets, etc.)
- [ ] Test with various in-progress statuses: "1st Qtr", "Halftime", "Live", etc.

### Part 3: CLI

- [ ] CLI script can be executed: `node scripts/predictions-cli.js --help`
- [ ] `list` command displays predictions
- [ ] `value-bets` command filters to value bets only
- [ ] `game <gameId>` command shows predictions for specific game
- [ ] `generate` command triggers prediction generation
- [ ] `export` command creates JSON/CSV files
- [ ] All filter options work correctly
- [ ] Error handling works for invalid inputs

---

## Related Files

- `app/predictions.tsx` - Main predictions page component
- `scripts/predictions-cli.js` - CLI script (to be created)
- `IMPLEMENTATION GUIDES/PREDICTIONS_FILTER_FINISHED_GAMES_IMPLEMENTATION.md` - Existing finished games filter guide
- `IMPLEMENTATION GUIDES/HIDE_LIVE_FINISHED_TOGGLE_IMPLEMENTATION.md` - Similar toggle implementation for scan page

---

## Notes

1. **Finished Games Filtering**: Already implemented, but this guide ensures it's comprehensive and handles edge cases.

2. **In-Progress Games Toggle**: This is a new feature. The default behavior (hidden) ensures users only see actionable predictions for games that haven't started yet.

3. **CLI**: The CLI provides programmatic access to predictions, useful for:
   - Automation scripts
   - Data analysis
   - Integration with other tools
   - Batch operations

4. **Performance**: Client-side filtering works well for moderate data sizes. For large datasets, consider implementing backend filtering.

5. **Status Detection**: The status detection relies on string matching. If your backend provides structured status fields (e.g., `isLive`, `isFinished`), prefer using those for more reliable detection.

---

## Future Enhancements

1. **Backend Status Flags**: Add `isLive` and `isFinished` boolean fields to game objects for more reliable status detection.

2. **CLI Enhancements**:
   - Add interactive mode
   - Add watch mode (auto-refresh)
   - Add comparison mode (compare predictions across dates)
   - Add statistics/analytics commands

3. **Filter Persistence**: Save filter preferences (including hide in-progress toggle) to localStorage.

4. **Real-time Updates**: Use WebSockets or polling to update predictions in real-time as games start/finish.

