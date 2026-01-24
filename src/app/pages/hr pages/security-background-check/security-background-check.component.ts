import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import {
  ApiInterview,
  SecurityResult,
  InterviewsServiceService,
  UpdateInterviewDto,
} from '../../../services/interviews/interviews-service.service';
import { FormModalSecurityBackgroundCheckComponent } from './components/form-modal-security-background-check/form-modal-security-background-check.component';


export interface BackgroundRow {
  id: number;
  date: string;
  courierName: string;
  nationalId: string;
  phoneNumber: string;
  residence: string;
  vehicleType: string;
  hub: string;
  area: string;
  account: string;

  hrFeedback: string;
  securityResult: SecurityResult | null;

  notes: string;
}



@Component({
  selector: 'app-security-background-check',
  standalone: true,
  imports: [CommonModule, FormsModule, FormModalSecurityBackgroundCheckComponent],
  templateUrl: './security-background-check.component.html',
  styleUrls: ['./security-background-check.component.scss'],
})
export class SecurityBackgroundCheckComponent implements OnInit {
  private interviewsService = inject(InterviewsServiceService);
  private router = inject(Router);

  readonly rows = signal<BackgroundRow[]>([]);
  readonly search = signal<string>('');
  readonly securityResultFilter = signal<string>('');

  readonly pageSize = signal<number>(10);
  readonly currentPage = signal<number>(1);

  // edit modal
  isEditModalOpen = false;
  editingRow: BackgroundRow | null = null;

  editingInterview: ApiInterview | null = null;


  saving = false;
  errorMessage = '';

  readonly filteredRows = computed<BackgroundRow[]>(() => {
    const term = this.search().toLowerCase().trim();
    const secFilter = (this.securityResultFilter() || '').toLowerCase().trim();

    let list = this.rows();

    if (term) {
      list = list.filter((row) =>
        [
          row.courierName,
          row.nationalId,
          row.phoneNumber,
          row.residence,
          row.hub,
          row.area,
          row.account,
          row.hrFeedback,
          row.securityResult ?? '',
          row.notes,
        ]
          .join(' ')
          .toLowerCase()
          .includes(term),
      );
    }

    if (secFilter) {
      list = list.filter((row) => {
        const s = (row.securityResult || '').toString().toLowerCase().trim();
        if (secFilter === 'pending') return !s;
        return s === secFilter;
      });
    }

    return list;
  });

  readonly totalPages = computed(() =>
    this.filteredRows().length
      ? Math.ceil(this.filteredRows().length / this.pageSize())
      : 1,
  );

  readonly startIndex = computed(
    () => (this.currentPage() - 1) * this.pageSize(),
  );

  readonly endIndex = computed(() =>
    Math.min(this.startIndex() + this.pageSize(), this.filteredRows().length),
  );

  readonly paginatedRows = computed<BackgroundRow[]>(() =>
    this.filteredRows().slice(this.startIndex(), this.endIndex()),
  );

  readonly visiblePages = computed<(number | string)[]>(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    const delta = 2;
    const range: number[] = [];
    const rangeWithDots: (number | string)[] = [];

    for (let i = Math.max(2, current - delta); i <= Math.min(total - 1, current + delta); i++) {
      range.push(i);
    }

    if (current - delta > 2) rangeWithDots.push(1, '...');
    else rangeWithDots.push(1);

    rangeWithDots.push(...range);

    if (current + delta < total - 1) rangeWithDots.push('...', total);
    else if (total > 1) rangeWithDots.push(total);

    return rangeWithDots;
  });

  ngOnInit(): void {
    this.loadRows();
    // log response
    this.interviewsService.getInterviews().subscribe((res) => console.log(res));
  }

  private loadRows(): void {
    this.interviewsService.getInterviews().subscribe({
      next: (list: ApiInterview[]) => {
        const mapped = list
          .filter((i) => (i.hrFeedback || '').toLowerCase().includes('signed'))
          .map((i) => this.mapInterviewToRow(i));

        this.rows.set(mapped);
        this.currentPage.set(1);
      },
      error: (err) => console.error('Failed to load background check list', err),
    });
  }

  private mapInterviewToRow(api: ApiInterview): BackgroundRow {
    return {
      id: api.id,
      date: api.date ?? '',
      courierName: api.courierName ?? '',
      nationalId: api.nationalId ?? '',
      phoneNumber: api.phoneNumber ?? '',
      residence: api.residence ?? '',
      vehicleType: api.vehicleType ?? '',
      hub: api.hub?.name ?? '',
      area: api.zone?.name ?? '',
      account: api.client?.name ?? '',
      hrFeedback: api.hrFeedback ?? '',
      securityResult: api.securityResult ?? null,
      notes: api.notes ?? '',
    };
  }

  // filters
  onSearchChange(v: string): void {
    this.search.set(v);
    this.currentPage.set(1);
  }

  onSecurityResultFilterChange(v: string): void {
    this.securityResultFilter.set(v);
    this.currentPage.set(1);
  }

  // pagination
  onPageSizeChange(size: string): void {
    this.pageSize.set(Number(size) || 10);
    this.currentPage.set(1);
  }

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

  // helpers
  trackById(_index: number, row: BackgroundRow): number {
    return row.id;
  }

  statusPillClass(value: string | SecurityResult | null): string {
    const s = (value || '').toString().toLowerCase().trim();
    if (!s) return 'status-pill--new';

    // Negative green, Positive red
    if (s === 'negative') return 'status-pill--hired';
    if (s === 'positive') return 'status-pill--rejected';

    return 'status-pill--new';
  }

  // ✅ details navigation (optionally: section=notes)
  openDetails(row: BackgroundRow, section?: 'notes'): void {
    this.router.navigate(['/interviews', row.id], {
      queryParams: section ? { section } : undefined,
    });
  }


  openEditModal(row: BackgroundRow): void {
  this.errorMessage = '';
  this.saving = false;

  this.interviewsService.getInterview(row.id).subscribe({
    next: (api) => {
      this.editingInterview = api;
      this.isEditModalOpen = true;
    },
    error: () => {
      this.errorMessage = 'Failed to load interview details.';
    },
  });
}

closeEditModal(): void {
  this.isEditModalOpen = false;
  this.editingInterview = null;
  this.errorMessage = '';
  this.saving = false;
}

onSave(payload: { id: number; dto: UpdateInterviewDto }): void {
  this.saving = true;
  this.errorMessage = '';

  this.interviewsService.updateInterview(payload.id, payload.dto).subscribe({
    next: () => {
      // اعمل reload بسيط عشان الجدول يتحدث (أو حدّث row محليًا)
      this.loadRows();
      this.closeEditModal();
    },
    error: (err) => {
      this.errorMessage = err?.error?.message || 'Failed to update. Try again.';
      this.saving = false;
    },
  });
}


}
