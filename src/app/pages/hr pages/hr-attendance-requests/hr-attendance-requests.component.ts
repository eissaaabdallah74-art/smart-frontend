import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';

import { AttendanceRequestsService } from '../../../services/attendance/attendance-requests.service';
import { AttendanceRequest, AttendanceRequestStatus } from '../../../models/attendance-request.model';

type DecisionMode = 'approve' | 'reject';

@Component({
  selector: 'app-hr-attendance-requests',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './hr-attendance-requests.component.html',
  styleUrls: ['./hr-attendance-requests.component.scss'],
})
export class HrAttendanceRequestsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private api = inject(AttendanceRequestsService);

  loading = false;
  errorMsg = '';
  successMsg = '';
  rows: AttendanceRequest[] = [];

  filterForm = this.fb.group({
    month: this.fb.control<string>(this.getCurrentMonth()),
    status: this.fb.control<AttendanceRequestStatus>('pending'),
    employeeId: this.fb.control<string>(''),
  });

  // ✅ decision modal
  modalOpen = false;
  modalMode: DecisionMode = 'approve';
  modalRow: AttendanceRequest | null = null;
  deciding = false;

  decisionForm = this.fb.group({
    decisionNote: this.fb.control<string>(''),
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.errorMsg = '';
    this.successMsg = '';

    const v = this.filterForm.value;
    const month = (v.month || '').trim();
    const status = v.status || undefined;
    const employeeIdNum = v.employeeId?.trim() ? Number(v.employeeId.trim()) : undefined;

    this.api.listAll({
      month: month || undefined,
      status: status || undefined,
      employeeId: employeeIdNum && Number.isFinite(employeeIdNum) ? employeeIdNum : undefined,
    }).subscribe({
      next: (rows) => {
        this.rows = rows || [];
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.errorMsg = err?.error?.message || 'Failed to load requests.';
      }
    });
  }

  openDecision(row: AttendanceRequest, mode: DecisionMode): void {
    this.modalRow = row;
    this.modalMode = mode;
    this.decisionForm.reset({ decisionNote: '' });
    this.modalOpen = true;
    this.errorMsg = '';
    this.successMsg = '';
  }

  closeModal(): void {
    this.modalOpen = false;
    this.modalRow = null;
    this.decisionForm.reset({ decisionNote: '' });
  }

  canDecide(r: AttendanceRequest): boolean {
    return r.status === 'pending';
  }

  decide(): void {
    if (!this.modalRow) return;
    if (!this.canDecide(this.modalRow)) return;

    this.deciding = true;
    const id = this.modalRow.id;
    const note = (this.decisionForm.value.decisionNote || '').trim() || undefined;

    const call =
      this.modalMode === 'approve'
        ? this.api.approve(id, note)
        : this.api.reject(id, note);

    call.subscribe({
      next: () => {
        this.deciding = false;
        this.modalOpen = false;
        this.successMsg = this.modalMode === 'approve' ? 'Request approved.' : 'Request rejected.';
        this.load();
      },
      error: (err) => {
        this.deciding = false;
        this.errorMsg = err?.error?.message || 'Failed to decide request.';
      },
    });
  }

  badgeClass(status: AttendanceRequest['status']): string {
    switch (status) {
      case 'approved': return 'badge badge-ok';
      case 'rejected': return 'badge badge-bad';
      case 'cancelled': return 'badge badge-muted';
      default: return 'badge badge-warn';
    }
  }

  displayEmployee(r: AttendanceRequest): string {
    if (r.employee?.fullName) return r.employee.fullName;
    return `#${r.employeeId}`;
  }

  displayType(r: AttendanceRequest): string {
    if (r.type === 'excuse_minutes') return `Excuse (${r.minutes || 0} min)`;
    return `Leave (${r.leaveType || 'annual'})`;
  }

  trackById = (_: number, r: AttendanceRequest) => r.id;

  private getCurrentMonth(): string {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${yyyy}-${mm}`;
  }
}
