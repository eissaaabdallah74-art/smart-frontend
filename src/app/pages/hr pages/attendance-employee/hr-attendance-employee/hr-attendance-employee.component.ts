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

type ItemFilterType = 'all' | AttendanceItemType;
type ManualReasonType = 'annual' | 'excuse' | 'admin' | 'other';

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

  // quick rule requested
  readonly SMALL_LATE_MAX_MINUTES = 10;

  readonly state = signal<LoadState>('idle');
  readonly saveState = signal<SaveState>('idle');
  readonly errorMsg = signal<string | null>(null);
  readonly toastMsg = signal<string | null>(null);

  readonly employeeId = signal<number | null>(null);

  // indicates whether backend returned payroll values (not normalized fallback)
  readonly hasPayroll = signal<boolean>(false);

  readonly form = this.fb.group({
    month: [this.getCurrentMonth(), [Validators.required]],
    type: ['all' as ItemFilterType],
    q: [''],
    showExceptions: [true],
  });

  readonly manualForm = this.fb.group({
    date: [this.getToday(), [Validators.required]],
    direction: ['deduct' as 'deduct' | 'restore', [Validators.required]],

    // ✅ smarter select
    reasonType: ['annual' as ManualReasonType, [Validators.required]],

    // ✅ annual approve default ON
    annualApproved: [true],

    amount: [null as number | null],
    deductionDays: [null as number | null],
    note: ['', [Validators.required, Validators.minLength(3)]],
  });

  readonly data = signal<EmployeeAttendanceMonthDto | null>(null);

  readonly grossSalary = computed(() => this.data()?.payroll?.grossSalary ?? 0);
  readonly dailyRate = computed(() => this.data()?.payroll?.dailyRate ?? 0);

  readonly workingDays = computed(() => Number(this.data()?.workingDaysCount ?? 0));
  readonly totalDeduction = computed(() => Number(this.data()?.totals?.totalDeductionAmount ?? 0));
  readonly netSalary = computed(() => Number(this.data()?.totals?.netSalary ?? 0));

  readonly filteredItems = computed(() => {
    const d = this.data();
    if (!d) return [];

    const q = (this.form.controls.q.value || '').trim().toLowerCase();
    const showExceptions = !!this.form.controls.showExceptions.value;
    const type = (this.form.controls.type.value || 'all') as ItemFilterType;

    const items = Array.isArray(d.items) ? d.items : [];

    return items.filter((it) => {
      if (!showExceptions && it.isException) return false;
      if (type !== 'all' && it.type !== type) return false;
      if (!q) return true;

      const hay = [
        it.type,
        it.date,
        String(it.lateMinutes ?? ''),
        String(it.deductionDays ?? ''),
        String(it.amount ?? ''),
        String(it.note ?? ''),
        String(it.source ?? ''),
        it.isException ? 'exception' : '',
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

  readonly filteredAppliedTotals = computed(() => {
    const list = this.filteredItems().filter((x) => !x.isException);
    let amount = 0;
    let days = 0;
    let lateMinutes = 0;

    for (const it of list) {
      amount += Number(it.amount ?? 0);
      days += Number(it.deductionDays ?? 0);
      if (it.type === 'late') lateMinutes += Number(it.lateMinutes ?? 0);
    }

    return {
      amount,
      days: Math.round(days * 100) / 100,
      lateMinutes,
    };
  });

  constructor() {
    combineLatest([this.route.paramMap, this.route.queryParamMap])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([pm, qm]) => {
        const raw = pm.get('id') || pm.get('employeeId');
        const id = Number(raw);
        this.employeeId.set(Number.isFinite(id) ? id : null);

        const monthQP = qm.get('month');
        if (monthQP && this.isValidMonth(monthQP)) {
          this.form.controls.month.setValue(monthQP, { emitEvent: false });
        }

        void this.load();
      });

    // month change -> load
    this.form.controls.month.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => void this.load());
  }

  reload(): void {
    void this.load();
  }

  clearFilters(): void {
    this.form.controls.type.setValue('all');
    this.form.controls.q.setValue('');
    this.form.controls.showExceptions.setValue(true);
  }

  trackByItemId(_: number, it: any): number {
    return Number(it?.id || 0);
  }

  private isValidMonth(month: string): boolean {
    return /^\d{4}-\d{2}$/.test(month);
  }

  private normalizeDto(dto: any): EmployeeAttendanceMonthDto {
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
      // ✅ includeSalary=true (your fix)
      const dtoRaw = await firstValueFrom(this.svc.getEmployeeMonth(id, month, true));

      // detect payroll presence before normalization fallback
      this.hasPayroll.set(
        dtoRaw?.payroll?.grossSalary != null || dtoRaw?.payroll?.dailyRate != null
      );

      const dto = this.normalizeDto(dtoRaw);
      this.data.set(dto);
      this.state.set('success');

      // default manual date: first day of selected month
      this.manualForm.controls.date.setValue(`${month}-01`);

      // if switching away from annual, keep annualApproved = true for next time
      const rt = this.manualForm.controls.reasonType.value;
      if (rt === 'annual' && this.manualForm.controls.annualApproved.value !== true) {
        this.manualForm.controls.annualApproved.setValue(true);
      }
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

  // ✅ SELECT handler (Applied/Exception)
  async onExceptionSelect(itemId: number, value: 'apply' | 'exception'): Promise<void> {
    const desired = value === 'exception';
    const d = this.data();
    const current = !!d?.items?.find((x) => x.id === itemId)?.isException;

    if (current === desired) return;
    await this.setException(itemId, desired);
  }

  private async setException(itemId: number, isException: boolean): Promise<void> {
    const id = this.employeeId();
    const month = this.form.controls.month.value || '';
    if (!id || !month) return;

    this.saveState.set('saving');
    this.toastMsg.set(null);
    this.errorMsg.set(null);

    try {
      await firstValueFrom(this.svc.setItemException(id, itemId, isException));

      // optimistic
      const d = this.data();
      if (d) {
        const items = (Array.isArray(d.items) ? d.items : []).map((it) =>
          it.id === itemId ? { ...it, isException } : it
        );
        this.data.set({ ...d, items });
      }

      await this.load();

      this.saveState.set('success');
      this.toastMsg.set(isException ? 'Exception enabled.' : 'Exception removed.');
    } catch (e: any) {
      console.error('setException error:', e);
      this.saveState.set('error');
      this.errorMsg.set(e?.error?.message || e?.message || 'Failed to update exception');
    }
  }

  // ✅ Button: mark late <= 10m as exception (and ignore >10m)
  async markSmallLateAsException(): Promise<void> {
    const id = this.employeeId();
    const d = this.data();
    if (!id || !d) return;

    const candidates = (Array.isArray(d.items) ? d.items : []).filter((it) => {
      if (it.type !== 'late') return false;
      const mins = Number(it.lateMinutes ?? 0);
      if (!Number.isFinite(mins)) return false;
      if (mins > this.SMALL_LATE_MAX_MINUTES) return false; // ✅ ignore >10
      return it.isException !== true;
    });

    if (candidates.length === 0) {
      this.toastMsg.set(`No late items ≤ ${this.SMALL_LATE_MAX_MINUTES}m to mark.`);
      return;
    }

    this.saveState.set('saving');
    this.toastMsg.set(null);
    this.errorMsg.set(null);

    try {
      // sequential (safe) to avoid spamming backend
      for (const it of candidates) {
        await firstValueFrom(this.svc.setItemException(id, it.id, true));
      }

      await this.load();

      this.saveState.set('success');
      this.toastMsg.set(
        `Marked ${candidates.length} late items (≤ ${this.SMALL_LATE_MAX_MINUTES}m) as exception.`
      );
    } catch (e: any) {
      console.error('markSmallLateAsException error:', e);
      this.saveState.set('error');
      this.errorMsg.set(e?.error?.message || e?.message || 'Failed to apply bulk exceptions');
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

    const reasonType = this.manualForm.controls.reasonType.value as ManualReasonType;
    const annualApproved = !!this.manualForm.controls.annualApproved.value;

    const noteRaw = String(this.manualForm.controls.note.value || '').trim();
    const note = this.composeManualNote(reasonType, annualApproved, noteRaw);

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
      note,
    };

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

      // keep annualApproved ON by default
      if (this.manualForm.controls.reasonType.value === 'annual') {
        this.manualForm.controls.annualApproved.setValue(true);
      }

      await this.load();
    } catch (e: any) {
      console.error('addManual error:', e);
      this.saveState.set('error');
      this.errorMsg.set(e?.error?.message || e?.message || 'Failed to add manual item');
    }
  }

  private composeManualNote(reasonType: ManualReasonType, annualApproved: boolean, note: string): string {
    const clean = (note || '').trim();
    if (!clean) return clean;

    if (reasonType === 'annual') {
      return annualApproved ? `Annual (approved): ${clean}` : `Annual (pending): ${clean}`;
    }
    if (reasonType === 'excuse') return `Excuse: ${clean}`;
    if (reasonType === 'admin') return `Admin override: ${clean}`;
    return clean;
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
