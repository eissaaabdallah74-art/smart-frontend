import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

type CourierCompany = 'Jumia' | 'Amazon' | 'SMSA' | 'Mylerz' | 'Bosta' | 'Other';
type VehicleType = 'truck' | 'sedan' | 'motorbike' | 'van';
type EngagementType = 'direct' | 'subcontractor';

type SortKey = 'expiry' | 'name' | 'company' | 'vehicle' | 'daysLeft';
type SortDir = 'asc' | 'desc';

interface CourierLicenseRow {
  id: string;
  courierName: string;
  courierPhone?: string;

  company: CourierCompany;
  companyRef?: string;

  engagementType: EngagementType;
  subcontractorName?: string;

  vehicleType: VehicleType;
  vehiclePlate?: string;

  licenseNo: string;
  licenseExpiry: string; // YYYY-MM-DD

  nationalId?: string;
  createdAt: string; // ISO
  lastUpdatedAt: string; // ISO
  notes?: string;
}
@Component({
  selector: 'app-expired-drivers-data',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './expired-drivers-data.component.html',
  styleUrl: './expired-drivers-data.component.scss'
})
export class ExpiredDriversDataComponent {

readonly EXPIRING_SOON_DAYS = 30;

  rows: CourierLicenseRow[] = this.buildFakeRows();

  // Filters
  q = '';
  company: CourierCompany | 'all' = 'all';
  vehicleType: VehicleType | 'all' = 'all';
  engagementType: EngagementType | 'all' = 'all';
  status: 'all' | 'valid' | 'expiring' | 'expired' = 'all';
  onlyCritical14 = false;

  // Sorting
  sortKey: SortKey = 'expiry';
  sortDir: SortDir = 'asc';

  // Paging
  pageSize = 4;
  page = 1;

  // Modal
  modalOpen = false;
  modalMode: 'create' | 'edit' = 'create';
  activeId: string | null = null;
  draft: CourierLicenseRow = this.emptyDraft();

  // Toast
  toast: { type: 'success' | 'error'; msg: string } | null = null;
  private toastTimer: any;

  // =========================
  // Derived
  // =========================
  get filteredSorted(): CourierLicenseRow[] {
    const query = this.q.trim().toLowerCase();
    const criticalDays = 14;

    const filtered = this.rows.filter((r) => {
      if (query) {
        const hay = [
          r.id,
          r.courierName,
          r.courierPhone ?? '',
          r.company,
          r.companyRef ?? '',
          r.engagementType,
          r.subcontractorName ?? '',
          r.vehicleType,
          r.vehiclePlate ?? '',
          r.licenseNo,
          r.licenseExpiry,
          r.nationalId ?? '',
          r.notes ?? '',
        ]
          .join(' | ')
          .toLowerCase();

        if (!hay.includes(query)) return false;
      }

      if (this.company !== 'all' && r.company !== this.company) return false;
      if (this.vehicleType !== 'all' && r.vehicleType !== this.vehicleType) return false;
      if (this.engagementType !== 'all' && r.engagementType !== this.engagementType) return false;

      const st = this.getStatus(r);
      if (this.status !== 'all' && st !== this.status) return false;

      if (this.onlyCritical14) {
        const d = this.daysLeft(r);
        if (!(d >= 0 && d <= criticalDays)) return false;
      }

      return true;
    });

    const dir = this.sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = this.sortValue(a, this.sortKey);
      const bv = this.sortValue(b, this.sortKey);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }

  get pageCount(): number {
    return Math.max(1, Math.ceil(this.filteredSorted.length / this.pageSize));
  }

  get paged(): CourierLicenseRow[] {
    const p = Math.min(Math.max(this.page, 1), this.pageCount);
    const start = (p - 1) * this.pageSize;
    return this.filteredSorted.slice(start, start + this.pageSize);
  }

