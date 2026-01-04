import { AppStats, GameSpeed, HourlyWinStats, LichessGame } from "../types";
import { capitalize } from "../utils";

// Source - https://stackoverflow.com/a/34602679
// Posted by PD81, modified by community. See post 'Timeline' for change history
// Retrieved 2026-01-04, License - CC BY-SA 4.0
const LOCAL_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

function getLocalDate(timestamp: number): Date {
    return new Date(new Date(timestamp).toLocaleString('en-US', { timeZone: LOCAL_TIMEZONE }));
}

export class DataProcessor {
    static process(games: LichessGame[], user: string): AppStats {
        let totalMs = 0;
        const dailyMinutes: Record<number, number> = {};
        const dailyMinutesByType: Record<number, Record<GameSpeed, number>> = {};
        const dailyGames: Record<number, number> = {};
        const dailyGamesList: Record<number, LichessGame[]> = {};
        const typeDist: Record<GameSpeed, number> = { Bullet: 0, Blitz: 0, Rapid: 0, Classical: 0 };
        const hourlyWins: Record<number, HourlyWinStats> = {};
        let bingeCount = 0;

        // Sort chronological for binge detection
        const sortedGames = [...games].reverse(); // Oldest to Newest

        sortedGames.forEach((g, i) => {
            // 1. Duration & Totals
            const duration = g.lastMoveAt - g.createdAt;
            totalMs += duration;

            // 2. Heatmap Data (Midnight Timestamp)
            const localDate = getLocalDate(g.createdAt);
            const date = localDate.setHours(0,0,0,0);
            dailyMinutes[date] = (dailyMinutes[date] || 0) + (duration / 60000);
            dailyGames[date] = (dailyGames[date] || 0) + 1;

            if (!dailyGamesList[date]) dailyGamesList[date] = [];
            dailyGamesList[date].push(g);

            // 3. Type Breakdown
            const speed = capitalize(g.speed) as GameSpeed;
            
            // Initialize daily type object
            if (!dailyMinutesByType[date]) {
                dailyMinutesByType[date] = { Bullet: 0, Blitz: 0, Rapid: 0, Classical: 0 };
            }
            if (dailyMinutesByType[date][speed] !== undefined) {
                dailyMinutesByType[date][speed] += (duration / 60000);
            }

            // Global Type distribution
            if (typeDist[speed] !== undefined) {
                typeDist[speed] += (duration / 60000);
            }

            // 4. Hourly Wins (Local Time)
            const hour = getLocalDate(g.createdAt).getHours();
            if (!hourlyWins[hour]) hourlyWins[hour] = { total: 0, wins: 0 };
            hourlyWins[hour].total++;

            const whiteUser = g.players.white.user?.name || '';
            const myColor = whiteUser.toLowerCase() === user.toLowerCase() ? 'white' : 'black';
            if (g.winner === myColor) hourlyWins[hour].wins++;

            // 5. Binge Detection (5 games within 2 hours sliding window)
            if (i >= 5) {
                const windowStart = sortedGames[i-5].createdAt;
                // 7200000 ms = 2 hours
                if (g.lastMoveAt - windowStart < 7200000) {
                    bingeCount++;
                }
            }
        });

        return {
            totalMs,
            totalGames: games.length,
            dailyMinutes,
            dailyMinutesByType,
            dailyGames,
            dailyGamesList,
            typeDistribution: typeDist,
            hourlyWins,
            bingeCount
        };
    }
}
