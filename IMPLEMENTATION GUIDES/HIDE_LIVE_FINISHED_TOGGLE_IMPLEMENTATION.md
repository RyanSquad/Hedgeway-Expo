## Hide Live/Finished Toggle Implementation Guide

This guide explains how to correctly implement the **“Hide Live/Finished”** toggle so that:

- **When the toggle is ON**: only games that are **in progress / live / finished** are hidden.
- **When the toggle is OFF**: the toggle has **no effect** and **all games (including live/finished and not-yet-started)** are shown.

The current behavior hides games that have **not yet started** when the toggle is used. This guide describes how to fix that behavior without changing the existing UI look and feel.

---

## 1. Clarify the Intended Behavior

### 1.1. Game Status Definitions

First, confirm (or define) the status values your backend or schedule model uses. Typical examples:

- **Pre-game / not started**: `scheduled`, `upcoming`, `pre_game`, `not_started`
- **In progress / live**: `in_progress`, `live`, `1Q`, `2Q`, `HALF`, `3Q`, `4Q`, `OT`, etc.
- **Finished**: `final`, `complete`, `finished`

You will need a **reliable way to tell which bucket a game is in** (pre-game vs live vs finished), usually via a `status` or `status_code` field on the game object.

Create or verify helper predicates (conceptually, names can be adjusted to match your existing codebase):

- `isPreGame(game)`: returns **true** only if the game has **not started yet**.
- `isLiveOrFinished(game)`: returns **true** only if the game is **currently in progress or completed**.

These helpers should be **pure functions** that only inspect the game’s status fields.

---

## 2. Locate the Toggle and Filtering Logic

### 2.1. Find the Toggle State

Search in your schedule or games screen for a state variable and UI control that handle the “Hide Live/Finished” toggle. Common patterns:

- `const [hideLiveFinished, setHideLiveFinished] = useState(false);`
- A switch or checkbox component labelled something like **“Hide Live/Finished”**, **“Hide Active Games”**, or similar.

The toggle component will typically:

- Read the current boolean value (`hideLiveFinished`), and
- Call `setHideLiveFinished(!hideLiveFinished)` or similar when the user toggles it.

Keep the **UI component, labels, and styling exactly as they are** to preserve the existing look and feel.

### 2.2. Find the Games List Derivation

Locate where the **list of games actually rendered** is computed. Common patterns:

- A `useMemo` or inline filter, for example:
  - `const filteredGames = useMemo(() => games.filter(...), [games, hideLiveFinished]);`
  - `games.filter(...)` directly in JSX.

This is where the current logic is likely **incorrectly excluding pre-game games** when the toggle is on.

---

## 3. Fix the Filtering Logic

### 3.1. High-Level Filtering Rules

Implement the filtering based on these rules:

- **Rule A**: If `hideLiveFinished` is **false** → **do not filter by status at all** (return all games).
- **Rule B**: If `hideLiveFinished` is **true** → **only remove live/finished games**, but **keep all pre-game games**.

In pseudocode:

```ts
if (!hideLiveFinished) {
  // Toggle is OFF → show everything
  return allGames;
}

// Toggle is ON → only hide live/finished games
return allGames.filter(game => !isLiveOrFinished(game));
```

The **key correction** is to **avoid filtering out pre-game games** when the toggle is on. If any existing code currently says something like:

- `if (hideLiveFinished) return games.filter(game => isPreGame(game));`
  
that still yields the right result **only if** `isPreGame` is correctly implemented. However, if pre-game games are being lost, it usually means:

- The condition is using the wrong predicate (e.g., `!isPreGame` instead of `isPreGame`), or
- The status mapping for pre-game values is incomplete or incorrect.

Make sure your final expression is logically equivalent to:

```ts
const visibleGames = hideLiveFinished
  ? games.filter(game => !isLiveOrFinished(game))
  : games;
```

### 3.2. Avoid Side Effects in Filtering

Keep the filter **pure**:

- No network calls, no state updates, no logging that depends on React state inside the filter callback.
- The filter should only **read** the game’s status fields and the `hideLiveFinished` flag.

This ensures predictable rendering and avoids performance issues.

---

## 4. Status Classification Helpers

### 4.1. Implement or Verify `isPreGame`

Ensure that all “not started yet” codes are covered. For example, if you get a `game.status` from an external API:

- Map status codes to your internal categories once (e.g., in a utility function or adapter).
- `isPreGame(game)` should return **true** for every code that means “not yet started”.

Examples of pre-game codes (adjust to your data source):

- `scheduled`
- `upcoming`
- `pre_game`
- `tipoff_pending`

If there’s a numeric or enum field (e.g., `game.status_type === 'pre'`), use that consistently in the helper.

### 4.2. Implement or Verify `isLiveOrFinished`

Similarly, ensure **every in-progress and finished state** is considered “live/finished”. Examples:

- Live/in-progress: `in_progress`, `live`, `Q1`, `Q2`, `Q3`, `Q4`, `OT`, `halftime`
- Finished: `final`, `complete`, `full_time`, `over`

You want `isLiveOrFinished(game)` to be **true** for all of those, and **false** for true pre-game states.

If your status model uses separate fields (e.g., `game.is_live` and `game.is_final`), `isLiveOrFinished` can simply be:

- `return game.is_live || game.is_final;`

---

## 5. End-to-End Behavior Scenarios

After updating the filter logic, validate the behavior with concrete scenarios.

### 5.1. Mixed Status List

Assume the list includes:

- Game A: `scheduled` (not started)
- Game B: `in_progress`
- Game C: `final`

**Toggle OFF (`hideLiveFinished === false`)**

- Visible: **A, B, C**

**Toggle ON (`hideLiveFinished === true`)**

- Visible: **A only** (B and C are hidden, because they are live/finished)

### 5.2. All Pre-Game

All games in the list are `scheduled` or other pre-game codes.

- Toggle OFF → all pre-game games visible.
- Toggle ON → still **all** pre-game games visible (nothing should disappear).

### 5.3. All Live/Finished

All games in the list are `in_progress` or `final`.

- Toggle OFF → all games visible.
- Toggle ON → **no games visible** (because they are all live/finished).

Confirm that this is an acceptable UX outcome for your use case. If you prefer a message like “No games to show,” ensure your empty-state UI is already handling that case.

---

## 6. Regression Checks and Edge Cases

After implementing the corrected logic, verify the following:

- **No impact to UI styling**:
  - The toggle control looks and behaves the same visually.
  - No layout shifts or new components were introduced.
- **Sorting, searching, and pagination** (if present) still work correctly:
  - The hide-live/finished filter should be applied **after** any search text filtering, but **before** pagination slicing (if pagination is client-side).
  - If pagination is backend-driven, ensure the hide-live/finished filter is applied to the client-side list you already received.
- **Time boundary cases**:
  - When a game transitions from `scheduled` → `in_progress` or `in_progress` → `final`, confirm that the list updates correctly on the next refresh or poll.

---

## 7. Summary

**Goal:** Fix the “Hide Live/Finished” toggle so that it **only hides in-progress/live/finished games**, and **never hides games that have not yet started**.

**Key implementation points:**

- Define and use clear helpers such as `isPreGame(game)` and `isLiveOrFinished(game)`.
- When the toggle is **off**, return the full games list without status-based filtering.
- When the toggle is **on**, filter to **exclude only live/finished games**, leaving all pre-game games visible.
- Preserve existing UI components, labels, and styling; only adjust the underlying filtering logic.

Once these steps are followed, the toggle behavior will match the intended functionality: **it hides active/finished games while always showing not-yet-started games, regardless of toggle state**.


