import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';

import {
  ApiInterview,
  InterviewsServiceService,
  SecurityResult,
  UpdateInterviewDto,
} from '../../../services/interviews/interviews-service.service';

import { ExportButtonComponent } from '../../../shared/export-button/export-button';

import type { DriverContractStatus, SignedWithHrStatus } from '../../../shared/enums/driver-enums';
import { DRIVER_CONTRACT_STATUSES } from '../../../shared/enums/driver-enums';

type HrFeedback = string | null;

interface FollowUpRow {
  id: number;

  date: string;
  courierName: string;
  nationalId: string | null;
  phoneNumber: string;

  residence: string | null;

  account: string;
  hub: string;
  area: string;

  vehicleType: string | null;

  courierStatus: DriverContractStatus | null;

  feedback: string | null;
  hrFeedback: HrFeedback;
  crmFeedback: string | null;

  followUp1: string | null;
  followUp2: string | null;
  followUp3: string | null;

  signedWithHr: SignedWithHrStatus | null;

  securityResult: SecurityResult | null;
  notes: string | null;

  accountManager: string;
  interviewer: string;
}

@Component({
  selector: 'app-background-follow-up',
  standalone: true,
  imports: [CommonModule, FormsModule, ExportButtonComponent],
  templateUrl: './background-follow-up.component.html',
  styleUrls: ['./background-follow-up.component.scss'],
})
export class BackgroundFollowUpComponent implements OnInit {
  private interviewsService = inject(InterviewsServiceService);

  // ===== State =====
  readonly rows = signal<FollowUpRow[]>([]);
  readonly loading = signal<boolean>(false);

  // search + filters
  readonly search = signal<string>('');
  readonly accountFilter = signal<string>('');
  readonly hubFilter = signal<string>('');
  readonly areaFilter = signal<string>('');
  readonly statusFilter = signal<string>(''); // courierStatus
  readonly hrFilter = signal<string>(''); // contains

  // pagination
  readonly pageSize = signal<number>(10);
  readonly currentPage = signal<number>(1);

  // details modal
  readonly isDetailsOpen = signal<boolean>(false);
  readonly detailsRow = signal<FollowUpRow | null>(null);

  // edit modal
  readonly isEditOpen = signal<boolean>(false);
  readonly editRow = signal<FollowUpRow | null>(null);
  readonly saving = signal<boolean>(false);
  readonly errorMessage = signal<string>('');

