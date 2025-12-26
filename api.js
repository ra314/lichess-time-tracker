/**
 * Lichess API Handler
 * Lichess uses an NDJSON (Newline Delimited JSON) stream for bulk data.
 * This file implements a stream reader to process large game histories 
 * without crashing the browser memory.
 */

async function fetchUserGames(username) {
    // max=300: Keeps it fast. perfType filters for competitive chess only.
    const url = `https://lichess.org/api/games/user/${username}?max=1&perfType=bullet,blitz,rapid,classical&moves=false`;
    
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
                console.log(line)
                games.push(JSON.parse(line));
            }
        }
    }
    return games;
}
