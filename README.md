# ♟️ Chess Accountability Dashboard

A Steam/Strava-style activity tracker for Lichess players. This dashboard helps users transition from "mindless playing" to "intentional practice" by visualizing time spent at the board.

## 🚀 Overview
The app fetches real-time game data via the Lichess API, calculates total playtime (lastMoveAt - createdAt), and provides accountability metrics such as binge detection and peak performance windows.

## 🛠️ Tech Stack
- **Frontend:** HTML5, CSS3 (Custom Grid), Vanilla JavaScript (ES6+).
- **Data Visualization:** [Chart.js](https://www.chartjs.org/) for bar charts; **Native CSS Grid** for the calendar heatmap.
- **Data Source:** [Lichess.org Open API](https://lichess.org/api) (NDJSON Stream).

## 🧠 Logic & Metrics
### 1. Playtime Calculation
Playtime is calculated per game by finding the difference between the first and last move timestamps.
$$Playtime = (LastMoveAt - CreatedAt)$$

### 2. Binge Detection
The "Binge Warning" triggers when a user plays **5 or more games** where the total elapsed time between the start of the first game and end of the last game is **less than 2 hours**. This helps identify sessions where a user might be "tilting."

### 3. Peak Performance (Golden Hour)
We calculate the win rate $P$ for every hour of the day $h$:
$$P_h = (\frac{Wins_h}{Total_h}) \times 100$$
The hour with the highest $P_h$ (minimum 4 games) is highlighted as the user's most productive time to play.

## 📂 File Structure
- `index.html`: Dashboard structure and CDN links.
- `style.css`: Dark-mode UI and custom heatmap styling.
- `api.js`: Logic for handling Lichess NDJSON streaming.
- `app.js`: Data processing engine and chart rendering logic.

## 👨‍💻 Future Roadmap
- [x] **Daily Goals:** Allow users to set a "mins/day" goal and color the heatmap green when achieved.
- [x] **Download Number:** Number of games to download should be a configurable field on the UI.
- [x] **Progress Bar:** Display real-time download progress showing the current date being processed and total number of games downloaded so far.
- [x] **Persistent Storing of Downloaded Data:** Reduce load on lichess by storing loaded games.
  - [x] Add an import and export button.
  - [x] Export:
    - Export is in JSON format.
    - Export includes all of the games currently downloaded.
    - Export contains metadata fields:
      - SHA-256 hash of the export, to prevent unintentional tampering by users.
      - Username of the user for whom the export was generated.
      - Timestamp of the earliest and most recent game in the list of games.
      - Export date and total game count.
  - [x] Import:
    - Imports games and metadata from JSON file.
    - Username field is populated with the username from the import.
    - Data validation: Hash verification ensures no tampering has occurred.
    - When sync button is pressed after import:
      - Downloads all games from the timestamp of the most recent game to current timestamp.
      - Downloads games previous to the earliest timestamp.
      - Deduplicates games to prevent conflicts.
- [ ] **OAuth2 Authentication** Authenticated users can download at 60 games per second, which we would prefer.

## 📦 Import/Export Feature

### Exporting Games
1. Click the **Export** button after syncing data
2. A JSON file will be downloaded containing:
   - All downloaded games
   - Metadata (username, timestamps, hash)
3. File naming: `lichess-games-{username}-{date}.json`

### Importing Games
1. Click the **Import** button
2. Select a previously exported JSON file
3. The app will:
   - Verify data integrity using SHA-256 hash
   - Load all games into the dashboard
   - Populate the username field
4. After import, clicking **Sync Data** will:
   - Fetch newer games (after most recent cached game)
   - Fetch older games (before earliest cached game)
   - Merge and deduplicate all games

### Security
- **SHA-256 Hashing:** All exports include a cryptographic hash to detect tampering
- **Validation:** Imports are rejected if the hash doesn't match the data
- **Deduplication:** Games are deduplicated by ID to prevent data corruption
