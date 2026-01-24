import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import {
  AttendanceImportDto,
  AttendanceMonthlySummaryResponseDto,
  AttendanceMonthlySummaryRowDto,
} from '../../../../models/attendance/attendance.models';
import { AttendanceDeductionsService } from '../../../../services/attendance/attendance-deductions.service';

type LoadState = 'idle' | 'loading' | 'success' | 'error';

@Component({
  selector: 'app-hr-attendance',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './hr-attendance.component.html',
  styleUrls: ['./hr-attendance.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HrAttendanceComponent {
  private fb = inject(FormBuilder);
  private svc = inject(AttendanceDeductionsService);
  private destroyRef = inject(DestroyRef);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  readonly form = this.fb.group({
    month: [this.getCurrentMonth(), [Validators.required]],
    includeSalary: [false],
    q: [''],
  });

  readonly state = signal<LoadState>('idle');
  readonly errorMsg = signal<string | null>(null);

  readonly imports = signal<AttendanceImportDto[]>([]);
  readonly latestImport = computed(
    () => this.imports().find((x) => x.status === 'done') || this.imports()[0] || null
  );

  readonly summary = signal<AttendanceMonthlySummaryResponseDto | null>(null);

  readonly filteredRows = computed(() => {
    const s = this.summary();
    if (!s) return [];

    const q = (this.form.controls.q.value || '').trim().toLowerCase();
    if (!q) return s.data;

    return s.data.filter((r) => {
      const name = (r.employee?.fullName || '').toLowerCase();
      const nid = String(r.employee?.nationalId || '').toLowerCase();
      return name.includes(q) || nid.includes(q);
    });
  });

  readonly kpiEmployeesCount = computed(() => this.filteredRows().length);

  readonly kpiTotalPenaltyDays = computed(() => {
    return this.filteredRows().reduce((acc, r) => acc + Number(r.totalPenaltyDays || 0), 0);
  });

  readonly kpiTotalDeductionAmount = computed(() => {
    return this.filteredRows().reduce((acc, r) => acc + Number(r.deductionAmount || 0), 0);
  });

  constructor() {
    // ✅ 1) hydrate month from query param (if exists)
    const qpMonth = this.route.snapshot.queryParamMap.get('month');
    if (qpMonth && /^\d{4}-\d{2}$/.test(qpMonth)) {
      this.form.controls.month.setValue(qpMonth, { emitEvent: false });
    }

    // load initially + on month/includeSalary change
    this.form.controls.month.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef), distinctUntilChanged())
      .subscribe(() => this.load());

    this.form.controls.includeSalary.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef), distinctUntilChanged())
      .subscribe(() => this.load());

    // q is local filter فقط
    this.form.controls.q.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef), debounceTime(150))
      .subscribe();

    // initial
    this.load();
  }

  async load(): Promise<void> {
    const month = this.form.controls.month.value || '';
    if (!month) return;

    this.state.set('loading');
    this.errorMsg.set(null);
    this.summary.set(null);

    try {
      // 1) imports list for the month
      const imports = await this.svc.listImports(month).toPromise();
      this.imports.set((imports || []).slice().sort((a, b) => (b.id ?? 0) - (a.id ?? 0)));

      // 2) monthly summary
      const includeSalary = !!this.form.controls.includeSalary.value;

      try {
        const summary = await this.svc.getMonthlySummary(month, includeSalary).toPromise();
        this.summary.set(summary || null);
      } catch (e: any) {
        // لو HR حاول includeSalary والـ backend رجّع 403 → نخفي salary تلقائيًا
        if (includeSalary && (e?.status === 403 || e?.status === 401)) {
          this.form.controls.includeSalary.setValue(false, { emitEvent: false });
          const summary = await this.svc.getMonthlySummary(month, false).toPromise();
          this.summary.set(summary || null);
        } else {
          throw e;
        }
      }

      this.state.set('success');
    } catch (e: any) {
      console.error('HrAttendance load error:', e);
      this.state.set('error');
      this.errorMsg.set(e?.error?.message || e?.message || 'Failed to load attendance data');
    }
  }

  // ✅ Navigation with month query param
  goToImport(): void {
    const month = this.form.controls.month.value || '';
    this.router.navigate(['/hr/attendance/import'], { queryParams: { month } });
  }

  goToMapping(): void {
    const month = this.form.controls.month.value || '';
    this.router.navigate(['/hr/attendance/mapping'], { queryParams: { month } });
  }

  goToExcuses(): void {
    const month = this.form.controls.month.value || '';
    this.router.navigate(['/hr/attendance/excuses'], { queryParams: { month } });
  }

  // ✅ FIX: route is /hr/attendance/employee/:id (not employees)
openEmployee(row: AttendanceMonthlySummaryRowDto): void {
  const month = this.form.controls.month.value;
  this.router.navigate(['/hr/attendance/employee', row.employeeId], {
    queryParams: { month },
  });
}


  // Helpers
  formatMoney(v: any): string {
    const n = Number(v || 0);
    if (!Number.isFinite(n)) return '0.00';
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  private getCurrentMonth(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }
}
