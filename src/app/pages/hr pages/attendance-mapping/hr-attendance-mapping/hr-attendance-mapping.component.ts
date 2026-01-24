import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  debounceTime,
  distinctUntilChanged,
  switchMap,
  catchError,
  of,
  tap,
  firstValueFrom,
} from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AttendanceDeductionsService } from '../../../../services/attendance/attendance-deductions.service';
import {
  AttendanceImportDto,
  AttendanceUnmatchedRowDto,
  AttendanceUnmatchedResponseDto,
  EmployeeSearchItemDto,
} from '../../../../models/attendance/attendance.models';

type LoadState = 'idle' | 'loading' | 'success' | 'error';
type SaveState = 'idle' | 'saving' | 'success' | 'error';

@Component({
  selector: 'app-hr-attendance-mapping',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './hr-attendance-mapping.component.html',
  styleUrls: ['./hr-attendance-mapping.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HrAttendanceMappingComponent {
  private fb = inject(FormBuilder);
  private svc = inject(AttendanceDeductionsService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  readonly form = this.fb.group({
    month: [this.getCurrentMonth(), [Validators.required]],
    unmatchedQ: [''],
    employeeQ: [''],
    mapEmpNo: [true],
    mapAcNo: [true],
  });

  readonly state = signal<LoadState>('idle');
  readonly saveState = signal<SaveState>('idle');
  readonly errorMsg = signal<string | null>(null);
  readonly successMsg = signal<string | null>(null);

  readonly imports = signal<AttendanceImportDto[]>([]);
  readonly importInfo = signal<AttendanceUnmatchedResponseDto | null>(null);

  readonly unmatchedRows = signal<AttendanceUnmatchedRowDto[]>([]);
  readonly selectedRowKey = signal<string | null>(null);

  readonly employees = signal<EmployeeSearchItemDto[]>([]);
  readonly employeesTotal = signal<number>(0);
  readonly selectedEmployeeId = signal<number | null>(null);

  readonly selectedRow = computed(() => {
    const key = this.selectedRowKey();
    if (!key) return null;
    return this.unmatchedRows().find((r) => r.key === key) || null;
  });

  readonly selectedEmployee = computed(() => {
    const id = this.selectedEmployeeId();
    if (!id) return null;
    return this.employees().find((e) => e.id === id) || null;
  });

  readonly filteredUnmatched = computed(() => {
    const q = (this.form.controls.unmatchedQ.value || '').trim().toLowerCase();
    if (!q) return this.unmatchedRows();

    return this.unmatchedRows().filter((r: any) => {
      const empNo = String(r.empNo || '').toLowerCase();
      const acNo = String(r.acNo || '').toLowerCase();
      const name = String(r.name || '').toLowerCase();
      const nationalId = String(r.nationalId || r.nationalID || '').toLowerCase();
      return (
        empNo.includes(q) ||
        acNo.includes(q) ||
        name.includes(q) ||
        nationalId.includes(q)
      );
    });
  });

  readonly canMap = computed(() => {
    const row = this.selectedRow();
    const emp = this.selectedEmployee();
    const month = this.form.controls.month.value;

    if (!month || !row || !emp) return false;

    const mapEmpNo = !!this.form.controls.mapEmpNo.value;
    const mapAcNo = !!this.form.controls.mapAcNo.value;

    const hasEmpNo = !!(row.empNo && String(row.empNo).trim());
    const hasAcNo = !!(row.acNo && String(row.acNo).trim());

    // لازم يكون فيه على الأقل identifier واحد هيتسجل
    return (mapEmpNo && hasEmpNo) || (mapAcNo && hasAcNo);
  });

  constructor() {
    // reload on month change
    this.form.controls.month.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef), distinctUntilChanged())
      .subscribe(() => this.load());

    // employee search
    this.form.controls.employeeQ.valueChanges
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        debounceTime(180),
        distinctUntilChanged(),
        switchMap((q) =>
          this.svc.searchEmployees(q || '', 20, 0).pipe(
            catchError(() => of({ total: 0, limit: 20, offset: 0, data: [] }))
          )
        ),
        tap((res) => {
          this.employees.set(res.data || []);
          this.employeesTotal.set(res.total || 0);

          // لو المختار اختفى من النتائج، نشيله
          const sel = this.selectedEmployeeId();
          if (sel && !(res.data || []).some((x) => x.id === sel)) {
            this.selectedEmployeeId.set(null);
          }
        })
      )
      .subscribe();

    // initial
    this.load();

    // initial employee list empty query (shows first page)
    this.form.controls.employeeQ.setValue('', { emitEvent: true });
  }

  async load(): Promise<void> {
    const month = this.form.controls.month.value || '';
    if (!month) return;

    this.state.set('loading');
    this.errorMsg.set(null);
    this.successMsg.set(null);
    this.saveState.set('idle');

    this.importInfo.set(null);
    this.unmatchedRows.set([]);
    this.selectedRowKey.set(null);

    try {
      const [imports, unmatched] = await Promise.all([
        firstValueFrom(this.svc.listImports(month)),
        firstValueFrom(this.svc.getUnmatchedRows(month)),
      ]);

      // imports
      this.imports.set(
        (imports || []).slice().sort((a, b) => (b.id ?? 0) - (a.id ?? 0))
      );

      // unmatched (support both shapes: {data: []} OR {items: []})
      const rawList: any[] =
        ((unmatched as any)?.items as any[]) ??
        ((unmatched as any)?.data as any[]) ??
        [];

      const rows: AttendanceUnmatchedRowDto[] = (rawList || []).map(
        (r: any, idx: number) => {
          const key =
            (r?.key && String(r.key)) ||
            `${month}-${idx}-${r?.empNo || ''}-${r?.acNo || ''}-${r?.name || ''}`;

          // remove key from original r to avoid duplication/overwrite issues
          const { key: _ignored, ...rest } = r || {};
          return { ...rest, key } as AttendanceUnmatchedRowDto;
        }
      );

      this.importInfo.set((unmatched as any) || null);
      this.unmatchedRows.set(rows);

      if (rows.length > 0) this.selectedRowKey.set(rows[0].key);

      this.state.set('success');
    } catch (e: any) {
      console.error('Mapping load error:', e);
      this.state.set('error');
      this.errorMsg.set(e?.error?.message || e?.message || 'Failed to load mapping data');
    }
  }

  goToImport(): void {
    this.router.navigateByUrl('/hr/attendance/import');
  }

  goToOverview(): void {
    this.router.navigateByUrl('/hr/attendance');
  }

  selectRow(row: AttendanceUnmatchedRowDto): void {
    this.selectedRowKey.set(row.key);
    this.successMsg.set(null);
    this.saveState.set('idle');
  }

  selectEmployee(emp: EmployeeSearchItemDto): void {
    this.selectedEmployeeId.set(emp.id);
    this.successMsg.set(null);
    this.saveState.set('idle');
  }

  clearEmployeeSelection(): void {
    this.selectedEmployeeId.set(null);
  }

  /**
   * ✅ Backend contract:
   * PUT /api/attendance/mapping/:employeeId
   * body: { attendanceEmpNo, attendanceAcNo, notes }
   *
   * ✅ Service expected signature:
   * upsertMapping(employeeId: number, payload: { attendanceEmpNo?: string|null, attendanceAcNo?: string|null, notes?: string|null })
   */
  async mapSelected(): Promise<void> {
    if (!this.canMap()) return;

    const month = this.form.controls.month.value!;
    const row: any = this.selectedRow()!;
    const employeeId = this.selectedEmployeeId()!;
    const mapEmpNo = !!this.form.controls.mapEmpNo.value;
    const mapAcNo = !!this.form.controls.mapAcNo.value;

    const attendanceEmpNo =
      mapEmpNo && row.empNo && String(row.empNo).trim()
        ? String(row.empNo).trim()
        : null;

    const attendanceAcNo =
      mapAcNo && row.acNo && String(row.acNo).trim()
        ? String(row.acNo).trim()
        : null;

    this.saveState.set('saving');
    this.errorMsg.set(null);
    this.successMsg.set(null);

    // optimistic remove (UX)
    const current = this.unmatchedRows();
    const newList = current.filter((x) => x.key !== row.key);
    this.unmatchedRows.set(newList);
    this.selectedRowKey.set(newList.length > 0 ? newList[0].key : null);

    try {
      // ✅ save mapping
await firstValueFrom(
  this.svc.upsertMapping({
    employeeId,
    attendanceEmpNo,
    attendanceAcNo,
    notes: `mapped from month ${month}`,
  } as any)
);


      // ✅ recompute to refresh summaries + unmatched server-side
      await firstValueFrom(this.svc.recomputeMonth(month));

      this.saveState.set('success');
      this.successMsg.set('Mapping saved + recompute done. Refreshing…');

      await this.load();
    } catch (e: any) {
      console.error('mapSelected error:', e);

      // rollback optimistic remove if failed
      this.unmatchedRows.set(current);
      this.selectedRowKey.set(row.key);

      this.saveState.set('error');
      this.errorMsg.set(e?.error?.message || e?.message || 'Failed to save mapping');
    }
  }

  async recompute(): Promise<void> {
    const month = this.form.controls.month.value || '';
    if (!month) return;

    this.saveState.set('saving');
    this.errorMsg.set(null);
    this.successMsg.set(null);

    try {
      await firstValueFrom(this.svc.recomputeMonth(month));
      this.saveState.set('success');
      this.successMsg.set('Recompute triggered successfully. Refreshing…');
      await this.load();
    } catch (e: any) {
      console.error('recompute error:', e);
      this.saveState.set('error');
      this.errorMsg.set(e?.error?.message || e?.message || 'Failed to trigger recompute');
    }
  }

  // helpers
  getCurrentMonth(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  formatRowTitle(r: AttendanceUnmatchedRowDto): string {
    const anyR: any = r as any;
    const parts: string[] = [];
    if (anyR.nationalId) parts.push(`NID: ${anyR.nationalId}`);
    if (r.empNo) parts.push(`EmpNo: ${r.empNo}`);
    if (r.acNo) parts.push(`AC: ${r.acNo}`);
    return parts.join(' • ') || 'Unmatched row';
  }
}
