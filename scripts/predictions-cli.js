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
 * 
 * Environment Variables:
 *   API_BASE_URL - Base URL for the API (default: https://hedgeway-server-production.up.railway.app)
 *   API_TOKEN - Bearer token for authentication (required for protected endpoints)
 */

const fs = require('fs').promises;
const path = require('path');

// Load environment variables from .env file if it exists
try {
  const envPath = path.join(__dirname, '..', '.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').replace(/^["']|["']$/g, '');
        process.env[key] = value;
      }
    }
  });
} catch (error) {
  // .env file doesn't exist or can't be read - that's okay
}

// API configuration
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 
                     process.env.API_BASE_URL || 
                     'https://hedgeway-server-production.up.railway.app';
const API_TOKEN = process.env.API_TOKEN || process.env.ACCESS_TOKEN;

// Check if fetch is available (Node.js 18+)
let fetch;
if (typeof globalThis.fetch === 'function') {
  fetch = globalThis.fetch;
} else {
  // Try to use node-fetch for older Node versions
  try {
    fetch = require('node-fetch');
  } catch (error) {
    console.error('Error: fetch is not available. Please use Node.js 18+ or install node-fetch:');
    console.error('  npm install node-fetch');
    process.exit(1);
  }
}

/**
 * Make API request
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
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
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText };
      }
      throw new Error(`API Error: ${response.status} - ${errorData.error || errorData.message || errorText}`);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    } else {
      const text = await response.text();
      return { data: text };
    }
  } catch (error) {
    if (error.message.includes('API Error')) {
      throw error;
    }
    console.error('Request failed:', error.message);
    throw error;
  }
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
 * Format decimal odds from American odds
 */
function formatDecimalOdds(americanOdds) {
  if (americanOdds === null || americanOdds === undefined) return 'N/A';
  if (americanOdds > 0) {
    return ((americanOdds / 100) + 1).toFixed(2);
  } else {
    return ((100 / Math.abs(americanOdds)) + 1).toFixed(2);
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
    opponent_team,
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
    `Player: ${playerName} (${team_abbreviation || 'N/A'})${opponent_team ? ` vs ${opponent_team}` : ''}`,
    `Prop: ${prop_type.toUpperCase()} ${line_value}`,
    `Value Bet: ${valueSide} | Value: ${(bestValue * 100).toFixed(1)}%`,
    `Predicted Probability: ${(predictedProb * 100).toFixed(1)}%`,
    `Market Odds: ${formatOdds(bestOdds)} (${formatDecimalOdds(bestOdds)}) | ${vendor || 'N/A'}`,
    `Confidence Score: ${(confidence_score * 100).toFixed(1)}%`,
  ];

  if (options.verbose) {
    lines.push(
      `\nDetailed Information:`,
      `  Over Odds: ${formatOdds(best_over_odds)} (${formatDecimalOdds(best_over_odds)}) | ${over_vendor || 'N/A'}`,
      `  Under Odds: ${formatOdds(best_under_odds)} (${formatDecimalOdds(best_under_odds)}) | ${under_vendor || 'N/A'}`,
      `  Over Value: ${predicted_value_over ? (predicted_value_over * 100).toFixed(1) + '%' : 'N/A'}`,
      `  Under Value: ${predicted_value_under ? (predicted_value_under * 100).toFixed(1) + '%' : 'N/A'}`,
      `  Over Probability: ${predicted_prob_over ? (predicted_prob_over * 100).toFixed(1) + '%' : 'N/A'}`,
      `  Under Probability: ${predicted_prob_under ? (predicted_prob_under * 100).toFixed(1) + '%' : 'N/A'}`
    );
  }

  return lines.join('\n');
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
    
    // Backend filtering parameters
    params.append('excludeFinished', options.excludeFinished !== false ? 'true' : 'false');
    if (options.excludeInProgress) {
      params.append('excludeInProgress', 'true');
    }

    const endpoint = `/api/predictions/value-bets${params.toString() ? '?' + params.toString() : ''}`;
    if (!options.silent) {
      console.log(`Fetching predictions from: ${endpoint}`);
    }

    const response = await apiRequest(endpoint);
    const predictions = response.valueBets || response.predictions || [];

    if (predictions.length === 0) {
      if (!options.silent) {
        console.log('No predictions found.');
      }
      return [];
    }

    if (!options.silent) {
      console.log(`\nFound ${predictions.length} prediction(s):\n`);
      predictions.forEach((pred, index) => {
        console.log(`${index + 1}. ${formatPrediction(pred, options)}`);
      });
    }

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
    
    // Backend filtering parameters
    params.append('excludeFinished', options.excludeFinished !== false ? 'true' : 'false');
    if (options.excludeInProgress) {
      params.append('excludeInProgress', 'true');
    }

    const endpoint = `/api/predictions/game/${gameId}${params.toString() ? '?' + params.toString() : ''}`;
    if (!options.silent) {
      console.log(`Fetching predictions for game ${gameId} from: ${endpoint}`);
    }

    const response = await apiRequest(endpoint);
    const predictions = response.predictions || [];

    if (predictions.length === 0) {
      if (!options.silent) {
        console.log(`No predictions found for game ${gameId}.`);
      }
      return [];
    }

    if (!options.silent) {
      console.log(`\nFound ${predictions.length} prediction(s) for game ${gameId}:\n`);
      predictions.forEach((pred, index) => {
        console.log(`${index + 1}. ${formatPrediction(pred, options)}`);
      });
    }

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
    
    // Backend filtering parameters
    params.append('excludeFinished', options.excludeFinished !== false ? 'true' : 'false');
    if (options.excludeInProgress) {
      params.append('excludeInProgress', 'true');
    }

    const endpoint = `/api/predictions/value-bets?${params.toString()}`;
    if (!options.silent) {
      console.log(`Fetching value bets from: ${endpoint}`);
    }

    const response = await apiRequest(endpoint);
    const valueBets = response.valueBets || [];

    if (valueBets.length === 0) {
      if (!options.silent) {
        console.log('No value bets found.');
      }
      return [];
    }

    // Sort by value (descending)
    valueBets.sort((a, b) => {
      const aValue = Math.max(a.predicted_value_over || 0, a.predicted_value_under || 0);
      const bValue = Math.max(b.predicted_value_over || 0, b.predicted_value_under || 0);
      return bValue - aValue;
    });

    if (!options.silent) {
      console.log(`\nFound ${valueBets.length} value bet(s):\n`);
      valueBets.forEach((pred, index) => {
        console.log(`${index + 1}. ${formatPrediction(pred, options)}`);
      });
    }

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
    
    // Prepare options with backend filtering parameters
    const exportOptions = {
      ...options,
      silent: true,
      excludeFinished: options.excludeFinished !== false, // Default to true
      excludeInProgress: options.excludeInProgress || false,
    };

    if (options.gameId) {
      predictions = await getGamePredictions(options.gameId, exportOptions);
    } else if (options.valueBetsOnly) {
      predictions = await getValueBets(exportOptions);
    } else {
      predictions = await listPredictions(exportOptions);
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
        'Opponent',
        'Prop Type',
        'Line Value',
        'Value Side',
        'Value %',
        'Predicted Prob %',
        'Market Odds',
        'Decimal Odds',
        'Vendor',
        'Confidence %',
        'Over Odds',
        'Over Vendor',
        'Under Odds',
        'Under Vendor',
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
          pred.opponent_team || '',
          pred.prop_type,
          pred.line_value,
          valueSide,
          (bestValue * 100).toFixed(1),
          (predictedProb * 100).toFixed(1),
          formatOdds(bestOdds),
          formatDecimalOdds(bestOdds),
          vendor || '',
          (pred.confidence_score * 100).toFixed(1),
          formatOdds(pred.best_over_odds),
          pred.over_vendor || '',
          formatOdds(pred.best_under_odds),
          pred.under_vendor || '',
        ];
      });

      content = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
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

