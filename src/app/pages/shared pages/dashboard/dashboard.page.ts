import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ViewChild,
  ElementRef,
  signal,
  computed,
  inject,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';



import {
  Chart,
  ChartConfiguration,
  registerables,
} from 'chart.js';
import { ClientsServiceService, ApiClient } from '../../../services/clients/clients-service.service';
import { DriversServiceService, ApiDriver } from '../../../services/drivers/drivers-service.service';
import { TrackingRow, TrackingServiceService } from '../../../services/tracking/tracking-service.service';

Chart.register(...registerables);

interface ExpiryBuckets {
  expired: number;
  danger: number;
  warning: number;
  ok: number;
  unknown: number;
}

interface ExpiryStats extends ExpiryBuckets {
  max: number;
}

interface ListItem {
  label: string;
  value: number;
}

interface ExpiringSoonItem {
  row: TrackingRow;
  days: number;
  date: string;
  kindLabel: string;
}

interface LegendItem {
  label: string;
  value: number;
  color: string;
}

@Component({
  standalone: true,
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  imports: [CommonModule],
})
export class DashboardPage implements OnInit, AfterViewInit, OnDestroy {
  private clientsService = inject(ClientsServiceService);
  private driversService = inject(DriversServiceService);
  private trackingService = inject(TrackingServiceService);
  private router = inject(Router);

  // ViewChild references for charts
  @ViewChild('expiryChart') expiryChartRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('clientsChart') clientsChartRef?: ElementRef<HTMLCanvasElement>;

  private expiryChart?: Chart;
  private clientsChart?: Chart;
  private viewReady = false;

  // Raw data signals
  drivers = signal<ApiDriver[]>([]);
  clients = signal<ApiClient[]>([]);
  tracking = signal<TrackingRow[]>([]);

  loading = signal(false);
  error = signal<string | null>(null);
  lastUpdated = signal<Date | null>(null);

  // Computed KPIs
  totalDrivers = computed(() => this.drivers().length);
  totalClients = computed(() => this.clients().length);
  totalTrackingRows = computed(() => this.tracking().length);

  trackedDriversCount = computed(() => {
    const ids = new Set<number>();
    for (const r of this.tracking()) {
      if (r.driverId != null) ids.add(r.driverId);
    }
    return ids.size;
  });

  driversWithoutTracking = computed(() => {
    const diff = this.totalDrivers() - this.trackedDriversCount();
    return diff > 0 ? diff : 0;
  });

  // Expiry computations
  expiryBuckets = computed<ExpiryBuckets>(() => {
    const rows = this.tracking();
    const buckets: ExpiryBuckets = {
      expired: 0,
      danger: 0,
      warning: 0,
      ok: 0,
      unknown: 0,
    };

    for (const r of rows) {
      const dates = [
        r.idExpiryDate,
        r.dLicenseExpiryDate,
        r.vLicenseExpiryDate,
      ];

      let minDays: number | null = null;

      for (const dateStr of dates) {
        const days = this.daysUntil(dateStr);
        if (days === null) continue;
        if (minDays === null || days < minDays) minDays = days;
      }

      if (minDays === null) buckets.unknown++;
      else if (minDays < 0) buckets.expired++;
      else if (minDays <= 30) buckets.danger++;
      else if (minDays <= 60) buckets.warning++;
      else buckets.ok++;
    }

    return buckets;
  });

  expiryStats = computed<ExpiryStats>(() => {
    const b = this.expiryBuckets();
    const max = Math.max(b.expired, b.danger, b.warning, b.ok, b.unknown, 1);
    return { ...b, max };
  });

  urgentExpiries = computed(
    () => this.expiryBuckets().danger + this.expiryBuckets().expired,
  );

  expiryLegendItems = computed<LegendItem[]>(() => [
    { label: 'Expired', value: this.expiryBuckets().expired, color: '#ef4444' },
    { label: '<= 30d', value: this.expiryBuckets().danger, color: '#f97316' },
    { label: '31–60d', value: this.expiryBuckets().warning, color: '#eab308' },
    { label: '> 60d', value: this.expiryBuckets().ok, color: '#22c55e' },
    { label: 'No date', value: this.expiryBuckets().unknown, color: '#9ca3af' },
  ]);

  // List computations
  driversByClient = computed<ListItem[]>(() => {
    const map = new Map<string, number>();
    for (const d of this.drivers()) {
      const key = (d.clientName || 'Unassigned').trim() || 'Unassigned';
      map.set(key, (map.get(key) || 0) + 1);
    }
    const arr: ListItem[] = [];
    map.forEach((value, label) => arr.push({ label, value }));
    arr.sort((a, b) => b.value - a.value);
    return arr.slice(0, 5);
  });

  clientsByCrm = computed<ListItem[]>(() => {
    const map = new Map<string, number>();
    for (const c of this.clients()) {
      const key = (c.crm || 'Unassigned').trim() || 'Unassigned';
      map.set(key, (map.get(key) || 0) + 1);
    }
    const arr: ListItem[] = [];
    map.forEach((value, label) => arr.push({ label, value }));
    arr.sort((a, b) => b.value - a.value);
    return arr.slice(0, 5);
  });

