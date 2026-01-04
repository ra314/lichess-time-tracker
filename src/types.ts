// Lichess API Interfaces
export interface LichessPlayer {
    user?: { name: string; id: string };
    rating?: number;
}

export interface LichessGame {
    id: string;
    createdAt: number; // Timestamp in ms
    lastMoveAt: number; // Timestamp in ms
    speed: 'bullet' | 'blitz' | 'rapid' | 'classical';
    perf: string;
    winner?: 'white' | 'black';
    players: {
        white: LichessPlayer;
        black: LichessPlayer;
    };
}

// Internal Application Data Types
export interface GameFilters {
    bullet: boolean;
    blitz: boolean;
    rapid: boolean;
    classical: boolean;
}

export type GameSpeed = 'Bullet' | 'Blitz' | 'Rapid' | 'Classical';

export interface HourlyWinStats {
    total: number;
    wins: number;
}

export interface AppStats {
    totalMs: number;
    totalGames: number;
    bingeCount: number;
    // Map of timestamp (midnight) -> total minutes
    dailyMinutes: Record<number, number>; 
    // Map of timestamp (midnight) -> { Bullet: 30, Blitz: 10 ... }
    dailyMinutesByType: Record<number, Record<GameSpeed, number>>;
    // Map of timestamp (midnight) -> count
    dailyGames: Record<number, number>;
    // Map of timestamp (midnight) -> games list
    dailyGamesList: Record<number, LichessGame[]>;
    typeDistribution: Record<GameSpeed, number>;
    hourlyWins: Record<number, HourlyWinStats>;
}

export interface CacheMetadata {
    username: string;
    earliestTimestamp: number;
    mostRecentTimestamp: number;
    hash?: string;
    exportDate?: number;
    totalGames?: number;
}

export interface ExportData {
    games: LichessGame[];
    metadata: CacheMetadata;
}