// Simple command parser (since we don't want to add commander as a dependency)
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  console.log(`
Predictions CLI - Command-line interface for managing predictions

Usage:
  node scripts/predictions-cli.js <command> [options]

Commands:
  list                    List all predictions
  value-bets              List value bets only
  game <gameId>           Get predictions for a specific game
  generate                 Generate predictions for today
  export                  Export predictions to file

Options:
  --prop-type <type>      Filter by prop type (points, assists, etc.)
  --min-value <value>     Minimum value threshold (default: 0 for list, 0.05 for value-bets)
  --min-confidence <conf> Minimum confidence threshold (default: 0 for list, 0.5 for value-bets)
  --exclude-finished       Exclude finished games (default: true)
  --include-finished       Include finished games (overrides exclude-finished)
  --exclude-in-progress    Exclude in-progress games
  --verbose               Show detailed information
  --format <format>       Export format: json or csv (default: json)
  --output <file>         Output filename for export
  --list-after            List predictions after generating
  --game-id <id>          Game ID for export command
  --value-bets-only       Export only value bets

Environment Variables:
  API_BASE_URL            Base URL for the API
  API_TOKEN               Bearer token for authentication

Examples:
  node scripts/predictions-cli.js list
  node scripts/predictions-cli.js value-bets --prop-type points --min-value 0.07
  node scripts/predictions-cli.js game 12345
  node scripts/predictions-cli.js generate --list-after
  node scripts/predictions-cli.js export --value-bets-only --format csv --output value-bets.csv
`);
  process.exit(0);
}

// Parse options from args
function parseOptions(args) {
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2).replace(/-/g, '');
      const nextArg = args[i + 1];
      if (nextArg && !nextArg.startsWith('--')) {
        options[key] = nextArg;
        i++;
      } else {
        options[key] = true;
      }
    }
  }
  
  // Handle excludeFinished/includeFinished logic
  if (options.includefinished) {
    options.excludeFinished = false;
  }
  
  return options;
}

// Execute command
const command = args[0];
const options = parseOptions(args.slice(1));

(async () => {
  try {
    switch (command) {
      case 'list':
        await listPredictions(options);
        break;
      case 'value-bets':
        await getValueBets(options);
        break;
      case 'game':
        const gameId = args[1];
        if (!gameId || isNaN(parseInt(gameId))) {
          console.error('Error: game command requires a valid game ID');
          console.error('Usage: node scripts/predictions-cli.js game <gameId> [options]');
          process.exit(1);
        }
        await getGamePredictions(parseInt(gameId), parseOptions(args.slice(2)));
        break;
      case 'generate':
        await generatePredictions(options);
        break;
      case 'export':
        await exportPredictions(options);
        break;
      default:
        console.error(`Unknown command: ${command}`);
        console.error('Run with --help to see available commands');
        process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error.message);
    if (error.message.includes('401') || error.message.includes('Authentication')) {
      console.error('\nNote: Authentication may be required. Set API_TOKEN environment variable.');
    }
    process.exit(1);
  }
})();

