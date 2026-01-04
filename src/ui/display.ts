import { AppStats, CacheMetadata } from "../types";

export class DisplayManager {
    private elements: Record<string, HTMLElement>;

    constructor() {
        this.elements = {
            totalTime: document.getElementById('totalTime')!,
            totalGames: document.getElementById('totalGames')!,
            timePeriod: document.getElementById('timePeriod')!,
            insightsList: document.getElementById('insightsList')!,
            goalLabel: document.querySelector('.goal-label') as HTMLElement,
            dailyGoalInput: document.getElementById('dailyGoalInput')!,
            progressIndicator: document.getElementById('progressIndicator')!,
            progressText: document.getElementById('progressText')!,
            progressFill: document.getElementById('progressFill')!,
            syncNewBtn: document.getElementById('syncNewBtn')!,
        };
    }

    updateStats(data: AppStats) {
        const hrs = Math.floor(data.totalMs / 3600000);
        const mins = Math.floor((data.totalMs % 3600000) / 60000);
        this.elements.totalTime.innerText = `${hrs}h ${mins}m`;
        this.elements.totalGames.innerText = data.totalGames.toString();
    }

    updateInsights(data: AppStats, goalStats: { met: number; total: number }) {
        // Calculate best hour
        let bestHour = -1, maxRate = 0;
        for (const hStr in data.hourlyWins) {
            const h = parseInt(hStr);
            const stats = data.hourlyWins[h];
            const rate = stats.wins / stats.total;
            if (rate > maxRate && stats.total >= 4) {
                maxRate = rate;
                bestHour = h;
            }
        }

        const formatHour = (h: number) => {
            const period = h >= 12 ? 'PM' : 'AM';
            const display = h === 0 ? 12 : (h > 12 ? h - 12 : h);
            return `${display}:00 ${period}`;
        };

        const activeType = (Object.keys(data.typeDistribution) as Array<keyof typeof data.typeDistribution>).reduce((a, b) =>
            data.typeDistribution[a] > data.typeDistribution[b] ? a : b
        );

        let html = `
            <div class="insight-item">🔥 Peak Performance: <b>${bestHour >= 0 ? formatHour(bestHour) : 'N/A'}</b> (Highest win rate).</div>
            <div class="insight-item">⚠️ Binge Warning: <b>${data.bingeCount}</b> high-density sessions detected.</div>
            <div class="insight-item">🎯 Most Active: <b>${activeType}</b> is your primary time sink.</div>
        `;

        if (goalStats.total > 0) {
            const pct = Math.round((goalStats.met / goalStats.total) * 100);
            html += `<div class="insight-item">🎯 Goal Progress: Met daily goal on <b>${goalStats.met}/${goalStats.total} days</b> (${pct}%).</div>`;
        }

        this.elements.insightsList.innerHTML = html;
    }

    updateTimePeriod(metadata: CacheMetadata | null) {
        if (!metadata) {
            this.elements.timePeriod.innerText = 'N/A';
            return;
        }

        const diffMs = metadata.mostRecentTimestamp - metadata.earliestTimestamp;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        const years = Math.floor(diffDays / 365);
        const months = Math.floor((diffDays % 365) / 30);
        const days = Math.floor((diffDays % 365) % 30);
        
        let text = '';
        if (years > 0) text += `${years}y `;
        if (months > 0) text += `${months}m `;
        text += `${days}d`;
        
        this.elements.timePeriod.innerText = text.trim() || '1d';
        
        const start = new Date(metadata.earliestTimestamp).toLocaleDateString('en-GB');
        const end = new Date(metadata.mostRecentTimestamp).toLocaleDateString('en-GB');
        this.elements.timePeriod.parentElement!.title = `${start} - ${end}`;
    }

    updateProgress(show: boolean, text: string = '', pct: number = 0) {
        this.elements.progressIndicator.style.display = show ? 'block' : 'none';
        if (show) {
            this.elements.progressText.textContent = text;
            this.elements.progressFill.style.width = `${pct}%`;
        }
    }

    toggleSyncNewBtn(show: boolean) {
        this.elements.syncNewBtn.style.display = show ? 'inline-block' : 'none';
    }

    setGoalLabels(type: 'minutes' | 'games') {
        const input = this.elements.dailyGoalInput as HTMLInputElement;
        if (type === 'minutes') {
            this.elements.goalLabel.textContent = 'min/day';
            input.max = "1440";
            input.placeholder = "Minutes";
        } else {
            this.elements.goalLabel.textContent = 'games/day';
            input.max = "500";
            input.placeholder = "Games";
        }
    }
}
