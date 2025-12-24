## Scan Game Status Backend Improvements (Optional)

This guide describes **optional backend enhancements** to make the “Hide Live/Finished” toggle on the Scan page more robust and explicit, without requiring changes to the existing UI.

The current frontend implementation uses `gameStatusMap` (string values) and some conservative heuristics to decide whether a game is **live/in-progress/finished**. These improvements standardize that on the server so the client can rely on a clear, explicit signal.

---

## 1. Goals

- **Standardize game status** for scan results.
- **Expose a simple boolean flag** per game, e.g. `isLiveOrFinished`, so the frontend can filter without parsing strings.
- **Avoid breaking existing clients** that already read `gameStatusMap`.

**Key idea:** the backend continues to provide `gameStatusMap` for display, but also provides **machine-friendly metadata** about each game’s phase.

---

## 2. Current Behavior and Data Shape

### 2.1. Existing Scan Results Response

From `DOCS/API_DOCUMENTATION.txt`, the `GET /api/scan/results` response currently looks like:

```json
{
  "arbs": [
    {
      "edge": 0.0250,
      "gameId": 12345,
      "playerId": 237,
      "propType": "points",
      "lineValue": 25.5,
      "marketType": "over_under",
      "over": { "odds": -110, "vendor": "fanduel" },
      "under": { "odds": -105, "vendor": "draftkings" },
      "timestamp": 1705319400000
    }
  ],
  "gameMap": { "12345": "LAL at BOS" },
  "playerNameMap": { "237": "LeBron James" },
  "gameTimeMap": { "12345": "2024-01-15T20:00:00Z" },
  "gameStatusMap": { "12345": "1st Qtr" },
  "date": "2024-01-15",
  "timestamp": 1705319400000,
  "nextRefreshSeconds": 60
}
```

The frontend currently:

- Reads `gameStatusMap[gameId]` (a human-readable string, e.g. `"1st Qtr"`, `"Final"`, `"Scheduled"`).
- Infers whether the game is live/finished from that string.

---

## 3. Option A – Add `gamePhaseMap` + `isLiveOrFinishedMap`

The **least invasive** improvement is to **add new fields** to the existing response, leaving current ones untouched.

### 3.1. New Fields

Enhance the response with:

- `gamePhaseMap: Record<string, 'pre' | 'live' | 'final' | 'unknown'>`
- `isLiveOrFinishedMap: Record<string, boolean>`

Example:

```json
{
  "gameStatusMap": {
    "12345": "1st Qtr"
  },
  "gamePhaseMap": {
    "12345": "live"
  },
  "isLiveOrFinishedMap": {
    "12345": true
  }
}
```

**Frontend behavior (optional future enhancement):**

- Instead of parsing `gameStatusMap`, the client can simply check:
  - `isLiveOrFinishedMap[gameId] === true` → hide when toggle is on.

### 3.2. Implementation Strategy

1. **Identify where scan results are built**  
   In the server codebase (not shown here), there will be a service or module that:
   - Fetches games,
   - Computes arbitrage opportunities,
   - Builds and stores the latest results object returned by `GET /api/scan/results`.

2. **Introduce a status normalization function**

Create a utility function that takes whatever raw status you get from upstream (BallDontLie or other source) and returns a normalized phase:

```js
// Pseudocode – adjust names/paths to your server’s structure
function getGamePhaseFromRawStatus(rawStatus) {
  if (!rawStatus) return 'unknown';

  const s = String(rawStatus).trim().toLowerCase();
  if (!s) return 'unknown';

  // Pre-game / not started
  const preKeywords = ['scheduled', 'upcoming', 'pre', 'pre-game', 'pregame', 'tipoff', 'tip-off'];

  // Live / in-progress
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
    'in-progress'
  ];

  // Finished
  const finalKeywords = ['final', 'finished', 'complete', 'full time', 'full-time', 'ft', 'ended'];

  if (preKeywords.some(k => s.includes(k))) return 'pre';
  if (liveKeywords.some(k => s.includes(k))) return 'live';
  if (finalKeywords.some(k => s.includes(k))) return 'final';

  return 'unknown';
}
```

3. **Derive `gamePhaseMap` and `isLiveOrFinishedMap`**

Where you build `gameStatusMap`, add:

```js
const gameStatusMap = {};          // existing
const gamePhaseMap = {};           // new
const isLiveOrFinishedMap = {};    // new

for (const game of games) {
  const id = String(game.id);

  // Existing display status
  const displayStatus = buildDisplayStatusFromUpstreamGame(game); // already exists
  gameStatusMap[id] = displayStatus;

  // New phase + boolean
  const phase = getGamePhaseFromRawStatus(displayStatus); // or from a raw status field
  gamePhaseMap[id] = phase;
  isLiveOrFinishedMap[id] = phase === 'live' || phase === 'final';
}

// In the final results object:
return {
  arbs,
  gameMap,
  playerNameMap,
  gameTimeMap,
  gameStatusMap,
  gamePhaseMap,          // new
  isLiveOrFinishedMap,   // new
  date,
  timestamp,
  nextRefreshSeconds
};
```

This keeps `gameStatusMap` for UI display and adds **two machine-oriented structures** that clients can choose to use.

---

## 4. Option B – Add a Per-Arb `isLiveOrFinished` Flag

As an alternative (or in addition), you can **annotate each arb** directly with a flag:

```json
{
  "arbs": [
    {
      "edge": 0.0250,
      "gameId": 12345,
      "playerId": 237,
      "propType": "points",
      "lineValue": 25.5,
      "marketType": "over_under",
      "over": { "odds": -110, "vendor": "fanduel" },
      "under": { "odds": -105, "vendor": "draftkings" },
      "timestamp": 1705319400000,
      "isLiveOrFinished": true   // new
    }
  ]
}
```

### 4.1. Implementation Strategy

1. **Compute the game phase once per game** (as described in Option A).
2. **When constructing each arb**, look up the phase for `arb.gameId`:

```js
const arbsWithFlags = arbs.map(arb => {
  const id = String(arb.gameId);
  const phase = gamePhaseMap[id] || 'unknown';

  return {
    ...arb,
    isLiveOrFinished: phase === 'live' || phase === 'final'
  };
});
```

3. **Return `arbsWithFlags` instead of the raw `arbs`** in the results object.

This allows the frontend to filter **only by fields on the arb itself**, without needing maps.

---

## 5. Backwards Compatibility

To avoid breaking existing clients:

- **Do not remove or rename**:
  - `gameStatusMap`
  - Existing arb fields (`edge`, `gameId`, `playerId`, etc.)
- **Add new fields only**:
  - `gamePhaseMap` and/or `isLiveOrFinishedMap`
  - `isLiveOrFinished` on each arb

Clients that don’t know about the new fields will continue to function as before. Newer clients (or future front-end refactors) can opt into the explicit flags when ready.

---

## 6. Testing Scenarios

After implementing the backend changes, validate with concrete examples:

### 6.1. Pre-Game Game

- Upstream status: `"Scheduled"` or similar.
- Expected:
  - `gamePhaseMap[id] === 'pre'`
  - `isLiveOrFinishedMap[id] === false`
  - Any arb for that game: `isLiveOrFinished === false`

### 6.2. Live Game

- Upstream status: `"1st Qtr"`, `"Q3"`, `"LIVE"`, `"In Progress"`, etc.
- Expected:
  - `gamePhaseMap[id] === 'live'`
  - `isLiveOrFinishedMap[id] === true`
  - Any arb for that game: `isLiveOrFinished === true`

### 6.3. Finished Game

- Upstream status: `"Final"`, `"Complete"`, `"Full Time"`, `"FT"`.
- Expected:
  - `gamePhaseMap[id] === 'final'`
  - `isLiveOrFinishedMap[id] === true`
  - Any arb for that game: `isLiveOrFinished === true`

### 6.4. Unknown/Edge Cases

- Upstream status is missing, empty, or unrecognized.
- Expected:
  - `gamePhaseMap[id] === 'unknown'`
  - `isLiveOrFinishedMap[id] === false` (conservative default)
  - Any arb for that game: `isLiveOrFinished === false`

This ensures that **pre-game games are never misclassified as live/finished**, aligning with the intended toggle behavior.

---

## 7. Summary

These backend improvements are **optional** but recommended for:

- **Cleaner frontend logic:** the client can rely on `isLiveOrFinished` instead of parsing status strings.
- **Better correctness:** status classification is centralized and tested once on the server.
- **Backwards compatibility:** existing consumers of `gameStatusMap` continue to work unchanged.

Recommended path:

1. Implement **Option A** (`gamePhaseMap` + `isLiveOrFinishedMap`) in the scan service.
2. Optionally implement **Option B** (per-arb `isLiveOrFinished`) for even simpler client filtering.
3. Once deployed, you may later update the frontend to use these explicit flags instead of heuristic parsing, if desired.

Test

