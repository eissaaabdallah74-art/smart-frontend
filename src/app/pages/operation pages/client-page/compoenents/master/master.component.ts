// src/app/pages/.../client-page/components/master/master.component.ts
import {
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  computed,
  signal,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  DriversServiceService,
  ApiDriver,
} from '../../../../../services/drivers/drivers-service.service';

type SortKey =
  | 'name'
  | 'courierPhone'
  | 'hub'
  | 'area'
  | 'vehicleType'
  | 'day1Date'
  | 'hiringStatus'
  | 'clientName';

type SortDir = 'asc' | 'desc';

@Component({
  selector: 'app-master',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './master.component.html',
  styleUrl: './master.component.scss',
})
export class MasterComponent implements OnChanges {
  @Input() clientId: number | null = null;
  @Input() clientName: string = '';

  private driversService = inject(DriversServiceService);

  private allDrivers = signal<ApiDriver[]>([]);
  readonly loading = signal<boolean>(false);
  readonly loadError = signal<string>('');

  // UX state
  readonly search = signal<string>('');
  readonly sortKey = signal<SortKey>('name');
  readonly sortDir = signal<SortDir>('asc');
  readonly lastUpdatedAt = signal<Date | null>(null);

  // منع refetch غير ضروري (بنجيب الداتا مرة واحدة + فلترة حسب العميل)
  private loadedOnce = false;

  ngOnChanges(changes: SimpleChanges): void {
    // أول ما يبقى عندي clientId أو clientName صالح — هاعمل load مرة واحدة فقط
    if (changes['clientName'] || changes['clientId']) {
      const hasClient = !!this.buildClientKey();
      if (hasClient && !this.loadedOnce) {
        this.loadDrivers(true);
      }
    }
  }

  /** =========================
   * Filtering + sorting
   * ========================= */

  private normalizeText(v: any): string {
    return String(v ?? '')
      .trim()
      .toLowerCase();
  }

  private normalizeClientName(v: string): string {
    // Normalize بسيط لتقليل مشاكل اختلاف المسافات/الرموز
    return this.normalizeText(v)
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9]+/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private getDriverClientId(d: ApiDriver): number | null {
    // لو الـ API بيرجع clientId فعلاً
    const anyD: any = d as any;
    const id = anyD?.clientId ?? null;
    return typeof id === 'number' ? id : null;
  }

  private getSortableValue(d: ApiDriver, key: SortKey): string {
    const anyD: any = d as any;
    const raw =
      key === 'day1Date'
        ? anyD?.day1Date
        : key === 'hub'
        ? anyD?.hub
        : (anyD?.[key] as any);

    // للـ date: نخليها ISO sortable
    if (key === 'day1Date') {
      const dt = raw ? new Date(raw) : null;
      return dt && !Number.isNaN(dt.getTime()) ? dt.toISOString() : '';
    }

    return this.normalizeText(raw);
  }

  // فلترة حسب العميل (clientId لو موجود، وإلا fallback على clientName)
  readonly filteredByClient = computed<ApiDriver[]>(() => {
    const all = this.allDrivers();
    const normInputName = this.normalizeClientName(this.clientName || '');
    const inputId = this.clientId;

    if (!inputId && !normInputName) return [];

    return all.filter((d) => {
      const dClientId = this.getDriverClientId(d);
      if (inputId != null && dClientId != null) return dClientId === inputId;

      const dName = this.normalizeClientName((d as any).clientName || '');
      if (!normInputName) return false;

      // مساواة normalized (أقل حساسية للاختلافات)
      return dName === normInputName;
    });
  });

  // Search + Sort
  readonly viewDrivers = computed<ApiDriver[]>(() => {
    const list = this.filteredByClient();
    const q = this.normalizeText(this.search());

    let out = list;

    if (q) {
      out = out.filter((d) => {
        const anyD: any = d as any;
        const haystack = [
          anyD?.name,
          anyD?.courierPhone,
          anyD?.clientName,
          anyD?.hub,
          anyD?.area,
          anyD?.vehicleType,
          anyD?.day1Date,
          anyD?.hiringStatus,
        ]
          .map((x) => this.normalizeText(x))
          .join(' | ');

        return haystack.includes(q);
      });
    }

    const key = this.sortKey();
    const dir = this.sortDir();

    out = [...out].sort((a, b) => {
      const av = this.getSortableValue(a, key);
      const bv = this.getSortableValue(b, key);
      if (av === bv) return 0;
      const res = av > bv ? 1 : -1;
      return dir === 'asc' ? res : -res;
    });

    return out;
  });

  // Summary
  readonly totalDrivers = computed(() => this.viewDrivers().length);
  readonly activeDrivers = computed(() => {
    const list = this.viewDrivers();
    return list.filter((d) => this.normalizeText((d as any).hiringStatus) === 'active')
      .length;
  });

  /** =========================
   * Actions
   * ========================= */

  setSort(key: SortKey): void {
    if (this.sortKey() === key) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
      return;
    }
    this.sortKey.set(key);
    this.sortDir.set('asc');
  }

  refresh(): void {
    this.loadDrivers(true);
  }

  clearSearch(): void {
    this.search.set('');
  }

  trackById = (_: number, d: ApiDriver) => (d as any).id ?? (d as any).courierPhone ?? _;

  /** =========================
   * UI helpers
   * ========================= */

  statusPillClass(status: any): string {
    const s = this.normalizeText(status);
    if (!s) return 'pill pill--muted';
    if (s === 'active') return 'pill pill--success';
    if (s.includes('hold') || s.includes('pending')) return 'pill pill--warn';
    if (s.includes('inactive') || s.includes('terminated') || s.includes('rejected'))
      return 'pill pill--danger';
    return 'pill pill--info';
  }

  vehicleLabel(v: any): string {
    const s = String(v ?? '').trim();
    return s || '—';
  }

  hubLabel(v: any): string {
    const s = String(v ?? '').trim();
    return s || '—';
  }

  safeText(v: any): string {
    const s = String(v ?? '').trim();
    return s || '—';
  }

  /** =========================
   * Data load
   * ========================= */

  private buildClientKey(): string | null {
    if (this.clientId != null) return `id:${this.clientId}`;
    const name = (this.clientName || '').trim();
    return name ? `name:${name.toLowerCase()}` : null;
  }

  private loadDrivers(force = false): void {
    const key = this.buildClientKey();
    if (!key) {
      this.allDrivers.set([]);
      this.loadedOnce = false;
      return;
    }

    // لو already loaded ومش force — بلاش نكرر
    if (this.loadedOnce && !force) return;

    this.loading.set(true);
    this.loadError.set('');

    this.driversService.getDrivers().subscribe({
      next: (list: ApiDriver[]) => {
        this.allDrivers.set(list || []);
        this.loading.set(false);
        this.loadedOnce = true;
        this.lastUpdatedAt.set(new Date());
      },
      error: (err) => {
        console.error('Failed to load drivers for master tab', err);
        this.allDrivers.set([]);
        this.loading.set(false);
        this.loadError.set('Failed to load drivers. Please try again.');
      },
    });
  }
}
