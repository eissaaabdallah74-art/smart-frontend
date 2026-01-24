// src/app/pages/operation pages/loans-request/loans-request.component.ts
import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../services/auth/auth-service.service';
import { LoanStatus, EmploysLoansServiceService, LoanApiRow } from '../../../services/employs-loans/employs-loans-service.service';


interface LoanRow {
  id: number;
  requesterId: number;
  requesterName: string;
  amount: number;
  note?: string;
  status: LoanStatus;
  createdAt: string;
  managerNote?: string;
}

type LoanStatusFilter = LoanStatus | 'all';

function pad2(n: number) {
  return String(n).padStart(2, '0');
}
function currentMonthValue(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`; // YYYY-MM
}
function monthRange(monthValue: string): { start: Date; end: Date } | null {
  // monthValue: YYYY-MM
  if (!monthValue || !/^\d{4}-\d{2}$/.test(monthValue)) return null;
  const [y, m] = monthValue.split('-').map(Number);
  if (!y || !m) return null;
  const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
  const end = new Date(y, m, 1, 0, 0, 0, 0); // next month
  return { start, end };
}
function inMonth(iso: string, monthValue: string): boolean {
  const r = monthRange(monthValue);
  if (!r) return true;
  const t = new Date(iso).getTime();
  return t >= r.start.getTime() && t < r.end.getTime();
}

@Component({
  selector: 'app-loans-request',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './loans-request.component.html',
  styleUrl: './loans-request.component.scss',
})
export class LoansRequestComponent implements OnInit {
  private auth = inject(AuthService);
  private loansApi = inject(EmploysLoansServiceService);

  readonly me = computed(() => this.auth.currentUser());

  private readonly _rows = signal<LoanRow[]>([]);
  readonly allRows = computed(() =>
    this._rows().slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  );

  // Filters
  month = currentMonthValue();
  status: LoanStatusFilter = 'all';
  q = '';

  // UI state
  loading = false;
  submitting = false;
  errorMsg = '';
  successMsg = '';

  // Details row
  expandedId: number | null = null;

  readonly filteredRows = computed(() => {
    const rows = this.allRows();
    const st = this.status;
    const q = this.q.trim().toLowerCase();
    const mv = this.month;

    return rows
      .filter((r) => (st === 'all' ? true : r.status === st))
      .filter((r) => (mv ? inMonth(r.createdAt, mv) : true))
      .filter((r) => {
        if (!q) return true;
        return (
          String(r.id).includes(q) ||
          String(r.amount).includes(q) ||
          (r.note || '').toLowerCase().includes(q) ||
          (r.managerNote || '').toLowerCase().includes(q)
        );
      });
  });

  // ===== KPIs for selected month (based on MY loans only) =====
  readonly monthRows = computed(() => {
    const mv = this.month;
    return this.allRows().filter((r) => (mv ? inMonth(r.createdAt, mv) : true));
  });

  readonly kpi = computed(() => {
    const rows = this.monthRows();

    const sumAll = rows.reduce((acc, r) => acc + (r.amount || 0), 0);
    const sumPending = rows
      .filter((r) => r.status === 'pending')
      .reduce((acc, r) => acc + (r.amount || 0), 0);
    const sumApproved = rows
      .filter((r) => r.status === 'approved')
      .reduce((acc, r) => acc + (r.amount || 0), 0);
    const sumRejected = rows
      .filter((r) => r.status === 'rejected')
      .reduce((acc, r) => acc + (r.amount || 0), 0);

    const countAll = rows.length;
    const countPending = rows.filter((r) => r.status === 'pending').length;

    const approvalRate =
      countAll === 0
        ? 0
        : Math.round(
            (rows.filter((r) => r.status === 'approved').length / countAll) * 100
          );

    return {
      sumAll,
      sumPending,
      sumApproved,
      sumRejected,
      countAll,
      countPending,
      approvalRate,
    };
  });

  // Form
  amount = 0;
  note = '';

  ngOnInit(): void {
    this.loadMyLoans();
  }

  private mapApiRow(r: LoanApiRow): LoanRow {
    const created = r.createdAt || r.created_at || new Date().toISOString();
    return {
      id: r.id,
      requesterId: r.requesterId,
      requesterName: r.requester?.fullName || '—',
      amount: Number(r.amount),
      note: r.note || undefined,
      status: r.status,
      createdAt: created,
      managerNote: r.managerNote || undefined,
    };
  }

  async loadMyLoans(): Promise<void> {
    this.errorMsg = '';
    this.successMsg = '';
    this.loading = true;

    try {
      const list = await this.loansApi.getMyLoans();
      this._rows.set(list.map((r) => this.mapApiRow(r)));
    } catch (e: any) {
      this.errorMsg = e?.error?.message || 'Failed to load your loans.';
    } finally {
      this.loading = false;
    }
  }

  async submit(): Promise<void> {
    this.errorMsg = '';
    this.successMsg = '';

    const me = this.me();
    if (!me) {
      this.errorMsg = 'Not authenticated';
      return;
    }

    const amt = Number(this.amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      this.errorMsg = 'Please enter a valid amount';
      return;
    }

    this.submitting = true;
    try {
      const created = await this.loansApi.createLoan(amt, this.note?.trim());
      const row = this.mapApiRow(created);

      this._rows.set([row, ...this._rows()]);
      this.amount = 0;
      this.note = '';
      this.successMsg = 'Loan request submitted';
    } catch (e: any) {
      this.errorMsg = e?.error?.message || 'Failed to submit request.';
    } finally {
      this.submitting = false;
    }
  }

  toggleDetails(id: number): void {
    this.expandedId = this.expandedId === id ? null : id;
  }

  fmtDate(iso: string): string {
    try {
      const d = new Date(iso);
      return d.toLocaleString();
    } catch {
      return iso;
    }
  }

  money(n: number): string {
    if (!Number.isFinite(n)) return '0';
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(
      n
    );
  }

  statusLabel(s: LoanStatus): string {
    if (s === 'pending') return 'Pending';
    if (s === 'approved') return 'Approved';
    return 'Rejected';
  }

  statusClass(s: LoanStatus): string {
    if (s === 'pending') return 'badge badge--pending';
    if (s === 'approved') return 'badge badge--approved';
    return 'badge badge--rejected';
  }
}