  maxCrmValue = computed(() => {
    const items = this.clientsByCrm();
    return items.length > 0 ? Math.max(...items.map((i) => i.value)) : 1;
  });

  clientsByAccountManager = computed<ListItem[]>(() => {
    const map = new Map<string, number>();
    for (const c of this.clients()) {
      const key = (c.accountManager || 'Unassigned').trim() || 'Unassigned';
      map.set(key, (map.get(key) || 0) + 1);
    }
    const arr: ListItem[] = [];
    map.forEach((value, label) => arr.push({ label, value }));
    arr.sort((a, b) => b.value - a.value);
    return arr.slice(0, 5);
  });

  maxManagerValue = computed(() => {
    const items = this.clientsByAccountManager();
    return items.length > 0 ? Math.max(...items.map((i) => i.value)) : 1;
  });

  expiringSoon = computed<ExpiringSoonItem[]>(() => {
    const result: ExpiringSoonItem[] = [];

    for (const r of this.tracking()) {
      const candidates: { kindLabel: string; dateStr?: string | null }[] = [
        { kindLabel: 'National ID', dateStr: r.idExpiryDate },
        { kindLabel: 'Driving licence', dateStr: r.dLicenseExpiryDate },
        { kindLabel: 'Vehicle licence', dateStr: r.vLicenseExpiryDate },
      ];

      let best: { kindLabel: string; date: string; days: number } | null = null;

      for (const c of candidates) {
        if (!c.dateStr) continue;
        const days = this.daysUntil(c.dateStr);
        if (days === null) continue;
        if (best === null || days < best.days) {
          best = { kindLabel: c.kindLabel, date: c.dateStr, days };
        }
      }

      if (best) {
        result.push({
          row: r,
          days: best.days,
          date: best.date,
          kindLabel: best.kindLabel,
        });
      }
    }

    result.sort((a, b) => a.days - b.days);
    return result.slice(0, 5);
  });

  // Lifecycle

  ngOnInit(): void {
    this.loadAll();
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    if (!this.loading() && !this.error()) {
      this.renderCharts();
    }
  }

  ngOnDestroy(): void {
    this.destroyCharts();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    // Debounce chart resizing
    setTimeout(() => {
      if (this.expiryChart || this.clientsChart) {
        this.renderCharts();
      }
    }, 100);
  }

  // Data loading

