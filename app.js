/**
 * Main Controller: Handles data processing and UI rendering.
 */

// Configuration constants for game fetching limits
const MIN_GAMES = 1;
const DEFAULT_MAX_GAMES = 300;
const MAX_GAMES_LIMIT = 5000;

// Global reference for Chart.js instance to allow refreshing
let myChart = null;

// Store the last processed data globally for re-rendering
let lastProcessedData = null;

// Store raw games data for export/import functionality
let gamesCache = [];
let gamesCacheMetadata = null;

// Load saved daily goal and setup event listener on page load
window.addEventListener('DOMContentLoaded', () => {
    const dailyGoalInput = document.getElementById('dailyGoalInput');
    
    // Load saved goal from localStorage
    const savedGoal = localStorage.getItem('dailyGoal');
    if (savedGoal !== null) {
        dailyGoalInput.value = savedGoal;
    }
    
    // Handle goal changes - use 'input' event for real-time updates
    const handleGoalChange = () => {
        let goalValue = parseInt(dailyGoalInput.value);
        if (isNaN(goalValue) || goalValue < 0) {
            goalValue = 0;
        } else if (goalValue > 1440) {
            goalValue = 1440;
            dailyGoalInput.value = 1440;
        }
        localStorage.setItem('dailyGoal', goalValue);
        
        // Re-render heatmap and insights if data exists
        if (lastProcessedData !== null) {
            renderHeatmap(lastProcessedData.dailyMinutes);
            updateUI(lastProcessedData);
        }
    };
    
    // Listen to 'input' for real-time updates as user types
    dailyGoalInput.addEventListener('input', handleGoalChange);
    
    // Setup Export button
    document.getElementById('exportBtn').addEventListener('click', exportGamesData);
    
    // Setup Import button
    document.getElementById('importBtn').addEventListener('click', () => {
        document.getElementById('importFileInput').click();
    });
    
    document.getElementById('importFileInput').addEventListener('change', handleImportFile);
});

