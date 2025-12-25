// src/app/pages/operation pages/smv-calls/smv-calls.component.ts
import {
  Component,
  OnInit,
  inject,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { ApiUser } from '../../../services/users/users-service.service';
import {
  SmvCallsServiceService,
  SmvCall,
  ImportCallRow,
  CallStatus,
  ImportResult,
  SmartOrSmv,
} from '../../../services/smv calls/smv-calls-service.service';
import { ImportButtonComponent } from '../../../shared/import-button/import-button.component';
import { ExportButtonComponent } from '../../../shared/export-button/export-button';
import { AuthService } from '../../../services/auth/auth-service.service';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-smv-calls',
  standalone: true,
  imports: [CommonModule, FormsModule, ImportButtonComponent, ExportButtonComponent],
  templateUrl: './smv-calls.component.html',
  styleUrl: './smv-calls.component.scss',
})
export class SmvCallsComponent implements OnInit {
  private auth = inject(AuthService);
  private callsApi = inject(SmvCallsServiceService);
  private router = inject(Router);

  currentUser = computed(() => this.auth.currentUser());

  isManagerOrSupervisor = computed(() => {
    const user = this.currentUser();
    return (
      !!user &&
      user.role === 'operation' &&
      (user.position === 'manager' || user.position === 'supervisor')
    );
  });

  loading = false;
  errorMsg = '';

  operationStaff: ApiUser[] = [];
  selectedAssignee: ApiUser | null = null;

  // all calls for selected assignee (قبل الفلترة بالتاريخ)
  private assigneeCallsAll: SmvCall[] = [];
  // calls بعد الفلترة (اللي بتظهر في الجدول + stats)
  assigneeCalls: SmvCall[] = [];

  // staff المختارين للتوزيع في الـ import
  checkedStaffIds = new Set<number>();

  // date filters
  filterFromDate: string | null = null; // yyyy-MM-dd
  filterToDate: string | null = null;

  // Stats
  stats = {
    total: 0,
    interview: 0,
    emptyFeedback: 0,
    noAnswer: 0,
  };

  get selectedImportCount(): number {
    return this.checkedStaffIds.size;
  }

  // Export calls for selected assignee بنفس ترتيب الشيت
  get exportData(): any[] {
    return this.assigneeCalls.map((c) => ({
      date: c.date || '',
      Name: c.name || '',
      Phone: c.phone || '',
      vehicle: c.vehicle_type || '',
      Government: c.government || '',
      'Call Feedback': c.call_feedback || '',
      "What's app message": c.whatsapp_status || '',
      comment: c.comment || '',
      'smart or smv': c.smart_or_smv || '',
      'Second call Comment': c.second_call_comment || '',
      Status: c.status,
    }));
  }

  // Template export: header + صف فاضي
  get templateExportData(): any[] {
    return [
      {
        date: '',
        Name: '',
        Phone: '',
        vehicle: '',
        Government: '',
        'Call Feedback': '',
        "What's app message": '',
        comment: '',
        'smart or smv': '',
        'Second call Comment': '',
      },
    ];
  }

  ngOnInit(): void {
    const user = this.currentUser();
    if (!user) return;

    if (!this.isManagerOrSupervisor()) {
      this.router.navigateByUrl('/my-calls');
      return;
    }

    this.loadOperationStaff();
  }

  private loadOperationStaff(): void {
    this.loading = true;
    this.errorMsg = '';

    this.callsApi.getOperationStaff(true).subscribe({
      next: (users: ApiUser[]) => {
        // نعرض بس الـ Seniors & Juniors
        this.operationStaff = users.filter(
          (u) => u.position === 'senior' || u.position === 'junior'
        );
        this.loading = false;
      },
      error: (err: any) => {
        console.error('[SmvCalls] loadOperationStaff error', err);
        this.errorMsg = 'Failed to load operation staff';
        this.loading = false;
      },
    });
  }

  onSelectAssignee(user: ApiUser): void {
    this.selectedAssignee = user;
    this.filterFromDate = null;
    this.filterToDate = null;
    this.loadCallsForAssignee(user.id);
  }

  onToggleStaff(user: ApiUser, checked: boolean): void {
    if (!user?.id) return;
    if (checked) {
      this.checkedStaffIds.add(user.id);
    } else {
      this.checkedStaffIds.delete(user.id);
    }
  }

  private loadCallsForAssignee(assigneeId: number): void {
    this.loading = true;
    this.errorMsg = '';

    this.callsApi.getCallsByAssignee(assigneeId).subscribe({
      next: (rows: SmvCall[]) => {
        this.assigneeCallsAll = rows;
        this.applyFilters();
        this.loading = false;
      },
      error: (err: any) => {
        console.error('[SmvCalls] loadCallsForAssignee error', err);
        this.errorMsg = 'Failed to load calls for assignee';
        this.loading = false;
      },
    });
  }

  // ================== Filters & Stats ==================

  onFilterChanged(): void {
    this.applyFilters();
  }

  clearFilters(): void {
    this.filterFromDate = null;
    this.filterToDate = null;
    this.applyFilters();
  }

