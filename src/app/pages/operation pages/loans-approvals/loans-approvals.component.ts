// src/app/pages/operation pages/loans-approvals/loans-approvals.component.ts
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
  if (!monthValue || !/^\d{4}-\d{2}$/.test(monthValue)) return null;
  const [y, m] = monthValue.split('-').map(Number);
  if (!y || !m) return null;
  const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
  const end = new Date(y, m, 1, 0, 0, 0, 0);
  return { start, end };
}
function inMonth(iso: string, monthValue: string): boolean {
  const r = monthRange(monthValue);
  if (!r) return true;
  const t = new Date(iso).getTime();
  return t >= r.start.getTime() && t < r.end.getTime();
}

@Component({
  selector: 'app-loans-approvals',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './loans-approvals.component.html',
  styleUrl: './loans-approvals.component.scss',
})
export class LoansApprovalsComponent implements OnInit {
  private auth = inject(AuthService);
  private loansApi = inject(EmploysLoansServiceService);

  readonly me = computed(() => this.auth.currentUser());

  // Raw from server (then we filter locally by month/q numeric)
  private readonly _rows = signal<LoanRow[]>([]);
  readonly allRows = computed(() =>
    this._rows().slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  );

  // Filters
  month = currentMonthValue();
  status: LoanStatusFilter = 'all';
  requesterId: number | 'all' = 'all';
  q = '';

  // Decision note per row
  decisionNote: Record<number, string> = {};

  // UI state
  loading = false;
  errorMsg = '';
  infoMsg = '';

  // Details row
  expandedId: number | null = null;

  ngOnInit(): void {
    this.refresh();
  }

  private isManagerView(): boolean {
    const u = this.me();
    if (!u) return false;
    if (u.role === 'admin') return true;
    return (
      u.role === 'operation' &&
      (u.position === 'manager' || u.position === 'supervisor')
    );
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

  private looksNumeric(q: string): boolean {
    const s = q.trim();
    if (!s) return false;
    return /^[0-9]+(\.[0-9]+)?$/.test(s);
  }

  readonly requesters = computed(() => {
    // unique requesters from loaded rows
    const map = new Map<number, string>();
    for (const r of this.allRows()) map.set(r.requesterId, r.requesterName);
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  readonly filteredRows = computed(() => {
    const rows = this.allRows();
    const st = this.status;
    const rid = this.requesterId;
    const q = this.q.trim().toLowerCase();
    const mv = this.month;

    return rows
      .filter((r) => (st === 'all' ? true : r.status === st))
      .filter((r) => (rid === 'all' ? true : r.requesterId === rid))
      .filter((r) => (mv ? inMonth(r.createdAt, mv) : true))
      .filter((r) => {
        if (!q) return true;
        return (
          String(r.id).includes(q) ||
          r.requesterName.toLowerCase().includes(q) ||
          String(r.amount).includes(q)
        );
      });
  });

  // ===== KPIs for selected filters (month + requesterId + status(all for KPIs)) =====
  readonly kpi = computed(() => {
    // KPIs based on month + requesterId filters, but ignore status filter
    const mv = this.month;
    const rid = this.requesterId;

    const base = this.allRows()
      .filter((r) => (rid === 'all' ? true : r.requesterId === rid))
      .filter((r) => (mv ? inMonth(r.createdAt, mv) : true));

    const sumAll = base.reduce((acc, r) => acc + (r.amount || 0), 0);
    const sumPending = base
      .filter((r) => r.status === 'pending')
      .reduce((acc, r) => acc + (r.amount || 0), 0);
    const sumApproved = base
      .filter((r) => r.status === 'approved')
      .reduce((acc, r) => acc + (r.amount || 0), 0);
    const sumRejected = base
      .filter((r) => r.status === 'rejected')
      .reduce((acc, r) => acc + (r.amount || 0), 0);

    const countAll = base.length;
    const countPending = base.filter((r) => r.status === 'pending').length;
    const countApproved = base.filter((r) => r.status === 'approved').length;
    const countRejected = base.filter((r) => r.status === 'rejected').length;

    const approvalRate = countAll ? Math.round((countApproved / countAll) * 100) : 0;

    return {
      sumAll,
      sumPending,
      sumApproved,
      sumRejected,
      countAll,
      countPending,
      countApproved,
      countRejected,
      approvalRate,
    };
  });

  async refresh(): Promise<void> {
    this.errorMsg = '';
    this.infoMsg = '';

    if (!this.isManagerView()) {
      this.infoMsg =
        'This page is for Operation managers/supervisors (or admin).';
      this._rows.set([]);
      return;
    }

    this.loading = true;
    try {
      const q = this.q.trim();

      // backend supports: status, requesterId, q (name/email) — so we push what we can
      const serverStatus = this.status === 'all' ? undefined : this.status;
      const serverRequesterId = this.requesterId === 'all' ? undefined : this.requesterId;

      // لو q رقم (id/amount) نخليه local عشان backend غالباً بيبحث في name/email
      const serverQ = q && !this.looksNumeric(q) ? q : undefined;

      const list = await this.loansApi.getLoans({
        status: serverStatus,
        requesterId: serverRequesterId,
        q: serverQ,
      });

      this._rows.set(list.map((r) => this.mapApiRow(r)));
    } catch (e: any) {
      this.errorMsg = e?.error?.message || 'Failed to load loans.';
    } finally {
      this.loading = false;
    }
  }

  async approve(id: number): Promise<void> {
    this.errorMsg = '';
    try {
      const note = (this.decisionNote[id] || '').trim();
      const updated = await this.loansApi.approve(id, note || 'Approved');
      const mapped = this.mapApiRow(updated);
      this.decisionNote[id] = '';

      this._rows.set(this._rows().map((r) => (r.id === id ? mapped : r)));

      // لو واقف على pending فقط، شيلها من العرض فوراً
      if (this.status === 'pending') {
        this._rows.set(this._rows().filter((r) => r.id !== id));
      }
    } catch (e: any) {
      this.errorMsg = e?.error?.message || 'Approve failed';
    }
  }

  async reject(id: number): Promise<void> {
    this.errorMsg = '';
    try {
      const note = (this.decisionNote[id] || '').trim();
      const updated = await this.loansApi.reject(id, note || 'Rejected');
      const mapped = this.mapApiRow(updated);
      this.decisionNote[id] = '';

      this._rows.set(this._rows().map((r) => (r.id === id ? mapped : r)));

      if (this.status === 'pending') {
        this._rows.set(this._rows().filter((r) => r.id !== id));
      }
    } catch (e: any) {
      this.errorMsg = e?.error?.message || 'Reject failed';
    }
  }

  toggleDetails(id: number): void {
    this.expandedId = this.expandedId === id ? null : id;
  }

  fmtDate(iso: string): string {
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  }

  money(n: number): string {
    if (!Number.isFinite(n)) return '0';
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);
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
