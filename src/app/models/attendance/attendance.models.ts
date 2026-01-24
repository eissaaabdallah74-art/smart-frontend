export interface EmployeeLiteDto {
  id: number;
  fullName: string;
  nationalId?: string;
}

export interface AttendanceImportDto {
  id: number;
  month: string; // YYYY-MM
  status: 'processing' | 'done' | 'failed';
  originalFilename?: string | null;
  uploadedBy?: number | null;

  workingDaysCount: number;
  rowsCount: number;
  matchedRowsCount: number;
  unmatchedRowsCount: number;

  createdAt?: string;
  updatedAt?: string;

  // backend may send sample json
  unmatchedSampleJson?: any[] | null;
}

export interface AttendanceMonthlySummaryRowDto {
  id: number;
  importId: number;
  employeeId: number;
  month: string;

  graceUsedCount: number;

  totalLateMinutes: number;
  totalEffectiveLateMinutes: number;

  totalExcuseMinutes: number;
  excusesCount: number;

  absentDays: number;

  totalLatePenaltyDays: number;
  totalAbsentPenaltyDays: number;
  totalPenaltyDays: number;

  // may be hidden for HR if includeSalary not allowed
  salaryGrossUsed?: number | null;
  dayRate?: number | null;
  deductionAmount?: number | null;

  computedAt?: string;

  employee?: EmployeeLiteDto;
}

export interface AttendanceMonthlySummaryResponseDto {
  month: string;
  importId: number | null;
  workingDaysCount: number;
  data: AttendanceMonthlySummaryRowDto[];
}



export interface AttendanceUnmatchedRowDto {
  key: string; // unique per row (backend preferred)
  empNo?: string | null;
  acNo?: string | null;
  name?: string | null;

  // optional (if backend provides)
  date?: string | null;
  lateMinutes?: number | null;
  absent?: boolean | null;

  raw?: any;
}

export interface AttendanceUnmatchedResponseDto {
  month: string; // YYYY-MM
  importId: number | null;
  workingDaysCount: number;
  data: AttendanceUnmatchedRowDto[];
}

export interface AttendanceMappingUpsertDto {
  employeeId: number;
  month: string;

  // map identifiers from sheet
  empNo?: string | null;
  acNo?: string | null;
}

export interface EmployeesListResponseDto<T> {
  total: number;
  limit: number;
  offset: number;
  data: T[];
}

export interface EmployeeSearchItemDto {
  id: number;
  fullName: string;
  nationalId?: string;
  employment?: {
    department?: string | null;
    companyNumber?: string | null;
    corporateEmail?: string | null;
  } | null;
}
