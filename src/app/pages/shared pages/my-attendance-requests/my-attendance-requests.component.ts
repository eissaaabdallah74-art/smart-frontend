import { CommonModule } from '@angular/common';
import { Component, OnInit, DestroyRef, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AttendanceRequestsService } from '../../../services/attendance/attendance-requests.service';
import {
  AttendanceRequest,
  AttendanceRequestType,
  LeaveType,
  CreateRequestDto,
} from '../../../models/attendance-request.model';

const EXCUSE_MAX_MINUTES = 120;

@Component({
  selector: 'app-my-attendance-requests',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './my-attendance-requests.component.html',
  styleUrls: ['./my-attendance-requests.component.scss'],
})
export class MyAttendanceRequestsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private api = inject(AttendanceRequestsService);
  private destroyRef = inject(DestroyRef);

  loading = false;
  saving = false;
  errorMsg = '';
  successMsg = '';

  month = this.getCurrentMonth(); // YYYY-MM
  rows: AttendanceRequest[] = [];

  // ✅ NOTE: لو انت ناوي تخلي "official" == errand (مش خصم مرتب) خلّي اللابل "Errand"
  readonly leaveTypes: { value: LeaveType; label: string; hint?: string }[] = [
    { value: 'annual', label: 'Annual', hint: 'Deduct from annual balance (no salary deduction)' },
    { value: 'sick', label: 'Sick', hint: 'Salary penalty 0.25 day (per policy)' },
    { value: 'official', label: 'Errand', hint: 'No salary deduction (meeting/errand)' },
    { value: 'unpaid', label: 'Unpaid' },
    { value: 'other', label: 'Other' },
  ];

  form = this.fb.group({
    type: this.fb.control<AttendanceRequestType>('excuse_minutes', { validators: [Validators.required] }),
    date: this.fb.control<string>(this.getTodayISO(), { validators: [Validators.required] }),
    minutes: this.fb.control<number>(EXCUSE_MAX_MINUTES, {
      validators: [Validators.required, Validators.min(1), Validators.max(EXCUSE_MAX_MINUTES)],
    }),
    leaveType: this.fb.control<LeaveType>('annual'),
    note: this.fb.control<string>(''),
  });

  ngOnInit(): void {
    this.syncValidatorsByType();

    this.form.get('type')!.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.syncValidatorsByType());

    this.load();
  }

  private syncValidatorsByType(): void {
    const type = this.form.get('type')!.value;

    const minutes = this.form.get('minutes')!;
    const leaveType = this.form.get('leaveType')!;

    if (type === 'excuse_minutes') {
      minutes.enable({ emitEvent: false });
      minutes.setValidators([Validators.required, Validators.min(1), Validators.max(EXCUSE_MAX_MINUTES)]);

      leaveType.disable({ emitEvent: false });
      leaveType.clearValidators();
    } else {
      leaveType.enable({ emitEvent: false });
      leaveType.setValidators([Validators.required]);

      minutes.disable({ emitEvent: false });
      minutes.clearValidators();
    }

    minutes.updateValueAndValidity({ emitEvent: false });
    leaveType.updateValueAndValidity({ emitEvent: false });
  }

  load(): void {
    this.loading = true;
    this.errorMsg = '';
    this.successMsg = '';

    this.api.listMine(this.month).subscribe({
      next: (rows) => {
        this.rows = rows || [];
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.errorMsg = err?.error?.message || 'Failed to load requests.';
      },
    });
  }

  changeMonth(m: string): void {
    this.month = m;

    // ✅ optional UX: خلي التاريخ جوه الفورم يفضل داخل نفس الشهر
    const d = this.form.get('date')!.value;
    if (d && String(d).slice(0, 7) !== m) {
      this.form.get('date')!.setValue(`${m}-01`);
    }

    this.load();
  }

  submit(): void {
    this.errorMsg = '';
    this.successMsg = '';

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();

    const dto: CreateRequestDto = {
      type: v.type!,
      date: v.date!,
      note: v.note?.trim() ? v.note.trim() : undefined,
    };

    if (v.type === 'excuse_minutes') dto.minutes = Number(v.minutes);
    if (v.type === 'leave_day') dto.leaveType = v.leaveType!;

    this.saving = true;
    this.api.createMine(dto).subscribe({
      next: () => {
        this.saving = false;
        this.successMsg = 'Request submitted successfully.';
        this.load();
      },
      error: (err) => {
        this.saving = false;
        this.errorMsg = err?.error?.message || 'Failed to submit request.';
      },
    });
  }

  canCancel(r: AttendanceRequest): boolean {
    return r.status === 'pending';
  }

  cancel(r: AttendanceRequest): void {
    if (!this.canCancel(r)) return;

    this.errorMsg = '';
    this.successMsg = '';

    this.api.cancelMine(r.id).subscribe({
      next: () => {
        this.successMsg = 'Request cancelled.';
        this.load();
      },
      error: (err) => {
        this.errorMsg = err?.error?.message || 'Failed to cancel request.';
      },
    });
  }

  trackById = (_: number, r: AttendanceRequest) => r.id;

  badgeClass(status: AttendanceRequest['status']): string {
    switch (status) {
      case 'approved': return 'badge badge-ok';
      case 'rejected': return 'badge badge-bad';
      case 'cancelled': return 'badge badge-muted';
      default: return 'badge badge-warn';
    }
  }

  formatType(r: AttendanceRequest): string {
    if (r.type === 'excuse_minutes') return `Excuse (${r.minutes || 0} min)`;
    return `Leave (${r.leaveType || 'annual'})`;
  }

  private getTodayISO(): string {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  private getCurrentMonth(): string {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${yyyy}-${mm}`;
  }
}
