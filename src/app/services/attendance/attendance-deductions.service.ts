import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpEvent, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import {
  AttendanceImportDto,
  AttendanceMappingUpsertDto,
  AttendanceMonthlySummaryResponseDto,
  AttendanceUnmatchedResponseDto,
  EmployeeSearchItemDto,
  EmployeesListResponseDto,
} from '../../models/attendance/attendance.models';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AttendanceDeductionsService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/attendance`;

  listImports(month?: string) {
    let params = new HttpParams();
    if (month) params = params.set('month', month);

    return this.http.get<AttendanceImportDto[]>(`${this.baseUrl}/imports`, {
      params,
    });
  }

  getMonthlySummary(month: string, includeSalary = false) {
    let params = new HttpParams().set('month', month);
    if (includeSalary) params = params.set('includeSalary', 'true');

    return this.http.get<AttendanceMonthlySummaryResponseDto>(
      `${this.baseUrl}/monthly-summary`,
      { params }
    );
  }

  importSheetWithProgress(file: File): Observable<HttpEvent<any>> {
    const form = new FormData();
    form.append('file', file);

    return this.http.post<any>(`${this.baseUrl}/import`, form, {
      reportProgress: true,
      observe: 'events',
    });
  }

  getUnmatchedRows(month: string) {
    const params = new HttpParams().set('month', month);
    return this.http.get<AttendanceUnmatchedResponseDto>(
      `${this.baseUrl}/unmatched`,
      { params }
    );
  }

  // ✅ FIX: align with backend: PUT /mapping/:employeeId
upsertMapping(payload: { employeeId: number; empNo?: string | null; acNo?: string | null; notes?: string | null }) {
  return this.http.post<any>(`${this.baseUrl}/mapping`, payload);
}



getEmployeeMonthDetails(employeeId: number, month: string, includeSalary = false) {
  return this.http.get<any>(`${this.baseUrl}/employee/${employeeId}`, {
    params: { month, includeSalary: String(includeSalary) },
  });
}


  // ✅ FIX: recompute exists in backend now
  recomputeMonth(month: string) {
    const params = new HttpParams().set('month', month);
    return this.http.post<{ ok: boolean; importId: number }>(
      `${this.baseUrl}/recompute`,
      null,
      { params }
    );
  }

  // employees search (from your existing /api/employees endpoint)
  searchEmployees(q: string, limit = 20, offset = 0) {
    let params = new HttpParams()
      .set('limit', String(limit))
      .set('offset', String(offset));

    if (q && q.trim()) params = params.set('q', q.trim());

    return this.http.get<EmployeesListResponseDto<EmployeeSearchItemDto>>(
      `${environment.apiUrl}/employees`,
      { params }
    );
  }

  getEmployeeMonth(employeeId: number, month: string, includeSalary = false) {
  let params = new HttpParams().set('month', month);
  if (includeSalary) params = params.set('includeSalary', 'true');

  return this.http.get<EmployeeAttendanceMonthDto>(
    `${this.baseUrl}/employee/${employeeId}`,
    { params }
  );
}


  setItemException(employeeId: number, itemId: number, isException: boolean) {
    return this.http.patch<{ ok: boolean }>(
      `${this.baseUrl}/employee/${employeeId}/items/${itemId}`,
      { isException }
    );
  }

  addManualItem(employeeId: number, payload: ManualAttendanceItemCreateDto) {
    return this.http.post<{ ok: boolean; itemId?: number }>(
      `${this.baseUrl}/employee/${employeeId}/manual`,
      payload
    );
  }

deleteManualItem(employeeId: number, manualId: number) {
  return this.http.delete(`${this.baseUrl}/employee/${employeeId}/manual/${manualId}`)
}

}

/**
 * ====== DTOs used by HrAttendanceEmployeeComponent ======
 */
export type AttendanceItemType = 'late' | 'absent' | 'manual';

export interface EmployeeAttendanceMonthDto {
  employee: {
    id: number;
    fullName: string;
    department?: string | null;
    jobTitle?: string | null;
  };

  month: string; // YYYY-MM
  workingDaysCount: number;

  payroll: {
    grossSalary: number;
    dailyRate: number;
  };

  totals: {
    totalDeductionAmount: number;
    netSalary: number;
  };

  items: Array<{
    id: number;
    date: string;
    type: AttendanceItemType;
    lateMinutes?: number | null;
    deductionDays: number;
    amount: number;
    isException: boolean;
    note?: string | null;
    source?: 'auto' | 'manual';
  }>;
}

export interface ManualAttendanceItemCreateDto {
  date: string;
  direction: 'deduct' | 'restore';
  amount?: number;
  deductionDays?: number;
  note: string;
}
