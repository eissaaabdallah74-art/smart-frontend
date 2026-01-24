import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type AuthRole =
  | 'admin'
  | 'crm'
  | 'operation'
  | 'hr'
  | 'finance'
  | 'supply_chain';

export type AuthPosition = 'manager' | 'supervisor' | 'senior' | 'junior';

export type MaritalStatus =
  | 'single'
  | 'married'
  | 'divorced'
  | 'widowed'
  | 'engaged'
  | 'unknown';

export type Religion = 'muslim' | 'christian' | 'other' | 'unknown';

export interface AuthAccountSummary {
  id: number;
  fullName: string;
  email: string;
  role: AuthRole;
  position?: AuthPosition | null;
  isActive: boolean;
  hireDate?: string | null;
  terminationDate?: string | null;
  creationDate?: string | null;
}

export interface EmployeeEmployment {
  employeeId: number;
  isWorking: boolean;
  department?: string | null;
  jobTitle?: string | null;
  corporateEmail?: string | null;
  hireDate?: string | null;
  terminationDate?: string | null;
  nationalIdExpiryDate?: string | null;
  companyNumber?: string | null;
  personalPhone?: string | null;

  annualLeaveBalance: number;
  annualLeaveUsed: number;
  annualLeaveRemaining: number;

  missingPapersText?: string | null;
  companyCode?: string | null;
  sheetLastUpdateAt?: string | null;
  adminNotes?: string | null;
}

export type InsuranceStatus = 'done' | 'pending' | 'not_insured';

export interface EmployeePayrollInsurance {
  employeeId: number;
  medicalInsuranceStatus: InsuranceStatus;
  socialInsuranceStatus: InsuranceStatus;

  grossSalary?: string | null; // DECIMAL as string
  insuredSalary?: string | null;

  employeeShare11?: string | null;
  employerShare1875?: string | null;
}

export type DocType =
  | 'work_stub'
  | 'insurance_print'
  | 'id_copy'
  | 'criminal_record'
  | 'utilities_receipt'
  | 'personal_photos'
  | 'qualification'
  | 'birth_certificate'
  | 'military_status'
  | 'employment_contract'
  | 'other';

export type DocumentStatus = 'missing' | 'provided' | 'copy' | 'not_applicable';

export interface EmployeeDocument {
  id: number;
  employeeId: number;
  docType: DocType;
  status: DocumentStatus;
  fileUrl?: string | null;
  notes?: string | null;
}

export interface EmployeeEducation {
  id: number;
  employeeId: number;
  degree: string;
  major?: string | null;
  institute?: string | null;
  graduationYear?: number | null;
  grade?: string | null;
}

export interface EmployeeEvaluation {
  id: number;
  employeeId: number;
  year: number;
  performanceRating?: string | null;
  commitmentGrade?: string | null;
}

export interface Employee {
  id: number;
  authUserId?: number | null;

  fullName: string;
  nationalId: string;

  birthDate?: string | null;
  maritalStatus?: MaritalStatus | null;
  religion?: Religion | null;
  nationality?: string | null;
  birthPlace?: string | null;
  fullAddress?: string | null;

  age?: number | null;

  employment?: EmployeeEmployment | null;
  account?: AuthAccountSummary | null;

  documents?: EmployeeDocument[];
  educations?: EmployeeEducation[];
  evaluations?: EmployeeEvaluation[];
}

export interface PagedEmployeesResponse {
  total: number;
  limit: number;
  offset: number;
  data: Employee[];
}

export interface CreateEmployeeDto {
  fullName: string;
  nationalId: string;

  birthDate?: string | null;
  maritalStatus?: MaritalStatus | null;
  religion?: Religion | null;
  nationality?: string | null;
  birthPlace?: string | null;
  fullAddress?: string | null;

  employment?: Partial<EmployeeEmployment>;
}

export interface UpdateEmployeeDto extends Partial<CreateEmployeeDto> {}

export interface UpsertPayrollDto extends Partial<EmployeePayrollInsurance> {}

export interface UpsertDocumentsDto {
  documents: Array<{
    docType: DocType;
    status: DocumentStatus;
    fileUrl?: string | null;
    notes?: string | null;
  }>;
}

