import { GameSpeed, GameFilters } from "../types";
import { formatMinutesToHMS } from "../utils";

export class HeatmapRenderer {
    private container: HTMLElement;
    
    // Stats exposed for the Insights module
    public stats = {
        daysGoalMet: 0,
        totalDaysWithData: 0
    };

    constructor(elementId: string) {
        const el = document.getElementById(elementId);
        if (!el) throw new Error(`Element ${elementId} not found`);
        this.container = el;
    }

    render(
        dailyMinutes: Record<number, number>,
        dailyMinutesByType: Record<number, Record<GameSpeed, number>>,
        dailyGames: Record<number, number>,
        goalConfig: { value: number; type: 'minutes' | 'games' },
        activeFilters: GameFilters
    ) {
        this.container.innerHTML = '';
        this.stats.daysGoalMet = 0;
        this.stats.totalDaysWithData = 0;

        // 1. Apply Filters
        const filteredMinutes: Record<number, number> = {};
        
        // Convert filter object to array of strings ['Bullet', 'Rapid', etc.]
        const activeTypes = (Object.keys(activeFilters) as (keyof GameFilters)[])
            .filter(k => activeFilters[k])
            .map(k => k.charAt(0).toUpperCase() + k.slice(1)) as GameSpeed[];

        // Recalculate daily totals based on active filters
        for (const dateStr in dailyMinutesByType) {
            const date = parseInt(dateStr);
            let total = 0;
            activeTypes.forEach(type => {
                total += dailyMinutesByType[date][type] || 0;
            });
            if (total > 0) filteredMinutes[date] = total;
        }

        // 2. Determine Date Range
        const timestamps = Object.keys(filteredMinutes).map(t => parseInt(t));
        if (timestamps.length === 0) {
            this.container.innerHTML = '<p class="placeholder">No activity data available for selected filters.</p>';
            return;
        }

        const minDate = new Date(Math.min(...timestamps));
        const maxDate = new Date();

        // Align start date to previous Sunday
        const startDate = new Date(minDate);
        startDate.setDate(minDate.getDate() - minDate.getDay());
        startDate.setHours(0,0,0,0);

        const endDate = new Date(maxDate);
        endDate.setHours(0,0,0,0);

        // 3. Build DOM
        this.buildHeaderRow();
        const scrollWrapper = document.createElement('div');
        scrollWrapper.className = 'calendar-scroll-wrapper';
        
        const grid = document.createElement('div');
        grid.className = 'calendar-grid';

        let currentMonth = -1;
        const currentDate = new Date(startDate);

        while (currentDate <= endDate) {
            const ts = currentDate.getTime();
            const mins = filteredMinutes[ts] || 0;
            const games = dailyGames[ts] || 0;

            // Month Labels
            if (currentDate.getMonth() !== currentMonth) {
                currentMonth = currentDate.getMonth();
                const label = document.createElement('div');
                label.className = 'month-label';
                label.textContent = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                grid.appendChild(label);
            }

            // Day Cell
            const cell = document.createElement('div');
            cell.className = 'day-cell';
            
            const dateNum = document.createElement('span');
            dateNum.className = 'date-number';
            dateNum.textContent = currentDate.getDate().toString();
            cell.appendChild(dateNum);

            // Goal Logic
            const goalValue = goalConfig.type === 'minutes' ? mins : games;
            const goalMet = goalConfig.value > 0 && goalValue >= goalConfig.value;

            if (mins > 0) this.stats.totalDaysWithData++;

            if (goalMet) {
                cell.classList.add('goal-achieved');
                this.stats.daysGoalMet++;
                const goalText = goalConfig.type === 'minutes' 
                    ? `${formatMinutesToHMS(mins)} (${goalConfig.value}m goal)`
                    : `${games} games (${goalConfig.value} game goal)`;
                cell.title = `${currentDate.toDateString()}: ${goalText} ✓ Goal Achieved!`;
            } else {
                // Intensity classes
                if (mins > 0) {
                    if (mins > 60) cell.classList.add('level-4');
                    else if (mins > 30) cell.classList.add('level-3');
                    else if (mins > 15) cell.classList.add('level-2');
                    else cell.classList.add('level-1');
                }

                // Tooltip
                let tooltip = `${currentDate.toDateString()}: ${formatMinutesToHMS(mins)} (${games} games)`;
                if (goalConfig.value > 0) {
                    tooltip += goalConfig.type === 'minutes' 
                        ? ` (${Math.round(mins)}/${goalConfig.value}m)` 
                        : ` (${games}/${goalConfig.value} games)`;
                }
                cell.title = tooltip;
            }

            // Out of range (future or pre-history)
            if (currentDate > maxDate || currentDate < minDate) {
                cell.classList.add('out-of-range');
            }

            grid.appendChild(cell);
            currentDate.setDate(currentDate.getDate() + 1);
        }

        scrollWrapper.appendChild(grid);
        this.container.appendChild(scrollWrapper);

        // Scroll to bottom
        setTimeout(() => scrollWrapper.scrollTop = scrollWrapper.scrollHeight, 0);
    }

    private buildHeaderRow() {
        const row = document.createElement('div');
        row.className = 'calendar-header-row';
        ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(day => {
            const d = document.createElement('div');
            d.className = 'day-header';
            d.textContent = day;
            row.appendChild(d);
        });
        this.container.appendChild(row);
    }
}
