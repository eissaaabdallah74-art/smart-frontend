import { CommonModule } from '@angular/common';
import { Component, HostListener, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

type Status = 'active' | 'inactive';
type CategoryKey = 'safety' | 'driving' | 'attendance' | 'vehicle';

type KpiKey =
  // Safety
  | 'accidents'
  | 'trafficViolations'
  | 'harshBrakingSpeeding'
  | 'seatbeltCompliance'
  // Driving Behavior
  | 'speedCompliance'
  | 'smoothDriving'
  | 'fuelEfficiency'
  // Attendance & Discipline
  | 'onTimeArrival'
  | 'absenteeism'
  | 'shiftCompliance'
  // Vehicle Care
  | 'vehicleCleanliness'
  | 'dailyVehicleInspection'
  | 'maintenanceIssuesReported';

type SortKey = 'scoreDesc' | 'scoreAsc' | 'updatedDesc' | 'nameAsc';

interface KpiDef {
  key: KpiKey;
  label: string;
}

interface CategoryDef {
  key: CategoryKey;
  label: string;
  weight: number; // 0..1
  icon: string;   // Remix icon class
  kpis: KpiDef[];
}

interface Courier {
  id: string;
  fullName: string;
  company: string;
  hub: string;
  status: Status;
  lastUpdatedIso: string;
  metrics: Record<KpiKey, number>; // 0..10 (higher is better)
}

interface CategoryVm {
  avg0to10: number;
  contribution0to100: number;
}

interface CourierVm extends Courier {
  initials: string;
  total0to100: number;
  scorePct: number; // 0..100
  rating: { label: string; cls: 'excellent' | 'good' | 'warn' | 'bad' };
  categories: Record<CategoryKey, CategoryVm>;
  weakCount: number;
}

const CATEGORY_DEFS: CategoryDef[] = [
  {
    key: 'safety',
    label: 'Safety',
    weight: 0.4,
    icon: 'ri-shield-check-line',
    kpis: [
      { key: 'accidents', label: 'Accidents' },
      { key: 'trafficViolations', label: 'Traffic Violations' },
      { key: 'harshBrakingSpeeding', label: 'Harsh Braking / Speeding' },
      { key: 'seatbeltCompliance', label: 'Seatbelt Compliance' },
    ],
  },
  {
    key: 'driving',
    label: 'Driving Behavior',
    weight: 0.3,
    icon: 'ri-road-map-line',
    kpis: [
      { key: 'speedCompliance', label: 'Speed Compliance' },
      { key: 'smoothDriving', label: 'Smooth Driving' },
      { key: 'fuelEfficiency', label: 'Fuel Efficiency' },
    ],
  },
  {
    key: 'attendance',
    label: 'Attendance & Discipline',
    weight: 0.2,
    icon: 'ri-calendar-check-line',
    kpis: [
      { key: 'onTimeArrival', label: 'On-Time Arrival' },
      { key: 'absenteeism', label: 'Absenteeism' },
      { key: 'shiftCompliance', label: 'Shift Compliance' },
    ],
  },
  {
    key: 'vehicle',
    label: 'Vehicle Care',
    weight: 0.1,
    icon: 'ri-car-line',
    kpis: [
      { key: 'vehicleCleanliness', label: 'Vehicle Cleanliness' },
      { key: 'dailyVehicleInspection', label: 'Daily Vehicle Inspection' },
      { key: 'maintenanceIssuesReported', label: 'Maintenance Issues Reported' },
    ],
  },
];

@Component({
  selector: 'app-sub-contractors',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sub-contractors.component.html',
  styleUrls: ['./sub-contractors.component.scss'],
})
export class SubContractorsComponent {
  // ===== Filters =====
  readonly query = signal('');
  readonly statusFilter = signal<'all' | Status>('all');
  readonly sortKey = signal<SortKey>('scoreDesc');

  // ===== Modal =====
  readonly detailsId = signal<string | null>(null);
  readonly openCategory = signal<CategoryKey>('safety');

  // ===== Data =====
  readonly categoryDefs = CATEGORY_DEFS;
  private readonly _couriers = signal<Courier[]>(this.buildDemoCouriers());

  // ===== Derived =====
  readonly vmList = computed<CourierVm[]>(() => {
    const q = this.query().trim().toLowerCase();
    const st = this.statusFilter();
    const sort = this.sortKey();

    let list = this._couriers().map((c) => this.toVm(c));

    if (q) {
      list = list.filter((x) => {
        const hay = `${x.fullName} ${x.company} ${x.hub}`.toLowerCase();
        return hay.includes(q);
      });
    }

    if (st !== 'all') list = list.filter((x) => x.status === st);

    return this.sortVm(list, sort);
  });

  readonly stats = computed(() => {
    const list = this.vmList();
    if (!list.length) return { count: 0, avg: 0, excellent: 0, needsAttention: 0 };
    const avg = Math.round(list.reduce((s, x) => s + x.total0to100, 0) / list.length);
    const excellent = list.filter((x) => x.rating.cls === 'excellent').length;
    const needsAttention = list.filter((x) => x.rating.cls === 'warn' || x.rating.cls === 'bad').length;
    return { count: list.length, avg, excellent, needsAttention };
  });

  readonly detailsCourier = computed<Courier | null>(() => {
    const id = this.detailsId();
    if (!id) return null;
    return this._couriers().find((x) => x.id === id) ?? null;
  });

  readonly detailsVm = computed(() => {
    const c = this.detailsCourier();
    return c ? this.toVm(c) : null;
  });

  readonly isModalOpen = computed(() => !!this.detailsId());

  // ===== UI actions =====
  setStatusFilter(v: string) {
    if (v === 'all' || v === 'active' || v === 'inactive') this.statusFilter.set(v);
  }

  setSortKey(v: string) {
    if (v === 'scoreDesc' || v === 'scoreAsc' || v === 'updatedDesc' || v === 'nameAsc') this.sortKey.set(v);
  }

  openDetails(id: string) {
    this.detailsId.set(id);
    this.openCategory.set('safety');
    this.lockBodyScroll(true);
  }

  closeDetails() {
    this.detailsId.set(null);
    this.lockBodyScroll(false);
  }

  toggleCategory(key: CategoryKey) {
    this.openCategory.set(this.openCategory() === key ? key : key);
  }

  setOpenCategory(key: CategoryKey) {
    this.openCategory.set(key);
  }

  isOpenCategory(key: CategoryKey) {
    return this.openCategory() === key;
  }

  @HostListener('document:keydown.escape')
  onEsc() {
    if (this.detailsId()) this.closeDetails();
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(e: KeyboardEvent) {
    if (!this.isModalOpen()) return;
    if (e.key === 'Tab') return; // keep simple
  }

  // ===== Formatting =====
  formatDate(iso: string) {
    const d = new Date(iso);
    return new Intl.DateTimeFormat('en-GB', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  }

  trackById(_i: number, x: CourierVm) {
    return x.id;
  }

  // ===== Scoring =====
  getCategoryDef(key: CategoryKey) {
    return this.categoryDefs.find((x) => x.key === key)!;
  }

  kpiScore(d: Courier, key: KpiKey) {
    return d.metrics[key];
  }

  private toVm(c: Courier): CourierVm {
    const initials = this.getInitials(c.fullName);
    const categories = this.buildCategoryVm(c);
    const total0to100 = Math.round(Object.values(categories).reduce((s, x) => s + x.contribution0to100, 0));
    const scorePct = this.clamp(0, 100, total0to100);
    const rating = this.ratingFor(total0to100);
    const weakCount = (Object.keys(c.metrics) as KpiKey[]).filter((k) => c.metrics[k] <= 5.5).length;

    return { ...c, initials, categories, total0to100, scorePct, rating, weakCount };
  }

  private buildCategoryVm(c: Courier): Record<CategoryKey, CategoryVm> {
    const out = {} as Record<CategoryKey, CategoryVm>;

    for (const def of CATEGORY_DEFS) {
      const scores = def.kpis.map((k) => c.metrics[k.key]);
      const avg0to10 = this.round1(scores.reduce((s, x) => s + x, 0) / scores.length);
      const contribution0to100 = this.round1((avg0to10 / 10) * def.weight * 100);
      out[def.key] = { avg0to10, contribution0to100 };
    }
    return out;
  }

  private ratingFor(total: number) {
    if (total >= 85) return { label: 'Excellent', cls: 'excellent' as const };
    if (total >= 70) return { label: 'Good', cls: 'good' as const };
    if (total >= 55) return { label: 'Needs Attention', cls: 'warn' as const };
    return { label: 'Critical', cls: 'bad' as const };
  }

  private sortVm(list: CourierVm[], key: SortKey) {
    const copy = [...list];
    switch (key) {
      case 'scoreAsc':
        return copy.sort((a, b) => a.total0to100 - b.total0to100);
      case 'updatedDesc':
        return copy.sort((a, b) => +new Date(b.lastUpdatedIso) - +new Date(a.lastUpdatedIso));
      case 'nameAsc':
        return copy.sort((a, b) => a.fullName.localeCompare(b.fullName));
      case 'scoreDesc':
      default:
        return copy.sort((a, b) => b.total0to100 - a.total0to100);
    }
  }

  // ===== Demo data =====
  private buildDemoCouriers(): Courier[] {
    const base: Array<Pick<Courier, 'fullName' | 'company' | 'hub' | 'status'>> = [
      { fullName: 'Omar Hassan', company: 'Jumia', hub: 'Cairo - Nasr City', status: 'active' },
      { fullName: 'Ahmed Samy', company: 'Amazon', hub: 'Giza - Dokki', status: 'active' },
      { fullName: 'Mohamed Ali', company: 'Bosta', hub: 'Cairo - Maadi', status: 'active' },
      { fullName: 'Youssef Adel', company: 'Mylerz', hub: 'Cairo - Sheraton', status: 'inactive' },
      { fullName: 'Karim Tarek', company: 'Jumia', hub: 'Giza - Haram', status: 'active' },
      { fullName: 'Mostafa Nabil', company: 'Amazon', hub: 'Cairo - Ain Shams', status: 'active' },
      { fullName: 'Hany Salah', company: 'Bosta', hub: 'Cairo - Downtown', status: 'inactive' },
      { fullName: 'Ibrahim Fathy', company: 'Mylerz', hub: 'Giza - Faisal', status: 'active' },
      { fullName: 'Ali Mahmoud', company: 'Jumia', hub: 'Cairo - Helwan', status: 'active' },
      { fullName: 'Mahmoud Ehab', company: 'Amazon', hub: 'Cairo - New Cairo', status: 'active' },
      { fullName: 'Tamer Reda', company: 'Bosta', hub: 'Giza - Mohandseen', status: 'active' },
      { fullName: 'Khaled Ashraf', company: 'Mylerz', hub: 'Cairo - Shobra', status: 'active' },
    ];

    const now = Date.now();

    return base.map((x, i) => {
      const seed = 420 + i * 91;
      const r = (n: number) => this.rand(seed + n);

      const metrics: Record<KpiKey, number> = {
        accidents: this.intRange(6, 10, r(11)),
        trafficViolations: this.intRange(5, 10, r(12)),
        harshBrakingSpeeding: this.intRange(5, 10, r(13)),
        seatbeltCompliance: this.intRange(7, 10, r(14)),

        speedCompliance: this.intRange(6, 9, r(21)),
        smoothDriving: this.intRange(5, 10, r(22)),
        fuelEfficiency: this.intRange(6, 10, r(23)),

        onTimeArrival: this.intRange(7, 10, r(31)),
        absenteeism: this.intRange(5, 10, r(32)),
        shiftCompliance: this.intRange(6, 10, r(33)),

        vehicleCleanliness: this.intRange(6, 10, r(41)),
        dailyVehicleInspection: this.intRange(5, 10, r(42)),
        maintenanceIssuesReported: this.intRange(5, 10, r(43)),
      };

      const minutesAgo = Math.floor(r(99) * 60 * 24 * 6);
      const lastUpdatedIso = new Date(now - minutesAgo * 60_000).toISOString();

      return {
        id: `courier_${i + 1}`,
        fullName: x.fullName,
        company: x.company,
        hub: x.hub,
        status: x.status,
        lastUpdatedIso,
        metrics,
      };
    });
  }

  // ===== Utils =====
  private getInitials(name: string) {
    const parts = name.split(' ').filter(Boolean);
    const a = (parts[0]?.[0] || '').toUpperCase();
    const b = (parts[1]?.[0] || '').toUpperCase();
    return (a + b) || 'U';
  }

  private round1(v: number) {
    return Math.round(v * 10) / 10;
  }

  private clamp(min: number, max: number, v: number) {
    return Math.max(min, Math.min(max, v));
  }

  private intRange(min: number, max: number, r: number) {
    const v = min + Math.floor(r * (max - min + 1));
    return Math.max(min, Math.min(max, v));
  }

  private rand(seed: number) {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  private lockBodyScroll(lock: boolean) {
    try {
      document.body.style.overflow = lock ? 'hidden' : '';
    } catch {
      // ignore
    }
  }
}
