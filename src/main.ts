import './style.css'; // Vite handles CSS
import { LichessGame, CacheMetadata, ExportData, GameFilters } from './types';
import { ApiService } from './services/api';
import { DataProcessor } from './services/processor';
import { HeatmapRenderer } from './ui/heatmap';
import { ChartManager } from './ui/charts';
import { DisplayManager } from './ui/display';
import { deduplicateGames } from './utils';

// --- STATE ---
const MAX_GAMES_LIMIT = 5000;
let gamesCache: LichessGame[] = [];
let metadata: CacheMetadata | null = null;
let lastProcessedData: any = null; // Stored to re-render heatmap on filter change

// --- UI MANAGERS ---
const heatmap = new HeatmapRenderer('heatmap');
const chart = new ChartManager('typeChart');
const display = new DisplayManager();

// --- DOM ELEMENTS ---
const elements = {
    username: document.getElementById('usernameInput') as HTMLInputElement,
    maxGames: document.getElementById('maxGamesInput') as HTMLInputElement,
    fetchBtn: document.getElementById('fetchBtn') as HTMLButtonElement,
    syncNewBtn: document.getElementById('syncNewBtn') as HTMLButtonElement,
    exportBtn: document.getElementById('exportBtn') as HTMLButtonElement,
    importBtn: document.getElementById('importBtn') as HTMLButtonElement,
    fileInput: document.getElementById('importFileInput') as HTMLInputElement,
    dailyGoal: document.getElementById('dailyGoalInput') as HTMLInputElement,
    goalType: document.getElementById('goalTypeSelect') as HTMLSelectElement,
    filters: {
        bullet: document.getElementById('filterBullet') as HTMLInputElement,
        blitz: document.getElementById('filterBlitz') as HTMLInputElement,
        rapid: document.getElementById('filterRapid') as HTMLInputElement,
        classical: document.getElementById('filterClassical') as HTMLInputElement,
    }
};

// --- CORE FUNCTIONS ---

function updateUI() {
    if (!lastProcessedData) return;
    
    const goalVal = parseInt(elements.dailyGoal.value) || 0;
    const goalType = elements.goalType.value as 'minutes' | 'games';
    
    const activeFilters: GameFilters = {
        bullet: elements.filters.bullet.checked,
        blitz: elements.filters.blitz.checked,
        rapid: elements.filters.rapid.checked,
        classical: elements.filters.classical.checked
    };

    // Render Visuals
    heatmap.render(
        lastProcessedData.dailyMinutes,
        lastProcessedData.dailyMinutesByType,
        lastProcessedData.dailyGames,
        lastProcessedData.dailyGamesList,
        { value: goalVal, type: goalType },
        activeFilters
    );
    
    chart.render(lastProcessedData.typeDistribution);
    
    // Render Stats
    display.updateStats(lastProcessedData);
    display.updateInsights(lastProcessedData, { 
        met: heatmap.stats.daysGoalMet, 
        total: heatmap.stats.totalDaysWithData 
    });
    display.updateTimePeriod(metadata);
    display.toggleSyncNewBtn(!!metadata);
}

function processAndSave(games: LichessGame[], username: string) {
    gamesCache = deduplicateGames(games);
    
    if (gamesCache.length > 0) {
        metadata = {
            username,
            earliestTimestamp: gamesCache[gamesCache.length - 1].createdAt,
            mostRecentTimestamp: gamesCache[0].createdAt
        };
    }

    lastProcessedData = DataProcessor.process(gamesCache, username);
    updateUI();
}

// --- EVENT HANDLERS ---

