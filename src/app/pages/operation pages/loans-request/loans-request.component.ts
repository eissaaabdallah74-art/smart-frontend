import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '../../../services/auth/auth-service.service';
import {
  LoanStatus,
  EmployeeLoansService,
  EmployeeLoanDto,
  EmployeeLoanEligibilityDto,
  LoanPolicyType,
} from '../../../services/employs-loans/employs-loans-service.service';

interface LoanRow {
  id: number;
  requesterId: number;
  requesterName: string;
  amount: number;
  note?: string;
  status: LoanStatus;
  createdAt: string;
  managerNote?: string;
  installmentsCount?: number;
  startMonth?: string | null;
  policyType?: LoanPolicyType;
}

type LoanStatusFilter = LoanStatus | 'all';

function pad2(n: number) {
  return String(n).padStart(2, '0');
}
function currentMonthValue(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
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
  selector: 'app-loans-request',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './loans-request.component.html',
  styleUrl: './loans-request.component.scss',
})
export class LoansRequestComponent implements OnInit {
  private auth = inject(AuthService);
  private loansApi = inject(EmployeeLoansService);

  readonly me = computed(() => this.auth.currentUser());

  private readonly _rows = signal<LoanRow[]>([]);
  readonly allRows = computed(() =>
    this._rows().slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  );

  readonly summary = signal<EmployeeLoanEligibilityDto | null>(null);

  // ✅ FIX: policy is a SIGNAL (so computed will update)
  readonly policyType = signal<LoanPolicyType>('triple_30_three');

  month = currentMonthValue();
  status: LoanStatusFilter = 'all';
  q = '';

  loading = false;
  submitting = false;
  errorMsg = '';
  successMsg = '';
  summaryMsg = '';
  summaryLoading = false;

  expandedId: number | null = null;