  private applyFilters(): void {
    let rows = [...this.assigneeCallsAll];

    if (this.filterFromDate) {
      const from = new Date(this.filterFromDate);
      rows = rows.filter((c) => {
        if (!c.date) return false;
        const d = new Date(c.date);
        return d >= from;
      });
    }

    if (this.filterToDate) {
      const to = new Date(this.filterToDate);
      // خلي اليوم الآخر inclusive
      to.setHours(23, 59, 59, 999);
      rows = rows.filter((c) => {
        if (!c.date) return false;
        const d = new Date(c.date);
        return d <= to;
      });
    }

    this.assigneeCalls = rows;
    this.computeStats();
  }

  private computeStats(): void {
    const rows = this.assigneeCalls;
    const lower = (v: string | null | undefined) =>
      (v || '').toString().toLowerCase().trim();

    const interviewCount = rows.filter((c) => {
      const f = lower(c.call_feedback);
      return f.includes('interview');
    }).length;

    const noAnswerCount = rows.filter((c) => {
      const f = lower(c.call_feedback);
      return f === 'no answer' || f.includes('no answer');
    }).length;

    const emptyFeedbackCount = rows.filter((c) => {
      const f = lower(c.call_feedback);
      return !f;
    }).length;

    this.stats = {
      total: rows.length,
      interview: interviewCount,
      emptyFeedback: emptyFeedbackCount,
      noAnswer: noAnswerCount,
    };
  }

  // ================== Helpers للـ Excel Mapping ==================

  private getField(raw: any, keys: string[]): string {
    if (!raw) return '';
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(raw, key)) {
        const val = raw[key];
        if (val !== null && val !== undefined && val !== '') {
          return String(val).trim();
        }
      }
    }
    return '';
  }

  private normalizeStatusFromFeedback(feedback: string): CallStatus | undefined {
    if (!feedback) return undefined;
    const f = feedback.toLowerCase();

    if (f.includes('cancel')) return 'cancelled';
    if (f.includes('interview')) return 'completed';

    return undefined;
  }

  private normalizeSmartOrSmv(raw: string): SmartOrSmv | '' {
    if (!raw) return '';
    const v = raw.toLowerCase().trim();
    if (v === 'smart') return 'smart';
    if (v === 'smv') return 'smv';
    return '';
  }

  /**
   * map لواحد row من Excel → ImportCallRow بنفس أعمدة الشيت
   */
  private mapExcelRow(raw: any, index: number): ImportCallRow | null {
    const date = this.getField(raw, ['date', 'Date']);
    const name = this.getField(raw, ['Name', 'Full Name']);
    const phone = this.getField(raw, ['Phone', 'Mobile']);
    const vehicle = this.getField(raw, ['vehicle', 'Vehicle']);
    const government = this.getField(raw, ['Government']);
    const callFeedback = this.getField(raw, ['Call Feedback', 'Call feedback']);
    const whatsappMsg = this.getField(raw, ["What's app message", "Whats app message", 'WhatsApp message']);
    const comment = this.getField(raw, ['comment', 'Comment']);
    const smartOrSmvRaw = this.getField(raw, ['smart or smv', 'Smart or smv', 'Smart or SMV']);
    const secondCallComment = this.getField(raw, ['Second call Comment', 'Second Call Comment']);

    const isEmpty =
      !date &&
      !name &&
      !phone &&
      !vehicle &&
      !government &&
      !callFeedback &&
      !whatsappMsg &&
      !comment &&
      !smartOrSmvRaw &&
      !secondCallComment;

    if (isEmpty) {
      return null;
    }

    const status = this.normalizeStatusFromFeedback(callFeedback);
    const smartOrSmv = this.normalizeSmartOrSmv(smartOrSmvRaw);

    const mapped: ImportCallRow = {
      date: date || undefined,
      name: name || undefined,
      phone: phone || undefined,
      vehicle_type: vehicle || undefined,
      government: government || undefined,
      call_feedback: callFeedback || undefined,
      whatsapp_status: whatsappMsg || undefined,
      comment: comment || undefined,
      smart_or_smv: smartOrSmv || undefined,
      second_call_comment: secondCallComment || undefined,
    };

    if (status) {
      mapped.status = status;
    }

    return mapped;
  }

  // ===== Import logic =====
  onImportFile(file: File): void {
    if (!this.selectedImportCount) {
      alert('Please select at least one staff member (checkbox) for import.');
      return;
    }

    const assigneeIds = Array.from(this.checkedStaffIds);
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);

        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const json = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        const rawRows: any[] = json as any[];

        const mappedRows: ImportCallRow[] = rawRows
          .map((raw, idx) => this.mapExcelRow(raw, idx))
          .filter((row): row is ImportCallRow => row !== null);

        if (!mappedRows.length) {
          alert('No valid rows found in file.');
          return;
        }

        this.callsApi
          .importCalls({ rows: mappedRows, assigneeIds })
          .subscribe({
            next: (res: ImportResult) => {
              if (res.errorCount) {
                console.warn('Import errors:', res.errors);
                alert(
                  `Imported: ${res.createdCount}, Errors: ${res.errorCount}`
                );
              } else {
                alert(`Imported: ${res.createdCount} calls.`);
              }

              if (this.selectedAssignee) {
                this.loadCallsForAssignee(this.selectedAssignee.id);
              }
            },
            error: (err: any) => {
              console.error('[SmvCalls] importCalls error', err);
              alert('Import failed. Check console for details.');
            },
          });
      } catch (err) {
        console.error('[SmvCalls] onImportFile parse error', err);
        alert('Failed to parse file.');
      }
    };

    reader.readAsArrayBuffer(file);
  }
}