  // KPIs
  get kpiTotal() {
    return this.rows.length;
  }
  get kpiExpired() {
    return this.rows.filter((r) => this.getStatus(r) === 'expired').length;
  }
  get kpiExpiring() {
    return this.rows.filter((r) => this.getStatus(r) === 'expiring').length;
  }
  get kpiCompanies() {
    return new Set(this.rows.map((r) => r.company)).size;
  }

  // =========================
  // Helpers
  // =========================
  trackById = (_: number, r: CourierLicenseRow) => r.id;

  onChangeAnyFilter() {
    this.page = 1;
  }

  toggleSort(key: SortKey) {
    if (this.sortKey === key) this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    else {
      this.sortKey = key;
      this.sortDir = 'asc';
    }
  }

  daysLeft(r: CourierLicenseRow): number {
    const end = this.toLocalMidday(r.licenseExpiry);
    const now = new Date();
    const ms = end.getTime() - now.getTime();
    return Math.floor(ms / (1000 * 60 * 60 * 24));
  }

  getStatus(r: CourierLicenseRow): 'valid' | 'expiring' | 'expired' {
    const d = this.daysLeft(r);
    if (d < 0) return 'expired';
    if (d <= this.EXPIRING_SOON_DAYS) return 'expiring';
    return 'valid';
  }

  statusLabel(r: CourierLicenseRow) {
    const st = this.getStatus(r);
    if (st === 'expired') return 'Expired';
    if (st === 'expiring') return 'Expiring';
    return 'Valid';
  }

  vehicleLabel(v: VehicleType): string {
    switch (v) {
      case 'truck':
        return 'Truck';
      case 'sedan':
        return 'Sedan';
      case 'motorbike':
        return 'Motorbike';
      case 'van':
        return 'Van';
    }
  }

  engagementLabel(t: EngagementType): string {
    return t === 'direct' ? 'Direct' : 'Sub-Contractor';
  }

  // =========================
  // Pagination (no Math in template)
  // =========================
  goFirstPage() {
    this.page = 1;
  }
  goLastPage() {
    this.page = this.pageCount;
  }
  goPrevPage() {
    this.page = Math.max(1, this.page - 1);
  }
  goNextPage() {
    this.page = Math.min(this.pageCount, this.page + 1);
  }

  // =========================
  // Modal CRUD
  // =========================
  openCreate() {
    this.modalMode = 'create';
    this.activeId = null;
    this.draft = this.emptyDraft();
    this.draft.licenseExpiry = this.toYmd(this.addDays(new Date(), 120));
    this.modalOpen = true;
  }

  openEdit(r: CourierLicenseRow) {
    this.modalMode = 'edit';
    this.activeId = r.id;
    this.draft = { ...r };
    this.modalOpen = true;
  }

  closeModal() {
    this.modalOpen = false;
  }

  saveDraft() {
    const err = this.validateDraft(this.draft);
    if (err) return this.showToast('error', err);

    const now = new Date().toISOString();

    if (this.modalMode === 'create') {
      const newRow: CourierLicenseRow = {
        ...this.draft,
        id: this.generateCourierId(),
        createdAt: now,
        lastUpdatedAt: now,
      };
      this.rows = [newRow, ...this.rows];
      this.showToast('success', 'Courier license created.');
    } else {
      const id = this.activeId;
      if (!id) return;
      this.rows = this.rows.map((r) =>
        r.id === id ? { ...this.draft, id, createdAt: r.createdAt, lastUpdatedAt: now } : r
      );
      this.showToast('success', 'Courier license updated.');
    }

    this.modalOpen = false;
  }

  deleteRow(r: CourierLicenseRow) {
    const ok = confirm(`Delete courier ${r.courierName} (${r.id})?`);
    if (!ok) return;
    this.rows = this.rows.filter((x) => x.id !== r.id);
    this.showToast('success', 'Courier deleted.');
    this.page = 1;
  }

