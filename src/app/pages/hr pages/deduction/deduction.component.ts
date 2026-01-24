import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../services/auth/auth-service.service';

type DeductionStatus = 'active' | 'voided';

interface AuthUserRow {
  id: number;
  fullName: string;
  email: string;
  role: string;
  position?: string | null;
  isActive: boolean;
}

interface DeductionRow {
  id: number;

  userId: number;
  userName: string;
  userRole?: string | null;

  amount: number;
  reason: string;
  effectiveDate: string; // YYYY-MM-DD
  status: DeductionStatus;

  createdAt: string; // ISO
}

@Component({
  selector: 'app-deduction',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './deduction.component.html',
  styleUrls: ['./deduction.component.scss'],
})
export class DeductionComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  // =========================
  // UI-only now
  // =========================
  readonly USE_MOCK = true;

  private readonly apiBase = environment.apiUrl; // ex: http://localhost:5000/api

  // =========================
  // State
  // =========================
  loading = false;
  errorMsg = '';

  users: AuthUserRow[] = [];

  // mock “DB”
  private mockSeq = 3;
  private allRows: DeductionRow[] = [];

  // table view
  rows: DeductionRow[] = [];
  total = 0;

  // pagination
  limit = 10;
  offset = 0;

  // =========================
  // Filters
  // =========================
  filtersForm = this.fb.group({
    q: [''],
    userId: [null as number | null],
    status: ['' as '' | DeductionStatus],
    fromDate: [''],
    toDate: [''],
    minAmount: [null as number | null],
    maxAmount: [null as number | null],
  });

  // =========================
  // Modal state (inline)
  // =========================
  formOpen = false;
  deleteOpen = false;

  formMode: 'create' | 'edit' = 'create';
  editingId: number | null = null;

  deletingRow: DeductionRow | null = null;

  deductionForm = this.fb.group({
    userId: [null as number | null, [Validators.required]],
    amount: [null as number | null, [Validators.required, Validators.min(1)]],
    reason: ['', [Validators.required, Validators.minLength(3)]],
    effectiveDate: ['', [Validators.required]],
    status: ['active' as DeductionStatus, [Validators.required]],
  });

  // =========================
  // Lifecycle
  // =========================
  async ngOnInit(): Promise<void> {
    await this.loadUsersFromAuth();

    if (this.USE_MOCK) {
      this.seedMockRows();
      this.applyFilters(true);
    } else {
      // هنا تحط API deductions لما يبقى جاهز
      this.allRows = [];
      this.applyFilters(true);
    }
  }

  // =========================
  // Users from Auth
  // =========================
  async loadUsersFromAuth(): Promise<void> {
    try {
      this.errorMsg = '';
      this.loading = true;

      const headers = this.auth.getAuthorizationHeader();

      // expected: GET /api/auth/users?active=true
      // (لو endpoint مختلف عدّله هنا)
      const url = `${this.apiBase}/auth/users`;

      let params = new HttpParams().set('active', 'true');

      const res = await firstValueFrom(
        this.http.get<AuthUserRow[]>(url, { params, headers })
      );

      this.users = (res || []).filter((u) => u?.isActive);
    } catch (err: any) {
      console.error(err);
      this.users = [];
      this.errorMsg =
        'Failed to load users from Auth (auth/users). Check permissions or endpoint access.';
    } finally {
      this.loading = false;
    }
  }

  userLabel(u: AuthUserRow): string {
    const pos = u.position ? ` / ${u.position}` : '';
    return `${u.fullName} — ${u.role}${pos} (${u.email})`;
  }

  private seedMockRows(): void {
    const nowIso = new Date().toISOString();
    const u1 = this.users[0];
    const u2 = this.users[1];

    this.allRows = [
      {
        id: 1,
        userId: u1?.id || 10,
        userName: u1?.fullName || 'Ahmed Ali',
        userRole: (u1?.role as any) || 'operation',
        amount: 250,
        reason: 'Late attendance',
        effectiveDate: this.todayDate(),
        status: 'active',
        createdAt: nowIso,
      },
      {
        id: 2,
        userId: u2?.id || 11,
        userName: u2?.fullName || 'Sara Mohamed',
        userRole: (u2?.role as any) || 'hr',
        amount: 150,
        reason: 'Policy violation',
        effectiveDate: this.todayDate(),
        status: 'voided',
        createdAt: nowIso,
      },
    ];
  }

  // =========================
  // Filtering + Pagination (client-side الآن)
  // =========================
  applyFilters(resetPage = false): void {
    if (resetPage) this.offset = 0;

    const v = this.filtersForm.value;

    const q = (v.q || '').trim().toLowerCase();
    const userId = v.userId ?? null;
    const status = (v.status || '') as '' | DeductionStatus;

    const fromDate = (v.fromDate || '').trim();
    const toDate = (v.toDate || '').trim();

    const minAmount = v.minAmount ?? null;
    const maxAmount = v.maxAmount ?? null;

    let filtered = [...this.allRows];

    if (q) {
      filtered = filtered.filter((r) => {
        return (
          r.userName.toLowerCase().includes(q) ||
          (r.userRole || '').toLowerCase().includes(q) ||
          (r.reason || '').toLowerCase().includes(q)
        );
      });
    }

    if (userId) filtered = filtered.filter((r) => r.userId === userId);
    if (status) filtered = filtered.filter((r) => r.status === status);

    if (fromDate) filtered = filtered.filter((r) => r.effectiveDate >= fromDate);
    if (toDate) filtered = filtered.filter((r) => r.effectiveDate <= toDate);

    if (minAmount !== null && minAmount !== undefined)
      filtered = filtered.filter((r) => r.amount >= Number(minAmount));

    if (maxAmount !== null && maxAmount !== undefined)
      filtered = filtered.filter((r) => r.amount <= Number(maxAmount));

    filtered.sort((a, b) => b.id - a.id);

    this.total = filtered.length;

    const start = this.offset;
    const end = Math.min(this.offset + this.limit, this.total);
    this.rows = filtered.slice(start, end);
  }

  resetFilters(): void {
    this.filtersForm.reset({
      q: '',
      userId: null,
      status: '',
      fromDate: '',
      toDate: '',
      minAmount: null,
      maxAmount: null,
    });
    this.applyFilters(true);
  }

  setPageSize(size: string | number): void {
    this.limit = Math.max(Number(size) || 10, 1);
    this.applyFilters(true);
  }

  prevPage(): void {
    this.offset = Math.max(this.offset - this.limit, 0);
    this.applyFilters(false);
  }

  nextPage(): void {
    if (this.offset + this.limit >= this.total) return;
    this.offset = this.offset + this.limit;
    this.applyFilters(false);
  }

  get pageInfo(): string {
    if (!this.total) return '0 - 0 of 0';
    const start = this.offset + 1;
    const end = Math.min(this.offset + this.limit, this.total);
    return `${start} - ${end} of ${this.total}`;
  }

  // =========================
  // Create / Edit modal
  // =========================
  openCreate(): void {
    this.formMode = 'create';
    this.editingId = null;

    this.deductionForm.reset({
      userId: null,
      amount: null,
      reason: '',
      effectiveDate: this.todayDate(),
      status: 'active',
    });

    this.formOpen = true;
  }

  openEdit(row: DeductionRow): void {
    this.formMode = 'edit';
    this.editingId = row.id;

    this.deductionForm.reset({
      userId: row.userId,
      amount: row.amount,
      reason: row.reason,
      effectiveDate: row.effectiveDate,
      status: row.status,
    });

    this.formOpen = true;
  }

  closeForm(): void {
    this.formOpen = false;
    this.editingId = null;
  }

  async submitForm(): Promise<void> {
    if (this.deductionForm.invalid) {
      this.deductionForm.markAllAsTouched();
      return;
    }

    const body = this.deductionForm.value;

    const userId = Number(body.userId);
    const amount = Number(body.amount);

    const u = this.users.find((x) => x.id === userId);
    const userName = u?.fullName || 'Unknown';
    const userRole = (u?.role as any) || null;

    if (this.USE_MOCK) {
      if (this.formMode === 'create') {
        const newRow: DeductionRow = {
          id: this.mockSeq++,
          userId,
          userName,
          userRole,
          amount,
          reason: String(body.reason || '').trim(),
          effectiveDate: String(body.effectiveDate || '').trim(),
          status: (body.status || 'active') as DeductionStatus,
          createdAt: new Date().toISOString(),
        };
        this.allRows.unshift(newRow);
      } else {
        const id = this.editingId!;
        const idx = this.allRows.findIndex((r) => r.id === id);
        if (idx >= 0) {
          this.allRows[idx] = {
            ...this.allRows[idx],
            userId,
            userName,
            userRole,
            amount,
            reason: String(body.reason || '').trim(),
            effectiveDate: String(body.effectiveDate || '').trim(),
            status: (body.status || 'active') as DeductionStatus,
          };
        }
      }

      this.closeForm();
      this.applyFilters(false);
      return;
    }

    // لما Backend يبقى جاهز: هنا تعمل POST/PUT
    this.closeForm();
  }

  // =========================
  // Delete confirm modal
  // =========================
  openDelete(row: DeductionRow): void {
    this.deletingRow = row;
    this.deleteOpen = true;
  }

  closeDelete(): void {
    this.deleteOpen = false;
    this.deletingRow = null;
  }

  async confirmDelete(): Promise<void> {
    if (!this.deletingRow) return;

    if (this.USE_MOCK) {
      const id = this.deletingRow.id;
      this.allRows = this.allRows.filter((r) => r.id !== id);
      this.closeDelete();
      this.applyFilters(false);
      return;
    }

    // لما Backend يبقى جاهز: DELETE
    this.closeDelete();
  }

  // =========================
  // Utils
  // =========================
  trackById(_: number, r: DeductionRow): number {
    return r.id;
  }

  todayDate(): string {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  }
}
