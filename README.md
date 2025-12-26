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
- [ ] **Daily Goals:** Allow users to set a "mins/day" goal and color the heatmap green when achieved.
- [x] **Download Number:** Number of games to download should be a configurable field on the UI.
- [x] **Progress Bar:** Display real-time download progress showing the current date being processed and total number of games downloaded so far.
- [ ] **Persistent Storing of Downloaded Data:** Reduce load on lichess by storing loaded games.
  - Add an import and export button.
  - Export:
    - Export should be in JSON.
    - Export should include all of the games currently downloaded.
    - Export should contain metadata fields.
      - Hash of the export, to prevent unintentional tampering by users.
      - Username of the user for whom the export was generated.
      - Timestamp of the earliest and most recent game in the list of games.
  - Import:
    - Should be capable of importing the games and metadata from the JSON through providing a file.
    - The username field should be replaced with the username provide in the import.
    - Data validation: Ensure that the hash present in the metadata is valid and that no tampering has occured.
    - If the sync button is pressed after import:
      - It should first attempt to download all games from the timestamp of the most recent game in the import file to the current timestamp.
      - After it has downloaded all of these games, then start downloading games previous to the earliest timestamp.
- [ ] **OAuth2 Authentication** Authenticated users can download at 60 games per second, which we would prefer.
