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

  readonly filteredRows = computed<AttendanceMonthlySummaryRowDto[]>(() => {
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

  // ===== Pagination (مثل Users) =====
  readonly currentPage = signal<number>(1);
  readonly pageSize = signal<number>(10);
  readonly pageSizes = signal<number[]>([5, 10, 20, 50]);

  readonly paginatedRows = computed<AttendanceMonthlySummaryRowDto[]>(() => {
    const startIndex = (this.currentPage() - 1) * this.pageSize();
    const endIndex = startIndex + this.pageSize();
    return this.filteredRows().slice(startIndex, endIndex);
  });

  readonly rowsPaginationStats = computed(() => {
    const totalRows = this.filteredRows().length;
    const size = Math.max(1, this.pageSize());
    const totalPages = Math.max(1, Math.ceil(totalRows / size));

    // clamp current page to avoid empty page after filter
    const currentPage = Math.min(this.currentPage(), totalPages);
    const startItem = totalRows === 0 ? 0 : (currentPage - 1) * size + 1;
    const endItem = Math.min(currentPage * size, totalRows);

    return {
      totalRows,
      totalPages,
      currentPage,
      startItem,
      endItem,
      hasPrevious: currentPage > 1,
      hasNext: currentPage < totalPages,
    };
  });

  /** أرقام الصفحات المعروضة (مع ellipsis) */
  readonly visiblePages = computed<(number | string)[]>(() => {
    const stats = this.rowsPaginationStats();
    const totalPages = stats.totalPages;
    const currentPage = stats.currentPage;

    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    if (currentPage <= 4) {
      return [1, 2, 3, 4, 5, '...', totalPages];
    }

    if (currentPage >= totalPages - 3) {
      return [
        1,
        '...',
        totalPages - 4,
        totalPages - 3,
        totalPages - 2,
        totalPages - 1,
        totalPages,
      ];
    }

    return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
  });

  /** الصفحات الرقمية فقط */
  readonly numberPages = computed<number[]>(() => {
    return this.visiblePages().filter((p) => typeof p === 'number') as number[];
  });

  // ===== KPIs =====
  readonly kpiEmployeesCount = computed(() => this.filteredRows().length);

  readonly kpiTotalPenaltyDays = computed(() => {
    return this.filteredRows().reduce((acc, r) => acc + Number(r.totalPenaltyDays || 0), 0);
  });

  readonly kpiTotalDeductionAmount = computed(() => {
    return this.filteredRows().reduce((acc, r) => acc + Number(r.deductionAmount || 0), 0);
  });

  constructor() {
    // ✅ hydrate month from query param (if exists)
    const qpMonth = this.route.snapshot.queryParamMap.get('month');
    if (qpMonth && /^\d{4}-\d{2}$/.test(qpMonth)) {
      this.form.controls.month.setValue(qpMonth, { emitEvent: false });
    }

    // load initially + on month/includeSalary change
    this.form.controls.month.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef), distinctUntilChanged())
      .subscribe(() => {
        this.currentPage.set(1);
        this.load();
      });

    this.form.controls.includeSalary.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef), distinctUntilChanged())
      .subscribe(() => {
        this.currentPage.set(1);
        this.load();
      });

    // q is local filter فقط
    this.form.controls.q.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef), debounceTime(150))
      .subscribe(() => {
        // لما البحث يتغير، رجّع لأول صفحة
        this.currentPage.set(1);
      });

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
        // لو HR حاول includeSalary والـ backend رجّع 403/401 → نخفي salary تلقائيًا
        if (includeSalary && (e?.status === 403 || e?.status === 401)) {
          this.form.controls.includeSalary.setValue(false, { emitEvent: false });
          const summary = await this.svc.getMonthlySummary(month, false).toPromise();
          this.summary.set(summary || null);
        } else {
          throw e;
        }
      }

      // بعد تحميل الداتا: clamp للصفحة (لو كان في فلترة سببت totalPages أقل)
      const totalPages = this.rowsPaginationStats().totalPages;
      if (this.currentPage() > totalPages) this.currentPage.set(totalPages);

      this.state.set('success');
    } catch (e: any) {
      console.error('HrAttendance load error:', e);
      this.state.set('error');
      this.errorMsg.set(e?.error?.message || e?.message || 'Failed to load attendance data');
    }
  }

  // ===== Pagination actions =====
  goToPage(page: number): void {
    if (page >= 1 && page <= this.rowsPaginationStats().totalPages) {
      this.currentPage.set(page);
    }
  }

  nextPage(): void {
    if (this.rowsPaginationStats().hasNext) {
      this.currentPage.update((p) => p + 1);
    }
  }

  previousPage(): void {
    if (this.rowsPaginationStats().hasPrevious) {
      this.currentPage.update((p) => p - 1);
    }
  }

  onPageSizeChange(size: number): void {
    const n = Number(size);
    if (!Number.isFinite(n) || n <= 0) return;
    this.pageSize.set(n);
    this.currentPage.set(1);
  }

  trackByEmployeeId(_i: number, row: AttendanceMonthlySummaryRowDto): number {
    return Number(row.employeeId);
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

  // ✅ route: /hr/attendance/employee/:id
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
    return n.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  private getCurrentMonth(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }
}
