// src/app/services/audit-logs/audit-logs-service.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'INVENTORY_DECREMENT'
  | string;

export interface ApiAuditActor {
  id: number;
  fullName: string;
}

export interface ApiAuditChange {
  field: string;
  before: any;
  after: any;
}

export interface ApiAuditLog {
  id: number;

  entity: string;
  entityId: number;
  action: AuditAction;

  summary?: string | null;
  changes?: any | null;
  meta?: any | null;

  requestId?: string | null;
  actorId?: number | null;
  actor?: ApiAuditActor | null;     // from include
  actorName?: string | null;        // computed by API
  changeList?: ApiAuditChange[];    // computed by API

  ip?: string | null;
  userAgent?: string | null;
  method?: string | null;
  path?: string | null;

  createdAt?: string;
  updatedAt?: string;
}

export interface AuditLogsQuery {
  entity: string;
  entityId: number;
  limit?: number;
  offset?: number;
}

export interface AuditLogsResponse {
  items: ApiAuditLog[];
  total?: number;
  limit?: number;
  offset?: number;
}

@Injectable({ providedIn: 'root' })
export class AuditLogsServiceService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/audit-logs`;

  getLogs(query: AuditLogsQuery): Observable<AuditLogsResponse> {
    let params = new HttpParams()
      .set('entity', query.entity)
      .set('entityId', String(query.entityId));

    if (query.limit != null) params = params.set('limit', String(query.limit));
    if (query.offset != null) params = params.set('offset', String(query.offset));

    return this.http.get<AuditLogsResponse>(this.baseUrl, { params });
  }
}
