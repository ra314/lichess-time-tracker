import {
  Chart,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip
} from 'chart.js';
import { GameSpeed } from '../types';

// Register Chart.js components manually (tree-shaking)
Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);

export class ChartManager {
    private chart: Chart | null = null;
    private ctx: CanvasRenderingContext2D;

    constructor(canvasId: string) {
        const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        if (!canvas) throw new Error(`Canvas ${canvasId} not found`);
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not get canvas context');
        this.ctx = ctx;
    }

    render(dist: Record<GameSpeed, number>) {
        if (this.chart) this.chart.destroy();

        this.chart = new Chart(this.ctx, {
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
}
