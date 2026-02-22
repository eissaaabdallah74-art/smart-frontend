import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';

export type LoanStatus = 'pending' | 'approved' | 'rejected' | 'closed' | 'cancelled';
export type LoanPolicyType = 'annual_75_once' | 'triple_30_three';

export interface EmployeeLoanPolicyDto {
  employeeId: number;
  policyType: LoanPolicyType;
  notes?: string | null;
}

export interface EmployeeLoanEligibilityDto {
  year: number;

  // legacy
  policyType: LoanPolicyType | null;
  hasActiveLoan: boolean;

  annual75Used: boolean;
  triple30UsedCount: number;

  maxPercent: number;
  maxTimesPerYear: number;
  allowedInstallments: number[];

  grossSalary?: number | null;
  maxAmountAllowed?: number | string | null;

  message?: string | null;

  // ✅ new
  perPolicy?: Partial<
    Record<
      LoanPolicyType,
      {
        policyType: LoanPolicyType;
        maxPercent: number;
        maxTimesPerYear: number;
        allowedInstallments: number[];
        maxAmountAllowed?: number | string | null;

        used?: number;
        usedText?: string;

        annual75Used?: boolean;
        triple30UsedCount?: number;
      }
    >
  >;
}

export interface EmployeeLoanDto {
  id: number;
  employeeId: number;

  policyType?: LoanPolicyType;

  amount: number;
  note?: string | null;

  status: LoanStatus;
  managerNote?: string | null;

  installmentsCount: number;
  startMonth?: string | null;

  approvedAt?: string | null;
  approvedById?: number | null;

  createdAt?: string;
  updatedAt?: string;

  employee?: { id: number; fullName: string; nationalId?: string };
}

export interface EmployeeLoanListResponseDto {
  total: number;
  data: EmployeeLoanDto[];
}

@Injectable({ providedIn: 'root' })
export class EmployeeLoansService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/employee-loans`;

  // ===== Employee side =====
  getMySummary(year?: number): Observable<EmployeeLoanEligibilityDto> {
    let params = new HttpParams();
    if (year) params = params.set('year', String(year));
    return this.http.get<EmployeeLoanEligibilityDto>(`${this.baseUrl}/me/summary`, { params });
  }

  getMyLoans(params?: { month?: string; status?: LoanStatus; q?: string }): Observable<EmployeeLoanDto[]> {
    let p = new HttpParams();
    if (params?.month) p = p.set('month', params.month);
    if (params?.status) p = p.set('status', params.status);
    if (params?.q) p = p.set('q', params.q);
    return this.http.get<EmployeeLoanDto[]>(`${this.baseUrl}/me`, { params: p });
  }

  createLoan(body: {
    amount: number;
    policyType: LoanPolicyType;
    installmentsCount: 1 | 2 | 3;
    note?: string;
  }): Observable<EmployeeLoanDto> {
    return this.http.post<EmployeeLoanDto>(`${this.baseUrl}`, body);
  }

  // ===== Admin/HR side =====
  listLoans(params?: {
    status?: LoanStatus;
    month?: string;
    employeeId?: number;
    q?: string;
    limit?: number;
    offset?: number;
  }): Observable<EmployeeLoanListResponseDto> {
    let p = new HttpParams();
    if (params?.status) p = p.set('status', params.status);
    if (params?.month) p = p.set('month', params.month);
    if (params?.employeeId) p = p.set('employeeId', String(params.employeeId));
    if (params?.q) p = p.set('q', params.q);
    if (typeof params?.limit !== 'undefined') p = p.set('limit', String(params.limit));
    if (typeof params?.offset !== 'undefined') p = p.set('offset', String(params.offset));
    return this.http.get<EmployeeLoanListResponseDto>(`${this.baseUrl}`, { params: p });
  }

  approveLoan(id: number, body: { managerNote?: string; startMonth?: string }): Observable<EmployeeLoanDto> {
    return this.http.patch<EmployeeLoanDto>(`${this.baseUrl}/${id}/approve`, body);
  }

  rejectLoan(id: number, body: { managerNote?: string }): Observable<EmployeeLoanDto> {
    return this.http.patch<EmployeeLoanDto>(`${this.baseUrl}/${id}/reject`, body);
  }
}
