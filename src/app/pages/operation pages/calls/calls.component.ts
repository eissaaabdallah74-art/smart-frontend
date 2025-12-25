import { Component, OnInit, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import {
  SmvCallsServiceService,
  SmvCall,
  CallStatus,
} from '../../../services/smv calls/smv-calls-service.service';
import { AuthService } from '../../../services/auth/auth-service.service';

type ViewMode = 'table' | 'cards';


type RowState = {
  status: CallStatus;
  callFeedback: string;
  whatsappStatus: string;
  comment: string;
  dirty: boolean;
  saving: boolean;
  savedAt?: number | null;
  saveError?: string | null;
};

@Component({
  selector: 'app-calls',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './calls.component.html',
  styleUrl: './calls.component.scss',
})
export class CallsComponent implements OnInit {
  private auth = inject(AuthService);
  private callsApi = inject(SmvCallsServiceService);
  private router = inject(Router);

  currentUser = computed(() => this.auth.currentUser());

  loading = false;
  errorMsg = '';

  calls: SmvCall[] = [];

  // Filters
  selectedStatusFilter: CallStatus | 'all' = 'all';
  searchTerm = '';

  // View
  viewMode: ViewMode = 'table';

  // Pagination
  pageSizeOptions = [10, 25, 50];
  pageSize = 25;
  currentPage = 1;

    Math = Math;

  readonly statusOptions: { value: CallStatus; label: string }[] = [
    { value: 'pending', label: 'Pending' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'rescheduled', label: 'Rescheduled' },
  ];

  readonly callFeedbackOptions: { value: string; label: string }[] = [
    { value: '', label: '—' },
    { value: 'Answered', label: 'Answered' },
    { value: 'No answer', label: 'No answer' },
    { value: 'Busy', label: 'Busy' },
    { value: 'Unreachable', label: 'Unreachable' },
    { value: 'Interview scheduled', label: 'Interview scheduled' },
    { value: 'Interview done', label: 'Interview done' },
  ];

  readonly whatsappOptions: { value: string; label: string }[] = [
    { value: '', label: '—' },
    { value: 'Done', label: 'Done' },
    { value: 'No WhatsApp', label: "There's no WhatsApp" },
  ];

  rowState: { [id: number]: RowState } = {};

  ngOnInit(): void {
    const user = this.currentUser();
    if (!user) return;

    if (
      user.role === 'operation' &&
      (user.position === 'manager' || user.position === 'supervisor')
    ) {
      this.router.navigateByUrl('/smv-calls');
      return;
    }

    // default view for mobile
    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
      this.viewMode = 'cards';
    }

    this.loadMyCalls();
  }

  // ========= Derived / UX helpers =========
  get dirtyCount(): number {
    return Object.values(this.rowState).filter((s) => s?.dirty).length;
  }

  get filteredCalls(): SmvCall[] {
    const q = (this.searchTerm || '').trim().toLowerCase();
    if (!q) return this.calls;

    return (this.calls || []).filter((c) => {
      const name = (c.name || '').toLowerCase();
      const phone = (c.phone || '').toLowerCase();
      const vehicle = (c.vehicle_type || '').toLowerCase();
      const gov = (c.government || '').toLowerCase();
      return (
        name.includes(q) ||
        phone.includes(q) ||
        vehicle.includes(q) ||
        gov.includes(q)
      );
    });
  }

  get totalPages(): number {
    const len = this.filteredCalls.length;
    if (!len) return 1;
    return Math.max(1, Math.ceil(len / this.pageSize));
  }

  get pagedCalls(): SmvCall[] {
    const rows = this.filteredCalls;
    if (!rows.length) return [];
    const start = (this.currentPage - 1) * this.pageSize;
    return rows.slice(start, start + this.pageSize);
  }

  trackById(_i: number, c: SmvCall): number {
    return c.id;
  }

  setViewMode(mode: ViewMode): void {
    this.viewMode = mode;
  }

  onSearchChange(): void {
    this.currentPage = 1;
  }

  // ========= Load / Filter =========
  loadMyCalls(): void {
    this.loading = true;
    this.errorMsg = '';

    const opts =
      this.selectedStatusFilter === 'all'
        ? {}
        : { status: this.selectedStatusFilter };

    this.callsApi.getMyCalls(opts).subscribe({
      next: (rows) => {
        this.calls = rows || [];
        this.currentPage = 1;
        this.initRowState(this.calls);
        this.loading = false;
      },
      error: (err) => {
        console.error('[MyCalls] loadMyCalls error', err);
        this.errorMsg = 'Failed to load your calls';
        this.loading = false;
      },
    });
  }

  onStatusFilterChange(value: any): void {
    this.selectedStatusFilter = value as CallStatus | 'all';
    this.currentPage = 1;
    this.loadMyCalls();
  }

  // ========= Pagination =========
  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
  }

  onPageSizeChange(size: number): void {
    this.pageSize = Number(size) || 25;
    this.currentPage = 1;
  }

  // ========= RowState =========
  private initRowState(rows: SmvCall[]): void {
    this.rowState = {};
    for (const c of rows) {
      this.rowState[c.id] = this.extractFromCall(c);
    }
  }

  private extractFromCall(call: SmvCall): RowState {
    const status = (call.status || 'pending') as CallStatus;
    const callFeedback = call.call_feedback || '';
    const whatsappStatus = call.whatsapp_status || '';
    const comment = call.comment || '';

    return {
      status,
      callFeedback,
      whatsappStatus,
      comment,
      dirty: false,
      saving: false,
      savedAt: null,
      saveError: null,
    };
  }

  /** يمنع undefined في الـ template */
  ensureState(call: SmvCall): RowState {
    if (!this.rowState[call.id]) {
      this.rowState[call.id] = this.extractFromCall(call);
    }
    return this.rowState[call.id];
  }

  onRowChanged(callId: number): void {
    const state = this.rowState[callId];
    if (state) {
      state.dirty = true;
      state.saveError = null;
    }
  }

  rowSavedRecently(state: RowState): boolean {
    if (!state?.savedAt) return false;
    return Date.now() - state.savedAt < 9000; // 9 seconds
  }

  saveRow(call: SmvCall): void {
    const state = this.rowState[call.id];
    if (!state || !state.dirty || state.saving) return;

    state.saving = true;
    state.saveError = null;

    this.callsApi
      .updateCall(call.id, {
        status: state.status,
        call_feedback: state.callFeedback || null,
        whatsapp_status: state.whatsappStatus || null,
        comment: state.comment || null,
      })
      .subscribe({
        next: (updated) => {
          const idx = this.calls.findIndex((c) => c.id === updated.id);
          if (idx !== -1) this.calls[idx] = updated;

          this.rowState[call.id] = {
            ...this.extractFromCall(updated),
            dirty: false,
            saving: false,
            savedAt: Date.now(),
            saveError: null,
          };
        },
        error: (err) => {
          console.error('[MyCalls] saveRow error', err);
          state.saving = false;
          state.saveError = 'Failed to save';
        },
      });
  }
}