  // =========================
  // Export CSV
  // =========================
  exportCsv() {
    const headers = [
      'CourierID',
      'CourierName',
      'Company',
      'CompanyRef',
      'EngagementType',
      'SubcontractorName',
      'VehicleType',
      'VehiclePlate',
      'LicenseNo',
      'LicenseExpiry',
      'DaysLeft',
      'Status',
      'Phone',
      'NationalId',
      'Notes',
    ];

    const lines = this.filteredSorted.map((r) => {
      const vals = [
        r.id,
        r.courierName,
        r.company,
        r.companyRef ?? '',
        r.engagementType,
        r.subcontractorName ?? '',
        r.vehicleType,
        r.vehiclePlate ?? '',
        r.licenseNo,
        r.licenseExpiry,
        String(this.daysLeft(r)),
        this.getStatus(r),
        r.courierPhone ?? '',
        r.nationalId ?? '',
        (r.notes ?? '').replace(/\s+/g, ' ').trim(),
      ];
      return vals.map((v) => this.csvEscape(v)).join(',');
    });

    const csv = [headers.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `couriers_licenses_${this.toYmd(new Date())}.csv`;
    a.click();

    URL.revokeObjectURL(url);
    this.showToast('success', 'CSV exported.');
  }

  private csvEscape(v: string) {
    const s = String(v ?? '');
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  // =========================
  // Validation / utils
  // =========================
  private validateDraft(d: CourierLicenseRow): string | null {
    const required = (val: any) => String(val ?? '').trim().length > 0;

    if (!required(d.courierName)) return 'Courier name is required.';
    if (!required(d.company)) return 'Company is required.';
    if (!required(d.engagementType)) return 'Engagement type is required.';
    if (d.engagementType === 'subcontractor' && !required(d.subcontractorName))
      return 'Sub-Contractor name is required.';
    if (!required(d.vehicleType)) return 'Vehicle type is required.';
    if (!required(d.licenseNo)) return 'License number is required.';
    if (!required(d.licenseExpiry)) return 'License expiry date is required.';

    const dt = this.toLocalMidday(d.licenseExpiry);
    if (Number.isNaN(dt.getTime())) return 'License expiry date is invalid.';

    return null;
  }

  private emptyDraft(): CourierLicenseRow {
    const now = new Date().toISOString();
    return {
      id: '',
      courierName: '',
      courierPhone: '',
      company: 'Jumia',
      companyRef: '',
      engagementType: 'direct',
      subcontractorName: '',
      vehicleType: 'sedan',
      vehiclePlate: '',
      licenseNo: '',
      licenseExpiry: this.toYmd(new Date()),
      nationalId: '',
      createdAt: now,
      lastUpdatedAt: now,
      notes: '',
    };
  }

  private showToast(type: 'success' | 'error', msg: string) {
    this.toast = { type, msg };
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => (this.toast = null), 2600);
  }

  private sortValue(r: CourierLicenseRow, key: SortKey): any {
    switch (key) {
      case 'expiry':
        return this.toLocalMidday(r.licenseExpiry).getTime();
      case 'daysLeft':
        return this.daysLeft(r);
      case 'name':
        return (r.courierName ?? '').toLowerCase();
      case 'company':
        return (r.company ?? '').toLowerCase();
      case 'vehicle':
        return (r.vehicleType ?? '').toLowerCase();
      default:
        return this.toLocalMidday(r.licenseExpiry).getTime();
    }
  }

  private generateCourierId(): string {
    const n = Math.floor(1000 + Math.random() * 9000);
    let id = `CR-${n}`;
    while (this.rows.some((r) => r.id === id)) {
      const m = Math.floor(1000 + Math.random() * 9000);
      id = `CR-${m}`;
    }
    return id;
  }

  private toYmd(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  private addDays(d: Date, days: number): Date {
    const x = new Date(d);
    x.setDate(x.getDate() + days);
    return x;
  }

  private toLocalMidday(ymd: string): Date {
    const [y, m, d] = (ymd ?? '').split('-').map((n) => Number(n));
    return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0);
  }

  private buildFakeRows(): CourierLicenseRow[] {
    const today = new Date();
    const iso = (d: Date) => this.toYmd(d);

    return [
      {
        id: 'CR-1207',
        courierName: 'Ahmed Samir',
        courierPhone: '+20 10 1234 5678',
        company: 'Jumia',
        companyRef: 'JUM-77',
        engagementType: 'subcontractor',
subcontractorName: 'Hossam Farouk',
        vehicleType: 'motorbike',
        vehiclePlate: 'ABC 1234',
        licenseNo: 'LIC-784512',
        licenseExpiry: iso(this.addDays(today, 9)),
        nationalId: '29801011234567',
        createdAt: new Date(today.getTime() - 1000 * 60 * 60 * 24 * 30).toISOString(),
        lastUpdatedAt: new Date(today.getTime() - 1000 * 60 * 60 * 24 * 2).toISOString(),
        notes: 'High volume area (Nasr City).',
      },
      {
        id: 'CR-8841',
        courierName: 'Mohamed Adel',
        courierPhone: '+20 11 5555 1212',
        company: 'Amazon',
        companyRef: 'AMZ-19',
        engagementType: 'direct',
        vehicleType: 'van',
        vehiclePlate: 'MNO 9087',
        licenseNo: 'LIC-990122',
        licenseExpiry: iso(this.addDays(today, 42)),
        nationalId: '30002021234567',
        createdAt: new Date(today.getTime() - 1000 * 60 * 60 * 24 * 120).toISOString(),
        lastUpdatedAt: new Date(today.getTime() - 1000 * 60 * 60 * 24 * 8).toISOString(),
        notes: 'Preferred for bulky shipments.',
      },
      {
        id: 'CR-4450',
        courierName: 'Sara Hassan',
        courierPhone: '+20 12 8888 0909',
        company: 'Bosta',
        companyRef: 'BOS-301',
        engagementType: 'direct',
        vehicleType: 'sedan',
        vehiclePlate: 'XYZ 5566',
        licenseNo: 'LIC-220045',
        licenseExpiry: iso(this.addDays(today, 17)),
        nationalId: '30107071234567',
        createdAt: new Date(today.getTime() - 1000 * 60 * 60 * 24 * 60).toISOString(),
        lastUpdatedAt: new Date(today.getTime() - 1000 * 60 * 60 * 24 * 1).toISOString(),
        notes: 'Covering Dokki / Mohandessin.',
      },
      {
        id: 'CR-3321',
        courierName: 'Mahmoud Refaat',
        courierPhone: '+20 10 9090 2323',
        company: 'SMSA',
        companyRef: 'SMSA-55',
        engagementType: 'subcontractor',
subcontractorName: 'Karim Samy',
        vehicleType: 'truck',
        vehiclePlate: 'TRK 7012',
        licenseNo: 'LIC-441901',
        licenseExpiry: iso(this.addDays(today, -6)),
        nationalId: '29712251234567',
        createdAt: new Date(today.getTime() - 1000 * 60 * 60 * 24 * 200).toISOString(),
        lastUpdatedAt: new Date(today.getTime() - 1000 * 60 * 60 * 24 * 20).toISOString(),
        notes: 'Needs renewal before dispatch.',
      },
      {
        id: 'CR-9072',
        courierName: 'Youssef Nabil',
        courierPhone: '+20 15 1111 2222',
        company: 'Mylerz',
        companyRef: 'MYL-12',
        engagementType: 'direct',
        vehicleType: 'motorbike',
        vehiclePlate: 'KLM 3344',
        licenseNo: 'LIC-700210',
        licenseExpiry: iso(this.addDays(today, 28)),
        nationalId: '29909091234567',
        createdAt: new Date(today.getTime() - 1000 * 60 * 60 * 24 * 25).toISOString(),
        lastUpdatedAt: new Date(today.getTime() - 1000 * 60 * 60 * 24 * 6).toISOString(),
        notes: '',
      },
      {
        id: 'CR-6109',
        courierName: 'Khaled Omar',
        courierPhone: '+20 10 3333 4444',
        company: 'Jumia',
        companyRef: 'JUM-22',
        engagementType: 'subcontractor',
subcontractorName: 'Mariam Saeed',
        vehicleType: 'van',
        vehiclePlate: 'QWE 1001',
        licenseNo: 'LIC-800330',
        licenseExpiry: iso(this.addDays(today, 75)),
        nationalId: '29603031234567',
        createdAt: new Date(today.getTime() - 1000 * 60 * 60 * 24 * 180).toISOString(),
        lastUpdatedAt: new Date(today.getTime() - 1000 * 60 * 60 * 24 * 12).toISOString(),
        notes: 'Backup driver for peak season.',
      },
      {
        id: 'CR-2714',
        courierName: 'Mostafa Ehab',
        courierPhone: '+20 11 7777 8888',
        company: 'Amazon',
        companyRef: 'AMZ-88',
        engagementType: 'direct',
        vehicleType: 'sedan',
        vehiclePlate: 'SED 8899',
        licenseNo: 'LIC-111099',
        licenseExpiry: iso(this.addDays(today, 4)),
        nationalId: '30201011234567',
        createdAt: new Date(today.getTime() - 1000 * 60 * 60 * 24 * 44).toISOString(),
        lastUpdatedAt: new Date(today.getTime() - 1000 * 60 * 60 * 24 * 3).toISOString(),
        notes: 'Critical renewal window.',
      },
      {
        id: 'CR-5038',
        courierName: 'Hany Tarek',
        courierPhone: '+20 12 2222 1111',
        company: 'Bosta',
        companyRef: 'BOS-119',
        engagementType: 'subcontractor',
        subcontractorName: 'SkyHub',
        vehicleType: 'truck',
        vehiclePlate: 'TRK 9090',
        licenseNo: 'LIC-909012',
        licenseExpiry: iso(this.addDays(today, 135)),
        nationalId: '29506061234567',
        createdAt: new Date(today.getTime() - 1000 * 60 * 60 * 24 * 300).toISOString(),
        lastUpdatedAt: new Date(today.getTime() - 1000 * 60 * 60 * 24 * 22).toISOString(),
        notes: 'Cross-city transfers.',
      },
      {
        id: 'CR-1188',
        courierName: 'Mina Fawzy',
        courierPhone: '+20 10 6666 5555',
        company: 'SMSA',
        companyRef: 'SMSA-91',
        engagementType: 'direct',
        vehicleType: 'van',
        vehiclePlate: 'VAN 7770',
        licenseNo: 'LIC-333221',
        licenseExpiry: iso(this.addDays(today, 31)),
        nationalId: '30011111234567',
        createdAt: new Date(today.getTime() - 1000 * 60 * 60 * 24 * 90).toISOString(),
        lastUpdatedAt: new Date(today.getTime() - 1000 * 60 * 60 * 24 * 10).toISOString(),
        notes: '',
      },
      {
        id: 'CR-7003',
        courierName: 'Nada Emad',
        courierPhone: '+20 12 9090 8080',
        company: 'Mylerz',
        companyRef: 'MYL-07',
        engagementType: 'subcontractor',
subcontractorName: 'Amr Naguib',
        vehicleType: 'motorbike',
        vehiclePlate: 'BIK 2002',
        licenseNo: 'LIC-500600',
        licenseExpiry: iso(this.addDays(today, -1)),
        nationalId: '30109091234567',
        createdAt: new Date(today.getTime() - 1000 * 60 * 60 * 24 * 210).toISOString(),
        lastUpdatedAt: new Date(today.getTime() - 1000 * 60 * 60 * 24 * 15).toISOString(),
        notes: 'Expired yesterday — block assignments.',
      },
    ];
  }
}
