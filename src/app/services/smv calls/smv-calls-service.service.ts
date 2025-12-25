// src/app/services/smv calls/smv-calls-service.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ApiUser } from '../users/users-service.service';

export type CallStatus = 'pending' | 'completed' | 'cancelled' | 'rescheduled';
export type SmartOrSmv = 'smart' | 'smv';

export interface SmvCall {
  id: number;
  assignee_id: number;
  created_by_id: number;

  date?: string | null;
  name?: string | null;
  phone?: string | null;
  vehicle_type?: string | null;
  government?: string | null;
  call_feedback?: string | null;
  whatsapp_status?: string | null;
  comment?: string | null;
  smart_or_smv?: SmartOrSmv | null;
  second_call_comment?: string | null;

  status: CallStatus;
}

export interface ImportCallRow {
  date?: string;
  name?: string;
  phone?: string;
  vehicle_type?: string;
  government?: string;
  call_feedback?: string;
  whatsapp_status?: string;
  comment?: string;
  smart_or_smv?: SmartOrSmv | '';
  second_call_comment?: string;
  status?: CallStatus;
}

export interface ImportResult {
  createdCount: number;
  errorCount: number;
  errors: { index: number; message: string; row: any }[];
}

@Injectable({ providedIn: 'root' })
export class SmvCallsServiceService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/calls`;

  /** Operation staff list */
  getOperationStaff(onlyActive = true) {
    let params = new HttpParams();
    if (onlyActive) params = params.set('active', 'true');

    return this.http.get<ApiUser[]>(
      `${environment.apiUrl}/auth/operation/staff`,
      { params }
    );
  }

  /** Calls لأساين واحد (manager view) */
  getCallsByAssignee(assigneeId: number) {
    return this.http.get<SmvCall[]>(`${this.baseUrl}/by-assignee/${assigneeId}`);
  }

  /** Calls للمستخدم الحالي (senior / junior) */
  getMyCalls(opts?: { status?: CallStatus; fromDate?: string; toDate?: string }) {
    let params = new HttpParams();
    if (opts?.status) params = params.set('status', opts.status);
    if (opts?.fromDate) params = params.set('fromDate', opts.fromDate);
    if (opts?.toDate) params = params.set('toDate', opts.toDate);

    return this.http.get<SmvCall[]>(`${this.baseUrl}/my/all`, { params });
  }

  /** Update call (status / feedback / whatsapp / comments ..) */
  updateCall(id: number, payload: Partial<SmvCall> & { status?: CallStatus }) {
    return this.http.patch<SmvCall>(`${this.baseUrl}/${id}`, payload);
  }

  /** Import calls من Excel */
  importCalls(payload: { rows: ImportCallRow[]; assigneeId?: number; assigneeIds?: number[] }) {
    return this.http.post<ImportResult>(`${this.baseUrl}/import`, payload);
  }
}
