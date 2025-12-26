/**
 * Main Controller: Handles data processing and UI rendering.
 */

// Global reference for Chart.js instance to allow refreshing
let myChart = null;

document.getElementById('fetchBtn').addEventListener('click', async () => {
    const username = document.getElementById('usernameInput').value.trim();
    if (!username) return;

    const progressIndicator = document.getElementById('progressIndicator');
    const progressText = document.getElementById('progressText');
    const progressFill = document.getElementById('progressFill');
    const fetchBtn = document.getElementById('fetchBtn');

    try {
        // Show progress indicator
        progressIndicator.style.display = 'block';
        fetchBtn.disabled = true;
        fetchBtn.style.opacity = '0.5';
        
        // Progress callback to update UI during download
        const onProgress = (gameCount, gameDate) => {
            const dateStr = gameDate.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric', 
                year: 'numeric' 
            });
            progressText.textContent = `Downloaded ${gameCount} games (${dateStr})`;
            
            // Animate progress bar (indeterminate style)
            const progress = Math.min((gameCount % 50) * 2, 100);
            progressFill.style.width = `${progress}%`;
        };
        
        const games = await fetchUserGames(username, onProgress);
        const data = processChessData(games, username);
        
        // Update completion message
        progressText.textContent = `✓ Successfully loaded ${games.length} games`;
        progressFill.style.width = '100%';
        
        // Render all UI components
        renderHeatmap(data.dailyMinutes);
        renderBarChart(data.typeDistribution);
        updateUI(data);
        
        // Hide progress after a short delay
        setTimeout(() => {
            progressIndicator.style.display = 'none';
            progressFill.style.width = '0%';
        }, 2000);
        
    } catch (e) { 
        progressText.textContent = `✗ Error: ${e.message}`;
        progressFill.style.width = '0%';
        setTimeout(() => {
            progressIndicator.style.display = 'none';
        }, 3000);
    } finally {
        fetchBtn.disabled = false;
        fetchBtn.style.opacity = '1';
    }
});

/**
 * DATA PROCESSING:
 * Converts raw Lichess JSON objects into metrics for the dashboard.
 */
function processChessData(games, user) {
    let totalMs = 0;
    const dailyMinutes = {};
    const typeDist = { Bullet: 0, Blitz: 0, Rapid: 0, Classical: 0 };
    const hourlyWins = {};
    let bingeCount = 0;

    // We process games chronologically to detect sequences (binges/tilts)
    const sortedGames = [...games].reverse();

    sortedGames.forEach((g, i) => {
        console.log(g)
        // PLAYTIME: Lichess games track start and end timestamps.
        const duration = g.lastMoveAt - g.createdAt;
        totalMs += duration;

        // HEATMAP: Group by day (Unix timestamp at midnight)
        const date = new Date(g.createdAt).setHours(0,0,0,0);
        dailyMinutes[date] = (dailyMinutes[date] || 0) + (duration / 60000);

        // FORMATS: Calculate minutes per time control
        const speed = g.speed.charAt(0).toUpperCase() + g.speed.slice(1);
        if (typeDist.hasOwnProperty(speed)) {
            typeDist[speed] += (duration / 60000);
        }

        // PEAK PERFORMANCE: Track wins by hour of the day
        const hour = new Date(g.createdAt).getHours();
        if (!hourlyWins[hour]) hourlyWins[hour] = { total: 0, wins: 0 };
        hourlyWins[hour].total++;
        
        const myColor = g.players.white.user?.name.toLowerCase() === user.toLowerCase() ? 'white' : 'black';
        if (g.winner === myColor) hourlyWins[hour].wins++;

        // BINGE DETECTION: 
        // Defined as 5 games starting and ending within a 2-hour sliding window.
        if (i > 5) {
            const windowStart = sortedGames[i-5].createdAt;
            if (g.lastMoveAt - windowStart < 7200000) bingeCount++;
        }
    });

    return { totalMs, dailyMinutes, typeDistribution: typeDist, bingeCount, totalGames: games.length, hourlyWins };
}

/**
 * HEATMAP RENDERER (Vanilla JS):
 * Dynamically builds a grid of divs representing the last 30 days.
 */
function renderHeatmap(dailyMinutes) {
    const container = document.getElementById('heatmap');
    container.innerHTML = '';
    
    for (let i = 29; i >= 0; i--) {
        const d = new Date(); 
        d.setHours(0,0,0,0); 
        d.setDate(d.getDate() - i);
        
        const mins = dailyMinutes[d.getTime()] || 0;
        const cell = document.createElement('div');
        cell.className = 'day-cell';
        
        // Intensity Thresholds
        if (mins > 0) {
            if (mins > 60) cell.classList.add('level-4');
            else if (mins > 30) cell.classList.add('level-3');
            else if (mins > 15) cell.classList.add('level-2');
            else cell.classList.add('level-1');
        }
        
        cell.title = `${d.toDateString()}: ${Math.round(mins)} mins`;
        container.appendChild(cell);
    }
}

/**
 * BAR CHART RENDERER (Chart.js):
 * Displays time distribution across different chess speeds.
 */
function renderBarChart(dist) {
    const ctx = document.getElementById('typeChart').getContext('2d');
    if (myChart) myChart.destroy(); // Clear old chart before rendering new data
    
    myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(dist),
            datasets: [{ 
                label: 'Minutes', 
                data: Object.values(dist), 
                backgroundColor: '#3692e7',
                borderRadius: 4
            }]
        },
        options: { 
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } }, 
            scales: { 
                y: { beginAtZero: true, ticks: { color: '#aaa' } }, 
                x: { ticks: { color: '#aaa' } } 
            } 
        }
    });
}

/**
 * UI STATS UPDATER:
 * Calculates finalized metrics like Golden Hour and total playtime strings.
 */
function updateUI(data) {
    const hrs = Math.floor(data.totalMs / 3600000);
    const mins = Math.floor((data.totalMs % 3600000) / 60000);
    document.getElementById('totalTime').innerText = `${hrs}h ${mins}m`;
    document.getElementById('totalGames').innerText = data.totalGames;

    // Identify hour with highest win rate (min 4 games played)
    let bestH = -1, maxRate = 0;
    for (let h in data.hourlyWins) {
        let rate = data.hourlyWins[h].wins / data.hourlyWins[h].total;
        if (rate > maxRate && data.hourlyWins[h].total >= 4) { 
            maxRate = rate; 
            bestH = h; 
        }
    }

    document.getElementById('insightsList').innerHTML = `
        <div class="insight-item">🔥 Peak Performance: <b>${bestH >= 0 ? bestH+':00' : 'N/A'}</b> (Highest win rate).</div>
        <div class="insight-item">⚠️ Binge Warning: <b>${data.bingeCount}</b> high-density sessions detected.</div>
        <div class="insight-item">🎯 Most Active: <b>${Object.keys(data.typeDistribution).reduce((a, b) => data.typeDistribution[a] > data.typeDistribution[b] ? a : b)}</b> is your primary time sink.</div>
    `;
}
