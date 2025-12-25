// src/app/pending-request/pending-request-service.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type PendingRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type PendingRequestPriority = 'low' | 'medium' | 'high' | 'urgent';

export type VehicleType =
  | 'SEDAN'
  | 'VAN'
  | 'BIKE'
  | 'DABABA'
  | 'NKR'
  | 'TRICYCLE'
  | 'JUMBO_4'
  | 'JUMBO_6'
  | 'HELPER'
  | 'DRIVER'
  | 'WORKER';

export interface PendingRequestItem {
  id?: number;
  pendingRequestId?: number;
  vehicleType: VehicleType;
  vehicleCount: number;
  orderPrice?: number | null;
  guaranteeMinOrders?: number | null;
  fixedAmount?: number | null;
  allowanceAmount?: number | null;
  totalAmount?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface PendingRequest {
  id?: number;
  clientId: number;
  hubId?: number | null;
  zoneId?: number | null;
  requestDate: string; // yyyy-MM-dd
  billingMonth?: string | null;
  status: PendingRequestStatus;

  // خليها optional على read عشان لو backend مش بيرجعها ما تكسرش UI
  priority?: PendingRequestPriority | null;

  notes?: string | null;
  createdBy?: number | null;
  updatedBy?: number | null;
  createdAt?: string;
  updatedAt?: string;

  client?: { id: number; name: string };
  hub?: { id: number; name: string };
  zone?: { id: number; name: string };

  items: PendingRequestItem[];
}

export interface PendingRequestFilters {
  clientId?: number;
  hubId?: number;
  zoneId?: number;
  status?: PendingRequestStatus | '';
  priority?: PendingRequestPriority | '';
  q?: string;
}

export type CreatePendingRequestDto = {
  clientId: number;
  hubId?: number | null;
  zoneId?: number | null;
  requestDate: string; // yyyy-MM-dd
  billingMonth?: string | null;
  status: PendingRequestStatus;
  priority: PendingRequestPriority;
  notes?: string | null;
  items: Array<{
    vehicleType: VehicleType;
    vehicleCount: number;
    orderPrice?: number | null;
    guaranteeMinOrders?: number | null;
    fixedAmount?: number | null;
    allowanceAmount?: number | null;
    totalAmount?: number | null;
  }>;
};

export interface BulkImportPendingRequestsPayload {
  requests: CreatePendingRequestDto[];
}

export interface BulkImportError {
  index: number;
  message: string;
}

export interface BulkImportResult {
  total: number;
  createdCount: number;
  updatedCount?: number;
  skippedCount?: number;
  failedCount: number;
  errors?: BulkImportError[];
}

@Injectable({ providedIn: 'root' })
export class PendingRequestServiceService {
  private readonly baseUrl = `${environment.apiUrl}/pending-requests`;

  constructor(private http: HttpClient) {}

  getAll(filters: PendingRequestFilters = {}): Observable<PendingRequest[]> {
    let params = new HttpParams();

    if (filters.clientId) params = params.set('clientId', String(filters.clientId));
    if (filters.hubId) params = params.set('hubId', String(filters.hubId));
    if (filters.zoneId) params = params.set('zoneId', String(filters.zoneId));
    if (filters.status) params = params.set('status', filters.status);
    if (filters.priority) params = params.set('priority', filters.priority);
    if (filters.q) params = params.set('q', filters.q);

    return this.http.get<PendingRequest[]>(this.baseUrl, { params });
  }

  getById(id: number): Observable<PendingRequest> {
    return this.http.get<PendingRequest>(`${this.baseUrl}/${id}`);
  }

  create(payload: CreatePendingRequestDto): Observable<PendingRequest> {
    return this.http.post<PendingRequest>(this.baseUrl, payload);
  }

  update(id: number, payload: Partial<PendingRequest>): Observable<PendingRequest> {
    return this.http.put<PendingRequest>(`${this.baseUrl}/${id}`, payload);
  }

  delete(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/${id}`);
  }

  // Bulk import (UI هيتعامل مع Excel ويحوّله JSON قبل الإرسال)
  bulkImport(payload: BulkImportPendingRequestsPayload): Observable<BulkImportResult> {
    return this.http.post<BulkImportResult>(`${this.baseUrl}/bulk-import`, payload);
  }
}
