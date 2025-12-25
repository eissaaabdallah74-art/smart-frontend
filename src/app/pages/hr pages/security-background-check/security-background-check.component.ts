// src/app/pages/hr pages/security-background-check/security-background-check.component.ts
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';

import {
  ApiInterview,
  SecurityResult,
  InterviewsServiceService,
  UpdateInterviewDto,
} from '../../../services/interviews/interviews-service.service';

import { ExportButtonComponent } from '../../../shared/export-button/export-button';

interface BackgroundRow {
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
  imports: [CommonModule, FormsModule, ExportButtonComponent],
  templateUrl: './security-background-check.component.html',
  styleUrls: ['./security-background-check.component.scss'],
})
export class SecurityBackgroundCheckComponent implements OnInit {
  private interviewsService = inject(InterviewsServiceService);

  // ===== state =====
  readonly rows = signal<BackgroundRow[]>([]);
  readonly search = signal<string>('');
  readonly securityResultFilter = signal<string>(''); // '', 'Positive', 'Negative', 'pending'

  // pagination
  readonly pageSize = signal<number>(10);
  readonly currentPage = signal<number>(1);

  // edit modal
  isModalOpen = false;
  editingRow: BackgroundRow | null = null;

  // notes modal
  isNotesModalOpen = false;
  notesRow: BackgroundRow | null = null;

  saving = false;
  errorMessage = '';

  readonly securityResultOptions: SecurityResult[] = ['Positive', 'Negative'];

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

  // ===== pagination computed =====
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

    for (
      let i = Math.max(2, current - delta);
      i <= Math.min(total - 1, current + delta);
      i++
    ) {
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
  }

  private loadRows(): void {
    this.interviewsService.getInterviews().subscribe({
      next: (list: ApiInterview[]) => {
        const mapped = list
          .filter((i) =>
            (i.hrFeedback || '').toLowerCase().includes('signed'),
          )
          .map((i) => this.mapInterviewToRow(i));

        this.rows.set(mapped);
        this.currentPage.set(1);
      },
      error: (err) => {
        console.error('Failed to load background check list', err);
      },
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

  // ===== filters handlers =====
  onSearchChange(v: string): void {
    this.search.set(v);
    this.currentPage.set(1);
  }

  onSecurityResultFilterChange(v: string): void {
    this.securityResultFilter.set(v);
    this.currentPage.set(1);
  }

  // ===== pagination handlers =====
  onPageSizeChange(size: string): void {
    const num = Number(size) || 10;
    this.pageSize.set(num);
    this.currentPage.set(1);
  }

  goToPage(page: number | string): void {
    if (typeof page !== 'number') return;
    if (page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
  }

  previousPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.set(this.currentPage() - 1);
    }
  }

  nextPage(): void {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.set(this.currentPage() + 1);
    }
  }

  // ===== table helpers =====
  trackById(_index: number, row: BackgroundRow): number {
    return row.id;
  }

  statusPillClass(value: string | SecurityResult | null): string {
    const s = (value || '').toString().toLowerCase().trim();

    if (!s) return 'status-pill--new';

    // ✅ swapped colors: Negative green, Positive red
    if (s === 'negative') return 'status-pill--hired';
    if (s === 'positive') return 'status-pill--rejected';

    // HR feedback
    if (s.includes('signed')) return 'status-pill--hired';
    if (s.includes('hiring from hold')) return 'status-pill--hired';

    if (s.includes('missing') || s.includes('think')) {
      return 'status-pill--in-progress';
    }
    if (s.includes('hold')) return 'status-pill--hold';
    if (s.includes('unqualified') || s.includes('reject')) {
      return 'status-pill--rejected';
    }

    return 'status-pill--new';
  }

  // ===== export =====
  readonly exportData = computed<any[]>(() =>
    this.filteredRows().map((r) => ({
      date: r.date,
      courierName: r.courierName,
      nationalId: r.nationalId,
      phoneNumber: r.phoneNumber,
      residence: r.residence,
      vehicleType: r.vehicleType,
      hub: r.hub,
      area: r.area,
      account: r.account,
      hrFeedback: r.hrFeedback,
      securityResult: r.securityResult ?? '',
      notes: r.notes,
    })),
  );

  // ===== edit modal =====
  openEditModal(row: BackgroundRow): void {
    this.editingRow = { ...row };
    this.errorMessage = '';
    this.isModalOpen = true;
  }

  closeModal(): void {
    this.isModalOpen = false;
    this.editingRow = null;
    this.errorMessage = '';
    this.saving = false;
  }

  onSave(form: NgForm): void {
    if (!this.editingRow) return;

    if (form.invalid) {
      form.control.markAllAsTouched();
      return;
    }

    this.saving = true;
    this.errorMessage = '';

    const row = this.editingRow;
    const dto: UpdateInterviewDto = {
      securityResult: row.securityResult,
      notes: row.notes,
    };

    this.interviewsService.updateInterview(row.id, dto).subscribe({
      next: (updated: ApiInterview) => {
        const updatedRow = this.mapInterviewToRow(updated);

        this.rows.update((list) =>
          list.map((r) => (r.id === updatedRow.id ? updatedRow : r)),
        );

        this.closeModal();
      },
      error: (err) => {
        console.error('Failed to update security result', err);
        this.errorMessage =
          err?.error?.message ||
          'Failed to update security result. Please try again.';
        this.saving = false;
      },
    });
  }

  // ===== notes modal =====
  openNotesModal(row: BackgroundRow): void {
    this.notesRow = row;
    this.isNotesModalOpen = true;
  }

  closeNotesModal(): void {
    this.isNotesModalOpen = false;
    this.notesRow = null;
  }

  copyNotesToClipboard(text: string | null | undefined): void {
    const val = (text || '').trim();
    if (!val) return;

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(val).catch(() => {});
      return;
    }

    try {
      const ta = document.createElement('textarea');
      ta.value = val;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    } catch {
      // ignore
    }
  }
}