  // ===== utils =====
  private normalizeNumber(v: any): number | null {
    if (v === null || typeof v === 'undefined') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  private perPolicy(): any | null {
    const s: any = this.summary();
    const pt = this.policyType();
    return s?.perPolicy?.[pt] ?? null;
  }

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

  // ===== KPIs =====
  readonly monthRows = computed(() => {
    const mv = this.month;
    return this.allRows().filter((r) => (mv ? inMonth(r.createdAt, mv) : true));
  });

  readonly kpi = computed(() => {
    const rows = this.monthRows();

    const sumAll = rows.reduce((acc, r) => acc + (r.amount || 0), 0);
    const sumPending = rows.filter((r) => r.status === 'pending').reduce((a, r) => a + (r.amount || 0), 0);
    const sumApproved = rows.filter((r) => r.status === 'approved').reduce((a, r) => a + (r.amount || 0), 0);
    const sumRejected = rows.filter((r) => r.status === 'rejected').reduce((a, r) => a + (r.amount || 0), 0);

    const countAll = rows.length;
    const countPending = rows.filter((r) => r.status === 'pending').length;
    const approvalRate = countAll ? Math.round((rows.filter((r) => r.status === 'approved').length / countAll) * 100) : 0;

    return { sumAll, sumPending, sumApproved, sumRejected, countAll, countPending, approvalRate };
  });

  // ===== Form =====
  amount = 0;
  note = '';
  installmentsCount: 1 | 2 | 3 = 1;

  readonly allowedInstallments = computed(() => {
    const s: any = this.summary();
    const per = this.perPolicy();
    const raw = per?.allowedInstallments ?? s?.allowedInstallments ?? [1, 2, 3];

    const arr = (raw || [])
      .map((x: any) => Number(x))
      .filter((x: number) => [1, 2, 3].includes(x));

    return (arr.length ? arr : [1, 2, 3]) as (1 | 2 | 3)[];
  });

  private ensureInstallmentsValid(): void {
    const allowed = this.allowedInstallments();
    if (!allowed.includes(this.installmentsCount)) {
      this.installmentsCount = allowed[0] as 1 | 2 | 3;
    }
  }

  readonly maxAmountAllowed = computed(() => {
    const s: any = this.summary();
    if (!s) return null;

    const per = this.perPolicy();
    const v = this.normalizeNumber(per?.maxAmountAllowed);
    return v && v > 0 ? v : null;
  });

  readonly maxPercentText = computed(() => {
    const s: any = this.summary();
    if (!s) return null;

    const per = this.perPolicy();
    const p = this.normalizeNumber(per?.maxPercent) ?? 0;
    return p > 0 ? `${Math.round(p * 100)}%` : null;
  });

  readonly canRequest = computed(() => {
    const s: any = this.summary();
    if (!s) return true;

    if (s.hasActiveLoan) return false;

    const pt = this.policyType();
    const per = this.perPolicy();

    if (pt === 'annual_75_once') {
      const used = typeof per?.used === 'number' ? per.used >= 1 : Boolean(per?.annual75Used ?? s.annual75Used);
      return !used;
    }

    const usedCount = typeof per?.used === 'number'
      ? per.used
      : Number(per?.triple30UsedCount ?? s.triple30UsedCount ?? 0);

    return usedCount < 3;
  });

  readonly policyLabel = computed(() => {
    return this.policyType() === 'annual_75_once'
      ? '70/75% once per year'
      : '30% up to 3 times per year';
  });

  onPolicyChange(newValue?: LoanPolicyType): void {
    if (newValue) this.policyType.set(newValue);
    this.ensureInstallmentsValid();

    const s: any = this.summary();
    if (!s) { this.summaryMsg = ''; return; }

    if (s.hasActiveLoan) {
      this.summaryMsg = 'You already have an active loan.';
      return;
    }

    const pt = this.policyType();
    const per = this.perPolicy();

    if (pt === 'annual_75_once') {
      const used = typeof per?.used === 'number' ? per.used >= 1 : Boolean(per?.annual75Used ?? s.annual75Used);
      this.summaryMsg = used ? 'Annual 70/75% loan already used this year.' : '';
      return;
    }

    const usedCount = typeof per?.used === 'number'
      ? per.used
      : Number(per?.triple30UsedCount ?? s.triple30UsedCount ?? 0);

    this.summaryMsg = usedCount >= 3 ? '30% loan reached max times this year.' : '';
  }

  ngOnInit(): void {
    void this.refreshAll();
  }

  async refreshAll(): Promise<void> {
    await Promise.allSettled([this.loadMyLoans(), this.loadSummary()]);
    this.ensureInstallmentsValid();
    this.onPolicyChange();
  }

  private mapApiRow(r: EmployeeLoanDto): LoanRow {
    const created = r.createdAt || new Date().toISOString();
    return {
      id: r.id,
      requesterId: r.employeeId,
      requesterName: r.employee?.fullName || '—',
      amount: Number(r.amount),
      note: r.note || undefined,
      status: r.status,
      createdAt: created,
      managerNote: r.managerNote || undefined,
      installmentsCount: r.installmentsCount,
      startMonth: r.startMonth || null,
      policyType: r.policyType,
    };
  }

  async loadSummary(): Promise<void> {
    this.summaryLoading = true;
    this.summaryMsg = '';
    try {
      const year = new Date().getFullYear();
      const s = await firstValueFrom(this.loansApi.getMySummary(year));
      this.summary.set(s || null);
    } catch {
      this.summary.set(null);
    } finally {
      this.summaryLoading = false;
    }
  }

  async loadMyLoans(): Promise<void> {
    this.errorMsg = '';
    this.successMsg = '';
    this.loading = true;

    try {
      const list = await firstValueFrom(this.loansApi.getMyLoans({}));
      this._rows.set((list || []).map((r) => this.mapApiRow(r)));
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

    const s = this.summary();
    if (s && !this.canRequest()) {
      this.errorMsg = (s as any)?.message || 'You are not eligible to request a loan right now.';
      return;
    }

    const amt = Number(this.amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      this.errorMsg = 'Please enter a valid amount';
      return;
    }

    const max = this.maxAmountAllowed();
    if (max && amt > max) {
      this.errorMsg = `Amount exceeds max allowed (${this.money(max)}).`;
      return;
    }

    this.ensureInstallmentsValid();

    this.submitting = true;
    try {
      const created = await firstValueFrom(
        this.loansApi.createLoan({
          amount: amt,
          policyType: this.policyType(), // ✅
          installmentsCount: this.installmentsCount,
          note: this.note?.trim() || undefined,
        })
      );

      const row = this.mapApiRow(created);
      this._rows.set([row, ...this._rows()]);

      this.amount = 0;
      this.note = '';
      this.installmentsCount = this.allowedInstallments()[0] as 1 | 2 | 3;

      this.successMsg = 'Loan request submitted';
      void this.loadSummary();
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
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);
  }

  statusLabel(s: LoanStatus): string {
    if (s === 'pending') return 'Pending';
    if (s === 'approved') return 'Approved';
    if (s === 'rejected') return 'Rejected';
    if (s === 'closed') return 'Closed';
    return 'Cancelled';
  }

  statusClass(s: LoanStatus): string {
    if (s === 'pending') return 'badge badge--pending';
    if (s === 'approved') return 'badge badge--approved';
    if (s === 'rejected') return 'badge badge--rejected';
    if (s === 'closed') return 'badge badge--closed';
    return 'badge badge--cancelled';
  }
}
