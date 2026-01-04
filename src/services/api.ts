import { LichessGame } from "../types";

export type ProgressCallback = (count: number, lastDate?: Date) => void;

export class ApiService {
    
    static async fetchUserGames(
        username: string, 
        maxGames: number = 300, 
        onProgress: ProgressCallback | null = null,
        untilTimestamp: number | null = null,
        sinceTimestamp: number | null = null
    ): Promise<LichessGame[]> {
        
        let url = `https://lichess.org/api/games/user/${username}?max=${maxGames}&perfType=bullet,blitz,rapid,classical&moves=false&clocks=true`;
        
        if (untilTimestamp) url += `&until=${untilTimestamp}`;
        if (sinceTimestamp) url += `&since=${sinceTimestamp}`;
        
        const response = await fetch(url, { 
            headers: { 'Accept': 'application/x-ndjson' } 
        });
    
        if (!response.ok) throw new Error('Could not fetch data from Lichess. Check username or API status.');
        if (!response.body) throw new Error('Response body is empty');
    
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        const games: LichessGame[] = [];
        let partial = '';
    
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
    
            const chunk = partial + decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            
            partial = lines.pop() || '';
    
            for (const line of lines) {
                if (line.trim()) {
                    try {
                        const game = JSON.parse(line) as LichessGame;
                        games.push(game);
                        if (onProgress && game.createdAt) {
                            onProgress(games.length, new Date(game.createdAt));
                        }
                    } catch (e) {
                        console.warn('Failed to parse line', line);
                    }
                }
            }
        }
        return games;
    }

    // SHA-256 Hashing for Integrity
    static async generateHash(data: unknown): Promise<string> {
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(JSON.stringify(data));
        const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    static async verifyHash(data: unknown, expectedHash: string): Promise<boolean> {
        const actualHash = await this.generateHash(data);
        return actualHash === expectedHash;
    }
}
