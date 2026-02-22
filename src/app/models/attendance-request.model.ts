export type AttendanceRequestType = 'excuse_minutes' | 'leave_day';
export type AttendanceRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export type LeaveType = 'annual' | 'sick' | 'unpaid' | 'official' | 'other';

export interface AttendanceRequest {
  id: number;
  employeeId: number;
  month: string; // YYYY-MM
  date: string;  // YYYY-MM-DD
  type: AttendanceRequestType;

  minutes?: number | null;
  leaveType?: LeaveType | null;

  note?: string | null;

  status: AttendanceRequestStatus;

  decidedBy?: number | null;
  decidedAt?: string | null;
  decisionNote?: string | null;

  createdAt?: string;
  updatedAt?: string;

  // HR list ممكن يرجّع employee object (لو backend عامل include)
  employee?: {
    id: number;
    fullName: string;
    nationalId?: string | null;
  };
}

export interface CreateRequestDto {
  type: AttendanceRequestType;
  date: string;
  minutes?: number;      // required if excuse_minutes
  leaveType?: LeaveType; // required if leave_day
  note?: string;
}

export interface HrListFilter {
  month?: string;
  status?: AttendanceRequestStatus;
  employeeId?: number;
}