document.getElementById('fetchBtn').addEventListener('click', async () => {
    const username = document.getElementById('usernameInput').value.trim();
    if (!username) return;

    // Get max games value from input, default to 300 if invalid
    const maxGamesInput = document.getElementById('maxGamesInput');
    let maxGames = parseInt(maxGamesInput.value);
    if (isNaN(maxGames) || maxGames < MIN_GAMES) {
        maxGames = DEFAULT_MAX_GAMES;
        maxGamesInput.value = DEFAULT_MAX_GAMES;
    } else if (maxGames > MAX_GAMES_LIMIT) {
        maxGames = MAX_GAMES_LIMIT;
        maxGamesInput.value = MAX_GAMES_LIMIT;
    }

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
        
        let games = [];
        
        // Check if we have cached data from import
        if (gamesCacheMetadata && gamesCacheMetadata.username.toLowerCase() === username.toLowerCase()) {
            // Fetch newer games first (since most recent game in cache)
            progressText.textContent = 'Fetching recent games...';
            const newerGames = await fetchUserGames(username, maxGames, onProgress, null, gamesCacheMetadata.mostRecentTimestamp);
            
            // Then fetch older games (before earliest game in cache)
            if (newerGames.length > 0) {
                progressText.textContent = `Found ${newerGames.length} new games. Fetching older games...`;
            }
            const olderGames = await fetchUserGames(username, maxGames, onProgress, gamesCacheMetadata.earliestTimestamp, null);
            
            // Merge: newer + cached + older (removing duplicates)
            const allGames = [...newerGames, ...gamesCache, ...olderGames];
            const uniqueGames = deduplicateGames(allGames);
            games = uniqueGames;
            
            progressText.textContent = `✓ Loaded ${newerGames.length} new + ${gamesCache.length} cached + ${olderGames.length} older games`;
        } else {
            // Fresh download without cache
            games = await fetchUserGames(username, maxGames, onProgress);
            progressText.textContent = `✓ Successfully loaded ${games.length} games`;
        }
        
        // Update cache
        gamesCache = games;
        updateCacheMetadata(username, games);
        
        const data = processChessData(games, username);
        
        // Store data globally for re-rendering when goal changes
        lastProcessedData = data;
        
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
 * Convert minutes to hours:minutes:seconds format
 */
function formatMinutesToHMS(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.floor(totalMinutes % 60);
    const seconds = Math.floor((totalMinutes % 1) * 60);
    
    if (hours > 0) {
        return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
    } else {
        return `${seconds}s`;
    }
}

/**
 * HEATMAP RENDERER (Vanilla JS):
 * Dynamically builds a scrollable calendar grid showing all available data.
 * Displays day labels, date numbers, and month labels.
 */
function renderHeatmap(dailyMinutes) {
    const container = document.getElementById('heatmap');
    container.innerHTML = '';
    
    // Get daily goal from input
    const dailyGoal = parseInt(document.getElementById('dailyGoalInput').value) || 0;
    
    // Get date range from data
    const timestamps = Object.keys(dailyMinutes).map(t => parseInt(t));
    if (timestamps.length === 0) {
        container.innerHTML = '<p class="placeholder">No activity data available.</p>';
        return;
    }
    
    const minDate = new Date(Math.min(...timestamps));
    const maxDate = new Date();
    
    // Start from the Sunday before the earliest date
    const startDate = new Date(minDate);
    startDate.setDate(minDate.getDate() - minDate.getDay());
    startDate.setHours(0, 0, 0, 0);
    
    // End at today
    const endDate = new Date(maxDate);
    endDate.setHours(0, 0, 0, 0);
    
    // Create day of week headers (outside scroll area)
    const headerRow = document.createElement('div');
    headerRow.className = 'calendar-header-row';
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayNames.forEach(day => {
        const header = document.createElement('div');
        header.className = 'day-header';
        header.textContent = day;
        headerRow.appendChild(header);
    });
    
    // Create wrapper for scrolling
    const scrollWrapper = document.createElement('div');
    scrollWrapper.className = 'calendar-scroll-wrapper';
    
    // Create calendar grid
    const calendar = document.createElement('div');
    calendar.className = 'calendar-grid';
    
    let currentMonth = -1;
    let daysGoalMet = 0;
    let totalDaysWithData = 0;
    
    // Generate calendar cells
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
        const timestamp = currentDate.getTime();
        const mins = dailyMinutes[timestamp] || 0;
        
        // Check if we need to add a month label
        const month = currentDate.getMonth();
        if (month !== currentMonth) {
            currentMonth = month;
            const monthLabel = document.createElement('div');
            monthLabel.className = 'month-label';
            monthLabel.textContent = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            monthLabel.style.gridColumn = `1 / 8`;
            calendar.appendChild(monthLabel);
        }
        
        // Create day cell
        const cell = document.createElement('div');
        cell.className = 'day-cell';
        
        // Add date number
        const dateNumber = document.createElement('span');
        dateNumber.className = 'date-number';
        dateNumber.textContent = currentDate.getDate();
        cell.appendChild(dateNumber);
        
        // Check if daily goal is met (and goal is > 0)
        const goalMet = dailyGoal > 0 && mins >= dailyGoal;
        
        if (mins > 0) totalDaysWithData++;
        
        if (goalMet) {
            cell.classList.add('goal-achieved');
            daysGoalMet++;
            cell.title = `${currentDate.toDateString()}: ${formatMinutesToHMS(mins)} ✓ Goal Achieved!`;
        } else {
            // Intensity Thresholds (only apply if goal not met)
            if (mins > 0) {
                if (mins > 60) cell.classList.add('level-4');
                else if (mins > 30) cell.classList.add('level-3');
                else if (mins > 15) cell.classList.add('level-2');
                else cell.classList.add('level-1');
            }
            
            const goalText = dailyGoal > 0 ? ` (${formatMinutesToHMS(mins)}/${dailyGoal}m goal)` : '';
            cell.title = `${currentDate.toDateString()}: ${formatMinutesToHMS(mins)}${goalText}`;
        }
        
        // Dim future dates or dates before data started
        if (currentDate > maxDate || currentDate < minDate) {
            cell.classList.add('out-of-range');
        }
        
        calendar.appendChild(cell);
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    scrollWrapper.appendChild(calendar);
    container.appendChild(headerRow);
    container.appendChild(scrollWrapper);
    
    // Store for insights
    container.dataset.daysGoalMet = daysGoalMet;
    container.dataset.totalDaysWithData = totalDaysWithData;
    
    // Scroll to bottom (most recent dates)
    setTimeout(() => {
        scrollWrapper.scrollTop = scrollWrapper.scrollHeight;
    }, 0);
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

    // Get goal achievement data from heatmap
    const heatmapContainer = document.getElementById('heatmap');
    const daysGoalMet = parseInt(heatmapContainer.dataset.daysGoalMet) || 0;
    const dailyGoal = parseInt(document.getElementById('dailyGoalInput').value) || 0;
    
    // Build insights with optional goal insight
    let insightsHTML = `
        <div class="insight-item">🔥 Peak Performance: <b>${bestH >= 0 ? bestH+':00' : 'N/A'}</b> (Highest win rate).</div>
        <div class="insight-item">⚠️ Binge Warning: <b>${data.bingeCount}</b> high-density sessions detected.</div>
        <div class="insight-item">🎯 Most Active: <b>${Object.keys(data.typeDistribution).reduce((a, b) => data.typeDistribution[a] > data.typeDistribution[b] ? a : b)}</b> is your primary time sink.</div>
    `;
    
    if (dailyGoal > 0) {
        const totalDaysWithData = parseInt(heatmapContainer.dataset.totalDaysWithData) || 0;
        const percentage = totalDaysWithData > 0 ? Math.round((daysGoalMet / totalDaysWithData) * 100) : 0;
        insightsHTML += `<div class="insight-item">🎯 Goal Progress: Met daily goal on <b>${daysGoalMet}/${totalDaysWithData} days</b> (${percentage}%).</div>`;
    }
    
    document.getElementById('insightsList').innerHTML = insightsHTML;
}

/**
 * EXPORT FUNCTIONALITY:
 * Creates a JSON file with all downloaded games and metadata
 */
async function exportGamesData() {
    if (!gamesCache || gamesCache.length === 0) {
        alert('No games data to export. Please sync data first.');
        return;
    }
    
    if (!gamesCacheMetadata) {
        alert('No metadata available. Please sync data first.');
        return;
    }
    
    try {
        // Create export object
        const exportData = {
            games: gamesCache,
            metadata: {
                username: gamesCacheMetadata.username,
                earliestTimestamp: gamesCacheMetadata.earliestTimestamp,
                mostRecentTimestamp: gamesCacheMetadata.mostRecentTimestamp,
                exportDate: Date.now(),
                totalGames: gamesCache.length
            }
        };
        
        // Generate hash for integrity verification
        const hash = await generateHash(exportData.games);
        exportData.metadata.hash = hash;
        
        // Convert to JSON and create download
        const jsonString = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `lichess-games-${gamesCacheMetadata.username}-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log('✓ Export successful:', exportData.metadata);
    } catch (e) {
        alert(`Export failed: ${e.message}`);
        console.error('Export error:', e);
    }
}

/**
 * IMPORT FUNCTIONALITY:
 * Loads games from a JSON file and validates integrity
 */
async function handleImportFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const progressIndicator = document.getElementById('progressIndicator');
    const progressText = document.getElementById('progressText');
    const progressFill = document.getElementById('progressFill');
    
    try {
        progressIndicator.style.display = 'block';
        progressText.textContent = 'Reading import file...';
        progressFill.style.width = '30%';
        
        const fileContent = await file.text();
        const importData = JSON.parse(fileContent);
        
        // Validate structure
        if (!importData.games || !importData.metadata) {
            throw new Error('Invalid file format: missing games or metadata');
        }
        
        if (!importData.metadata.hash) {
            throw new Error('Invalid file format: missing integrity hash');
        }
        
        progressText.textContent = 'Verifying data integrity...';
        progressFill.style.width = '60%';
        
        // Verify hash
        const isValid = await verifyHash(importData.games, importData.metadata.hash);
        if (!isValid) {
            throw new Error('Data integrity check failed: file may have been tampered with');
        }
        
        progressText.textContent = 'Loading games...';
        progressFill.style.width = '90%';
        
        // Update username field
        document.getElementById('usernameInput').value = importData.metadata.username;
        
        // Load games into cache
        gamesCache = importData.games;
        gamesCacheMetadata = {
            username: importData.metadata.username,
            earliestTimestamp: importData.metadata.earliestTimestamp,
            mostRecentTimestamp: importData.metadata.mostRecentTimestamp
        };
        
        // Process and render data
        const data = processChessData(gamesCache, importData.metadata.username);
        lastProcessedData = data;
        
        renderHeatmap(data.dailyMinutes);
        renderBarChart(data.typeDistribution);
        updateUI(data);
        
        progressText.textContent = `✓ Successfully imported ${gamesCache.length} games`;
        progressFill.style.width = '100%';
        
        setTimeout(() => {
            progressIndicator.style.display = 'none';
            progressFill.style.width = '0%';
        }, 2000);
        
        console.log('✓ Import successful:', importData.metadata);
        
    } catch (e) {
        progressText.textContent = `✗ Import failed: ${e.message}`;
        progressFill.style.width = '0%';
        setTimeout(() => {
            progressIndicator.style.display = 'none';
        }, 3000);
        console.error('Import error:', e);
    } finally {
        // Reset file input
        event.target.value = '';
    }
}

/**
 * Update cache metadata based on current games
 */
function updateCacheMetadata(username, games) {
    if (!games || games.length === 0) {
        gamesCacheMetadata = null;
        return;
    }
    
    const timestamps = games.map(g => g.createdAt);
    gamesCacheMetadata = {
        username: username,
        earliestTimestamp: Math.min(...timestamps),
        mostRecentTimestamp: Math.max(...timestamps)
    };
}

/**
 * Remove duplicate games based on game ID
 */
function deduplicateGames(games) {
    const seen = new Set();
    const unique = [];
    
    for (const game of games) {
        if (!seen.has(game.id)) {
            seen.add(game.id);
            unique.push(game);
        }
    }
    
    // Sort by timestamp (most recent first)
    unique.sort((a, b) => b.createdAt - a.createdAt);
    
    return unique;
}