  // ✅ Enum options (new)
  readonly statusOptions: DriverContractStatus[] = [...DRIVER_CONTRACT_STATUSES];

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);

    this.interviewsService.getInterviews().subscribe({
      next: (list: ApiInterview[]) => {
        // المطلوب: securityResult = Negative && status != Active
        const mapped = (list || [])
          .filter((i) => (i.securityResult || '') === 'Negative')
          .filter((i) => !this.isActiveStatus(i.courierStatus))
          .map((i) => this.mapApiToRow(i));

        this.rows.set(mapped);
        this.currentPage.set(1);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load background follow-up list', err);
        this.rows.set([]);
        this.loading.set(false);
      },
    });
  }

  private mapApiToRow(api: ApiInterview): FollowUpRow {
    return {
      id: api.id,
      date: api.date ?? '',
      courierName: api.courierName ?? '',
      nationalId: api.nationalId ?? null,
      phoneNumber: api.phoneNumber ?? '',
      residence: api.residence ?? null,

      account: api.client?.name ?? '',
      hub: api.hub?.name ?? '',
      area: api.zone?.name ?? '',

      vehicleType: api.vehicleType ?? null,
      courierStatus: api.courierStatus ?? null,

      feedback: api.feedback ?? null,
      hrFeedback: api.hrFeedback ?? null,
      crmFeedback: api.crmFeedback ?? null,

      followUp1: api.followUp1 ?? null,
      followUp2: api.followUp2 ?? null,
      followUp3: api.followUp3 ?? null,

      signedWithHr: api.signedWithHr ?? null,

      securityResult: api.securityResult ?? null,
      notes: api.notes ?? null,

      accountManager: api.accountManager?.fullName ?? '',
      interviewer: api.interviewer?.fullName ?? '',
    };
  }

  // ===== Helpers =====
  private isActiveStatus(status: DriverContractStatus | null | undefined): boolean {
    const s = (status || '').toLowerCase().trim();
    return s === 'active' || s.startsWith('active');
  }

  private normalize(v: any): string {
    return String(v ?? '').toLowerCase().trim();
  }

  trackById(_index: number, row: { id: number }): number {
    return row.id;
  }

  // ===== Dropdown Sources =====
  readonly accounts = computed<string[]>(() => {
    const set = new Set<string>();
    for (const r of this.rows()) {
      const v = (r.account || '').trim();
      if (v) set.add(v);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  });

  readonly hubs = computed<string[]>(() => {
    const set = new Set<string>();
    for (const r of this.rows()) {
      const v = (r.hub || '').trim();
      if (v) set.add(v);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  });

  readonly areas = computed<string[]>(() => {
    const set = new Set<string>();
    for (const r of this.rows()) {
      const v = (r.area || '').trim();
      if (v) set.add(v);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  });

  readonly statuses = computed<string[]>(() => {
    const set = new Set<string>();
    for (const r of this.rows()) {
      const v = (r.courierStatus || '').trim();
      if (v) set.add(v);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  });

  // ===== Filtering =====
  readonly filtered = computed<FollowUpRow[]>(() => {
    const term = this.normalize(this.search());
    const acc = this.accountFilter();
    const hub = this.hubFilter();
    const area = this.areaFilter();
    const status = this.statusFilter();
    const hr = this.normalize(this.hrFilter());

    let list = this.rows();

    if (term) {
      list = list.filter((r) => {
        const blob = [
          r.courierName,
          r.phoneNumber,
          r.nationalId,
          r.residence,
          r.account,
          r.hub,
          r.area,
          r.vehicleType,
          r.courierStatus,
          r.hrFeedback,
          r.crmFeedback,
          r.feedback,
          r.followUp1,
          r.followUp2,
          r.followUp3,
          r.notes,
          r.accountManager,
          r.interviewer,
        ]
          .join(' ')
          .toLowerCase();

        return blob.includes(term);
      });
    }

    if (acc) list = list.filter((r) => r.account === acc);
    if (hub) list = list.filter((r) => r.hub === hub);
    if (area) list = list.filter((r) => r.area === area);

    if (status) {
      list = list.filter((r) => (r.courierStatus || '') === status);
    }

    if (hr) {
      list = list.filter((r) => this.normalize(r.hrFeedback).includes(hr));
    }

    return list;
  });

  // ===== Pagination =====
  readonly totalPages = computed(() =>
    this.filtered().length ? Math.ceil(this.filtered().length / this.pageSize()) : 1,
  );

  readonly startIndex = computed(() => (this.currentPage() - 1) * this.pageSize());

  readonly endIndex = computed(() =>
    Math.min(this.startIndex() + this.pageSize(), this.filtered().length),
  );

  readonly paginated = computed<FollowUpRow[]>(() =>
    this.filtered().slice(this.startIndex(), this.endIndex()),
  );

  readonly visiblePages = computed<(number | string)[]>(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    const delta = 2;

    if (total <= 1) return [1];

    const range: number[] = [];
    const out: (number | string)[] = [];

    for (let i = Math.max(2, current - delta); i <= Math.min(total - 1, current + delta); i++) {
      range.push(i);
    }

    if (current - delta > 2) out.push(1, '...');
    else out.push(1);

    out.push(...range);

    if (current + delta < total - 1) out.push('...', total);
    else out.push(total);

    return out;
  });

  goToPage(page: number | string): void {
    if (typeof page !== 'number') return;
    if (page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
  }

  previousPage(): void {
    if (this.currentPage() > 1) this.currentPage.set(this.currentPage() - 1);
  }

  nextPage(): void {
    if (this.currentPage() < this.totalPages()) this.currentPage.set(this.currentPage() + 1);
  }

  onPageSizeChange(size: string): void {
    const num = Number(size) || 10;
    this.pageSize.set(num);
    this.currentPage.set(1);
  }

  // ===== Actions =====
  clearFilters(): void {
    this.search.set('');
    this.accountFilter.set('');
    this.hubFilter.set('');
    this.areaFilter.set('');
    this.statusFilter.set('');
    this.hrFilter.set('');
    this.currentPage.set(1);
  }

  hasActiveFilters(): boolean {
    return (
      !!this.search().trim() ||
      !!this.accountFilter() ||
      !!this.hubFilter() ||
      !!this.areaFilter() ||
      !!this.statusFilter() ||
      !!this.hrFilter().trim()
    );
  }

  openDetails(row: FollowUpRow): void {
    this.detailsRow.set(row);
    this.isDetailsOpen.set(true);
  }

  closeDetails(): void {
    this.isDetailsOpen.set(false);
    this.detailsRow.set(null);
  }

  openEdit(row: FollowUpRow): void {
    this.editRow.set({ ...row });
    this.errorMessage.set('');
    this.isEditOpen.set(true);
  }

  closeEdit(): void {
    this.isEditOpen.set(false);
    this.editRow.set(null);
    this.saving.set(false);
    this.errorMessage.set('');
  }

  saveEdit(form: NgForm): void {
    const row = this.editRow();
    if (!row) return;

    if (form.invalid) {
      form.control.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.errorMessage.set('');

    const dto: UpdateInterviewDto = {
      courierStatus: (row.courierStatus ?? null) as any,
      followUp1: row.followUp1 ?? null,
      followUp2: row.followUp2 ?? null,
      followUp3: row.followUp3 ?? null,
      notes: row.notes ?? null,
    };

    this.interviewsService.updateInterview(row.id, dto).subscribe({
      next: (updated: ApiInterview) => {
        if (this.isActiveStatus(updated.courierStatus)) {
          this.rows.update((list) => list.filter((r) => r.id !== updated.id));
          this.closeEdit();
          return;
        }

        const updatedRow = this.mapApiToRow(updated);
        this.rows.update((list) => list.map((r) => (r.id === updatedRow.id ? updatedRow : r)));
        this.closeEdit();
      },
      error: (err) => {
        console.error('Failed to update follow-up', err);
        this.errorMessage.set(err?.error?.message || 'Failed to save changes. Please try again.');
        this.saving.set(false);
      },
    });
  }

  // ===== Pills =====
  pillClass(value: string | SecurityResult | null): string {
    const s = this.normalize(value);

    // المطلوب: Negative = GREEN , Positive = RED
    if (s === 'negative') return 'pill pill--green';
    if (s === 'positive') return 'pill pill--red';

    if (!s) return 'pill pill--neutral';
    if (s.includes('signed')) return 'pill pill--blue';
    if (s.includes('hold')) return 'pill pill--amber';
    if (s.includes('reject') || s.includes('unqualified')) return 'pill pill--red';

    return 'pill pill--neutral';
  }

  // ===== Export =====
  readonly exportData = computed<any[]>(() =>
    this.filtered().map((r) => ({
      date: r.date,
      courierName: r.courierName,
      nationalId: r.nationalId ?? '',
      phoneNumber: r.phoneNumber,
      residence: r.residence ?? '',
      account: r.account,
      hub: r.hub,
      area: r.area,
      vehicleType: r.vehicleType ?? '',
      courierStatus: r.courierStatus ?? '',
      securityResult: r.securityResult ?? '',
      signedWithHr: r.signedWithHr ?? '',
      feedback: r.feedback ?? '',
      hrFeedback: r.hrFeedback ?? '',
      crmFeedback: r.crmFeedback ?? '',
      followUp1: r.followUp1 ?? '',
      followUp2: r.followUp2 ?? '',
      followUp3: r.followUp3 ?? '',
      notes: r.notes ?? '',
      accountManager: r.accountManager ?? '',
      interviewer: r.interviewer ?? '',
    })),
  );
}
