// src/app/services/users/users-service.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type UserRole =
  | 'admin'
  | 'crm'
  | 'operation'
  | 'hr'
  | 'finance'
  | 'supply_chain';

export type UserPosition = 'manager' | 'supervisor' | 'senior' | 'junior';

/** NEW: employee dropdown item */
export interface EmployeeOption {
  id: number;
  fullName: string;
  authUserId: number | null;
  corporateEmail: string | null;
  department: string | null;
  jobTitle: string | null;
  isWorking: boolean | null;
}

/** NEW: optional employee profile returned when includeEmployee=true */
export interface EmployeeProfileSummary {
  id: number;
  authUserId?: number | null;
  fullName?: string;
  employment?: {
    corporateEmail?: string | null;
  } | null;
}

export interface ApiUser {
  id: number;
  fullName: string;
  email: string;
  role: UserRole;
  position?: UserPosition | null;
  isActive: boolean;
  hireDate?: string | null;
  terminationDate?: string | null;
  creationDate: string;
  created_at?: string;
  updated_at?: string;

  /** NEW */
  employeeProfile?: EmployeeProfileSummary | null;
}

export interface CreateUserDto {
  fullName: string;
  email: string;
  password: string;
  role?: UserRole;
  position?: UserPosition | null;
  isActive?: boolean;
  hireDate?: string | null;
  terminationDate?: string | null;

  /** NEW */
  employeeId?: number | null;
}

export interface UpdateUserDto {
  fullName?: string;
  email?: string;
  password?: string;
  role?: UserRole;
  position?: UserPosition | null;
  isActive?: boolean;
  hireDate?: string | null;
  terminationDate?: string | null;

  /** NEW */
  employeeId?: number | null;
}

@Injectable({
  providedIn: 'root',
})
export class UsersServiceService {
  private readonly baseUrl = `${environment.apiUrl}/auth/users`;

  constructor(private http: HttpClient) {}

  getUsers(params?: {
    role?: UserRole;
    active?: boolean;
    q?: string;

    /** NEW */
    includeEmployee?: boolean;
  }): Observable<ApiUser[]> {
    let httpParams = new HttpParams();
    if (params?.role) httpParams = httpParams.set('role', params.role);
    if (params?.active !== undefined)
      httpParams = httpParams.set('active', String(params.active));
    if (params?.q) httpParams = httpParams.set('q', params.q);

    // NEW
    if (params?.includeEmployee !== undefined) {
      httpParams = httpParams.set('includeEmployee', String(params.includeEmployee));
    }

    return this.http.get<ApiUser[]>(this.baseUrl, { params: httpParams });
  }

  getUser(id: number, params?: { includeEmployee?: boolean }): Observable<ApiUser> {
    let httpParams = new HttpParams();
    if (params?.includeEmployee !== undefined) {
      httpParams = httpParams.set('includeEmployee', String(params.includeEmployee));
    }
    return this.http.get<ApiUser>(`${this.baseUrl}/${id}`, { params: httpParams });
  }

  createUser(body: CreateUserDto): Observable<ApiUser> {
    return this.http.post<ApiUser>(this.baseUrl, body);
  }

  updateUser(id: number, body: UpdateUserDto): Observable<ApiUser> {
    return this.http.put<ApiUser>(`${this.baseUrl}/${id}`, body);
  }

  deleteUser(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  // ================= NEW: Employees dropdown =================
  // GET /api/auth/employees/available?q=&isWorking=&department=&includeLinked=
  getAvailableEmployees(params?: {
    q?: string;
    isWorking?: boolean;
    department?: string;
    includeLinked?: boolean;
  }): Observable<EmployeeOption[]> {
    const url = `${environment.apiUrl}/auth/employees/available`;
    let httpParams = new HttpParams();

    if (params?.q) httpParams = httpParams.set('q', params.q);
    if (typeof params?.isWorking !== 'undefined')
      httpParams = httpParams.set('isWorking', String(params.isWorking));
    if (params?.department) httpParams = httpParams.set('department', params.department);
    if (typeof params?.includeLinked !== 'undefined')
      httpParams = httpParams.set('includeLinked', String(params.includeLinked));

    return this.http.get<EmployeeOption[]>(url, { params: httpParams });
  }
}
