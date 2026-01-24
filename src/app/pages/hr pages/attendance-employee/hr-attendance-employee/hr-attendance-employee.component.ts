import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { combineLatest, firstValueFrom } from 'rxjs';

import {
  AttendanceDeductionsService,
  EmployeeAttendanceMonthDto,
  ManualAttendanceItemCreateDto,
  AttendanceItemType,
} from '../../../../services/attendance/attendance-deductions.service';

type LoadState = 'idle' | 'loading' | 'success' | 'error';
type SaveState = 'idle' | 'saving' | 'success' | 'error';

@Component({
  selector: 'app-hr-attendance-employee',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './hr-attendance-employee.component.html',
  styleUrls: ['./hr-attendance-employee.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HrAttendanceEmployeeComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);
  private svc = inject(AttendanceDeductionsService);

  readonly state = signal<LoadState>('idle');
  readonly saveState = signal<SaveState>('idle');
  readonly errorMsg = signal<string | null>(null);
  readonly toastMsg = signal<string | null>(null);

  readonly employeeId = signal<number | null>(null);

  readonly form = this.fb.group({
    month: [this.getCurrentMonth(), [Validators.required]],
    q: [''],
    showExceptions: [true],
  });

  readonly manualForm = this.fb.group({
    date: [this.getToday(), [Validators.required]],
    direction: ['deduct' as 'deduct' | 'restore', [Validators.required]],
    amount: [null as number | null],
    deductionDays: [null as number | null],
    note: ['', [Validators.required, Validators.minLength(3)]],
  });

  readonly data = signal<EmployeeAttendanceMonthDto | null>(null);

  /**
   * IMPORTANT:
   * - payroll/totals ممكن ييجوا undefined من الـ backend في بعض الحالات
   * - لذلك بنقرأهم بـ ?. وبنرجّع default 0
   */
readonly grossSalary = computed(() => this.data()?.payroll?.grossSalary ?? 0);
readonly dailyRate   = computed(() => this.data()?.payroll?.dailyRate ?? 0);

  readonly workingDays = computed(() => Number(this.data()?.workingDaysCount ?? 0));

  readonly totalDeduction = computed(() =>
    Number(this.data()?.totals?.totalDeductionAmount ?? 0)
  );

  readonly netSalary = computed(() =>
    Number(this.data()?.totals?.netSalary ?? 0)
  );

  readonly filteredItems = computed(() => {
    const d = this.data();
    if (!d) return [];

    const q = (this.form.controls.q.value || '').trim().toLowerCase();
    const showExceptions = !!this.form.controls.showExceptions.value;

    const items = Array.isArray(d.items) ? d.items : [];

    return items.filter((it) => {
      if (!showExceptions && it.isException) return false;
      if (!q) return true;

      const hay = [
        it.type,
        it.date,
        String(it.lateMinutes ?? ''),
        String(it.deductionDays ?? ''),
        String(it.amount ?? ''),
        String(it.note ?? ''),
        String(it.source ?? ''),
      ]
        .join(' ')
        .toLowerCase();

      return hay.includes(q);
    });
  });

  readonly exceptionCount = computed(() => {
    const d = this.data();
    if (!d) return 0;
    const items = Array.isArray(d.items) ? d.items : [];
    return items.filter((x) => x.isException).length;
  });

  constructor() {
    // param + query param (month)
    combineLatest([this.route.paramMap, this.route.queryParamMap])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([pm, qm]) => {
        const raw = pm.get('id') || pm.get('employeeId');
        const id = Number(raw);
        this.employeeId.set(Number.isFinite(id) ? id : null);

        const monthQP = qm.get('month');
        if (monthQP && this.isValidMonth(monthQP)) {
          // avoid triggering valueChanges load twice
          this.form.controls.month.setValue(monthQP, { emitEvent: false });
        }

        void this.load();
      });

    // manual month change
    this.form.controls.month.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => void this.load());
  }

  private isValidMonth(month: string): boolean {
    return /^\d{4}-\d{2}$/.test(month);
  }

  private normalizeDto(dto: any): EmployeeAttendanceMonthDto {
    // بنحافظ على الشكل المتوقع للـ UI حتى لو الـ backend رجّع null/undefined في أجزاء
    return {
      ...(dto || {}),
      workingDaysCount: Number(dto?.workingDaysCount ?? 0),
      payroll: {
        ...(dto?.payroll || {}),
        grossSalary: Number(dto?.payroll?.grossSalary ?? 0),
        dailyRate: Number(dto?.payroll?.dailyRate ?? 0),
      },
      totals: {
        ...(dto?.totals || {}),
        totalDeductionAmount: Number(dto?.totals?.totalDeductionAmount ?? 0),
        netSalary: Number(dto?.totals?.netSalary ?? 0),
      },
      items: Array.isArray(dto?.items) ? dto.items : [],
    } as EmployeeAttendanceMonthDto;
  }

  async load(): Promise<void> {
    const id = this.employeeId();
    const month = this.form.controls.month.value || '';
    if (!id || !month) return;

    this.state.set('loading');
    this.errorMsg.set(null);
    this.toastMsg.set(null);

    try {
      const dto = await firstValueFrom(this.svc.getEmployeeMonth(id, month));
      this.data.set(this.normalizeDto(dto));
      this.state.set('success');

      // default manual date: first day of selected month
      this.manualForm.controls.date.setValue(`${month}-01`);
    } catch (e: any) {
      console.error('load employee attendance error:', e);
      this.state.set('error');
      this.errorMsg.set(e?.error?.message || e?.message || 'Failed to load data');
    }
  }

  back(): void {
    this.router.navigateByUrl('/hr/attendance');
  }

  formatEGP(n: number): string {
    const num = Number(n || 0);
    if (!Number.isFinite(num)) return '0';
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(num);
  }

  badgeLabel(type: AttendanceItemType): string {
    if (type === 'late') return 'Late';
    if (type === 'absent') return 'Absent';
    return 'Manual';
  }

  badgeClass(type: AttendanceItemType): string {
    if (type === 'late') return 'badge-warn';
    if (type === 'absent') return 'badge-danger';
    return 'badge-muted';
  }

  async toggleException(itemId: number, current: boolean): Promise<void> {
    const id = this.employeeId();
    const month = this.form.controls.month.value || '';
    if (!id || !month) return;

    this.saveState.set('saving');
    this.toastMsg.set(null);
    this.errorMsg.set(null);

    try {
      await firstValueFrom(this.svc.setItemException(id, itemId, !current));

      // optimistic
      const d = this.data();
      if (d) {
        const items = (Array.isArray(d.items) ? d.items : []).map((it) =>
          it.id === itemId ? { ...it, isException: !current } : it
        );
        this.data.set({ ...d, items });
      }

      await this.load();

      this.saveState.set('success');
      this.toastMsg.set(!current ? 'Exception enabled.' : 'Exception removed.');
    } catch (e: any) {
      console.error('toggleException error:', e);
      this.saveState.set('error');
      this.errorMsg.set(e?.error?.message || e?.message || 'Failed to update exception');
    }
  }

  async addManual(): Promise<void> {
    const id = this.employeeId();
    const month = this.form.controls.month.value || '';
    if (!id || !month) return;

    if (this.manualForm.invalid) {
      this.manualForm.markAllAsTouched();
      return;
    }

    const payload: ManualAttendanceItemCreateDto = {
      date: this.manualForm.controls.date.value!,
      direction: this.manualForm.controls.direction.value!,
      amount:
        this.manualForm.controls.amount.value !== null
          ? Number(this.manualForm.controls.amount.value)
          : undefined,
      deductionDays:
        this.manualForm.controls.deductionDays.value !== null
          ? Number(this.manualForm.controls.deductionDays.value)
          : undefined,
      note: this.manualForm.controls.note.value!.trim(),
    };

    // must have amount or days
    const hasAmount = payload.amount !== undefined && Number.isFinite(payload.amount);
    const hasDays = payload.deductionDays !== undefined && Number.isFinite(payload.deductionDays);

    if (!hasAmount && !hasDays) {
      this.errorMsg.set('Manual item requires amount or deductionDays.');
      return;
    }

    this.saveState.set('saving');
    this.toastMsg.set(null);
    this.errorMsg.set(null);

    try {
      await firstValueFrom(this.svc.addManualItem(id, payload));

      this.saveState.set('success');
      this.toastMsg.set('Manual item added.');

      this.manualForm.controls.note.setValue('');
      this.manualForm.controls.amount.setValue(null);
      this.manualForm.controls.deductionDays.setValue(null);

      await this.load();
    } catch (e: any) {
      console.error('addManual error:', e);
      this.saveState.set('error');
      this.errorMsg.set(e?.error?.message || e?.message || 'Failed to add manual item');
    }
  }

  private getCurrentMonth(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  private getToday(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