  loadAll(): void {
    this.loading.set(true);
    this.error.set(null);

    forkJoin({
      drivers: this.driversService.getDrivers().pipe(
        catchError((err) => {
          console.error('Error loading drivers:', err);
          return of([] as ApiDriver[]);
        }),
      ),
      clients: this.clientsService.getClients().pipe(
        catchError((err) => {
          console.error('Error loading clients:', err);
          return of([] as ApiClient[]);
        }),
      ),
      tracking: this.trackingService.getRows().pipe(
        catchError((err) => {
          console.error('Error loading tracking:', err);
          return of([] as TrackingRow[]);
        }),
      ),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ drivers, clients, tracking }) => {
          this.drivers.set(drivers);
          this.clients.set(clients);
          this.tracking.set(tracking);
          this.lastUpdated.set(new Date());

          if (this.viewReady) {
            setTimeout(() => this.renderCharts(), 0);
          }
        },
        error: (err) => {
          console.error('Dashboard load error', err);
          this.error.set(
            'Failed to load dashboard data. Please try again.',
          );
        },
      });
  }

  refreshData(): void {
    if (!this.loading()) {
      this.loadAll();
    }
  }

  // Chart rendering

  private renderCharts(): void {
    this.destroyCharts();
    this.renderExpiryChart();
    this.renderClientsChart();
  }

  private renderExpiryChart(): void {
    const expiryCanvas = this.expiryChartRef?.nativeElement;
    if (!expiryCanvas) return;

    const b = this.expiryBuckets();
    const data = [b.expired, b.danger, b.warning, b.ok, b.unknown];

    const config: ChartConfiguration<'bar'> = {
      type: 'bar',
      data: {
        labels: [
          'Expired',
          'Urgent (≤30d)',
          'Warning (31-60d)',
          'Safe (>60d)',
          'No Date',
        ],
        datasets: [
          {
            data,
            borderWidth: 0,
            borderRadius: 8,
            backgroundColor: [
              '#ef4444',
              '#f97316',
              '#eab308',
              '#22c55e',
              '#9ca3af',
            ],
            hoverBackgroundColor: [
              '#dc2626',
              '#ea580c',
              '#ca8a04',
              '#16a34a',
              '#6b7280',
            ],
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1f2937',
            titleColor: '#f9fafb',
            bodyColor: '#f9fafb',
            borderColor: '#374151',
            borderWidth: 1,
            cornerRadius: 8,
            displayColors: true,
            callbacks: {
              label: (context) => {
                const value = (context.parsed.y ?? 0) as number;
                const total = data.reduce((sum, val) => sum + val, 0);
                const percentage =
                  total > 0
                    ? ((value / total) * 100).toFixed(1)
                    : '0';
                return `${value} documents (${percentage}%)`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              font: { size: 11, family: 'Inter' },
              color: '#6b7280',
            },
          },
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1,
              precision: 0,
              font: { size: 11, family: 'Inter' },
              color: '#6b7280',
            },
            grid: {
              color: '#f3f4f6',
            },
          },
        },
        interaction: {
          intersect: false,
          mode: 'index',
        },
      },
    };

    this.expiryChart = new Chart(expiryCanvas.getContext('2d')!, config);
  }

  private renderClientsChart(): void {
    const clientsCanvas = this.clientsChartRef?.nativeElement;
    if (!clientsCanvas) return;

    const items = this.driversByClient();
    const labels = items.map((i) => this.truncateLabel(i.label, 15));
    const values = items.map((i) => i.value);

    const backgroundColors = [
      '#6366f1',
      '#0ea5e9',
      '#22c55e',
      '#f97316',
      '#a855f7',
      '#ec4899',
      '#06b6d4',
      '#84cc16',
      '#f59e0b',
      '#8b5cf6',
    ];

    const config: ChartConfiguration<'doughnut'> = {
      type: 'doughnut',
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: backgroundColors.slice(0, items.length),
            hoverBackgroundColor: backgroundColors
              .slice(0, items.length)
              .map((color) => this.adjustBrightness(color, -20)),
            borderWidth: 2,
            borderColor: '#ffffff',
            hoverOffset: 8,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 12,
              font: { size: 11, family: 'Inter' },
              color: '#6b7280',
              usePointStyle: true,
              padding: 15,
            },
          },
          tooltip: {
            backgroundColor: '#1f2937',
            titleColor: '#f9fafb',
            bodyColor: '#f9fafb',
            borderColor: '#374151',
            borderWidth: 1,
            cornerRadius: 8,
            callbacks: {
              label: (context) => {
                const value = context.parsed as number;
                const total = values.reduce(
                  (sum, val) => sum + val,
                  0,
                );
                const percentage =
                  total > 0
                    ? ((value / total) * 100).toFixed(1)
                    : '0';
                return `${context.label}: ${value} drivers (${percentage}%)`;
              },
            },
          },
        },
        cutout: '65%',
        interaction: {
          intersect: true,
          mode: 'point',
        },
      },
    };

    this.clientsChart = new Chart(
      clientsCanvas.getContext('2d')!,
      config,
    );
  }

  private destroyCharts(): void {
    if (this.expiryChart) {
      this.expiryChart.destroy();
      this.expiryChart = undefined;
    }
    if (this.clientsChart) {
      this.clientsChart.destroy();
      this.clientsChart = undefined;
    }
  }

  // UI Interactions

  navigateToDrivers(): void {
    this.router.navigate(['/drivers']);
  }

  navigateToClients(): void {
    this.router.navigate(['/clients']);
  }

  navigateToTracking(): void {
    this.router.navigate(['/drivers-tracking']);
  }

  showExpiryModal(): void {
    // Implement modal showing urgent expiries
    console.log('Show expiry modal with urgent items');
  }

  viewAllExpiries(): void {
    this.router.navigate(['/expiries']);
  }

  viewDriverDetails(driverId?: number): void {
    if (driverId) {
      this.router.navigate(['/drivers', driverId]);
    }
  }

  exportExpiryData(): void {
    // Implement export functionality
    console.log('Export expiry data');
  }

  // Helper methods

  private daysUntil(dateStr?: string | null): number | null {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diffMs = d.getTime() - today.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }

  expiryText(dateStr?: string | null): string {
    const days = this.daysUntil(dateStr);
    if (days === null) return 'No date';
    if (days < 0) return `${Math.abs(days)} days overdue`;
    if (days === 0) return 'Expires today';
    if (days === 1) return '1 day left';
    return `${days} days left`;
  }

  badgeClassForDays(dateStr?: string | null): string {
    const days = this.daysUntil(dateStr);
    if (days === null) return 'badge--muted';
    if (days < 0) return 'badge--expired';
    if (days <= 30) return 'badge--danger';
    if (days <= 60) return 'badge--warning';
    return 'badge--ok';
  }

  badgeIconClassForDays(dateStr?: string | null): string {
    const days = this.daysUntil(dateStr);
    if (days === null) return 'icon-calendar';
    if (days < 0) return 'icon-alert';
    if (days <= 30) return 'icon-warning';
    if (days <= 60) return 'icon-clock';
    return 'icon-check';
  }

  getManagerAvatar(managerName: string): string {
    // Simple avatar generation based on manager name
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(
      managerName,
    )}&background=6366f1&color=fff&size=32`;
  }

  private truncateLabel(label: string, maxLength: number): string {
    return label.length > maxLength
      ? `${label.substring(0, maxLength)}...`
      : label;
  }

  private adjustBrightness(color: string, percent: number): string {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = ((num >> 8) & 0x00ff) + amt;
    const B = (num & 0x0000ff) + amt;

    return (
      '#' +
      (
        0x1000000 +
        (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
        (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
        (B < 255 ? (B < 1 ? 0 : B) : 255)
      )
        .toString(16)
        .slice(1)
    );
  }
}
