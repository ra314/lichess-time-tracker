/**
 * Lichess API Handler
 * Lichess uses an NDJSON (Newline Delimited JSON) stream for bulk data.
 * This file implements a stream reader to process large game histories 
 * without crashing the browser memory.
 */

async function fetchUserGames(username, maxGames = 300, progressCallback = null) {
    // maxGames: Configurable number of games to fetch. perfType filters for competitive chess only.
    const url = `https://lichess.org/api/games/user/${username}?max=${maxGames}&perfType=bullet,blitz,rapid,classical&moves=false`;
    
    const response = await fetch(url, { 
        headers: { 'Accept': 'application/x-ndjson' } 
    });

    if (!response.ok) throw new Error('Could not fetch data from Lichess. Check username or API status.');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let games = [];
    let partial = '';

    /**
     * STREAMING LOGIC:
     * We read chunks of data. If a chunk ends in the middle of a JSON line,
     * we save that 'partial' string and prepend it to the next chunk.
     */
    while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = partial + decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
        // Save the incomplete last line for the next iteration
        partial = lines.pop();

        for (const line of lines) {
            if (line.trim()) {
                const game = JSON.parse(line);
                games.push(game);
                
                // Report progress with game date
                if (progressCallback && game.createdAt) {
                    const gameDate = new Date(game.createdAt);
                    progressCallback(games.length, gameDate);
                }
            }
        }
    }
    return games;
}
