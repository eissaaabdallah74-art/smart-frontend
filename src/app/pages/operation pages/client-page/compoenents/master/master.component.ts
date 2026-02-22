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
import { ExportButtonComponent } from '../../../../../shared/export-button/export-button';
import { DetailsDriverMasterComponent } from './components/details-driver-master/details-driver-master.component';
import { UpdateDriverMasterComponent } from './components/update-driver-master/update-driver-master.component';



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
type PanelMode = 'details' | 'update';

@Component({
  selector: 'app-master',
  standalone: true,
  imports: [
    CommonModule,
    ExportButtonComponent,
    DetailsDriverMasterComponent,
    UpdateDriverMasterComponent,
  ],
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

  // Filters
  readonly filterHiringStatus = signal<string>('');
  readonly filterHub = signal<string>('');
  readonly filterArea = signal<string>('');
  readonly filterVehicleType = signal<string>('');
  readonly filterContractStatus = signal<string>('');
  readonly filterSigned = signal<'' | 'true' | 'false'>('');

  // Panel
  readonly panelOpen = signal<boolean>(false);
  readonly panelMode = signal<PanelMode>('details');
  readonly selectedDriverId = signal<number | null>(null);

  // منع refetch غير ضروري
  private loadedOnce = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['clientName'] || changes['clientId']) {
      const hasClient = !!this.buildClientKey();
      if (hasClient && !this.loadedOnce) {
        this.loadDrivers(true);
      }
    }
  }

  /** =========================
   * Helpers
   * ========================= */

  private normalizeText(v: any): string {
    return String(v ?? '').trim().toLowerCase();
  }

  private normalizeClientName(v: string): string {
    return this.normalizeText(v)
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9]+/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private getDriverClientId(d: ApiDriver): number | null {
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

    if (key === 'day1Date') {
      const dt = raw ? new Date(raw) : null;
      return dt && !Number.isNaN(dt.getTime()) ? dt.toISOString() : '';
    }

    return this.normalizeText(raw);
  }

  private uniqNonEmpty(values: any[]): string[] {
    const set = new Set<string>();
    for (const v of values) {
      const s = String(v ?? '').trim();
      if (s) set.add(s);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }

  /** =========================
   * Filter by client
   * ========================= */

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
      return dName === normInputName;
    });
  });

  /** =========================
   * Filter options
   * ========================= */

  readonly hubOptions = computed(() =>
    this.uniqNonEmpty(this.filteredByClient().map((d: any) => d?.hub))
  );

  readonly areaOptions = computed(() =>
    this.uniqNonEmpty(this.filteredByClient().map((d: any) => d?.area))
  );

  readonly vehicleOptions = computed(() =>
    this.uniqNonEmpty(this.filteredByClient().map((d: any) => d?.vehicleType))
  );

  readonly hiringStatusOptions = computed(() =>
    this.uniqNonEmpty(this.filteredByClient().map((d: any) => d?.hiringStatus))
  );

  readonly contractStatusOptions = computed(() =>
    this.uniqNonEmpty(this.filteredByClient().map((d: any) => d?.contractStatus))
  );

  hasActiveFilters(): boolean {
    return !!(
      this.filterHiringStatus() ||
      this.filterHub() ||
      this.filterArea() ||
      this.filterVehicleType() ||
      this.filterContractStatus() ||
      this.filterSigned()
    );
  }

  clearFilters(): void {
    this.filterHiringStatus.set('');
    this.filterHub.set('');
    this.filterArea.set('');
    this.filterVehicleType.set('');
    this.filterContractStatus.set('');
    this.filterSigned.set('');
  }

  setSignedFilter(val: string): void {
    if (val === 'true' || val === 'false' || val === '') {
      this.filterSigned.set(val as any);
    } else {
      this.filterSigned.set('');
    }
  }

  /** =========================
   * Search + Filters + Sort
   * ========================= */

  readonly viewDrivers = computed<ApiDriver[]>(() => {
    const base = this.filteredByClient();

    const fs = {
      hiringStatus: this.normalizeText(this.filterHiringStatus()),
      hub: this.normalizeText(this.filterHub()),
      area: this.normalizeText(this.filterArea()),
      vehicleType: this.normalizeText(this.filterVehicleType()),
      contractStatus: this.normalizeText(this.filterContractStatus()),
      signed: this.filterSigned(),
    };

    let out = base.filter((d: any) => {
      if (fs.hiringStatus && this.normalizeText(d?.hiringStatus) !== fs.hiringStatus) return false;
      if (fs.hub && this.normalizeText(d?.hub) !== fs.hub) return false;
      if (fs.area && this.normalizeText(d?.area) !== fs.area) return false;
      if (fs.vehicleType && this.normalizeText(d?.vehicleType) !== fs.vehicleType) return false;
      if (fs.contractStatus && this.normalizeText(d?.contractStatus) !== fs.contractStatus) return false;

      if (fs.signed === 'true' && !Boolean(d?.signed)) return false;
      if (fs.signed === 'false' && Boolean(d?.signed)) return false;

      return true;
    });

    const q = this.normalizeText(this.search());
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
          anyD?.contractStatus,
          anyD?.courierCode,
          anyD?.courierId,
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
    return list.filter((d) => this.normalizeText((d as any).hiringStatus) === 'active').length;
  });

  /** =========================
   * Export
   * ========================= */

  readonly exportData = computed(() => {
    return this.viewDrivers().map((d: any) => ({
      id: d?.id ?? '',
      name: d?.name ?? '',
      courierPhone: d?.courierPhone ?? '',
      clientName: d?.clientName ?? '',
      hub: d?.hub ?? '',
      area: d?.area ?? '',
      vehicleType: d?.vehicleType ?? '',
      hiringStatus: d?.hiringStatus ?? '',
      contractStatus: d?.contractStatus ?? '',
      signed: d?.signed ? 'Yes' : 'No',
      day1Date: d?.day1Date ? String(d.day1Date).slice(0, 10) : '',
      hiringDate: d?.hiringDate ? String(d.hiringDate).slice(0, 10) : '',
      courierCode: d?.courierCode ?? '',
      courierId: d?.courierId ?? '',
    }));
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

  openDetails(id: number | null): void {
    if (!id) return;
    this.selectedDriverId.set(id);
    this.panelMode.set('details');
    this.panelOpen.set(true);
  }

  openUpdate(id: number | null): void {
    if (!id) return;
    this.selectedDriverId.set(id);
    this.panelMode.set('update');
    this.panelOpen.set(true);
  }

  closePanel(): void {
    this.panelOpen.set(false);
  }

  onDriverSaved(updated: ApiDriver): void {
    // update local list to avoid refetch
    const list = [...this.allDrivers()];
    const idx = list.findIndex((x: any) => (x as any)?.id === (updated as any)?.id);
    if (idx >= 0) {
      list[idx] = updated;
      this.allDrivers.set(list);
      this.lastUpdatedAt.set(new Date());
    }
    // after save go to details for quick review
    this.openDetails((updated as any)?.id ?? null);
  }

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