async function handleFetch(onlyNew: boolean = false) {
    const username = elements.username.value.trim();
    if (!username) return;

    let maxGames = parseInt(elements.maxGames.value);
    if (isNaN(maxGames) || maxGames < 1) maxGames = 300;
    if (maxGames > MAX_GAMES_LIMIT) maxGames = MAX_GAMES_LIMIT;

    const btn = onlyNew ? elements.syncNewBtn : elements.fetchBtn;
    btn.disabled = true;
    display.updateProgress(true, 'Initializing...');

    try {
        let newGames: LichessGame[] = [];
        
        const onProgress = (count: number, date?: Date) => {
            const dateStr = date ? date.toLocaleDateString() : '';
            display.updateProgress(true, `Fetched ${count} games (${dateStr})`, Math.min((count%50)*2, 100));
        };

        if (onlyNew && metadata) {
             // Fetch only newer than cache
             newGames = await ApiService.fetchUserGames(
                 username, maxGames, onProgress, null, metadata.mostRecentTimestamp
             );
        } else {
             // Fetch standard
             newGames = await ApiService.fetchUserGames(username, maxGames, onProgress);
        }
        
        if (newGames.length === 0) {
            display.updateProgress(true, 'No new games found', 100);
        } else {
            const allGames = [...newGames, ...gamesCache];
            processAndSave(allGames, username);
            display.updateProgress(true, `Success! Loaded ${allGames.length} games.`, 100);
        }

        setTimeout(() => display.updateProgress(false), 2000);

    } catch (e: any) {
        alert(e.message);
        display.updateProgress(false);
    } finally {
        btn.disabled = false;
    }
}

async function handleExport() {
    if (gamesCache.length === 0 || !metadata) return alert('No data to export');

    const hash = await ApiService.generateHash(gamesCache);
    const exportPayload: ExportData = {
        games: gamesCache,
        metadata: { ...metadata, hash, exportDate: Date.now() }
    };

    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lichess-${metadata.username}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

async function handleImport(e: Event) {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    display.updateProgress(true, 'Reading file...', 20);

    try {
        const text = await file.text();
        const data = JSON.parse(text) as ExportData;

        if (!data.games || !data.metadata || !data.metadata.hash) {
            throw new Error('Invalid file format');
        }

        display.updateProgress(true, 'Verifying Integrity...', 60);
        const isValid = await ApiService.verifyHash(data.games, data.metadata.hash);
        
        if (!isValid) throw new Error('Integrity Check Failed: File modified');

        elements.username.value = data.metadata.username;
        processAndSave(data.games, data.metadata.username);
        
        display.updateProgress(true, 'Import Successful', 100);
        setTimeout(() => display.updateProgress(false), 2000);

    } catch (err: any) {
        alert(err.message);
        display.updateProgress(false);
    } finally {
        target.value = '';
    }
}

// --- INITIALIZATION ---

window.addEventListener('DOMContentLoaded', () => {
    // Load local storage
    const savedGoal = localStorage.getItem('dailyGoal');
    if (savedGoal) elements.dailyGoal.value = savedGoal;
    
    const savedType = localStorage.getItem('goalType');
    if (savedType) elements.goalType.value = savedType;
    display.setGoalLabels(elements.goalType.value as any);

    ['bullet', 'blitz', 'rapid', 'classical'].forEach(type => {
        const key = `filter_${type}`;
        const saved = localStorage.getItem(key);
        if (saved !== null) {
            (elements.filters as any)[type].checked = saved === 'true';
        }
    });

    // Listeners
    elements.fetchBtn.addEventListener('click', () => handleFetch(false));
    elements.syncNewBtn.addEventListener('click', () => handleFetch(true));
    elements.exportBtn.addEventListener('click', handleExport);
    elements.importBtn.addEventListener('click', () => elements.fileInput.click());
    elements.fileInput.addEventListener('change', handleImport);

    elements.dailyGoal.addEventListener('input', () => {
        localStorage.setItem('dailyGoal', elements.dailyGoal.value);
        updateUI();
    });

    elements.goalType.addEventListener('change', () => {
        localStorage.setItem('goalType', elements.goalType.value);
        display.setGoalLabels(elements.goalType.value as any);
        updateUI();
    });

    Object.keys(elements.filters).forEach(key => {
        const el = (elements.filters as any)[key];
        el.addEventListener('change', () => {
            localStorage.setItem(`filter_${key}`, el.checked);
            updateUI();
        });
    });
});
