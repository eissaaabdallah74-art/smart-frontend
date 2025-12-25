// src/app/pages/hr pages/employment-contracts-status/employment-contracts-status.component.ts
import {
  Component,
  OnInit,
  computed,
  signal,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';

import {
  InterviewsServiceService,
  ApiInterview,
  UpdateInterviewDto,
} from '../../../services/interviews/interviews-service.service';

interface EmploymentContractRow {
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
  status: string; // HR Feedback
  notes: string;
}

@Component({
  selector: 'app-employment-contracts-status',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './employment-contracts-status.component.html',
  styleUrls: ['./employment-contracts-status.component.scss'],
})
export class EmploymentContractsStatusComponent implements OnInit {
  private interviewsService = inject(InterviewsServiceService);

  readonly rows = signal<EmploymentContractRow[]>([]);
  
  // Filters & Search
  readonly search = signal<string>('');
  readonly statusFilter = signal<string>('All'); // New Filter

  // Pagination
  readonly currentPage = signal<number>(1);
  readonly pageSize = signal<number>(10);

  isModalOpen = false;
  editingRow: EmploymentContractRow | null = null;

  saving = false;
  errorMessage = '';

  readonly statusOptions: string[] = [
    'Signed',
    'Not Signed'
  ];

  // 1. Filter Logic (Search + Dropdown)
  readonly filteredRows = computed<EmploymentContractRow[]>(() => {
    const term = this.search().toLowerCase().trim();
    const status = this.statusFilter();
    let data = this.rows();

    // Apply Status Filter
    if (status && status !== 'All') {
      data = data.filter(row => row.status === status);
    }

    // Apply Search
    if (!term) return data;

    return data.filter((row) => {
      return (
        row.courierName.toLowerCase().includes(term) ||
        row.nationalId.toLowerCase().includes(term) ||
        row.phoneNumber.toLowerCase().includes(term) ||
        row.residence.toLowerCase().includes(term) ||
        row.hub.toLowerCase().includes(term) ||
        row.area.toLowerCase().includes(term) ||
        row.account.toLowerCase().includes(term) ||
        (row.status || '').toLowerCase().includes(term)
      );
    });
  });

  // 2. Pagination Logic
  readonly paginatedRows = computed<EmploymentContractRow[]>(() => {
    const page = this.currentPage();
    const size = this.pageSize();
    const start = (page - 1) * size;
    return this.filteredRows().slice(start, start + size);
  });

  readonly totalPages = computed<number>(() => {
    return Math.ceil(this.filteredRows().length / this.pageSize());
  });

  ngOnInit(): void {
    this.loadRows();
  }

  // --- Reset Pagination when filters change ---
  onFilterChange(): void {
    this.currentPage.set(1);
  }

  // --- Pagination Actions ---
  nextPage(): void {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.update(p => p + 1);
    }
  }

  prevPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.update(p => p - 1);
    }
  }

  private loadRows(): void {
    this.interviewsService.getInterviews().subscribe({
      next: (list: ApiInterview[]) => {
        const mapped = list.map((i) => this.mapInterviewToRow(i));
        this.rows.set(mapped);
      },
      error: (err) => {
        console.error('Failed to load employment contracts status', err);
      },
    });
  }

  private mapInterviewToRow(api: ApiInterview): EmploymentContractRow {
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
      status: api.hrFeedback ?? '',
      notes: api.notes ?? '',
    };
  }

  trackById(_index: number, row: EmploymentContractRow): number {
    return row.id;
  }

  statusPillClass(status: string): string {
    const s = (status || '').toLowerCase().trim();
    if (!s) return 'status-pill--new';
    if (s.includes('signed')) return 'status-pill--hired';
    if (s.includes('hiring from hold')) return 'status-pill--hired';
    if (s.includes('missing') || s.includes('think')) return 'status-pill--in-progress';
    if (s.includes('hold')) return 'status-pill--hold';
    if (s.includes('unqualified') || s.includes('reject')) return 'status-pill--rejected';
    return 'status-pill--new';
  }

  openEditModal(row: EmploymentContractRow): void {
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

    // 3. Update All Fields
    // NOTE: Your UpdateInterviewDto interface in the service must support these fields.
    // If it doesn't, TypeScript might complain unless you cast to `any` or update the interface.
    const dto: any = {
      courierName: row.courierName,
      nationalId: row.nationalId,
      phoneNumber: row.phoneNumber,
      residence: row.residence,
      vehicleType: row.vehicleType,
      // Assuming backend expects IDs for Hub/Area/Account or just strings. 
      // Sending strings based on your UI binding:
      hubName: row.hub, 
      zoneName: row.area,
      clientName: row.account,
      
      hrFeedback: row.status || null,
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
        console.error('Failed to update interview', err);
        this.errorMessage =
          err?.error?.message || 'Failed to update. Please try again.';
        this.saving = false;
      },
    });
  }
}