export interface ReplaceEducationDto {
  educations: Array<{
    degree: string;
    major?: string | null;
    institute?: string | null;
    graduationYear?: number | null;
    grade?: string | null;
  }>;
}

export interface UpsertEvaluationDto {
  year: number;
  performanceRating?: string | null;
  commitmentGrade?: string | null;
}

export interface CreateAccountForEmployeeDto {
  email?: string;
  role?: AuthRole;
  position?: AuthPosition | null;
  tempPassword?: string;
}

export interface CreateAccountResponse {
  message: string;
  account: {
    id: number;
    email: string;
    role: AuthRole;
    position?: AuthPosition | null;
    isActive: boolean;
  };
  tempPassword: string; // returned once
}

@Injectable({ providedIn: 'root' })
export class EmployeesService {
  private readonly baseUrl = `${environment.apiUrl}/employees`;

  constructor(private http: HttpClient) {}

  getEmployees(params: {
    q?: string;
    department?: string;
    isWorking?: boolean;
    hasAccount?: boolean;
    includeAccount?: boolean;
    limit?: number;
    offset?: number;
  }): Observable<PagedEmployeesResponse> {
    let p = new HttpParams();

    if (params.q) p = p.set('q', params.q);
    if (params.department) p = p.set('department', params.department);
    if (typeof params.isWorking !== 'undefined')
      p = p.set('isWorking', String(params.isWorking));
    if (typeof params.hasAccount !== 'undefined')
      p = p.set('hasAccount', String(params.hasAccount));
    if (typeof params.includeAccount !== 'undefined')
      p = p.set('includeAccount', String(params.includeAccount));

    if (typeof params.limit !== 'undefined') p = p.set('limit', String(params.limit));
    if (typeof params.offset !== 'undefined') p = p.set('offset', String(params.offset));

    return this.http.get<PagedEmployeesResponse>(this.baseUrl, { params: p });
  }

  getEmployeeById(id: number): Observable<Employee> {
    return this.http.get<Employee>(`${this.baseUrl}/${id}`);
  }

  createEmployee(body: CreateEmployeeDto): Observable<Employee> {
    return this.http.post<Employee>(this.baseUrl, body);
  }

  updateEmployee(id: number, body: UpdateEmployeeDto): Observable<Employee> {
    return this.http.put<Employee>(`${this.baseUrl}/${id}`, body);
  }

  // Payroll
  getPayroll(employeeId: number): Observable<EmployeePayrollInsurance | null> {
    return this.http.get<EmployeePayrollInsurance | null>(`${this.baseUrl}/${employeeId}/payroll`);
  }

  upsertPayroll(employeeId: number, body: UpsertPayrollDto): Observable<EmployeePayrollInsurance> {
    return this.http.put<EmployeePayrollInsurance>(`${this.baseUrl}/${employeeId}/payroll`, body);
  }

  // Documents
  listDocuments(employeeId: number): Observable<EmployeeDocument[]> {
    return this.http.get<EmployeeDocument[]>(`${this.baseUrl}/${employeeId}/documents`);
  }

  upsertDocuments(employeeId: number, body: UpsertDocumentsDto): Observable<EmployeeDocument[]> {
    return this.http.put<EmployeeDocument[]>(`${this.baseUrl}/${employeeId}/documents`, body);
  }

  // Education
  listEducation(employeeId: number): Observable<EmployeeEducation[]> {
    return this.http.get<EmployeeEducation[]>(`${this.baseUrl}/${employeeId}/education`);
  }

  replaceEducation(employeeId: number, body: ReplaceEducationDto): Observable<EmployeeEducation[]> {
    return this.http.put<EmployeeEducation[]>(`${this.baseUrl}/${employeeId}/education`, body);
  }

  // Evaluation
  upsertEvaluation(employeeId: number, body: UpsertEvaluationDto): Observable<EmployeeEvaluation> {
    return this.http.post<EmployeeEvaluation>(`${this.baseUrl}/${employeeId}/evaluation`, body);
  }

  // Create account
  createAccountForEmployee(employeeId: number, body: CreateAccountForEmployeeDto): Observable<CreateAccountResponse> {
    return this.http.post<CreateAccountResponse>(`${this.baseUrl}/${employeeId}/create-account`, body);
  }
}
