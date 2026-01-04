# ♟️ Chess Accountability Dashboard

A Steam/Strava-style activity tracker for Lichess players. This dashboard helps users transition from "mindless playing" to "intentional practice" by visualizing time spent at the board.

> 🤖 **Note:** This application was originally vibe-coded using AI assistance, then refactored into a modular **TypeScript** architecture to ensure type safety and maintainability.

GitHub Pages: https://ra314.github.io/lichess-time-tracker/

## 🚀 Overview
The app fetches real-time game data via the Lichess API, calculates total playtime (lastMoveAt - createdAt), and provides accountability metrics such as binge detection and peak performance windows.

## 🛠️ Tech Stack
- **Language:** TypeScript (ESNext)
- **Build Tool:** Vite
- **Frontend:** HTML5, CSS3 (Custom Grid)
- **Visualization:** [Chart.js](https://www.chartjs.org/) (via NPM)
- **Data Source:** [Lichess.org Open API](https://lichess.org/api) (NDJSON Stream)

## 📊 Features
- **Scrollable Calendar Heatmap:** View your entire playing history in a calendar format with day labels, date numbers, and month headers
- **Flexible Daily Goals:** Set goals based on either time played or number of games, with customizable targets
- **Game Type Filters:** Filter heatmap data by Bullet, Blitz, Rapid, or Classical time controls
- **Activity Levels:** Color-coded intensity showing playing patterns
- **Time Period Tracking:** See the full span of your downloaded game history
- **Export/Import:** Save and restore your game data locally with integrity verification
- **Real-time Progress:** Watch as games download with live progress indicators

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
The project is organized into modular services and UI handlers:

```text
src/
├── services/
│   ├── api.ts         # Handles Lichess API fetching, NDJSON streaming, and SHA-256 Hashing
│   └── processor.ts   # Pure business logic: calculates totals, binges, and heatmap data
├── ui/
│   ├── heatmap.ts     # Logic for building the calendar grid DOM
│   ├── charts.ts      # Wrapper for Chart.js bar chart rendering
│   └── display.ts     # Manages text updates (stats, insights, progress bars)
├── main.ts            # Application entry point: State management and Event Listeners
├── types.ts           # TypeScript interfaces for API responses and internal data
├── utils.ts           # Helper functions (Time formatting, Deduplication)
└── style.css          # Dark-mode UI and custom heatmap styling
```