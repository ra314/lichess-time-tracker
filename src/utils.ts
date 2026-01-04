import { LichessGame } from "./types";

/**
 * Format minutes to Xh Ym Zs string
 */
export function formatMinutesToHMS(totalMinutes: number): string {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.floor(totalMinutes % 60);
    const seconds = Math.floor((totalMinutes % 1) * 60);
    
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
}

/**
 * Deduplicate games array based on Game ID
 */
export function deduplicateGames(games: LichessGame[]): LichessGame[] {
    const seen = new Set<string>();
    const unique: LichessGame[] = [];
    
    for (const game of games) {
        if (!seen.has(game.id)) {
            seen.add(game.id);
            unique.push(game);
        }
    }
    // Sort descending (newest first)
    return unique.sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Capitalize first letter
 */
export function capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
}
